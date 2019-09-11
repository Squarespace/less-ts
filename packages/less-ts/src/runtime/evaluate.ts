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

export class Evaluator {

  // Register closure on a Mixin definition
  private closures: Map<Mixin, ExecEnv> = new Map();

  private closureArrow: MixinClosureArrow =
    ((m: Mixin): ExecEnv | undefined => this.closures.get(m));

  constructor(readonly ctx: Context) { }

  evaluate(env: ExecEnv, block: Block, n: Node): Node {
    switch (n.type) {
      case NodeType.BLOCK_DIRECTIVE:
        return this.evaluateBlockDirective(env, n as BlockDirective);

      case NodeType.DEFINITION:
        {
          const d = n as Definition;
          return new Definition(d.name, d.dereference(env));
        }

      case NodeType.DIRECTIVE:
        {
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

      case NodeType.MIXIN:
        {
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
      switch (n.type) {
        case NodeType.BLOCK_DIRECTIVE:
          n = this.evaluateBlockDirective(env, n as BlockDirective);
          break;

        case NodeType.DEFINITION:
          {
            const d = n as Definition;
            n = new Definition(d.name, d.dereference(env));
            break;
          }

        case NodeType.DIRECTIVE:
          {
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

        case NodeType.MIXIN:
          {
            // Attach a closure to this mixin at the point we evaluate its definition.
            const m = (n as Mixin).original as Mixin;
            this.setClosure(env, m);
            break;
          }

        case NodeType.MIXIN_CALL:
          {
            // TODO: should have all been evaluated.
            break;
          }

        case NodeType.RULE:
          {
            const r = n as Rule;
            if (forceImportant && !r.important) {
              n = new Rule(r.property, r.value.eval(env), true);
            } else {
              n = r.eval(env);
            }
            env.ctx.captureErrors(n, env);
            break;
          }

        case NodeType.RULESET:
          n = this.evaluateRuleset(env, n as Ruleset, forceImportant);
          break;

        default:
          n = n.eval(env);
          break;
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

  protected expandMixins(env: ExecEnv, block: Block): void {
    if (!block.hasMixinCalls()) {
      return;
    }

    const { ctx } = env;
    const { rules } = block;
    for (let i = 0; i < rules.length; i++) {
      const n = rules[i];
      if (n.type === NodeType.MIXIN_CALL) {
        const result = this.executeMixinCall(env, n as MixinCall);
        ctx.captureErrors(n, env);

        const len = result.rules.length;
        if (len > 0) {
          // Replace mixin call site with the result
          rules.splice(i, 1, ...result.rules);
          for (const r of result.rules) {
            block.update(r);
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
      const result = guard.eval(env);
      if (result.equals(FALSE)) {
        ctx.captureErrors(mixin, env);
        return true;
      }
    }

    if (ctx.mixinDepth >= ctx.mixinRecursionLimit) {
      origEnv.errors.push(mixinRecurse(ctx.render(call.selector), ctx.mixinRecursionLimit));
      return true;
    }

    ctx.mixinDepth++;

    env.push(mixin);
    const { block } = mixin;
    this.expandMixins(env, block);
    this.evaluateRules(env, block, call.important);

    for (const rule of block.rules) {
      collector.add(rule);
    }

    ctx.mixinDepth--;

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
    const result = this.evaluateRuleset(env, ruleset, call.important);
    ctx.mixinDepth--;

    for (const n of result.block.rules) {
      collector.add(n);
    }

    return true;
  }
}
