import { ExecEnv, Function, Node } from '../../common';
import { RGBColor } from '../../model';
import { BaseFunction } from '../base';
import { rgb } from './util';

const { abs } = Math;

class Average extends BaseFunction {

  constructor() {
    super('average', 'cc');
  }

  invoke(env: ExecEnv, args: Node[]): Node | undefined {
    const c1 = rgb(args[0]);
    const c2 = rgb(args[1]);
    const r = (c1.r + c2.r) / 2.0;
    const g = (c1.g + c2.g) / 2.0;
    const b = (c1.b + c2.b) / 2.0;
    return new RGBColor(r, g, b, 1.0);
  }

}

class Difference extends BaseFunction {

  constructor() {
    super('difference', 'cc');
  }

  invoke(env: ExecEnv, args: Node[]): Node | undefined {
    const c1 = rgb(args[0]);
    const c2 = rgb(args[1]);
    const r = abs(c1.r - c2.r);
    const g = abs(c1.g - c2.g);
    const b = abs(c1.b - c2.b);
    return new RGBColor(r, g, b, 1.0);
  }
}

class Exclusion extends BaseFunction {

  constructor() {
    super('exclusion', 'cc');
  }

  invoke(env: ExecEnv, args: Node[]): Node | undefined {
    const c1 = rgb(args[0]);
    const c2 = rgb(args[1]);
    const r = exclusion(c1.r, c2.r);
    const g = exclusion(c1.g, c2.g);
    const b = exclusion(c1.b, c2.b);
    return new RGBColor(r, g, b, 1.0);
  }

}

class Hardlight extends BaseFunction {

  constructor() {
    super('hardlight', 'cc');
  }

  invoke(env: ExecEnv, args: Node[]): Node | undefined {
    const c1 = rgb(args[0]);
    const c2 = rgb(args[1]);
    const r = hardlight(c1.r, c2.r);
    const g = hardlight(c1.g, c2.g);
    const b = hardlight(c1.b, c2.b);
    return new RGBColor(r, g, b, 1.0);
  }
}

class Multiply extends BaseFunction {

  constructor() {
    super('multiply', 'cc');
  }

  invoke(env: ExecEnv, args: Node[]): Node | undefined {
    const c1 = rgb(args[0]);
    const c2 = rgb(args[1]);
    const r = (c1.r * c2.r) / 255;
    const g = (c1.g * c2.g) / 255;
    const b = (c1.b * c2.b) / 255;
    return new RGBColor(r, g, b, 1.0);

  }
}

class Negation extends BaseFunction {

  constructor() {
    super('negation', 'cc');
  }

  invoke(env: ExecEnv, args: Node[]): Node | undefined {
    const c1 = rgb(args[0]);
    const c2 = rgb(args[1]);
    const r = negation(c1.r, c2.r);
    const g = negation(c1.g, c2.g);
    const b = negation(c1.b, c2.b);
    return new RGBColor(r, g, b, 1.0);

  }
}

class Overlay extends BaseFunction {

  constructor() {
    super('overlay', 'cc');
  }

  invoke(env: ExecEnv, args: Node[]): Node | undefined {
    const c1 = rgb(args[0]);
    const c2 = rgb(args[1]);
    const r = overlay(c1.r, c2.r);
    const g = overlay(c1.g, c2.g);
    const b = overlay(c1.b, c2.b);
    return new RGBColor(r, g, b, 1.0);
  }
}

class Screen extends BaseFunction {

  constructor() {
    super('screen', 'cc');
  }

  invoke(env: ExecEnv, args: Node[]): Node | undefined {
    const c1 = rgb(args[0]);
    const c2 = rgb(args[1]);
    const r = screen(c1.r, c2.r);
    const g = screen(c1.g, c2.g);
    const b = screen(c1.b, c2.b);
    return new RGBColor(r, g, b, 1.0);
  }
}

class Softlight extends BaseFunction {

  constructor() {
    super('softlight', 'cc');
  }

  invoke(env: ExecEnv, args: Node[]): Node | undefined {
    const c1 = rgb(args[0]);
    const c2 = rgb(args[1]);
    const r = softlight(c1.r, c2.r);
    const g = softlight(c1.g, c2.g);
    const b = softlight(c1.b, c2.b);
    return new RGBColor(r, g, b, 1.0);
  }
}

const exclusion = (c1: number, c2: number): number =>
  (c1 + c2 * (255 - c1 - c1) / 255.0);

const hardlight = (c1: number, c2: number): number =>
  c2 < 128 ? (2 * c2 * c1 / 255.0)
    : (255 - 2 * (255 - c2) * (255 - c1) / 255.0);

const negation = (c1: number, c2: number): number =>
  255 - abs(255 - c2 - c1);

const overlay = (c1: number, c2: number): number =>
  c1 < 128 ? 2 * c1 * c2 / 255.0
    : 255 - 2 * (255 - c1) * (255 - c2) / 255.0;

const screen = (c1: number, c2: number): number =>
  255 - (255 - c1) * (255 - c2) / 255.0;

const softlight = (c1: number, c2: number): number => {
  const t = c2 * c1 / 255;
  return t + c1 * (255 - (255 - c1) * (255 - c2) / 255 - t) / 255;
};

export const BLENDING: { [x: string]: Function } = {
  average: new Average(),
  difference: new Difference(),
  exclusion: new Exclusion(),
  hardlight: new Hardlight(),
  multiply: new Multiply(),
  negation: new Negation(),
  overlay: new Overlay(),
  screen: new Screen(),
  softlight: new Softlight()
};
