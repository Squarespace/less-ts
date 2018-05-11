import { Buffer, ExecEnv, Node, NodeType } from '../common';
import { arrayEquals } from '../utils';

export class Quoted extends Node {

  protected evaluate: boolean = false;

  constructor(
    readonly delim: string,
    public escaped: boolean | number,
    readonly parts: Node[],
    skipEval: boolean = false) {
      super(NodeType.QUOTED);

    if (!skipEval) {
      for (const n of parts) {
        if (n.needsEval()) {
          this.evaluate = true;
          break;
        }
      }
    }
  }

  copy(): Quoted {
    return new Quoted(this.delim, this.escaped, this.parts.slice(0));
  }

  equals(n: Node): boolean {
    if (n.type === NodeType.QUOTED) {
      const o = n as Quoted;
      return this.delim === o.delim
          && this.escaped === o.escaped
          && arrayEquals(this.parts, o.parts);
    }
    return false;
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
