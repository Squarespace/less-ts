import { Node } from '../../common';
import { Anonymous, Expression, ExpressionList, Ratio, Shorthand } from '../../model';
import { LessStream, Parselet, Parselets } from '../stream';
import { isDigit, Chars } from '../types';

export class FontParselet implements Parselet {

  parse(stm: LessStream): Node | undefined {
    const parts: Node[] = [];
    let node = stm.parse(Parselets.FONT_SUB);
    while (node !== undefined) {
      parts.push(node);
      stm.skipWs();
      if (stm.peek() === Chars.SLASH) {
        const next = stm.peekn(1);
        // Make sure this isn't the start of a comment
        if (next !== Chars.ASTERISK && next !== Chars.SLASH) {
          stm.seek1();
          parts.push(new Anonymous(Chars.SLASH));
        }
      }
      node = stm.parse(Parselets.FONT_SUB);
    }

    const expn: Node[] = [new Expression(parts)];
    stm.skipWs();
    if (stm.seekIf(Chars.COMMA)) {
      node = stm.parse(Parselets.EXPRESSION);
      while (node !== undefined) {
        expn.push(node);
        stm.skipWs();
        if (!stm.seekIf(Chars.COMMA)) {
          break;
        }
        node = stm.parse(Parselets.EXPRESSION);
      }
    }
    return new ExpressionList(expn);
  }
}

export class RatioParselet implements Parselet {
  parse(stm: LessStream): Node | undefined {
    if (isDigit(stm.peek()) && stm.matchRatio()) {
      return new Ratio(stm.token());
    }
    return undefined;
  }
}

export class ShorthandParselet implements Parselet {
  parse(stm: LessStream): Node | undefined {
    if (!stm.peekShorthand()) {
      return undefined;
    }
    const mark = stm.mark();
    const left = stm.parse(Parselets.ENTITY);
    if (!stm.seekIf(Chars.SLASH)) {
      stm.restore(mark);
      return undefined;
    }
    const right = stm.parse(Parselets.ENTITY);
    if (left === undefined || right === undefined) {
      throw new Error('parse error in shorthand parselet');
    }
    return new Shorthand(left, right);
  }

}
