import { Node } from '../../common';
import { Chars } from '../types';
import { LessStream, Parselet, Parselets } from '../stream';
import { parseOperator, Condition, Guard, Operator, TRUE } from '../../model';

export class ConditionParselet implements Parselet {
  parse(stm: LessStream): Node | undefined {
    let cond = this.parseCondition(stm);
    stm.skipWs();
    while (stm.matchAnd()) {
      const sub = this.parseCondition(stm);
      cond = new Condition(Operator.AND, cond, sub, false);
      stm.skipWs();
    }
    return cond;
  }

  parseCondition(stm: LessStream): Condition {
    stm.skipWs();
    const negate = stm.matchNot();
    let res: Condition | undefined;
    stm.skipWs();
    if (!stm.seekIf(Chars.LEFT_PARENTHESIS)) {
      stm.parseError("SyntaxError EXPECTED Expected left parenthesis '(' to start guard condition");
    }
    const left = stm.parse(Parselets.CONDITION_SUB);
    if (left === undefined) {
      stm.parseError('SyntaxError EXPECTED Expected condition value');
    }

    stm.skipWs();
    if (stm.matchBoolOperator()) {
      const op = parseOperator(stm.token()) as Operator;
      const right = stm.parse(Parselets.CONDITION_SUB);
      if (right !== undefined) {
        res = new Condition(op, left, right, negate);
      } else {
        stm.parseError('SyntaxError EXPECTED Expected expression');
      }
    } else {
      res = new Condition(Operator.EQUAL, left, TRUE, negate);
    }

    stm.skipWs();
    if (!stm.seekIf(Chars.RIGHT_PARENTHESIS)) {
      stm.parseError("SyntaxError EXPECTED Expected right parenthesis ')' to end guard condition");
    }
    return res;
  }
}

export class GuardParselet implements Parselet {
  parse(stm: LessStream): Node | undefined {
    stm.skipWs();
    if (!stm.matchWhen()) {
      return undefined;
    }
    const conditions: Condition[] = [];
    let cond = stm.parse(Parselets.CONDITION) as Condition;
    while (cond !== undefined) {
      conditions.push(cond);
      stm.skipWs();
      if (!stm.seekIf(Chars.COMMA)) {
        break;
      }
      cond = stm.parse(Parselets.CONDITION) as Condition;
    }
    return new Guard(conditions);
  }
}
