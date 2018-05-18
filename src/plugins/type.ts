import { ExecEnv, Function, Node, NodeType } from '../common';
import { Dimension, FALSE, Keyword, Quoted, TRUE, Unit } from '../model';
import { BaseFunction } from './base';

class IsColor extends BaseFunction {

  constructor() {
    super('iscolor', '*');
  }

  invoke(env: ExecEnv, args: Node[]): Node | undefined {
    return args[0].type === NodeType.COLOR ? TRUE : FALSE;
  }
}

class DimensionUnit extends BaseFunction {

  constructor(name: string, readonly unit: Unit) {
    super(name, '*');
  }

  invoke(env: ExecEnv, args: Node[]): Node | undefined {
    const arg = args[0];
    return arg.type === NodeType.DIMENSION && (arg as Dimension).unit === this.unit ? TRUE : FALSE;
  }

}

class IsEm extends DimensionUnit {

  constructor() {
    super('isem', Unit.EM);
  }

}

class IsKeyword extends BaseFunction {

  constructor() {
    super('iskeyword', '*');
  }

  invoke(env: ExecEnv, args: Node[]): Node | undefined {
    switch (args[0].type) {
      case NodeType.FALSE:
      case NodeType.KEYWORD:
      case NodeType.TRUE:
        return TRUE;
      default:
        return FALSE;
    }
  }
}

class IsNumber extends BaseFunction {

  constructor() {
    super('isnumber', '*');
  }

  invoke(env: ExecEnv, args: Node[]): Node | undefined {
    return args[0].type === NodeType.DIMENSION ? TRUE : FALSE;
  }
}

class IsPercentage extends DimensionUnit {

  constructor() {
    super('ispercentage', Unit.PERCENTAGE);
  }

}

class IsPixel extends DimensionUnit {

  constructor() {
    super('ispixel', Unit.PX);
  }

}

class IsString extends BaseFunction {

  constructor() {
    super('isstring', '*');
  }

  invoke(env: ExecEnv, args: Node[]): Node | undefined {
    return args[0].type === NodeType.QUOTED ? TRUE : FALSE;
  }

}

class IsUnit extends BaseFunction {

  constructor() {
    super('isunit', '**');
  }

  invoke(env: ExecEnv, args: Node[]): Node | undefined {
    if (args[0].type !== NodeType.DIMENSION) {
      return FALSE;
    }
    const dim = args[0] as Dimension;
    let unit: Unit | undefined;

    if (args[1].type === NodeType.KEYWORD) {
      unit = (args[1] as Keyword).value as Unit;
    } else if (args[1].type === NodeType.QUOTED) {
      const str = (args[1] as Quoted).copy();
      str.escaped = true;
      unit = env.ctx.render(str) as Unit;
    } else {
      return FALSE;
    }
    return unit === dim.unit ? TRUE : FALSE;
  }

}

class IsUrl extends BaseFunction {

  constructor() {
    super('isurl', '*');
  }

  invoke(env: ExecEnv, args: Node[]): Node | undefined {
    return args[0].type === NodeType.URL ? TRUE : FALSE;
  }

}

export const TYPE: { [x: string]: Function } = {
  iscolor: new IsColor(),
  isem: new IsEm(),
  iskeyword: new IsKeyword(),
  isnumber: new IsNumber(),
  ispercentage: new IsPercentage(),
  ispixel: new IsPixel(),
  isstring: new IsString(),
  isunit: new IsUnit(),
  isurl: new IsUrl()
};
