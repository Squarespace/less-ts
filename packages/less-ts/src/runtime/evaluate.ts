import { Context, ExecEnv, Node, NodeType } from '../common';
import { mixinRecurse, mixinUndefined } from '../errors';
import {
  Block,
  BlockDirective,
  Definition,
  Directive,
  FALSE,
  Media,
  Mixin,
  MixinCall,
  MixinParams,
  Rule,
  Ruleset,
  Stylesheet,
} from '../model';
import { MixinMatcher } from './mixin';
import { MixinClosureArrow, MixinMatch, MixinResolver, RulesetMatch } from './resolver';

const EMPTY_BLOCK = new Block([]);

// Node type name for recovery warnings, matching the reference's
// type-based phrasing ('rule', 'definition', ...).
export const droppedTypeName = (n: Node): string => {
  switch (n.type) {
    case NodeType.RULE:
      return 'rule';
    case NodeType.DEFINITION:
      return 'definition';
    case NodeType.RULESET:
      return 'ruleset';
    case NodeType.MEDIA:
      return 'media';
    case NodeType.BLOCK_DIRECTIVE:
      return 'block_directive';
    case NodeType.DIRECTIVE:
      return 'directive';
    case NodeType.MIXIN:
      return 'mixin';
    default:
      return 'node';
  }
};

export class Evaluator {
  // Register closure on a Mixin definition
  private closures: Map<Mixin, ExecEnv> = new Map();

  private closureArrow: MixinClosureArrow = (m: Mixin): ExecEnv | undefined => this.closures.get(m);

  constructor(readonly ctx: Context) {}

  evaluate(env: ExecEnv, block: Block, n: Node): Node {
    switch (n.type) {
      case NodeType.BLOCK_DIRECTIVE:
        return this.evaluateBlockDirective(env, n as BlockDirective);

      case NodeType.DEFINITION: {
        const d = n as Definition;
        return new Definition(d.name, d.dereference(env));
      }

      case NodeType.DIRECTIVE: {
        const d = n.eval(env) as Directive;
        if (d.name === '@charset') {
          if (block.charset === undefined) {
            block.charset = d;
          }
        }
        return d;
      }

      case NodeType.MEDIA:
        return this.evaluateMedia(env, n as Media);

      case NodeType.MIXIN: {
        // Attach a closure to this mixin at the point we evaluate its definition.
        const m = (n as Mixin).original as Mixin;
        this.setClosure(env, m);
        return m;
      }

      case NodeType.MIXIN_CALL:
        return this.executeMixinCall(env, n as MixinCall);

      case NodeType.RULESET:
        return this.evaluateRuleset(env, n as Ruleset, false);

      default:
        return n.eval(env);
    }
  }

  evaluateBlockDirective(env: ExecEnv, orig: BlockDirective): BlockDirective {
    const n = orig.copy();
    env.push(n);
    this.expandMixins(env, n.block);
    this.evaluateRules(env, n.block, false);
    env.pop();
    return n;
  }

  evaluateMedia(env: ExecEnv, orig: Media): Media {
    const n = orig.copy(env);
    env.push(n);
    this.expandMixins(env, n.block);
    this.evaluateRules(env, n.block, false);
    env.pop();
    return n;
  }

  evaluateRuleset(env: ExecEnv, input: Ruleset, forceImportant: boolean | number): Ruleset {
    const orig = input.original as Ruleset;
    const n = input.copy(env);
    env.push(n);
    orig.enter();
    this.expandMixins(env, n.block);
    this.evaluateRules(env, n.block, forceImportant);
    orig.exit();
    env.pop();
    return n;
  }

  evaluateStylesheet(env: ExecEnv, orig: Stylesheet): Stylesheet {
    const n = new Stylesheet(orig.block.copy());
    env.push(n);
    this.expandMixins(env, n.block);
    this.evaluateRules(env, n.block, false);
    env.pop();
    return n;
  }

