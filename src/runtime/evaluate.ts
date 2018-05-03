import { Context, ExecEnv, NodeType } from '../common';
import {
  Block,
  BlockDirective,
  Definition,
  Directive,
  Media,
  Mixin,
  MixinCall,
  Rule,
  Ruleset,
  Stylesheet,
} from '../model';
import { MixinMatch, MixinMatcher } from './mixin';

export class Evaluator {

  constructor(readonly ctx: Context) {}

  evaluate(sheet: Stylesheet): Stylesheet {
    const env = this.ctx.newEnv();
    return this.evaluateStylesheet(env, sheet);
  }

  protected evaluateBlockDirective(env: ExecEnv, orig: BlockDirective): BlockDirective {
    const n = orig.copy();
    env.push(n);
    this.expandMixins(env, n.block);
    this.evaluateRules(env, n.block, false);
    env.pop();
    return n;
  }

  protected evaluateMedia(env: ExecEnv, orig: Media): Media {
    const n = orig.copy(env);
    env.push(n);
    this.expandMixins(env, n.block);
    this.evaluateRules(env, n.block, false);
    env.pop();
    return n;
  }

  protected evaluateRuleset(env: ExecEnv, input: Ruleset, forceImportant: boolean): Ruleset {
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

  protected evaluateStylesheet(env: ExecEnv, orig: Stylesheet): Stylesheet {
    const n = new Stylesheet(orig.block.copy());
    env.push(n);
    this.expandMixins(env, n.block);
    this.evaluateRules(env, n.block, false);
    env.pop();
    return n;
  }

  protected evaluateRules(env: ExecEnv, block: Block, forceImportant: boolean): void {
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
            m.closure = env;
          }
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

      // TODO: catch errors
      // if env.hasError()

      rules[i] = n;
    }
  }

  protected expandMixins(env: ExecEnv, block: Block): void {
    // TODO: if block.hasMixinCalls flags
    const { rules } = block;
    for (let i = 0; i < rules.length; i++) {
      const n = rules[i];
      if (n.type === NodeType.MIXIN_CALL) {
        const result = this.executeMixinCall(env, n as MixinCall);
        rules.splice(i, 1, ...result.rules);
        i += result.rules.length - 1;

        // TODO: flags
      }
    }
  }

  protected executeMixinCall(env: ExecEnv, call: MixinCall): Block {
    const b = new Block();
    return b;
  }

  protected executeMixin(env: ExecEnv, collector: Block, matcher: MixinMatcher, match: MixinMatch): void {
    //
  }

  protected executeRulesetMixin(env: ExecEnv, collector: Block, matcher: MixinMatcher, match: MixinMatch): void {
    //
  }

}
