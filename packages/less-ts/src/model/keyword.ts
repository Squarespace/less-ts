import { Buffer, Node, NodeType } from '../common';
import { KeywordColor } from './color';

export class Keyword extends Node {

  constructor(readonly value: string, type: NodeType = NodeType.KEYWORD) {
    super(type);
  }

  equals(n: Node): boolean {
    switch (n.type) {
      case NodeType.KEYWORD:
      case NodeType.TRUE:
      case NodeType.FALSE:
        return this.value === (n as Keyword).value;

      case NodeType.COLOR:
        if (n instanceof KeywordColor) {
          return this.value === (n as KeywordColor).keyword;
        }
        break;
    }
    return false;
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
