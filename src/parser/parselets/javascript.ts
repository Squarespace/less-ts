import { Node } from '../../common';
import { Chars } from '../types';
import { LessStream, Parselet } from '../stream';

export class JavascriptParselet implements Parselet {
  parse(stm: LessStream): Node | undefined {
    let pos = 0;
    if (stm.peek() === Chars.TILDE) {
      pos++;
    }
    if (stm.peekn(pos) === Chars.GRAVE_ACCENT) {
      throw new Error('inline JavaScript not supported');
    }
    return undefined;
  }
}
