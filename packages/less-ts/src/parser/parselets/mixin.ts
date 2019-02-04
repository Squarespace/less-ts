import { Node, NodeType } from '../../common';
import { Chars } from '../types';
import { LessStream, Parselet, Parselets } from '../stream';
import {
  Argument,
  Block,
  Combinator,
  Element,
  ExpressionList,
  Guard,
  Mixin,
  MixinCall,
  MixinCallArgs,
  MixinParams,
  Parameter,
  Selector,
  TextElement,
  Variable
} from '../../model';

export class MixinCallArgsParselet implements Parselet {
  parse(stm: LessStream): Node | undefined {
    stm.skipWs();
    if (!stm.seekIf(Chars.LEFT_PARENTHESIS)) {
      return undefined;
    }

    let delimSemicolon = false;
    let containsNamed = false;
    const argsComma: Argument[] = [];
    const argsSemicolon: Argument[] = [];
    let expressions: Node[] = [];
    let name: string | undefined;

    let node: Node | undefined;
    while ((node = stm.parse(Parselets.EXPRESSION)) !== undefined) {
      let nameLoop: string | undefined;
      let value: Node = node;

      // If the last node parsed is a variable reference, check if it is a named argument.

      if (node.type === NodeType.VARIABLE) {
        const v = node as Variable;
        const tmp = this.parseVarArg(stm);
        if (tmp !== undefined) {
          if (expressions.length > 0) {
            if (delimSemicolon) {
              throw new Error('mixed delimiters in mixin call arguments');
            }
            containsNamed = true;
          }
          value = tmp;
          nameLoop = v.name;
          name = v.name;
        }
      }

      expressions.push(value);
      argsComma.push(new Argument(nameLoop, value));

      stm.skipWs();
      if (stm.seekIf(Chars.COMMA)) {
        continue;
      }

      if (stm.seekIf(Chars.SEMICOLON)) {
        delimSemicolon = true;
      } else if (!delimSemicolon) {
        continue;
      }

      if (containsNamed) {
        throw new Error('mixed delimiters in mixin call arguments');
      }
      if (expressions.length > 1) {
        value = new ExpressionList(expressions);
      }

      argsSemicolon.push(new Argument(name, value));
      name = undefined;
      expressions = [];
      containsNamed = false;
    }

    stm.skipWs();
    if (!stm.seekIf(Chars.RIGHT_PARENTHESIS)) {
      throw new Error('expected right parenthesis ")" to end mixin call arguments');
    }
    if (delimSemicolon) {
      return new MixinCallArgs(';', argsSemicolon);
    }
    return new MixinCallArgs(',', argsComma);
  }

  parseVarArg(stm: LessStream): Node | undefined {
    if (!stm.seekIf(Chars.COLON)) {
      return undefined;
    }
    const value = stm.parse(Parselets.EXPRESSION);
    if (value === undefined) {
      throw new Error('expected expression for named argument');
    }
    return value;
  }
}

export class MixinCallParselet implements Parselet {
  parse(stm: LessStream): Node | undefined {
    let ch = stm.peek();
    if (ch !== Chars.PERIOD && ch !== Chars.NUMBER_SIGN) {
      return undefined;
    }
    const mark = stm.mark();
    const elements: Element[] = [];
    let comb: Combinator | undefined;
    while (stm.matchMixinName()) {
      elements.push(new TextElement(comb, stm.token()));
      const skipped = stm.skipWs();
      if (stm.peek() === Chars.GREATER_THAN_SIGN) {
        comb = Combinator.CHILD;
        stm.seek1();
      } else if (skipped > 0) {
        comb = Combinator.DESC;
      } else {
        comb = undefined;
      }
      stm.skipWs();
    }

    if (elements.length === 0) {
      stm.restore(mark);
      return undefined;
    }

    const args = stm.parse(Parselets.MIXIN_CALL_ARGS) as MixinCallArgs;
    stm.skipWs();
    const important = stm.matchImportant();
    stm.skipWs();
    ch = stm.peek();
    if (ch === Chars.SEMICOLON) {
      stm.seek1();
      return new MixinCall(new Selector(elements), args, important);
    } else if (ch === Chars.RIGHT_CURLY_BRACKET || ch === undefined) {
      return new MixinCall(new Selector(elements), args, important);
    }
    stm.restore(mark);
    return undefined;
  }
}

export class MixinParamsParselet implements Parselet {
  parse(stm: LessStream): Node | undefined {
    const mark = stm.mark();
    stm.skipWs();
    if (!stm.seekIf(Chars.LEFT_PARENTHESIS)) {
      return undefined;
    }

    const params: Parameter[] = [];
    while (true) {
      stm.parse(Parselets.COMMENT);
      if (this.matchVariadic(stm)) {
        stm.seekn(3);
        params.push(new Parameter(undefined, undefined, true));
        break;
      }

      const param = this.parseParam(stm);
      if (param === undefined) {
        break;
      }

      params.push(param);

      stm.skipWs();
      const ch = stm.peek();
      if (ch !== Chars.COMMA && ch !== Chars.SEMICOLON) {
        break;
      }
      stm.seek1();
    }

    if (!stm.seekIf(Chars.RIGHT_PARENTHESIS)) {
      stm.restore(mark);
      return undefined;
    }
    return new MixinParams(params);
  }

  parseParam(stm: LessStream): Parameter | undefined {
    const temp = stm.parse(Parselets.MIXIN_PARAMETER);
    if (temp === undefined) {
      return undefined;
    }
    if (temp.type !== NodeType.VARIABLE) {
      return new Parameter(undefined, temp, false);
    }

    const v = temp as Variable;
    stm.skipWs();
    if (stm.seekIf(Chars.COLON)) {
      stm.skipWs();
      const value = stm.parse(Parselets.EXPRESSION);
      if (value === undefined) {
        // TODO:
        throw new Error('expected an expression');
      }
      return new Parameter(v.name, value, false);
    } else if (this.matchVariadic(stm)) {
      stm.seekn(3);
      return new Parameter(v.name, undefined, true);
    }
    return new Parameter(v.name, undefined, false);
  }

  matchVariadic(stm: LessStream): boolean {
    return stm.peek() === Chars.PERIOD && stm.peekn(1) === Chars.PERIOD && stm.peekn(2) === Chars.PERIOD;
  }
}

export class MixinParselet implements Parselet {

  parse(stm: LessStream): Node | undefined {
    const ch = stm.peek();
    if (ch !== Chars.PERIOD && ch !== Chars.NUMBER_SIGN) {
      return undefined;
    }
    const mark = stm.mark();
    if (!stm.matchMixinName()) {
      return undefined;
    }
    const name = stm.token();
    const params = stm.parse(Parselets.MIXIN_PARAMS) as MixinParams;
    if (params === undefined) {
      stm.restore(mark);
      return undefined;
    }
    stm.parse(Parselets.COMMENT);

    const guard = stm.parse(Parselets.GUARD) as Guard;
    stm.parse(Parselets.COMMENT);

    const block = stm.parse(Parselets.BLOCK) as Block;
    if (block === undefined) {
      stm.restore(mark);
      return undefined;
    }

    return new Mixin(name, params, guard, block);
  }
}
