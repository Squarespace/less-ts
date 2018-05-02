import { Buffer, DefinitionBase, ExecEnv, Node, NodeType } from './types';

export class Definition extends Node implements DefinitionBase {

  private evaluating: boolean = false;

  constructor(
    readonly name: string,
    readonly value: Node) {
    super();
  }

  type(): NodeType {
    return NodeType.DEFINITION;
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
    // TODO:
    return this;
  }
}

export class Variable extends Node {

  readonly name: string;
  readonly indirect: boolean;

  constructor(name: string, readonly curly: boolean = false) {
    super();
    if (name.startsWith('@@')) {
      name = name.substring(1);
      this.indirect = true;
    } else {
      this.indirect = false;
    }
    this.name = name;
  }

  type(): NodeType {
    return NodeType.VARIABLE;
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

    // TODO:
    return this;
  }
}
