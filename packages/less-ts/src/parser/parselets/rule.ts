import { Node, NodeType } from '../../common';
import { isPropertyStart, isRuleStart, Chars } from '../types';
import { LessStream, Parselet, Parselets } from '../stream';
import { Anonymous, Definition, ExpressionList, Property, Rule, Variable } from '../../model';

export class PropertyParselet implements Parselet {

  parse(stm: LessStream): Node | undefined {
    if (!isPropertyStart(stm.peek()) || !stm.matchProperty()) {
      return undefined;
    }
    return new Property(stm.token());
  }
}

export class RuleParselet implements Parselet {

  parse(stm: LessStream): Node | undefined {
    if (!isRuleStart(stm.peek())) {
      return undefined;
    }
    const ruleMark = stm.mark();
    const key = this.parseKey(stm);
    if (key === undefined) {
      stm.restore(ruleMark);
      return undefined;
    }

    let name: string;
    if (key.type === NodeType.PROPERTY) {
      name = (key as Property).name;
    } else {
      name = (key as Variable).name;
    }

    stm.skipWs();
    let value: Node | undefined;
    const valueMark = stm.mark();
    if (name === 'font') {
      value = stm.parse(Parselets.FONT);
    } else {
      value = stm.parse(Parselets.EXPRESSION_LIST);
      if (value !== undefined) {
        // Flatten expression lists of length 1, simplifying the syntax tree
        const expn = value as ExpressionList;
        if (expn.values.length === 1) {
          value = expn.values[0];
        }
      }
    }

    stm.skipWs();
    let important = this.important(stm);

    if (!this.endPeek(stm)) {
      important = false;
      stm.restore(valueMark);
      if (name[0] !== Chars.AT_SIGN && stm.matchAnonRuleValue()) {
        value = new Anonymous(stm.token().trim());
      }
    } else if (value === undefined) {
      value = new Anonymous('');
    }

    if (value !== undefined && this.end(stm)) {
      if (key.type === NodeType.VARIABLE) {
        const def = new Definition(name, value);
        stm.setOpenSpace();
        return def;
      } else {
        const rule = new Rule(key as Property, value, important);
        stm.setOpenSpace();
        return rule;
      }
    }
    stm.restore(ruleMark);
    return undefined;
  }

  parseKey(stm: LessStream): Node | undefined {
    const key = stm.parse(Parselets.RULE_KEY);
    stm.skipWs();
    if (stm.seekIf(Chars.COLON)) {
      return key;
    }
    return undefined;
  }

  important(stm: LessStream): boolean {
    return stm.peek() === Chars.EXCLAMATION_MARK && stm.matchImportant();
  }

  endPeek(stm: LessStream): boolean {
    stm.skipWs();
    const ch = stm.peek();
    return ch === Chars.SEMICOLON || ch === Chars.RIGHT_CURLY_BRACKET || ch === undefined;
  }

  end(stm: LessStream): boolean {
    stm.skipWs();
    switch (stm.peek()) {
      case Chars.SEMICOLON:
        stm.seek1();
        return true;
      case undefined:
      case Chars.RIGHT_CURLY_BRACKET:
        return true;
      default:
        break;
    }
    return false;
  }
}
