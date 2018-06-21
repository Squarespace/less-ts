import { ExecEnv, Function, Node, NodeType } from '../../common';
import { Dimension, HSLColor, RGBColor, Unit } from '../../model';
import { BaseFunction } from '../base';
import { hsl, rgb } from './util';

const BLACK = new RGBColor(0, 0, 0, 1.0);
const WHITE = new RGBColor(255, 255, 255, 1.0);

class Contrast extends BaseFunction {

  constructor() {
    super('constrast', '*:ccp');
  }

  invoke(env: ExecEnv, args: Node[]): Node | undefined {
    const arg = args[0];
    if (arg === undefined || arg.type !== NodeType.COLOR) {
      return undefined;
    }
    const len = args.length;
    const color = rgb(arg);
    const dark = len >= 2 ? rgb(args[1]) : BLACK;
    const light = len >= 3 ? rgb(args[2]) : WHITE;
    const threshold = len >= 4 ? num(args[3]) : 0.43;
    const value =
       (0.2126 * (color.r / 255)
      + 0.7152 * (color.g / 255)
      + 0.0722 * (color.b / 255))
      * color.a;
    return value < threshold ? light : dark;
  }

}

class Darken extends BaseFunction {

  constructor() {
    super('darken', 'cp');
  }

  invoke(env: ExecEnv, args: Node[]): Node | undefined {
    const c = hsl(args[0]);
    const value = num(args[1]) * 0.01;
    return new HSLColor(c.h / 360, c.s, c.l - value, c.a);
  }
}

class Desaturate extends BaseFunction {

  constructor() {
    super('desaturate', 'cp');
  }

  invoke(env: ExecEnv, args: Node[]): Node | undefined {
    const c = hsl(args[0]);
    const value = num(args[1]) * 0.01;
    return new HSLColor(c.h / 360, c.s - value, c.l, c.a);
  }
}

class Fade extends BaseFunction {

  constructor() {
    super('fade', 'cp');
  }

  invoke(env: ExecEnv, args: Node[]): Node | undefined {
    const c = rgb(args[0]);
    const alpha = num(args[1]) * 0.01;
    return new RGBColor(c.r, c.g, c.b, alpha);
  }
}

class FadeIn extends BaseFunction {

  constructor() {
    super('fadein', 'cp');
  }

  invoke(env: ExecEnv, args: Node[]): Node | undefined {
    const c = rgb(args[0]);
    const amt = num(args[1]) * 0.01;
    return new RGBColor(c.r, c.g, c.b, c.a + amt);
  }
}

class FadeOut extends BaseFunction {

  constructor() {
    super('fadeout', 'cp');
  }

  invoke(env: ExecEnv, args: Node[]): Node | undefined {
    const c = rgb(args[0]);
    const amt = num(args[1]) * 0.01;
    return new RGBColor(c.r, c.g, c.b, c.a - amt);
  }
}

class Greyscale extends BaseFunction {

  constructor() {
    super('greyscale', 'c');
  }

  invoke(env: ExecEnv, args: Node[]): Node | undefined {
    const c = hsl(args[0]);
    return new HSLColor(c.h / 360, 0, c.l, c.a);
  }
}

class Lighten extends BaseFunction {

  constructor() {
    super('lighten', 'cp');
  }

  invoke(env: ExecEnv, args: Node[]): Node | undefined {
    const c = hsl(args[0]);
    const val = num(args[1]) * 0.01;
    return new HSLColor(c.h / 360, c.s, c.l + val, c.a);
  }
}

class Mix extends BaseFunction {

  constructor() {
    super('mix', 'cc:d');
  }

  invoke(env: ExecEnv, args: Node[]): Node | undefined {
    const c1 = rgb(args[0]);
    const c2 = rgb(args[1]);
    let wt = 0.5;
    if (args.length >= 3) {
      wt = num(args[2]) * 0.01;
    }
    return mix(c1, c2, wt);
  }
}

class Saturate extends BaseFunction {

  constructor() {
    super('saturate', 'cp');
  }

  invoke(env: ExecEnv, args: Node[]): Node | undefined {
    const c = hsl(args[0]);
    const val = num(args[1]) * 0.01;
    return new HSLColor(c.h / 360, c.s + val, c.l, c.a);
  }
}

class Shade extends BaseFunction {

  constructor() {
    super('shade', 'cd');
  }

  invoke(env: ExecEnv, args: Node[]): Node | undefined {
    const c = rgb(args[0]);
    const dim = args[1] as Dimension;
    return mix(BLACK, c, dim.value * 0.01);
  }
}

class Spin extends BaseFunction {

  constructor() {
    super('spin', 'cp');
  }

  invoke(env: ExecEnv, args: Node[]): Node | undefined {
    const c = hsl(args[0]);
    const amt = args[1] as Dimension;
    let { value } = amt;
    if (amt.unit === Unit.PERCENTAGE) {
      value = (value * 0.01) * 360.0;
    }
    let h = (c.h + value) % 360;
    h = h < 0 ? 360 + h : h;
    return new HSLColor(h / 360, c.s, c.l, c.a);
  }
}

class Tint extends BaseFunction {

  constructor() {
    super('tint', 'cd');
  }

  invoke(env: ExecEnv, args: Node[]): Node | undefined {
    const c = rgb(args[0]);
    const dim = args[1] as Dimension;
    const wt = dim.value * 0.01;
    return mix(WHITE, c, wt);
  }
}

const num = (n: Node): number => (n as Dimension).value;

const mix = (c1: RGBColor, c2: RGBColor, weight: number): RGBColor => {
  const p = weight;
  const w = p * 2 - 1;
  const a = c1.toHSL().a - c2.toHSL().a;
  const w1 = (((w * a === -1) ? w : (w + a) / (1 + w * a)) + 1) / 2.0;
  const w2 = 1 - w1;
  const r = c1.r * w1 + c2.r * w2;
  const g = c1.g * w1 + c2.g * w2;
  const b = c1.b * w1 + c2.b * w2;
  const _a = c1.a * p + c2.a * (1 - p);
  return new RGBColor(r, g, b, _a);
};

export const OPERATIONS: { [x: string]: Function } = {
  contrast: new Contrast(),
  darken: new Darken(),
  desaturate: new Desaturate(),
  fade: new Fade(),
  fadein: new FadeIn(),
  fadeout: new FadeOut(),
  greyscale: new Greyscale(),
  lighten: new Lighten(),
  mix: new Mix(),
  saturate: new Saturate(),
  shade: new Shade(),
  spin: new Spin(),
  tint: new Tint()
};
