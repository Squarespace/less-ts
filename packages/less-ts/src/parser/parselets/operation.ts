import { Node } from '../../common';
import { Chars } from '../types';
import { LessStream, Parselet, Parselets } from '../stream';
import { parseOperator, Dimension, Operation, Operator, Url } from '../../model';
import { whitespace } from '../../utils';
import { Patch } from '../../compat';
import { FunctionCallParselet } from './function';

export class AdditionParselet implements Parselet {
  parse(stm: LessStream): Node | undefined {
    const op0 = stm.parse(Parselets.MULTIPLICATION);
    if (op0 === undefined) {
      return undefined;
    }

    let operation = op0;
    while (true) {
      // BUG4: a dangling operator (no right operand). Mark so the
      // fixed level can roll it back.
      const pos = stm.mark();
      const operator = this.parseOperator(stm);
      if (operator === undefined) {
        break;
      }
      const op1 = stm.parse(Parselets.MULTIPLICATION);
      if (op1 === undefined) {
        // Legacy: the operator stays consumed. Fixed: roll it back
        // so the enclosing parse fails.
        if (!stm.ctx.compat.enabled(Patch.BUG4)) {
          stm.restore(pos);
        }
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

      // BUG4: restore the operator when the right side fails to
      // parse, so it can be treated as a plain CSS separator
      // (e.g. url(x) / cover center). Legacy: it stays consumed.
      const pos = stm.mark();
      stm.seek1();
      const op1 = stm.parse(Parselets.OPERAND);
      if (op1 === undefined) {
        if (!stm.ctx.compat.enabled(Patch.BUG4)) {
          stm.restore(pos);
        }
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
    const mark = stm.mark();
    // Below the fixed level a value-position call is a plain value,
    // not a math operand: the operand chain stops where the call
    // would start, and the enclosing parse decides the outcome.
    const sub = Parselets.OPERAND_SUB;
    const node = stm.ctx.compat.enabled(Patch.FUNCTION_CALL_IN_VALUE)
      ? stm.parse(sub.filter((p) => !(p instanceof FunctionCallParselet)))
      : stm.parse(sub);
    // url() is a value, not a math operand, e.g. the
    // "background: url(x) / 100% 50%" size/position shorthand.
    if (node instanceof Url) {
      stm.restore(mark);
      return undefined;
    }
    return node === undefined ? node : negate ? new Operation(Operator.MULTIPLY, node, new Dimension(-1, undefined)) : node;
  }
}
