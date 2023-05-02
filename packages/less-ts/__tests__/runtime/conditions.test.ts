import { LessCompiler, Node, NodeType } from '../../src';
import { Condition, Dimension, FALSE, Keyword, Operator, RGBColor, TRUE, Unit } from '../../src/model';
import { RuntimeContext, RuntimeExecEnv } from '../../src/runtime';

const dim = (n: number, unit?: Unit) => new Dimension(n, unit);
const kwd = (s: string, t?: NodeType) => new Keyword(s, t);

const cond = (op: Operator, a: Node, b: Node, negate: boolean = false) => new Condition(op, a, b, negate);

const eq = (a: Node, b: Node, negate: boolean = false) => cond(Operator.EQUAL, a, b, negate);

const lt = (a: Node, b: Node, negate: boolean = false) => cond(Operator.LESS_THAN, a, b, negate);

const lte = (a: Node, b: Node, negate: boolean = false) => cond(Operator.LESS_THAN_OR_EQUAL, a, b, negate);

const gt = (a: Node, b: Node, negate: boolean = false) => cond(Operator.GREATER_THAN, a, b, negate);

const gte = (a: Node, b: Node, negate: boolean = false) => cond(Operator.GREATER_THAN_OR_EQUAL, a, b, negate);

test('condition errors', () => {
  const compiler = new LessCompiler({});
  const ctx = compiler.context();
  let c: Condition;

  const five = dim(5);
  const ten = dim(10);

  const env = ctx.newEnv();
  c = cond(Operator.ADD, five, ten);
  c.eval(env);
  ctx.captureErrors(c, env);
  expect(ctx.errors.length).toEqual(1);
  expect(ctx.errors[0].errors[0].type).toEqual('runtime');
  expect(ctx.errors[0].errors[0].message).toContain('Expected a boolean operator');
});

test('condition - same types', () => {
  const compiler = new LessCompiler({});
  const ctx = compiler.context();
  const env = new RuntimeExecEnv(ctx, []);
  let c: Condition;

  const five = dim(5);
  const ten = dim(10);

  // equal
  c = eq(five, five);
  expect(c.eval(env)).toEqual(TRUE);
  c = eq(five, ten);
  expect(c.eval(env)).toEqual(FALSE);
  c = eq(ten, five);
  expect(c.eval(env)).toEqual(FALSE);

  // less than
  c = lt(five, ten);
  expect(c.eval(env)).toEqual(TRUE);
  c = lt(five, five);
  expect(c.eval(env)).toEqual(FALSE);
  c = lt(ten, five);
  expect(c.eval(env)).toEqual(FALSE);

  // less than or equal
  c = lte(five, ten);
  expect(c.eval(env)).toEqual(TRUE);
  c = lte(five, five);
  expect(c.eval(env)).toEqual(TRUE);
  c = lte(ten, five);
  expect(c.eval(env)).toEqual(FALSE);

  // greater than
  c = gt(five, ten);
  expect(c.eval(env)).toEqual(FALSE);
  c = gt(five, five);
  expect(c.eval(env)).toEqual(FALSE);
  c = gt(ten, five);
  expect(c.eval(env)).toEqual(TRUE);

  // greater than or equal
  c = gte(five, ten);
  expect(c.eval(env)).toEqual(FALSE);
  c = gte(five, five);
  expect(c.eval(env)).toEqual(TRUE);
  c = gte(ten, five);
  expect(c.eval(env)).toEqual(TRUE);

  // NOT equal
  c = eq(five, five, true);
  expect(c.eval(env)).toEqual(FALSE);
  c = eq(five, ten, true);
  expect(c.eval(env)).toEqual(TRUE);
  c = eq(ten, five, true);
  expect(c.eval(env)).toEqual(TRUE);

  // NOT less than
  c = lt(five, five, true);
  expect(c.eval(env)).toEqual(TRUE);
  c = lt(five, ten, true);
  expect(c.eval(env)).toEqual(FALSE);
  c = lt(ten, five, true);
  expect(c.eval(env)).toEqual(TRUE);

  // NOT less than or equal
  c = lte(five, ten, true);
  expect(c.eval(env)).toEqual(FALSE);
  c = lte(five, five, true);
  expect(c.eval(env)).toEqual(FALSE);
  c = lte(ten, five, true);
  expect(c.eval(env)).toEqual(TRUE);

  // NOT greater than
  c = gt(five, ten, true);
  expect(c.eval(env)).toEqual(TRUE);
  c = gt(five, five, true);
  expect(c.eval(env)).toEqual(TRUE);
  c = gt(ten, five, true);
  expect(c.eval(env)).toEqual(FALSE);

  // NOT greater than or equal
  c = gte(five, ten, true);
  expect(c.eval(env)).toEqual(TRUE);
  c = gte(five, five, true);
  expect(c.eval(env)).toEqual(FALSE);
  c = gte(ten, five, true);
  expect(c.eval(env)).toEqual(FALSE);
});

test('condition - units', () => {
  const compiler = new LessCompiler({});
  const ctx = compiler.context();
  const env = new RuntimeExecEnv(ctx, []);
  let c: Condition;

  const five = dim(5);
  const ten = dim(10);

  const fivePX = dim(5, Unit.PX);
  const sixteenPX = dim(16, Unit.PX);

  const fivePT = dim(5, Unit.PT);
  const twelvePT = dim(12, Unit.PT);

  // equal PX = <>
  c = eq(five, fivePX);
  expect(c.eval(env)).toEqual(TRUE);
  c = eq(five, sixteenPX);
  expect(c.eval(env)).toEqual(FALSE);
  c = eq(ten, fivePX);
  expect(c.eval(env)).toEqual(FALSE);

  // equal PX = PT
  c = eq(fivePX, fivePT);
  expect(c.eval(env)).toEqual(FALSE);
  c = eq(sixteenPX, twelvePT);
  expect(c.eval(env)).toEqual(TRUE);
});

test('keywords', () => {
  const compiler = new LessCompiler({});
  const ctx = compiler.context();
  const env = new RuntimeExecEnv(ctx, []);
  let c: Condition;

  const foo = kwd('foo');
  const bar = kwd('bar');
  const _true = kwd('true');
  const _false = kwd('false');

  c = eq(foo, foo);
  expect(c.eval(env)).toEqual(TRUE);
  c = eq(foo, bar);
  expect(c.eval(env)).toEqual(FALSE);
  c = eq(TRUE, _true);
  expect(c.eval(env)).toEqual(TRUE);
  c = eq(TRUE, foo);
  expect(c.eval(env)).toEqual(FALSE);
  c = eq(FALSE, _false);
  expect(c.eval(env)).toEqual(TRUE);
  c = eq(FALSE, foo);
  expect(c.eval(env)).toEqual(FALSE);

  // TODO:
});
