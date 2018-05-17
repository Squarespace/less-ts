import { Node } from '../../common';
import { Chars } from '../types';
import { LessStream, Parselet, Parselets } from '../stream';
import { parseOperator, Dimension, Operation, Operator } from '../../model';
import { whitespace } from '../../utils';

export class AdditionParselet implements Parselet {

  parse(stm: LessStream): Node | undefined {
    const op0 = stm.parse(Parselets.MULTIPLICATION);
    if (op0 === undefined) {
      return undefined;
    }

    let operation = op0;
    while (true) {
      const operator = this.parseOperator(stm);
      if (operator === undefined) {
        break;
      }
      const op1 = stm.parse(Parselets.MULTIPLICATION);
      if (op1 === undefined) {
        break;
      }
      operation = new Operation(operator, operation, op1);
    }
    return operation;
  }

  /**
   * Parse a single-character addition/subtraction operator, and avoid
   * treating a bare positive/negative number as an operation.
   */
  parseOperator(stm: LessStream): Operator | undefined {
    stm.skipWs();
    const op = stm.peek();
    if (op !== Operator.ADD && op !== Operator.SUBTRACT) {
      return undefined;
    }
    if (whitespace(stm.peekn(1)) || !whitespace(stm.peekn(-1))) {
      stm.seek1();
      return op as Operator;
    }
    return undefined;
  }
}

export class MultiplicationParselet implements Parselet {

  parse(stm: LessStream): Node | undefined {
    const op0 = stm.parse(Parselets.OPERAND);
    if (op0 === undefined) {
      return undefined;
    }

    let operation = op0;
    while (true) {
      stm.skipWs();

      const op = parseOperator(stm.peek());
      if (op !== Operator.MULTIPLY && op !== Operator.DIVIDE) {
        break;
      }

      const ch = stm.peekn(1);
      if (ch === Chars.ASTERISK || ch === Chars.SLASH) {
        // TODO: should be operation, but need to change Java code too
        return op0;
      }

      stm.seek1();
      const op1 = stm.parse(Parselets.OPERAND);
      if (op1 === undefined) {
        break;
      }
      operation = new Operation(op, operation, op1);
    }
    return operation;
  }
}

export class OperandParselet implements Parselet {

  parse(stm: LessStream): Node | undefined {
    let negate = false;
    const ch0 = stm.peek();
    const ch1 = stm.peekn(1);
    if (ch0 === '-' && (ch1 === Chars.AT_SIGN || ch1 === Chars.LEFT_PARENTHESIS)) {
      negate = true;
      stm.seek1();
    }
    const node = stm.parse(Parselets.OPERAND_SUB);
    return node === undefined ? node :
      negate ? new Operation(Operator.MULTIPLY, node, new Dimension(-1, undefined)) : node;
  }
}
