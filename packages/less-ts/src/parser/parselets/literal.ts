import { Node } from '../../common';
import { isCallStart } from '../types';
import { LessStream, Parselet } from '../stream';
import { UnicodeRange } from '../../model';
import { FunctionCallParselet } from './function';

export class UnicodeRangeParselet implements Parselet {
  parse(stm: LessStream): Node | undefined {
    if (stm.peek() === 'U' && stm.matchUnicodeRange()) {
      return new UnicodeRange(stm.token());
    }
    return undefined;
  }
}

export class UrlParselet implements Parselet {
  parse(stm: LessStream): Node | undefined {
    const mark = stm.mark();
    if (!isCallStart(stm.peek()) || !stm.matchCallName()) {
      return undefined;
    }
    const name = stm.token();
    const nameLC = name.toLowerCase();
    if (nameLC === 'url') {
      const result = FunctionCallParselet.parseUrl(stm);
      if (result !== undefined) {
        return result;
      }
    }
    stm.restore(mark);
    return undefined;
  }
}
