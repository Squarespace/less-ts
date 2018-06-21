import { Buffer, ExecEnv, Node, NodeName, NodeType } from '../common';
import { expectedBoolOp, uncomparableType } from '../errors';
import { Anonymous } from './general';
import { colorFromName, BaseColor, RGBColor } from './color';
import { unitConversionFactor, Dimension, Unit } from './dimension';
import { False, Keyword, True } from './keyword';
import { Operator } from './operation';
import { arrayEquals } from '../utils';

export const FALSE = new False();
export const TRUE = new True();

const compareString = (a: string, b: string): number =>
  a < b ? -1 : a > b ? 1 : 0;

export class Condition extends Node {

  constructor(
    readonly operator: Operator,
    readonly left: Node,
    readonly right: Node,
    readonly negate: boolean | number) {
    super(NodeType.CONDITION);
  }

  equals(n: Node): boolean {
    return n.type === NodeType.CONDITION
        && this.operator === (n as Condition).operator
        && this.negate === (n as Condition).negate
        && this.left.equals((n as Condition).left)
        && this.right.equals((n as Condition).right);
  }

  repr(buf: Buffer): void {
    if (this.negate) {
      buf.str('not ');
    }
    const nested = this.left.type === NodeType.CONDITION || this.right.type === NodeType.CONDITION;
    if (!nested) {
      buf.str('(');
    }
    this.left.repr(buf);
    buf.str(' ').str(this.operator).str(' ');
    this.right.repr(buf);
    if (!nested) {
      buf.str(')');
    }
  }

  needsEval(): boolean {
    return true;
  }

  eval(env: ExecEnv): Node {
    const res = this.negate ? !this.compare(env) : this.compare(env);
    return res ? TRUE : FALSE;
  }

  protected compare(env: ExecEnv): boolean {
    const { operator, left, right } = this;
    const op0 = left.needsEval() ? left.eval(env) : left;
    const op1 = right.needsEval() ? right.eval(env) : right;

    switch (operator) {
      case Operator.ADD:
      case Operator.DIVIDE:
      case Operator.MULTIPLY:
      case Operator.SUBTRACT:
      {
        // Conditions only use boolean operators.
        const { ctx } = env;
        env.errors.push(expectedBoolOp(operator));
        return false;
      }

      case Operator.AND:
        return truthValue(env, op0) && truthValue(env, op1);

      case Operator.OR:
        return truthValue(env, op0) || truthValue(env, op1);

      default:
        break;
    }

    let res = -1;
    const { type } = op0;
    switch (type) {
      case NodeType.ANONYMOUS:
      {
        const lval = (op0 as Anonymous).value;
        const rval = env.render(op1);
        res = compareString(lval, rval);
        break;
      }

      case NodeType.COLOR:
        res = compareColor(op0 as BaseColor, op1);
        break;

      case NodeType.DIMENSION:
        res = compareDimension(op0 as Dimension, op1);
        break;

      case NodeType.KEYWORD:
      case NodeType.TRUE:
      case NodeType.FALSE:
        res = compareKeyword(op0 as Keyword, op1);
        break;

      case NodeType.QUOTED:
      {
        const lval = env.render(op0);
        const rval = env.render(op1);
        res = compareString(lval, rval);
        break;
      }

      default:
        env.errors.push(uncomparableType(NodeName[type]));
        return false;
    }

    switch (res) {
      case -1:
        return operator === Operator.LESS_THAN
            || operator === Operator.LESS_THAN_OR_EQUAL
            || operator === Operator.NOT_EQUAL;
      case 0:
        return operator === Operator.EQUAL
            || operator === Operator.LESS_THAN_OR_EQUAL
            || operator === Operator.GREATER_THAN_OR_EQUAL;
      case 1:
        return operator === Operator.GREATER_THAN
            || operator === Operator.GREATER_THAN_OR_EQUAL
            || operator === Operator.NOT_EQUAL;
      default:
        return false;
    }
  }

}

export class Guard extends Node {

  constructor(readonly conditions: Condition[]) {
    super(NodeType.GUARD);
  }

  equals(n: Node): boolean {
    return n.type === NodeType.GUARD
        && arrayEquals(this.conditions, (n as Guard).conditions);
  }

  repr(buf: Buffer): void {
    const { conditions } = this;
    const len = conditions.length;
    for (let i = 0; i < len; i++) {
      if (i > 0) {
        buf.str(', '); // TODO: could be compressed with listsep
      }
      conditions[i].repr(buf);
    }
  }

  needsEval(): boolean {
    return true;
  }

  eval(env: ExecEnv): Node {
    let res: Node = FALSE;
    for (const c of this.conditions) {
      res = c.eval(env);
      if (res.type === NodeType.TRUE) {
        break;
      }
    }
    return res;
  }

}

const truthValue = (env: ExecEnv, node: Node): boolean => {
  const { type } = node;
  switch (type) {
    case NodeType.ANONYMOUS:
      return (node as Anonymous).value === 'true';

    case NodeType.KEYWORD:
      return (node as Keyword).value === 'true';

    case NodeType.QUOTED:
      return env.render(node) === 'true';

    case NodeType.TRUE:
      return true;

    default:
      return false;
  }
};

const compareColor = (left: BaseColor, right: Node): number => {
  let rval: RGBColor | undefined;
  if (right.type === NodeType.KEYWORD) {
    rval = colorFromName((right as Keyword).value);
  } else if (right.type === NodeType.COLOR) {
    rval = (right as BaseColor).toRGB();
  }
  if (!rval) {
    return -1;
  }
  const lval = left.toRGB();
  return lval.r === rval.r
      && lval.g === rval.g
      && lval.b === rval.b
      && lval.a === rval.a ? 0 : -1;
};

const compareDimension = (left: Dimension, right: Node): number => {
  if (right.type !== NodeType.DIMENSION) {
    return -1;
  }

  const rval = (right as Dimension);

  const basevalue = left.value;
  const baseunit = left.unit === Unit.PERCENTAGE ? undefined : left.unit;
  const unit = rval.unit === Unit.PERCENTAGE ? undefined : rval.unit;

  let value = rval.value;
  let factor = 1.0;
  if (baseunit !== unit) {
    factor = unitConversionFactor(rval.unit, baseunit);
    if (factor === 0) {
      // Units are not compatible
      return -1;
    }
    value *= factor;
  }
  return basevalue < value ? -1 : basevalue > value ? 1 : 0;
};

const compareKeyword = (left: Keyword, right: Node): number => {
  switch (right.type) {
    case NodeType.FALSE:
    case NodeType.KEYWORD:
    case NodeType.TRUE:
      return compareString(left.value, (right as Keyword).value);
    default:
      return -1;
  }
};
