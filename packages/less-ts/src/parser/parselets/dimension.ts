import { Node } from '../../common';
import { Patch } from '../../compat';
import { isDimensionStart } from '../types';
import { LessStream, Parselet } from '../stream';
import { Dimension, Unit } from '../../model';

export class DimensionParselet implements Parselet {
  parse(stm: LessStream): Node | undefined {
    if (!isDimensionStart(stm.peek())) {
      return undefined;
    }
    // The exponent is part of the number once NUMBER_EXPO is fixed
    // (level 2). At legacy levels 'e' starts an identifier, so '1e3'
    // tokenizes as 1 + 'e3' exactly as the release did. Mirrors the
    // parser's choice between the two Java number patterns.
    const matched = stm.ctx.compat.enabled(Patch.NUMBER_EXPO) ? stm.matchDimensionValueLegacy() : stm.matchDimensionValue();
    if (!matched) {
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
