import { Node } from '../../common';
import { isDimensionStart } from '../types';
import { LessStream, Parselet } from '../stream';
import { Dimension, Unit } from '../../model';

export class DimensionParselet implements Parselet {
  parse(stm: LessStream): Node | undefined {
    if (!isDimensionStart(stm.peek()) || !stm.matchDimensionValue()) {
      return undefined;
    }
    const value = stm.token();
    let unit: Unit | undefined;
    if (stm.matchDimensionUnit()) {
      unit = stm.token().toLowerCase() as Unit;
    }
    return new Dimension(Number(value), unit);
  }
}
