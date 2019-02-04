import { Context, LessErrorEvent, Node, Options } from './common';
import { Stylesheet } from './model';
import { renderNode, Evaluator, Renderer, RuntimeContext } from './runtime';
import { LessStream, Parselet, STYLESHEET } from './parser';
import { ErrorFormatter } from './runtime/errors';

export interface CompileResult {
  css: string;
  errors: LessErrorEvent[];
}

export class LessCompiler {

  constructor(readonly opts: Options) {}

  context(): Context {
    return new RuntimeContext(this.opts, renderNode);
  }

  compile(raw: string): CompileResult {
    const tree = this.parse(raw) as Stylesheet;
    const ctx = this.context();
    const evaluator = new Evaluator(ctx);
    const env = ctx.newEnv();
    const evald = evaluator.evaluateStylesheet(env, tree);
    const css = Renderer.render(ctx, evald).trimRight();
    return {
      css,
      errors: ctx.errors
    };
  }

  parse(raw: string, parselet: Parselet[] = STYLESHEET): Node | undefined {
    const ctx = this.context();
    const stm = new LessStream(ctx, raw);
    return stm.parse(parselet);
  }

  formatErrors(events: LessErrorEvent[], windowSize: number = 4): string[] {
    return new ErrorFormatter(windowSize, renderNode).format(events);
  }
}
