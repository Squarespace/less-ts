import { Context, Options } from '../common';
import { RuntimeContext, RuntimeBuffer } from './context';
import { renderNode } from './render';

export class LessCompiler {

  constructor(readonly opts: Options) {}

  context(): Context {
    return new RuntimeContext(this.opts, renderNode);
  }

}
