import { Buffer, ExecEnv, Node, NodeType } from './types';

export class Expression extends Node {

  private evaluate: boolean = false;

  constructor(readonly values: Node[], skipEval: boolean = false) {
    super();
    if (!skipEval) {
      for (const v of values) {
        if (v.needsEval()) {
          this.evaluate = true;
          break;
        }
      }
    }
  }

  type(): NodeType {
    return NodeType.EXPRESSION;
  }

  repr(buf: Buffer): void {
    const { values } = this;
    const len = values.length;
    for (let i = 0; i < len; i++) {
      if (i > 0) {
        buf.str(' ');
      }
      values[i].repr(buf);
    }
  }

  needsEval(): boolean {
    return this.evaluate;
  }

  eval(env: ExecEnv): Node {
    if (!this.needsEval()) {
      return this;
    }

    // Special case for single value. We pull it out of the array.
    const values = this.values;
    if (values.length === 1) {
      return this.values[0].eval(env);
    }

    const r: Node[] = [];
    for (const v of values) {
      r.push(v.eval(env));
    }
    return new Expression(r, true);
  }
}

export class ExpressionList extends Node {

  private evaluate: boolean = false;

  constructor(readonly values: Node[], skipEval: boolean = false) {
    super();
    if (!skipEval) {
      for (const v of values) {
        if (v.needsEval()) {
          this.evaluate = true;
          break;
        }
      }
    }
  }

  type(): NodeType {
    return NodeType.EXPRESSION_LIST;
  }

  repr(buf: Buffer): void {
    const { values } = this;
    const len = values.length;
    for (let i = 0; i < len; i++) {
      if (i > 0) {
        buf.listsep();
      }
      values[i].repr(buf);
    }
  }

  needsEval(): boolean {
    return this.evaluate;
  }

  eval(env: ExecEnv): Node {
    if (!this.needsEval()) {
      return this;
    }

    const r: Node[] = [];
    for (const v of this.values) {
      r.push(v.eval(env));
    }
    return new ExpressionList(r, true);
  }

}
