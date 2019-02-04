import { Node, NodeType } from '../../common';
import { isCallStart, Chars } from '../types';
import { LessStream, Parselet, Parselets } from '../stream';
import { Alpha, Anonymous, Assignment, Dimension, FunctionCall, Url } from '../../model';

export class AlphaParselet implements Parselet {

  parse(stm: LessStream): Node | undefined {
    if (!stm.matchOpacity()) {
      return undefined;
    }
    const value = stm.parse(Parselets.ALPHA_SUB);
    if (value !== undefined && value.type === NodeType.DIMENSION) {
      const dim = value as Dimension;
      if (dim.unit !== undefined) {
        throw new Error('Numeric values for alpha cannot have units.');
      }
    }
    stm.skipWs();
    if (!stm.seekIf(Chars.RIGHT_PARENTHESIS)) {
      if (value !== undefined) {
        throw new Error('expected a unit-less number or variable for alpha');
      } else {
        throw new Error('expected right parenthesis ")" to end alpha');
      }
    }
    return new Alpha(value === undefined ? new Anonymous('') : value);
  }
}

export class AssignmentParselet implements Parselet {

  parse(stm: LessStream): Node | undefined {
    const mark = stm.mark();
    if (!stm.matchWord()) {
      return undefined;
    }
    const name = stm.token();
    stm.skipWs();
    if (!stm.seekIf(Chars.EQUALS_SIGN)) {
      stm.restore(mark);
      return undefined;
    }
    const value = stm.parse(Parselets.ENTITY);
    if (value === undefined) {
      stm.restore(mark);
      return undefined;
    }
    return new Assignment(name, value);
  }
}

export class FunctionCallParselet implements Parselet {

  parse(stm: LessStream): Node | undefined {
    const mark = stm.mark();
    if (!isCallStart(stm.peek()) || !stm.matchCallName()) {
      return undefined;
    }

    const name = stm.token();
    const nameLC = name.toLowerCase();
    if (nameLC === 'url') {
      return FunctionCallParselet.parseUrl(stm);
    }

    if (nameLC === 'alpha') {
      const result = stm.parse(Parselets.ALPHA);
      // Special handling for IE's alpha function
      if (result !== undefined) {
        return result;
      }
      // Fall through, assuming the built-in alpha function
    }

    const args = this.parseArgs(stm);
    const call = new FunctionCall(name, args);
    stm.skipWs();
    if (!stm.seekIf(Chars.RIGHT_PARENTHESIS)) {
      stm.restore(mark);
      return undefined;
    }
    return call;
  }

  parseArgs(stm: LessStream): Node[] {
    const args: Node[] = [];
    while (true) {
      const arg = stm.parse(Parselets.FUNCTION_CALL_ARGS);
      if (arg !== undefined) {
        args.push(arg);
      }
      stm.skipWs();
      if (!stm.seekIf(Chars.COMMA)) {
        break;
      }
    }
    return args;
  }

  static parseUrl(stm: LessStream): Node | undefined {
    stm.skipWs();
    let value = stm.parse(Parselets.FUNCTION_CALL_SUB);
    if (value === undefined) {
      const start = stm.index;
      let ch = stm.peek();
      while (ch !== Chars.RIGHT_PARENTHESIS && ch !== undefined) {
        stm.seek1();
        ch = stm.peek();
      }
      const url = stm.source.substring(start, stm.index);
      value = new Anonymous(url.trim());
    }
    stm.skipWs();
    if (!stm.seekIf(Chars.RIGHT_PARENTHESIS)) {
      throw new Error('expected right parenthesis ")" to end url');
    }
    return new Url(value);
  }
}