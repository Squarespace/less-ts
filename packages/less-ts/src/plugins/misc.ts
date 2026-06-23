import { ExecEnv, Function, Node, NodeType } from '../common';
import { Patch } from '../compat';
import { incompatibleUnits, invalidColor, unknownUnit } from '../errors';
import { stringToUnit, unitConversionFactor, unitDisplay, Anonymous, Dimension, Keyword, Quoted, RGBColor, Unit } from '../model';
import { isHexColor } from '../utils';
import { BaseFunction } from './base';

const ANON_EMPTY = new Anonymous('');
const ANON_PERCENT = new Anonymous('%');

class Color extends BaseFunction {
  constructor() {
    super('color', 's');
  }

  invoke(env: ExecEnv, args: Node[]): Node | undefined {
    let str = args[0] as Quoted;
    str = str.copy();
    str.escaped = true;
    const hex = env.ctx.render(str);
    if (!isHexColor(hex)) {
      // Report a clean error instead of a raw failure on bad lengths or
      // silently mapping bad digits to #000.
      env.errors.push(invalidColor(hex));
      return undefined;
    }
    return RGBColor.fromHex(hex);
  }
}

class Convert extends BaseFunction {
  constructor() {
    super('convert', 'd*');
  }

  invoke(env: ExecEnv, args: Node[]): Node | undefined {
    const dim = args[0] as Dimension;
    const destUnit = toUnit(env, args[1]);
    if (destUnit === undefined) {
      return undefined;
    }
    const factor = unitConversionFactor(dim.unit, destUnit);
    // CONVERT_INCOMPATIBLE_UNITS: legacy emits 0 with the target
    // unit; fixed levels fail the compile.
    if (factor === 0 && !env.ctx.compat.enabled(Patch.CONVERT_INCOMPATIBLE_UNITS)) {
      env.errors.push(incompatibleUnits(unitDisplay(dim.unit), unitDisplay(destUnit)));
      return undefined;
    }
    return new Dimension(dim.value * factor, destUnit);
  }
}

class GetUnit extends BaseFunction {
  constructor() {
    super('get-unit', 'd');
  }

  invoke(env: ExecEnv, args: Node[]): Node | undefined {
    const { unit } = args[0] as Dimension;
    if (unit === undefined) {
      return ANON_EMPTY;
    } else if (unit === Unit.PERCENTAGE) {
      return new Quoted('"', false, [ANON_PERCENT]);
    }
    return new Keyword(unit);
  }
}

class UnitFunc extends BaseFunction {
  constructor() {
    super('unit', 'd:*');
  }

  invoke(env: ExecEnv, args: Node[]): Node | undefined {
    const dim = args[0] as Dimension;
    let unit: Unit | undefined;
    if (args.length >= 2) {
      unit = toUnit(env, args[1]);
      if (unit === undefined) {
        return undefined;
      }
    }
    return new Dimension(dim.value, unit);
  }
}

const toUnit = (env: ExecEnv, n: Node): Unit | undefined => {
  let unit: Unit | undefined;
  if (n.type === NodeType.KEYWORD) {
    unit = stringToUnit((n as Keyword).value);
  } else if (n.type === NodeType.QUOTED) {
    const str = (n as Quoted).copy();
    str.escaped = true;
    unit = stringToUnit(env.ctx.render(str));
  }
  if (unit === undefined) {
    // The reference throws here. Record the error with the unit's
    // repr: a keyword bare, a quoted string with its delimiters.
    const buf = env.ctx.newBuffer();
    n.repr(buf);
    env.errors.push(unknownUnit(buf.toString()));
  }
  return unit;
};

export const MISC: { [x: string]: Function } = {
  color: new Color(),
  convert: new Convert(),
  'get-unit': new GetUnit(),
  unit: new UnitFunc(),
};
