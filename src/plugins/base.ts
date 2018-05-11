import { ExecEnv, Function, Node } from '../common';
import { ArgSpec } from './args';

export abstract class BaseFunction implements Function {

  readonly spec: ArgSpec;

  constructor(readonly name: string, spec: string) {
    this.spec = new ArgSpec(spec);
  }

  invoke(env: ExecEnv, args: Node[]): Node | undefined {
    if (!this.spec.validate(args)) {
      return undefined;
    }
    return this._invoke(env, args);
  }

  protected abstract _invoke(env: ExecEnv, args: Node[]): Node | undefined;

}
