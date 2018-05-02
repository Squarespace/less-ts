import { Buffer, ExecEnv, Node, NodeType } from './types';

export const enum Operator {
  ADD = '+',
  AND = 'and',
  DIVIDE = '/',
  EQUAL = '=',
  GREATER_THAN = '>',
  GREATER_THAN_OR_EQUAL = '>=',
  LESS_THAN = '<',
  LESS_THAN_OR_EQUAL = '<=',
  MULTILY = '*',
  NOT_EQUAL = '<>',
  OR = 'or',
  SUBTRACT = '-'
}

export class Operation extends Node {

  constructor(
    readonly operator: Operator,
    readonly left: Node,
    readonly right: Node
  ) {
    super();
  }

  type(): NodeType {
    return NodeType.OPERATION;
  }

  repr(buf: Buffer): void {
    buf.str('(');
    this.left.repr(buf);
    buf.str(' ').str(this.operator).str(' ');
    this.right.repr(buf);
    buf.str(')');
  }

  needsEval(): boolean {
    return true;
  }

  eval(env: ExecEnv): Node {
    // TODO:
    return this;
  }
}