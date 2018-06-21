import { Node, NodeType } from '../../common';
import { RGBColor } from '../../model';
import { LessStream, Parselet, Parselets } from '../stream';
import { Chars } from '../types';

export class ColorParselet implements Parselet {
  parse(stm: LessStream): Node | undefined {
    if (stm.peek() === Chars.NUMBER_SIGN && stm.matchHexColor()) {
      return RGBColor.fromHex(stm.token().substring(1));
    }
    return undefined;
  }
}

export class ColorKeywordParselet implements Parselet {

  parse(stm: LessStream): Node | undefined {
    const mark = stm.mark();
    const node = stm.parse(Parselets.KEYWORD);
    if (node !== undefined && node.type === NodeType.COLOR) {
      return node;
    }
    stm.restore(mark);
    return undefined;
  }
}
