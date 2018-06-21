import { Node } from '../../common';
import { Chars } from '../types';
import { LessStream, Parselet } from '../stream';
import { Variable } from '../../model';

export class VariableParselet implements Parselet {
  parse(stm: LessStream): Node | undefined {
    const mark = stm.mark();
    let indirect = false;
    let pos = 0;

    if (stm.peek() !== Chars.AT_SIGN) {
      return undefined;
    }
    pos++;

    if (stm.peekn(pos) === Chars.AT_SIGN) {
      indirect = true;
      pos++;
    }

    stm.seekn(pos);
    if (!stm.matchIdentifier()) {
      stm.restore(mark);
      return undefined;
    }

    const name = '@' + stm.token();
    return new Variable(name, indirect, false);
  }
}

export class VariableCurlyParselet implements Parselet {
  parse(stm: LessStream): Node | undefined {
    let indirect = false;
    let pos = 0;
    if (stm.peek() !== Chars.AT_SIGN) {
      return undefined;
    }
    pos++;
    if (stm.peekn(pos) === Chars.AT_SIGN) {
      indirect = true;
      pos++;
    }
    if (stm.peekn(pos) !== Chars.LEFT_CURLY_BRACKET) {
      return undefined;
    }
    pos++;

    const mark = stm.mark();
    stm.seekn(pos);
    if (!stm.matchIdentifier()) {
      stm.restore(mark);
      return undefined;
    }
    const name = Chars.AT_SIGN + stm.token();
    if (!stm.seekIf(Chars.RIGHT_CURLY_BRACKET)) {
      stm.restore(mark);
      return undefined;
    }
    return new Variable(name, indirect, true);
  }
}
