import { Context, Node, Options } from './common';
import { Stylesheet } from './model';
import { renderNode, Evaluator, Renderer, RuntimeBuffer, RuntimeContext } from './runtime';
import { LessStream, Parselet, STYLESHEET } from './parser';

export class LessCompiler {

  constructor(readonly opts: Options) {}

  context(): Context {
    return new RuntimeContext(this.opts, renderNode);
  }

  compile(raw: string): string {
    const ctx = this.context();
    const orig = this.parse(raw) as Stylesheet;
    const evaluator = new Evaluator(ctx);
    const env = ctx.newEnv();
    const evald = evaluator.evaluateStylesheet(env, orig);
    return Renderer.render(ctx, evald).trimRight();
  }

  parse(raw: string, parselet: Parselet[] = STYLESHEET): Node | undefined {
    const ctx = this.context();
    const stm = new LessStream(ctx, raw);
    return stm.parse(parselet);
  }
}
