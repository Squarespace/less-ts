import { Buffer, ExecEnv, Node, NodeName, NodeType } from '../common';
import { Patch } from '../compat';
import { badColorMath, divideByZero, expectedMathOp, incompatibleUnits, invalidOperation, invalidOperation1 } from '../errors';
import { colorFromName, BaseColor, RGBColor } from './color';
import { unitConversionFactor, unitDisplay, Dimension, Unit } from './dimension';
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
  MULTIPLY = '*',
  NOT_EQUAL = '<>',
  OR = 'or',
  SUBTRACT = '-',
}

export const parseOperator = (op: string | undefined): Operator | undefined => {
  if (op === undefined) {
    return undefined;
  }
  switch (op) {
    case '+':
      return Operator.ADD;
    case '/':
      return Operator.DIVIDE;
    case '>':
      return Operator.GREATER_THAN;
    case '<':
      return Operator.LESS_THAN;
    case '*':
      return Operator.MULTIPLY;
    case '-':
      return Operator.SUBTRACT;

    case '=':
    case '==':
      return Operator.EQUAL;

    case '>=':
    case '=>':
      return Operator.GREATER_THAN_OR_EQUAL;

    case '<=':
    case '=<':
      return Operator.LESS_THAN_OR_EQUAL;

    case '!=':
    case '<>':
      return Operator.NOT_EQUAL;

    default:
      return undefined;
  }
};

export class Operation extends Node {
  constructor(
    readonly operator: Operator,
    readonly left: Node,
    readonly right: Node,
  ) {
    super(NodeType.OPERATION);
  }

  equals(n: Node): boolean {
    return (
      n.type === NodeType.OPERATION &&
      this.operator === (n as Operation).operator &&
      this.left.equals((n as Operation).left) &&
      this.right.equals((n as Operation).right)
    );
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
      if (operator === Operator.MULTIPLY || operator === Operator.ADD) {
        [op0, op1] = [op1, op0];
      } else {
        // Java main (strict): a color cannot be subtracted or divided
        // from a dimension.
        const verb = operator === Operator.SUBTRACT ? 'be subtracted from' : 'divide';
        env.errors.push(badColorMath(verb, env.ctx.render(op0)));
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
        if (dim.unit) {
          // Java main (strict): a dimension with a unit cannot operate
          // on a color.
          env.errors.push(incompatibleUnits(unitDisplay(dim.unit), 'COLOR'));
          return left;
        }
        // COLOR_CHANNEL_PRECISION: legacy converts the scalar to an
        // int channel, truncating the fraction (#fff * 0.5 -> #000).
        // Fixed levels keep the fraction; the ctor's round is the
        // final one (#fff * 0.5 -> 127.5 -> grey).
        if (env.ctx.compat.enabled(Patch.COLOR_CHANNEL_PRECISION)) {
          const v = Math.trunc(dim.value);
          right = new RGBColor(v, v, v, 1.0);
        } else {
          return operateColorScalar(env, op, (left as BaseColor).toRGB(), dim.value);
        }
      }
      if (right.type === NodeType.COLOR) {
        return operateColor(env, op, (left as BaseColor).toRGB(), (right as BaseColor).toRGB());
      }
      env.errors.push(invalidOperation1(op.toString(), 'COLOR'));
      break;

    case NodeType.DIMENSION:
      if (right.type === NodeType.DIMENSION) {
        return operateDimension(env, op, left as Dimension, right as Dimension);
      }
      // Java Dimension.operate: the right operand must be a dimension.
      env.errors.push(invalidOperation1(op.toString(), 'DIMENSION'));
      break;

    default:
      // Java Node.operate default: fail the operation with both operand
      // types, e.g. lighten(...) + 1 or 1 + unit(5px).
      env.errors.push(invalidOperation(op.toString(), NodeName[left.type], NodeName[right.type]));
      break;
  }
  return left;
};

/**
 * Apply an operator to color arguments. The channels are ints (the
 * ctor rounds), so only division can leave a fraction. While
 * COLOR_CHANNEL_PRECISION is active it truncates (128 / 3 = 42); at
 * the fixed level the fraction survives to the ctor's round
 * (128 / 3 -> 43). A zero channel divides by 1, not 255.
 */
