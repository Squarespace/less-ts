import { Node } from '../../common';
import { whitespace } from '../../utils';
import { isCombinator, isSelectorEnd, Chars } from '../types';
import { LessStream, Parselet, Parselets } from '../stream';

import {
  Anonymous,
  AttributeElement,
  Combinator,
  Element,
  Paren,
  Selector,
  Selectors,
  TextElement,
  ValueElement
} from '../../model';

export class ElementParselet implements Parselet {

  parse(stm: LessStream): Node | undefined {
    const comb = this.parseCombinator(stm);
    stm.skipWs();
    const ch = stm.peek();

    if (stm.matchElement0() || stm.matchElement1()) {
      return new TextElement(comb, stm.token());
    } else if (ch === Chars.ASTERISK || ch === Chars.AMPERSAND) {
      stm.seek1();
      return new TextElement(comb, ch);
    }

    let elem = this.parseAttribute(stm, comb);
    if (elem !== undefined) {
      return elem;
    }

    if (stm.matchElement2() || stm.matchElement3()) {
      return new TextElement(comb, stm.token());
    } else {
      const variable = stm.parse(Parselets.VARIABLE_CURLY);
      if (variable !== undefined) {
        return new ValueElement(comb, variable);
      }
    }

    if (elem === undefined) {
      elem = this.parseSub(stm);
      if (elem !== undefined) {
        return new ValueElement(comb, elem);
      }
    }

    return undefined;
  }

  private parseAttribute(stm: LessStream, comb?: Combinator): Node | undefined {
    if (!stm.seekIf(Chars.LEFT_SQUARE_BRACKET)) {
      return undefined;
    }

    let key: Node | undefined;
    if (stm.matchAttributeKey()) {
      key = new Anonymous(stm.token());
    } else {
      key = stm.parse(Parselets.QUOTED);
    }
    if (key === undefined) {
      return undefined;
    }

    const parts: Node[] = [key];
    if (stm.matchAttributeOp()) {
      const oper = new Anonymous(stm.token());
      let val = stm.parse(Parselets.QUOTED);
      if (val === undefined && stm.matchIdentifier()) {
        val = new Anonymous(stm.token());
      }
      if (val !== undefined) {
        parts.push(oper);
        parts.push(val);
      }
    }
    if (!stm.seekIf(Chars.RIGHT_SQUARE_BRACKET)) {
      return undefined;
    }
    return new AttributeElement(comb, parts);
  }

  private parseCombinator(stm: LessStream): Combinator | undefined {
    const block = stm.inOpenSpace();
    const prev = stm.peekn(-1);
    const skipped = stm.skipWs();
    const ch = stm.peek();
    if (isCombinator(ch)) {
      stm.seek1();
      return ch as Combinator;
    } else if (block
      || skipped > 0
      || whitespace(prev)
      || prev === undefined
      || prev === Chars.COMMA) {
        return Combinator.DESC;
    }
    return undefined;
  }

  private parseSub(stm: LessStream): Node | undefined {
    stm.skipWs();
    if (!stm.seekIf(Chars.LEFT_PARENTHESIS)) {
      return undefined;
    }
    const value = stm.parse(Parselets.ELEMENT_SUB);
    stm.skipWs();
    if (value && stm.seekIf(Chars.RIGHT_PARENTHESIS)) {
      return new Paren(value);
    }
    return undefined;
  }
}

export class SelectorParselet implements Parselet {

  parse(stm: LessStream): Node | undefined {
    stm.skipWs();
    if (stm.peek() === Chars.LEFT_PARENTHESIS) {
      stm.seek1();
      const value = stm.parse(Parselets.ENTITY);
      stm.skipWs();
      if (value && stm.peek() === Chars.RIGHT_PARENTHESIS) {
        stm.seek1();
        return new Selector([new ValueElement(Combinator.DESC, value)]);
      }
      return undefined;
    }
    const elements: Element[] = [];
    let elem = stm.parse(Parselets.ELEMENT);
    while (elem) {
      elements.push(elem as Element);
      stm.parse(Parselets.COMMENT);
      const ch = stm.peek();
      if (ch === undefined || isSelectorEnd(ch)) {
        break;
      }
      elem = stm.parse(Parselets.ELEMENT);
    }
    return new Selector(elements);
  }
}

export class SelectorsParselet implements Parselet {

  parse(stm: LessStream): Node | undefined {
    let selector = stm.parse(Parselets.SELECTOR);
    if (selector === undefined) {
      return undefined;
    }
    const group: Selector[] = [];
    while (selector !== undefined) {
      group.push(selector as Selector);
      stm.parse(Parselets.COMMENT);
      stm.skipWs();
      if (!stm.seekIf(Chars.COMMA)) {
        break;
      }
      stm.parse(Parselets.COMMENT);
      stm.skipWs();
      selector = stm.parse(Parselets.SELECTOR);
    }
    return new Selectors(group);
  }
}
