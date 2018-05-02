import { Buffer, ExecEnv, Node, NodeType } from './types';

export class Quoted extends Node {

  protected evaluate: boolean = false;

  constructor(
    readonly delim: string,
    readonly escaped: boolean | number,
    readonly parts: Node[],
    skipEval: boolean = false) {
      super();

    if (!skipEval) {
      for (const n of parts) {
        if (n.needsEval()) {
          this.evaluate = true;
          break;
        }
      }
    }
  }

  type(): NodeType {
    return NodeType.QUOTED;
  }

  repr(buf: Buffer): void {
    if (this.escaped) {
      buf.str('~');
    }
    buf.str(this.delim);
    const { parts } = this;
    const len = parts.length;
    for (let i = 0; i < len; i++) {
      parts[i].repr(buf);
    }
    buf.str(this.delim);
  }

  needsEval(): boolean {
    return this.evaluate;
  }

  eval(env: ExecEnv): Node {
    if (!this.evaluate) {
      return this;
    }
    const r: Node[] = [];
    for (const n of this.parts) {
      r.push(n.eval(env));
    }
    return new Quoted(this.delim, this.escaped, r, true);
  }

}