  protected evaluateRules(env: ExecEnv, block: Block, forceImportant: boolean | number): void {
    const { rules } = block;
    for (let i = 0; i < rules.length; i++) {
      let n = rules[i];
      if (n === undefined) {
        continue;
      }
      const errorsBefore = env.errors.length;
      switch (n.type) {
        case NodeType.BLOCK_DIRECTIVE:
          n = this.evaluateBlockDirective(env, n as BlockDirective);
          break;

        case NodeType.DEFINITION: {
          const d = n as Definition;
          n = new Definition(d.name, d.dereference(env));
          // A member dropped by the recovery check below keeps
          // nothing: its pending warnings stay in the env for the
          // rollback.
          if (!(env.ctx.safeMode() && env.errors.length > errorsBefore)) {
            this.attachWarnings(n, env);
          }
          break;
        }

        case NodeType.DIRECTIVE: {
          const d = n.eval(env) as Directive;
          if (d.name === '@charset') {
            if (block.charset === undefined) {
              block.charset = d;
            }
          }
          n = d;
          break;
        }

        case NodeType.MEDIA:
          n = this.evaluateMedia(env, n as Media);
          break;

        case NodeType.MIXIN: {
          // Attach a closure to this mixin at the point we evaluate its definition.
          const m = (n as Mixin).original as Mixin;
          this.setClosure(env, m);
          break;
        }

        case NodeType.MIXIN_CALL: {
          // Calls are expanded by expandMixins before this pass; a call
          // that survives here has no render representation and is
          // skipped.
          break;
        }

        case NodeType.RULE: {
          const r = n as Rule;
          if (forceImportant && !r.important) {
            n = new Rule(r.property, r.value.eval(env), true);
          } else {
            n = r.eval(env);
          }
          // A member dropped by the recovery check below keeps
          // nothing: no error event, no warning attachment (the
          // pending warnings stay in the env for the rollback).
          if (!(env.ctx.safeMode() && env.errors.length > errorsBefore)) {
            env.ctx.captureErrors(n, env);
            this.attachWarnings(n, env);
          }
          break;
        }

        case NodeType.RULESET:
          n = this.evaluateRuleset(env, n as Ruleset, forceImportant);
          break;

        default:
          n = n.eval(env);
          break;
      }

      if (env.errors.length > errorsBefore && env.ctx.safeMode()) {
        // Best effort: drop this member, warn, and continue with the
        // next sibling. Discarding the env's pending warnings rolls
        // back their budget slots: the failed member's partial
        // warnings neither bleed into the next rule nor consume budget
        // they will never surface in.
        const [first] = env.errors.splice(errorsBefore);
        env.discardWarnings();
        rules[i] = undefined;
        env.ctx.addWarning('eval: dropped ' + droppedTypeName(n) + ': ' + first.message);
        continue;
      }

      rules[i] = n;
    }
  }

  protected setClosure(env: ExecEnv, mixin: Mixin): void {
    let closure = this.closures.get(mixin);
    if (closure === undefined) {
      closure = env.copy();
      this.closures.set(mixin, closure);
    }
  }

  // Pull pending warnings off the environment and attach them to the
  // evaluated rule or definition; they render as a comment before it.
  protected attachWarnings(n: Node, env: ExecEnv): void {
    const w = env.takeWarnings();
    if (w.length > 0 && (n.type === NodeType.RULE || n.type === NodeType.DEFINITION)) {
      (n as Rule).warnings = w;
    }
  }

  protected expandMixins(env: ExecEnv, block: Block): void {
    if (!block.hasMixinCalls()) {
      return;
    }

    const { ctx } = env;
    const { rules } = block;
    for (let i = 0; i < rules.length; i++) {
      const n = rules[i];
      if (n === undefined) {
        continue;
      }
      if (n.type === NodeType.MIXIN_CALL) {
        const call = n as MixinCall;
        const errorsBefore = env.errors.length;
        const result = this.executeMixinCall(env, call);
        if (ctx.safeMode() && env.errors.length > errorsBefore) {
          // Best effort: drop the failing call and continue with the
          // next statement; the call's partial env warnings are
          // discarded, rolling back their budget slots.
          const [first] = env.errors.splice(errorsBefore);
          env.discardWarnings();
          rules[i] = undefined;
          ctx.addWarning('eval: dropped mixin call: ' + first.message);
          continue;
        }
        ctx.captureErrors(call, env);

        const len = result.rules.length;
        if (len > 0) {
          // Replace mixin call site with the result
          rules.splice(i, 1, ...result.rules);
          for (const r of result.rules) {
            if (r !== undefined) {
              block.update(r);
            }
          }
        } else {
          // Snip out the call.
          rules.splice(i, 1);
        }

        // Adjust loop variable based on number of nodes inserted
        i += len - 1;
        block.flags = block.flags || result.flags;
        block.resetVariableCache();
      }
    }
  }

