import { Buffer, ExecEnv, Node, NodeType } from '../common';
import { BaseColor, RGBColor, colorFromName } from './color';
import { Dimension, unitConversionFactor } from './dimension';
import { Keyword } from './keyword';

export const enum Operator {
  ADD = '+',
  AND = 'and',
  DIVIDE = '/',
  EQUAL = '=',
  GREATER_THAN = '>',
  GREATER_THAN_OR_EQUAL = '>=',
  LESS_THAN = '<',
  LESS_THAN_OR_EQUAL = '<=',
  MULTILY = '*',
  NOT_EQUAL = '<>',
  OR = 'or',
  SUBTRACT = '-'
}

export class Operation extends Node {

  constructor(
    readonly operator: Operator,
    readonly left: Node,
    readonly right: Node
  ) {
    super(NodeType.OPERATION);
  }

  equals(n: Node): boolean {
    return n.type === NodeType.OPERATION
        && this.operator === (n as Operation).operator
        && this.left.equals((n as Operation).left)
        && this.right.equals((n as Operation).right);
  }

  repr(buf: Buffer): void {
    buf.str('(');
    this.left.repr(buf);
    buf.str(' ').str(this.operator).str(' ');
    this.right.repr(buf);
    buf.str(')');
  }

  needsEval(): boolean {
    return true;
  }

  eval(env: ExecEnv): Node {
    const { operator, left, right } = this;
    let op0 = cast(left.needsEval() ? left.eval(env) : left);
    let op1 = cast(right.needsEval() ? right.eval(env) : right);
    if (op0.type === NodeType.DIMENSION && op1.type === NodeType.COLOR) {
      if (operator === Operator.MULTILY || operator === Operator.ADD) {
        [op0, op1] = [op1, op0];
      } else {
        // TODO:
        return op0;
      }
    }
    return operate(env, operator, op0, op1);
  }
}

const cast = (n: Node): Node => {
  if (n.type === NodeType.KEYWORD) {
    const color = colorFromName((n as Keyword).value);
    return color ? color : n;
  }
  return n;
};

const operate = (env: ExecEnv, op: Operator, left: Node, right: Node): Node => {
  switch (left.type) {
    case NodeType.COLOR:
      if (right.type === NodeType.DIMENSION) {
        const dim = right as Dimension;
        right = new RGBColor(dim.value, dim.value, dim.value, 1.0);
      }
      if (right.type === NodeType.COLOR) {
        return operateColor(op, (left as BaseColor).toRGB(), (right as BaseColor).toRGB());
      }
      break;

    case NodeType.DIMENSION:
      if (right.type === NodeType.DIMENSION) {
        return operateDimension(op, left as Dimension, right as Dimension);
      }
      break;
  }
  return left;
};

/**
 * Apply an operator to color arguments.
 */
const operateColor = (op: Operator, c0: RGBColor, c1: RGBColor): RGBColor => {
  const { r, g, b } = c1;
  const a = Math.min(1.0, c0.a + c1.a);
  switch (op) {
    case Operator.ADD:
      return new RGBColor(c0.r + r, c0.g + g, c0.b + b, a);

    case Operator.DIVIDE:
      return new RGBColor(
        r ? (c0.r / r) : 255,
        g ? (c0.g / g) : 255,
        b ? (c0.b / b) : 255,
        a);
    case Operator.MULTILY:
      return new RGBColor(r * c0.r, g * c0.g, b * c0.b, a);

    case Operator.SUBTRACT:
      return new RGBColor(c0.r - r, c0.g - g, c0.b - b, a);

    default:
      return c0;
  }
};

/**
 * Apply an operator to dimension arguments.
 */
const operateDimension = (op: Operator, n0: Dimension, n1: Dimension): Node => {
  const u0 = n0.unit;
  const u1 = n1.unit;
  const unit = u0 ? u0 : u1;
  const factor = unitConversionFactor(u0, u1);
  const scaled = n1.value * factor;
  let result = 0.0;

  switch (op) {
    case Operator.DIVIDE:
      if (scaled !== 0.0) {
        result = n0.value / scaled;
      }
      break;

    case Operator.MULTILY:
      result = n0.value * scaled;
      break;

    case Operator.SUBTRACT:
      result = n0.value - scaled;
      break;

    case Operator.ADD:
    default:
      result = n0.value + scaled;
      break;
  }
  return new Dimension(result, unit);
};
