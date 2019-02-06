import { ExecEnv, Function, Node, NodeType } from '../common';
import { Dimension, ExpressionList } from '../model';
import { BaseFunction } from './base';

const { round } = Math;

class Extract extends BaseFunction {

  constructor() {
    super('extract', '**.');
  }

  invoke(env: ExecEnv, args: Node[]): Node | undefined {
    const arg1 = args[0];
    const arg2 = args[1];
    if (arg1.type !== NodeType.EXPRESSION_LIST || arg2.type !== NodeType.DIMENSION) {
      // Bail out and emit literal representation of function call
      return undefined;
    }
    const { values } = (arg1 as ExpressionList);
    const len = values.length;
    const index = (arg2 as Dimension).value;
    if (index !== round(index) || index < 0 || index >= len) {
      // Bail out and emit literal representation of function call.
      return undefined;
    }
    return values[index];
  }

}

class Length extends BaseFunction {

  constructor() {
    super('length', '*.');
  }

  invoke(env: ExecEnv, args: Node[]): Node | undefined {
    const arg = args[0];
    let size = 1;
    if (arg.type === NodeType.EXPRESSION_LIST) {
      size = (arg as ExpressionList).values.length;
    }
    return new Dimension(size);
  }

}

export const LIST: { [x: string]: Function } = {
  extract: new Extract(),
  length: new Length()
};
