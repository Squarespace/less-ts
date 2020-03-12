import { ExecEnv, Function, Node } from '../../common';
import { Dimension, Unit } from '../../model';
import { BaseFunction } from '../base';
import { hsl, rgb } from './util';

const round = Math.round;

class Alpha extends BaseFunction {

  constructor() {
    super('alpha', 'c');
  }

  invoke(env: ExecEnv, args: Node[]): Node | undefined {
    const c = rgb(args[0]);
    return new Dimension(c.a);
  }
}

class Blue extends BaseFunction {

  constructor() {
    super('blue', 'c');
  }

  invoke(env: ExecEnv, args: Node[]): Node | undefined {
    const c = rgb(args[0]);
    return new Dimension(c.b);
  }
}

class Green extends BaseFunction {

  constructor() {
    super('green', 'c');
  }

  invoke(env: ExecEnv, args: Node[]): Node | undefined {
    const c = rgb(args[0]);
    return new Dimension(c.g);
  }
}

class Hue extends BaseFunction {

  constructor() {
    super('hue', 'c');
  }

  invoke(env: ExecEnv, args: Node[]): Node | undefined {
    const c = hsl(args[0]);
    return new Dimension(c.h);
  }
}

class Lightness extends BaseFunction {

  constructor() {
    super('lightness', 'c');
  }

  invoke(env: ExecEnv, args: Node[]): Node | undefined {
    const c = hsl(args[0]);
    return new Dimension(round(c.l * 100), Unit.PERCENTAGE);
  }
}

class Luma extends BaseFunction {

  constructor() {
    super('luma', 'c');
  }

  invoke(env: ExecEnv, args: Node[]): Node | undefined {
    const c = rgb(args[0]);
    return new Dimension(c.luma() * c.a * 100, Unit.PERCENTAGE);
  }
}

class Luminance extends BaseFunction {
  constructor() {
    super('luminance', 'c');
  }

  invoke(env: ExecEnv, args: Node[]): Node | undefined {
    const c = rgb(args[0]);
    const luminance =
      (0.2126 * c.r / 255)
      + (0.7152 * c.g / 255)
      + (0.0722 * c.b / 255);
    return new Dimension(Math.round(luminance * c.a * 100), Unit.PERCENTAGE);
  }
}

class Red extends BaseFunction {

  constructor() {
    super('red', 'c');
  }

  invoke(env: ExecEnv, args: Node[]): Node | undefined {
    const c = rgb(args[0]);
    return new Dimension(c.r);
  }
}

class Saturation extends BaseFunction {

  constructor() {
    super('saturation', 'c');
  }

  invoke(env: ExecEnv, args: Node[]): Node | undefined {
    const c = hsl(args[0]);
    return new Dimension(round(c.s * 100), Unit.PERCENTAGE);
  }

}

export const CHANNELS: { [x: string]: Function } = {
  alpha: new Alpha(),
  blue: new Blue(),
  green: new Green(),
  hue: new Hue(),
  lightness: new Lightness(),
  luma: new Luma(),
  luminance: new Luminance(),
  red: new Red(),
  saturation: new Saturation()
};
