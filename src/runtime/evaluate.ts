import { Context, ExecEnv, Node, NodeType } from '../common';
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
import { MixinMatch, MixinResolver, RulesetMatch } from './resolver';

const EMPTY_BLOCK = new Block([]);

export class Evaluator {

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
          const m = (n as Mixin).original as Mixin;
          if (m.closure === undefined) {
            m.closure = env.copy();
          }
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
    const n = orig.copy(env);
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
            const m = (n as Mixin).original as Mixin;
            if (m.closure === undefined) {
              m.closure = env.copy();
            }
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
            break;
          }

        case NodeType.RULESET:
          n = this.evaluateRuleset(env, n as Ruleset, forceImportant);
          break;

        default:
          n = n.eval(env);
          break;
      }

      // TODO: catch, report errors
      // if env.hasError()

      rules[i] = n;
    }
  }

  protected expandMixins(env: ExecEnv, block: Block): void {
    if (!block.hasMixinCalls()) {
      return;
    }

    const { rules } = block;
    for (let i = 0; i < rules.length; i++) {
      const n = rules[i];
      if (n.type === NodeType.MIXIN_CALL) {
        const result = this.executeMixinCall(env, n as MixinCall);
        // Replace mixin call with resulting rules.
        const len = result.rules.length;
        if (len > 0) {
          rules.splice(i, 1, ...result.rules);
        } else {
          rules.splice(i, 1);
        }
        i += len - 1;
        // TODO: block flags
      }
    }
  }

  protected executeMixinCall(env: ExecEnv, call: MixinCall): Block {
    const matcher = new MixinMatcher(env, call);
    const resolver = new MixinResolver(matcher);

    // Attempt to resolve mixins up the stack. Stop at the first
    // set of matches.
    const { frames } = env;
    const start = frames.length - 1;
    let found = false;
    for (let i = start; i >= 0; i--) {
      if (resolver.match(0, frames[i])) {
        found = true;
        break;
      }
    }

    if (!found) {
      return EMPTY_BLOCK;
    }

    // Avoid constructing empty blocks when we
    const { matches } = resolver;
    if (matches.length === 0) {
      return EMPTY_BLOCK;
    }

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
    // TODO: if calls == 0, error / warning
    return block;
  }

  protected executeMixin(env: ExecEnv, collector: Block, matcher: MixinMatcher, match: MixinMatch): boolean {
    const { call } = matcher;
    const mixin = (match.mixin as Mixin).copy();
    const params = mixin.params.eval(env) as MixinParams;
    const bindings = matcher.bind(params);
    env = env.copy();
    const original = (mixin.original || mixin) as Mixin;

    const closureEnv = original.closure;
    if (closureEnv) {
      env.append(closureEnv.frames);
    }

    env.push(bindings);

    const { guard } = mixin;
    if (guard) {
      // Execute the guard condition. If it returns false, we return immediately
      // but return true to indicate we found and evaluated at least one mixin definition.
      const result = guard.eval(env);
      if (result.equals(FALSE)) {
        return true;
      }
    }

    const { ctx } = env;

    // TODO: check mixin recursion depth here

    original.enter();
    ctx.enterMixin();

    env.push(mixin);
    const { block } = mixin;
    this.expandMixins(env, block);
    this.evaluateRules(env, block, call.important);
    for (const rule of block.rules) {
      collector.add(rule);
    }

    ctx.exitMixin();
    original.exit();
    return true;
  }

  protected executeRulesetMixin(env: ExecEnv, collector: Block, matcher: MixinMatcher, match: RulesetMatch): boolean {
    const { call } = matcher;
    const { ctx } = env;
    const { ruleset } = match;

    // TODO: check mixin recursion depth

    ctx.enterMixin();
    const result = this.evaluateRuleset(env, ruleset, call.important);
    ctx.exitMixin();

    for (const n of result.block.rules) {
      collector.add(n);
    }
    return true;
  }

}
