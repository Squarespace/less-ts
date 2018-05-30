import { ExecEnv, Function, Node } from '../../common';
import { Dimension, HSLColor, RGBColor, Unit } from '../../model';
import { BaseFunction } from '../base';
import { hsl, rgb } from './util';

class RGB extends BaseFunction {

  constructor() {
    super('rgb', 'ppp');
  }

  invoke(env: ExecEnv, args: Node[]): Node | undefined {
    const r = scaled(args[0], 256);
    const g = scaled(args[1], 256);
    const b = scaled(args[2], 256);
    return new RGBColor(r, g, b, 1.0);
  }
}

class RGBA extends BaseFunction {

  constructor() {
    super('rgba', 'pppp');
  }

  invoke(env: ExecEnv, args: Node[]): Node | undefined {
    const r = scaled(args[0], 256);
    const g = scaled(args[1], 256);
    const b = scaled(args[2], 256);
    const a = percent(args[3]);
    return new RGBColor(r, g, b, a);
  }
}

class ARGB extends BaseFunction {

  constructor() {
    super('argb', 'c');
  }

  invoke(env: ExecEnv, args: Node[]): Node | undefined {
    const c = rgb(args[0]);
    return c.toARGB();
  }
}

class HSL extends BaseFunction {

  constructor() {
    super('hsl', 'ppp');
  }

  invoke(env: ExecEnv, args: Node[]): Node | undefined {
    const h = percent(args[0]);
    const s = percent(args[1]);
    const l = percent(args[2]);
    return new HSLColor((h % 360) / 360, s, l, 1.0);
  }
}

class HSLA extends BaseFunction {

  constructor() {
    super('hsla', 'pppp');
  }

  invoke(env: ExecEnv, args: Node[]): Node | undefined {
    const h = percent(args[0]);
    const s = percent(args[1]);
    const l = percent(args[2]);
    const a = percent(args[3]);
    return new HSLColor(h % 360 / 360, s, l, a);
  }
}

class HSV extends BaseFunction {

  constructor() {
    super('hsv', 'ppp');
  }

  invoke(env: ExecEnv, args: Node[]): Node | undefined {
    const h = percent(args[0]);
    const s = percent(args[1]);
    const v = percent(args[2]);
    return RGBColor.fromHSVA(h % 360 / 360, s, v, 1.0);
  }
}

class HSVA extends BaseFunction {

  constructor() {
    super('hsva', 'pppp');
  }

  invoke(env: ExecEnv, args: Node[]): Node | undefined {
    const h = percent(args[0]);
    const s = percent(args[1]);
    const v = percent(args[2]);
    const a = percent(args[3]);
    return RGBColor.fromHSVA(h % 360 / 360, s, v, a);
  }
}

const scaled = (n: Node, scale: number): number => {
  const { value } = (n as Dimension);
  return (n as Dimension).unit === Unit.PERCENTAGE ? (value * 0.01) * scale : value;
};

const percent = (n: Node): number => {
  const { value } = (n as Dimension);
  return (n as Dimension).unit === Unit.PERCENTAGE ? value * 0.01 : value;
};

export const DEFINITIONS: { [x: string]: Function } = {
  rgb: new RGB(),
  rgba: new RGBA(),
  argb: new ARGB(),
  hsl: new HSL(),
  hsla: new HSLA(),
  hsv: new HSV(),
  hsva: new HSVA()
};