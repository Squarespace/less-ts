import { Node } from '../../common';
import { Chars } from '../types';
import { LessStream, Parselet, Parselets } from '../stream';
import { Anonymous, Quoted } from '../../model';

export class QuotedParselet implements Parselet {

  parse(stm: LessStream): Node | undefined {
    stm.skipWs();
    let offset = 0;
    let escaped = false;
    let ch = stm.peek();
    if (ch === Chars.TILDE) {
      escaped = true;
      offset++;
    }

    const delim = stm.peekn(offset);
    if (delim !== Chars.APOSTROPHE && delim !== Chars.QUOTATION_MARK) {
      return undefined;
    }

    const parts: Node[] = [];
    let buf = '';
    stm.seekn(offset + 1);

    while (stm.index < stm.length) {
      ch = stm.peek();

      // If we see an @ symbol, check if it is a variable reference.
      // NOTE: the variable curly parselet will reset the stream state so
      // we don't need to maintain a position marker here.
      if (ch === Chars.AT_SIGN) {
        const ref = stm.parse(Parselets.VARIABLE_CURLY);
        if (ref !== undefined) {
          if (buf) {
            parts.push(new Anonymous(buf));
            buf = '';
          }
          parts.push(ref);
          continue;
        }
      }

      stm.seek1();

      // Check if we've found the end of the string
      if (ch === delim || ch === undefined) {
        break;
      }

      if (ch === Chars.LINE_FEED) {
        // TODO: stm.parseError method
        throw new Error('Quoted string contains a bare line feed');
      }

      buf += ch;
      if (ch !== '\\') {
        continue;
      }

      ch = stm.peek();
      if (ch !== undefined) {
        buf += ch;
        stm.seek1();
      }
    }
    if (buf) {
      parts.push(new Anonymous(buf));
    }
    return new Quoted(delim, escaped, parts);
  }
}
