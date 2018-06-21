import { Node } from '../../common';
import { Chars } from '../types';
import { LessStream, Parselet, Parselets } from '../stream';
import { Expression, Feature, Features, Paren, Property } from '../../model';

export class FeatureParselet implements Parselet {
  parse(stm: LessStream): Node | undefined {
    let elem = this.parseOne(stm);
    if (elem === undefined) {
      return undefined;
    }

    const expn: Node[] = [];
    while (elem !== undefined) {
      expn.push(elem);
      elem = this.parseOne(stm);
    }
    return new Expression(expn);
  }

  parseOne(stm: LessStream): Node | undefined {
    const mark = stm.mark();
    let node = stm.parse(Parselets.KEYWORD);
    if (node !== undefined) {
      return node;
    } else if (stm.seekIf(Chars.LEFT_PARENTHESIS)) {
      const prop = this.parseProperty(stm);
      node = stm.parse(Parselets.ENTITY);
      stm.skipWs();
      if (stm.seekIf(Chars.RIGHT_PARENTHESIS)) {
        if (prop !== undefined && node !== undefined) {
          return new Paren(new Feature(prop, node));
        } else if (node !== undefined) {
          return new Paren(node);
        }
      }
    }
    stm.restore(mark);
    return undefined;
  }

  parseProperty(stm: LessStream): Property | undefined {
    const mark = stm.mark();
    const prop = stm.parse(Parselets.PROPERTY);
    if (prop !== undefined) {
      stm.skipWs();
      if (stm.seekIf(Chars.COLON)) {
        return prop as Property;
      }
    }
    stm.restore(mark);
    return undefined;
  }
}

export class FeaturesParselet implements Parselet {
  parse(stm: LessStream): Node | undefined {
    let node = this.parseOne(stm);
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
      node = this.parseOne(stm);
    }
    return new Features(parts);
  }

  parseOne(stm: LessStream): Node | undefined {
    const node = stm.parse(Parselets.FEATURE);
    if (node !== undefined) {
      return node;
    }
    return stm.parse(Parselets.VARIABLE);
  }
}
