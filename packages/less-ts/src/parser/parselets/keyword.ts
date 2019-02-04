import { Node } from '../../common';
import { isKeywordStart } from '../types';
import { LessStream, Parselet } from '../stream';
import { colorFromName, Keyword } from '../../model';

export class KeywordParselet implements Parselet {
  parse(stm: LessStream): Node | undefined {
    if (!isKeywordStart(stm.peek()) || !stm.matchKeyword()) {
      return undefined;
    }
    const token = stm.token();
    const color = colorFromName(token);
    return color !== undefined ? color : new Keyword(token);
  }
}
