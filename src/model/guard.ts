import { Buffer, ExecEnv, Node, NodeType } from './types';
import { False, True } from './keyword';
import { Operator } from './operation';

export const FALSE = new False();
export const TRUE = new True();

export class Condition extends Node {

  constructor(
    readonly operator: Operator,
    readonly left: Node,
    readonly right: Node,
    readonly negate: boolean | number) {
    super();
  }

  type(): NodeType {
    return NodeType.CONDITION;
  }

  repr(buf: Buffer): void {
    if (this.negate) {
      buf.str('not ');
    }
    const nested = this.left instanceof Condition || this.right instanceof Condition;
    if (!nested) {
      buf.str('(');
    }
    this.left.repr(buf);
    buf.str(' ').str(this.operator).str(' ');
    this.right.repr(buf);
    if (!nested) {
      buf.str(')');
    }
  }

  needsEval(): boolean {
    return true;
  }

  eval(env: ExecEnv): Node {
    // TODO:
    return FALSE;
  }
}

export class Guard extends Node {

  constructor(readonly conditions: Condition[]) {
    super();
  }

  type(): NodeType {
    return NodeType.GUARD;
  }

  repr(buf: Buffer): void {
    const { conditions } = this;
    const len = conditions.length;
    for (let i = 0; i < len; i++) {
      if (i > 0) {
        buf.str(', '); // TODO: could be compressed with listsep
      }
      conditions[i].repr(buf);
    }
  }

  needsEval(): boolean {
    return true;
  }

  eval(env: ExecEnv): Node {
    // TODO:
    return FALSE;
  }

}
