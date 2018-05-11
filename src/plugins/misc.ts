import { ExecEnv, Function, Node, NodeType } from '../common';
import {
  Anonymous,
  Dimension,
  Keyword,
  Quoted,
  RGBColor,
  Unit,
  stringToUnit,
  unitConversionFactor
} from '../model';
import { BaseFunction } from './base';

const ANON_EMPTY = new Anonymous('');
const ANON_PERCENT = new Anonymous('%');

class Color extends BaseFunction {

  constructor() {
    super('color', 's');
  }

  protected _invoke(env: ExecEnv, args: Node[]): Node | undefined {
    let str = args[0] as Quoted;
    str = str.copy();
    str.escaped = true;
    const hex = env.ctx.render(str);
    return RGBColor.fromHex(hex);
  }
}

class Convert extends BaseFunction {

  constructor() {
    super('convert', 'd*');
  }

  protected _invoke(env: ExecEnv, args: Node[]): Node | undefined {
    const dim = args[0] as Dimension;
    const destUnit = toUnit(env, args[1]);
    const factor = unitConversionFactor(dim.unit, destUnit);
    return new Dimension(dim.value * factor, destUnit);
  }
}

class GetUnit extends BaseFunction {

  constructor() {
    super('get-unit', 'd');
  }

  protected _invoke(env: ExecEnv, args: Node[]): Node | undefined {
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

  protected _invoke(env: ExecEnv, args: Node[]): Node | undefined {
    const dim = args[0] as Dimension;
    let unit: Unit | undefined;
    if (args.length >= 2) {
      unit = toUnit(env, args[1]);
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
    const res = env.ctx.render(str);
    unit = stringToUnit(res);
  }
  return unit;
};

export const MISC: { [x: string]: Function } = {
  color: new Color(),
  convert: new Convert(),
  'get-unit': new GetUnit(),
  unit: new UnitFunc()
};
