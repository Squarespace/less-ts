import { Buffer, ExecEnv, Node, NodeType } from '../common';

export class Keyword extends Node {

  constructor(readonly value: string, type: NodeType = NodeType.KEYWORD) {
    super(type);
  }

  repr(buf: Buffer): void {
    buf.str(this.value);
  }
}

export class False extends Keyword {

  constructor() {
    super('false', NodeType.FALSE);
  }

}

export class True extends Keyword {

  constructor() {
    super('true', NodeType.TRUE);
  }

}
