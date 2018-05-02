import { Buffer, ExecEnv, Node, NodeType } from './types';

export class Keyword extends Node {

  constructor(readonly value: string) {
    super();
  }

  type(): NodeType {
    return NodeType.KEYWORD;
  }

  repr(buf: Buffer): void {
    buf.str(this.value);
  }
}

export class False extends Keyword {

  constructor() {
    super('false');
  }

  type(): NodeType {
    return NodeType.FALSE;
  }

}

export class True extends Keyword {

  constructor() {
    super('true');
  }

  type(): NodeType {
    return NodeType.TRUE;
  }

}
