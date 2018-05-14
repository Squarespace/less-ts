import { ExecEnv, Function, Node } from '../../common';
import { Dimension, Unit } from '../../model';
import { BaseFunction } from '../base';
import { hsl, rgb } from './util';

const round = Math.round;

class Alpha extends BaseFunction {

  constructor() {
    super('alpha', 'c');
  }

  protected _invoke(env: ExecEnv, args: Node[]): Node | undefined {
    const c = rgb(args[0]);
    return new Dimension(c.a);
  }
}

class Blue extends BaseFunction {

  constructor() {
    super('blue', 'c');
  }

  protected _invoke(env: ExecEnv, args: Node[]): Node | undefined {
    const c = rgb(args[0]);
    return new Dimension(c.b);
  }
}

class Green extends BaseFunction {

  constructor() {
    super('green', 'c');
  }

  protected _invoke(env: ExecEnv, args: Node[]): Node | undefined {
    const c = rgb(args[0]);
    return new Dimension(c.g);
  }
}

class Hue extends BaseFunction {

  constructor() {
    super('hue', 'c');
  }

  protected _invoke(env: ExecEnv, args: Node[]): Node | undefined {
    const c = hsl(args[0]);
    return new Dimension(c.h);
  }
}

class Lightness extends BaseFunction {

  constructor() {
    super('lightness', 'c');
  }

  protected _invoke(env: ExecEnv, args: Node[]): Node | undefined {
    const c = hsl(args[0]);
    return new Dimension(round(c.l * 100), Unit.PERCENTAGE);
  }
}

class Luma extends BaseFunction {

  constructor() {
    super('luma', 'c');
  }

  protected _invoke(env: ExecEnv, args: Node[]): Node | undefined {
    const c = rgb(args[0]);
    return new Dimension(round(c.luma() * 100), Unit.PERCENTAGE);
  }
}

class Red extends BaseFunction {

  constructor() {
    super('red', 'c');
  }

  protected _invoke(env: ExecEnv, args: Node[]): Node | undefined {
    const c = rgb(args[0]);
    return new Dimension(c.r);
  }
}

class Saturation extends BaseFunction {

  constructor() {
    super('saturation', 'c');
  }

  protected _invoke(env: ExecEnv, args: Node[]): Node | undefined {
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
  red: new Red(),
  saturation: new Saturation()
};
