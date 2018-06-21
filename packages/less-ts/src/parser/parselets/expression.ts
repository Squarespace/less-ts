import { Node } from '../../common';
import { Chars } from '../types';
import { LessStream, Parselet, Parselets } from '../stream';
import { Anonymous, Expression, ExpressionList } from '../../model';

export class ExpressionParselet implements Parselet {

  parse(stm: LessStream): Node | undefined {
    let node = stm.parse(Parselets.EXPRESSION_SUB);
    if (node === undefined) {
      return undefined;
    }
    const parts: Node[] = [];
    do {
      parts.push(node);

      // Peek for '/' delimiter
      stm.skipWs();
      if (stm.peek() === Chars.SLASH && stm.peekn(1) !== Chars.ASTERISK) {
        stm.seek1();
        parts.push(new Anonymous(Chars.SLASH));
      }

      node = stm.parse(Parselets.EXPRESSION_SUB);
    } while (node !== undefined);
    return parts.length === 1 ? parts[0] : new Expression(parts);
  }
}

export class ExpressionListParselet implements Parselet {

  parse(stm: LessStream): Node | undefined {
    let node = stm.parse(Parselets.EXPRESSION);
    if (node === undefined) {
      return undefined;
    }

    const parts: Node[] = [];
    while (node !== undefined) {
      parts.push(node);
      stm.skipWs();
      if (!stm.seekIf(Chars.COMMA)) {
        break;
      }
      node = stm.parse(Parselets.EXPRESSION);
    }
    return new ExpressionList(parts);
  }
}

export class SubParselet implements Parselet {

  parse(stm: LessStream): Node | undefined {
    const mark = stm.mark();
    if (!stm.seekIf(Chars.LEFT_PARENTHESIS)) {
      return undefined;
    }
    const node = stm.parse(Parselets.EXPRESSION);
    if (!stm.seekIf(Chars.RIGHT_PARENTHESIS)) {
      stm.restore(mark);
      return undefined;
    }
    return node;
  }
}