const operateColor = (env: ExecEnv, op: Operator, c0: RGBColor, c1: RGBColor): RGBColor => {
  const { r, g, b } = c1;
  const a = c0.a + c1.a; // the ctor clamps it to [0, 1]
  const legacy = env.ctx.compat.enabled(Patch.COLOR_CHANNEL_PRECISION);
  switch (op) {
    case Operator.ADD:
      return new RGBColor(c0.r + r, c0.g + g, c0.b + b, a);

    case Operator.DIVIDE:
      if (legacy) {
        return new RGBColor(
          Math.trunc(c0.r / (r === 0 ? 1 : r)),
          Math.trunc(c0.g / (g === 0 ? 1 : g)),
          Math.trunc(c0.b / (b === 0 ? 1 : b)),
          a,
        );
      }
      return new RGBColor(c0.r / (r === 0 ? 1 : r), c0.g / (g === 0 ? 1 : g), c0.b / (b === 0 ? 1 : b), a);
    case Operator.MULTIPLY:
      return new RGBColor(r * c0.r, g * c0.g, b * c0.b, a);

    case Operator.SUBTRACT:
      return new RGBColor(c0.r - r, c0.g - g, c0.b - b, a);

    default: {
      env.errors.push(invalidOperation1(op.toString(), 'COLOR'));
      return c0;
    }
  }
};

/**
 * Channel math with a fractional scalar (Java
 * BaseColor.operateFixed): the scalar stays a double until the ctor
 * rounds, and its alpha is 1.0, so the result's is too.
 */
const operateColorScalar = (env: ExecEnv, op: Operator, c0: RGBColor, scalar: number): RGBColor => {
  const a = c0.a + 1.0; // the ctor clamps it to 1.0
  switch (op) {
    case Operator.ADD:
      return new RGBColor(c0.r + scalar, c0.g + scalar, c0.b + scalar, a);

    case Operator.DIVIDE: {
      const s = scalar === 0 ? 1 : scalar;
      return new RGBColor(c0.r / s, c0.g / s, c0.b / s, a);
    }

    case Operator.MULTIPLY:
      return new RGBColor(c0.r * scalar, c0.g * scalar, c0.b * scalar, a);

    case Operator.SUBTRACT:
      return new RGBColor(c0.r - scalar, c0.g - scalar, c0.b - scalar, a);

    default: {
      env.errors.push(invalidOperation1(op.toString(), 'COLOR'));
      return c0;
    }
  }
};

const ZERO = new Dimension(0, undefined);

/**
 * Apply an operator to dimension arguments.
 */
const operateDimension = (env: ExecEnv, op: Operator, n0: Dimension, n1: Dimension): Node => {
  const u0 = n0.unit;
  const u1 = n1.unit;
  const unit = u0 ? u0 : u1;

  let factor = unitConversionFactor(u1, u0);
  if (factor === 0) {
    // Java main: incompatible units raise an INCOMPATIBLE_UNITS warning
    // (silently when the right operand is a percentage), then fall back
    // to unitless arithmetic.
    if (u1 !== undefined && u1 !== Unit.PERCENTAGE) {
      const info = incompatibleUnits(unitDisplay(u0), unitDisplay(u1));
      env.warnings.push(`${info.message}.. stripping unit.`);
    }
    factor = 1.0;
  }
  const scaled = n1.value * factor;
  let result = 0.0;

  switch (op) {
    case Operator.DIVIDE:
      if (scaled !== 0.0) {
        result = n0.value / scaled;
      } else {
        // Java renders the operand as its model repr, e.g. DIMENSION 1.0,
        // DIMENSION 1.0 PX (pixels).
        env.errors.push(divideByZero(n0.modelRepr()));
      }
      break;

    case Operator.MULTIPLY:
      result = n0.value * scaled;
      break;

    case Operator.SUBTRACT:
      result = n0.value - scaled;
      break;

    case Operator.ADD:
      result = n0.value + scaled;
      break;

    default:
      env.errors.push(expectedMathOp(op));
      break;
  }
  return new Dimension(result, unit);
};
