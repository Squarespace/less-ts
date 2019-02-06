import { ExecEnv, Function, Node, NodeType } from '../common';
import { unitConversionFactor, Dimension, Unit } from '../model';
import { BaseFunction } from './base';

const PI = new Dimension(Math.PI);

const enum TrigFunction {
  COS,
  SIN,
  TAN
}

class Abs extends BaseFunction {

  constructor() {
    super('abs', 'd');
  }

  invoke(env: ExecEnv, args: Node[]): Node | undefined {
    const d = args[0] as Dimension;
    return new Dimension(Math.abs(d.value), d.unit);
  }
}

class ACos extends BaseFunction {

  constructor() {
    super('acos', 'd');
  }

  invoke(env: ExecEnv, args: Node[]): Node | undefined {
    const { value } = (args[0] as Dimension);
    return new Dimension(Math.acos(value), Unit.RAD);
  }
}

class ASin extends BaseFunction {

  constructor() {
    super('asin', 'd');
  }

  invoke(env: ExecEnv, args: Node[]): Node | undefined {
    const { value } = (args[0] as Dimension);
    return new Dimension(Math.asin(value), Unit.RAD);
  }
}

class ATan extends BaseFunction {

  constructor() {
    super('atan', 'd');
  }

  invoke(env: ExecEnv, args: Node[]): Node | undefined {
    const { value } = (args[0] as Dimension);
    return new Dimension(Math.atan(value), Unit.RAD);
  }
}

class Ceil extends BaseFunction {

  constructor() {
    super('ceil', 'd');
  }

  invoke(env: ExecEnv, args: Node[]): Node | undefined {
    const { value, unit } = (args[0] as Dimension);
    return new Dimension(Math.ceil(value), unit);
  }
}

class Cos extends BaseFunction {

  constructor() {
    super('cos', 'd');
  }

  invoke(env: ExecEnv, args: Node[]): Node | undefined {
    return trigFunction(TrigFunction.COS, args[0]);
  }
}

class Floor extends BaseFunction {

  constructor() {
    super('floor', 'd');
  }

  invoke(env: ExecEnv, args: Node[]): Node | undefined {
    const { value, unit } = (args[0] as Dimension);
    return new Dimension(Math.floor(value), unit);
  }
}

class Max extends BaseFunction {

  constructor() {
    super('max', '*.');
  }

  invoke(env: ExecEnv, args: Node[]): Node | undefined {
    return calcMinOrMax(args, false);
  }
}

class Min extends BaseFunction {

  constructor() {
    super('min', '*.');
  }

  invoke(env: ExecEnv, args: Node[]): Node | undefined {
    return calcMinOrMax(args, true);
  }
}

class Mod extends BaseFunction {

  constructor() {
    super('mod', 'dd');
  }

  invoke(env: ExecEnv, args: Node[]): Node | undefined {
    const dividend = (args[0] as Dimension);
    const divisor = (args[1] as Dimension).value;
    let res: number = NaN;
    if (divisor !== 0) {
      res = dividend.value % divisor;
    }
    return new Dimension(res, dividend.unit);
  }
}

class Percentage extends BaseFunction {

  constructor() {
    super('percentage', 'd');
  }

  invoke(env: ExecEnv, args: Node[]): Node | undefined {
    const dim = args[0] as Dimension;
    return new Dimension(dim.value * 100, Unit.PERCENTAGE);
  }
}

class Pi extends BaseFunction {

  constructor() {
    super('pi', '');
  }

  invoke(env: ExecEnv, args: Node[]): Node | undefined {
    return PI;
  }
}

class Pow extends BaseFunction {

  constructor() {
    super('pow', 'dd');
  }

  invoke(env: ExecEnv, args: Node[]): Node | undefined {
    const base = args[0] as Dimension;
    const exp = args[1] as Dimension;
    const value = Math.pow(base.value, exp.value);
    return new Dimension(value, base.unit);
  }
}

class Round extends BaseFunction {

  constructor() {
    super('round', 'd:n');
  }

  invoke(env: ExecEnv, args: Node[]): Node | undefined {
    let places = 0.0;
    const len = args.length;
    const dim = args[0] as Dimension;
    if (len === 2) {
      places = Math.max((args[1] as Dimension).value, 0);
    }
    const scale = Math.pow(10, places);
    return new Dimension(Math.round(dim.value * scale) / scale, dim.unit);
  }
}

class Sin extends BaseFunction {

  constructor() {
    super('sin', 'd');
  }

  invoke(env: ExecEnv, args: Node[]): Node | undefined {
    return trigFunction(TrigFunction.SIN, args[0]);
  }
}

class Sqrt extends BaseFunction {

  constructor() {
    super('sqrt', 'd');
  }

  invoke(env: ExecEnv, args: Node[]): Node | undefined {
    const dim = args[0] as Dimension;
    return new Dimension(Math.sqrt(dim.value), dim.unit);
  }
}

class Tan extends BaseFunction {

  constructor() {
    super('tan', 'd');
  }

  invoke(env: ExecEnv, args: Node[]): Node | undefined {
    return trigFunction(TrigFunction.TAN, args[0]);
  }
}

const calcMinOrMax = (args: Node[], minimum: boolean): Dimension | undefined => {
  let value = 0.0;
  let unit: Unit | undefined;

  const len = args.length;
  for (let i = 0; i < len; i++) {
    const arg = args[i];
    if (arg.type !== NodeType.DIMENSION) {
      return undefined;
    }

    const dim = arg as Dimension;
    if (i === 0) {
      value = dim.value;
      unit = dim.unit;
    } else if (dim.unit !== unit) {
      return undefined;
    } else {
      value = minimum ? Math.min(value, dim.value) : Math.max(value, dim.value);
    }
  }
  return new Dimension(value, unit);
};

const trigFunction = (type: TrigFunction, n: Node): Node => {
  const dim = n as Dimension;
  const factor = unitConversionFactor(dim.unit, Unit.RAD);
  let result = dim.value * factor;
  switch (type) {
    case TrigFunction.COS:
      result = Math.cos(result);
      break;
    case TrigFunction.SIN:
      result = Math.sin(result);
      break;
    case TrigFunction.TAN:
      result = Math.tan(result);
      break;
  }
  return new Dimension(result);
};

export const MATH: { [x: string]: Function } = {
  abs: new Abs(),
  acos: new ACos(),
  asin: new ASin(),
  atan: new ATan(),
  ceil: new Ceil(),
  cos: new Cos(),
  floor: new Floor(),
  max: new Max(),
  min: new Min(),
  mod: new Mod(),
  percentage: new Percentage(),
  pi: new Pi(),
  pow: new Pow(),
  round: new Round(),
  sin: new Sin(),
  sqrt: new Sqrt(),
  tan: new Tan()
};
