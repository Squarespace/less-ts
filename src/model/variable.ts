import { Buffer, IDefinition, ExecEnv, Node, NodeType } from '../common';
import { Anonymous } from './general';

export class Definition extends Node implements IDefinition {

  private evaluating: boolean = false;

  constructor(
    readonly name: string,
    readonly value: Node) {
    super(NodeType.DEFINITION);
  }

  repr(buf: Buffer): void {
    buf.str(this.name).str(': ');
    this.value.repr(buf);
  }

  eval(env: ExecEnv): Node {
    // Late binding. Definitions must be derefenced to get their value.
    return this;
  }

  dereference(env: ExecEnv): Node {
    if (this.evaluating) {
      return this.value;
    }

    this.evaluating = true;
    const result = this.value.eval(env);
    this.evaluating = false;
    return result;
  }
}

const EMPTY = new Anonymous('');

export class Variable extends Node {

  readonly name: string;
  readonly indirect: boolean;

  constructor(name: string, readonly curly: boolean = false) {
    super(NodeType.VARIABLE);
    if (name.startsWith('@@')) {
      name = name.substring(1);
      this.indirect = true;
    } else {
      this.indirect = false;
    }
    this.name = name;
  }

  repr(buf: Buffer): void {
    if (this.indirect) {
      buf.str('@');
    }
    buf.str('@');
    if (this.curly) {
      buf.str('{');
    }
    buf.str(this.name.substring(1));
    if (this.curly) {
      buf.str('}');
    }
  }

  needsEval(): boolean {
    return true;
  }

  eval(env: ExecEnv): Node {
    const def = env.resolveDefinition(this.name);
    if (!def) {
      return EMPTY;
    }

    const res = def.dereference(env);
    if (!this.indirect) {
      return res;
    }

    const { ctx } = env;
    // TODO: implement escape mode
    return this;
  }
}