  protected executeMixinCall(env: ExecEnv, call: MixinCall): Block {
    const matcher = new MixinMatcher(env, call);
    const resolver = new MixinResolver(matcher, this.closureArrow);

    const { ctx } = env;

    // Attempt to resolve mixins
    if (!resolver.resolve(env.frames)) {
      env.errors.push(mixinUndefined(ctx.render(call.selector)));
      return EMPTY_BLOCK;
    }

    const { matches } = resolver;

    const block = new Block();
    let calls = 0;
    for (const match of matches) {
      switch (match.kind) {
        case 'mixin':
          if (this.executeMixin(env, block, matcher, match)) {
            calls++;
          }
          break;
        case 'ruleset':
          if (this.executeRulesetMixin(env, block, matcher, match)) {
            calls++;
          }
          break;
      }
    }
    return block;
  }

  protected executeMixin(origEnv: ExecEnv, collector: Block, matcher: MixinMatcher, match: MixinMatch): boolean {
    const { call } = matcher;
    const mixin = (match.mixin as Mixin).copy();
    const params = mixin.params.eval(origEnv) as MixinParams;

    const bindings = matcher.bind(params);
    const env = origEnv.copy();
    const original = (mixin.original || mixin) as Mixin;

    const closureEnv = this.closures.get(original);
    if (closureEnv) {
      env.append(closureEnv.frames);
    }

    env.push(bindings);

    const { ctx } = env;
    const { guard } = mixin;
    if (guard) {
      // Execute the guard condition. If it returns false, we return immediately
      // but return true to indicate we found and evaluated at least one mixin definition.
      const errorsBefore = env.errors.length;
      const result = guard.eval(env);
      if (env.errors.length > errorsBefore) {
        // A guard that fails to evaluate fails the call: strict
        // surfaces the error, safe mode drops the call with a
        // warning. This env is a copy, so the error must reach the
        // caller's env for the drop check to see it.
        origEnv.errors.push(...env.errors.splice(errorsBefore));
        return true;
      }
      if (result.equals(FALSE)) {
        return true;
      }
    }

    if (ctx.mixinDepth >= ctx.mixinRecursionLimit) {
      origEnv.errors.push(mixinRecurse(ctx.render(call.selector), ctx.mixinRecursionLimit));
      return true;
    }

    ctx.mixinDepth++;
    try {
      env.push(mixin);
      const { block } = mixin;
      this.expandMixins(env, block);
      this.evaluateRules(env, block, call.important);

      for (const rule of block.rules) {
        if (rule !== undefined) {
          collector.add(rule);
        }
      }
    } finally {
      // The depth unwinds on every path, failed or not, so a dropped
      // call cannot leave the counter high for the next one.
      ctx.mixinDepth--;
    }

    // Note: env.pop() calls unnecessary here, since we're throwing
    // away the temporary environment.

    ctx.captureErrors(mixin, env);
    return true;
  }

  protected executeRulesetMixin(env: ExecEnv, collector: Block, matcher: MixinMatcher, match: RulesetMatch): boolean {
    const { call } = matcher;
    const { ctx } = env;
    const { ruleset } = match;

    if (ctx.mixinDepth >= ctx.mixinRecursionLimit) {
      env.errors.push(mixinRecurse(ctx.render(call.selector), ctx.mixinRecursionLimit));
      return true;
    }

    ctx.mixinDepth++;
    let result: Ruleset;
    try {
      result = this.evaluateRuleset(env, ruleset, call.important);
    } finally {
      // The depth unwinds on every path, failed or not, so a dropped
      // call cannot leave the counter high for the next one.
      ctx.mixinDepth--;
    }

    for (const n of result.block.rules) {
      if (n !== undefined) {
        collector.add(n);
      }
    }

    return true;
  }
}
