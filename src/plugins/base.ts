import { ExecEnv, Function, LessError, Node } from '../common';
import { ArgSpec } from './args';

export abstract class BaseFunction implements Function {

  readonly spec: ArgSpec;

  constructor(readonly name: string, spec: string) {
    this.spec = new ArgSpec(name, spec);
  }

  validate(env: ExecEnv, args: Node[]): [boolean, LessError[]] {
    return this.spec.validate(env, args);
  }

  abstract invoke(env: ExecEnv, args: Node[]): Node | undefined;

}
