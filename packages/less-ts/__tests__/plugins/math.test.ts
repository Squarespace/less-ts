import { Dimension, ExpressionList, LessCompiler, Unit } from '../../src';
import { MATH } from '../../src/plugins/math';

const context = () => new LessCompiler({ compress: false }).context();
const dim = (n: number, u?: Unit) => new Dimension(n, u);

test('math abs', () => {
  const env = context().newEnv();

  let n = MATH.abs.invoke(env, [dim(-1037)]);
  expect(n).toEqual(dim(1037));

  n = MATH.abs.invoke(env, [dim(155)]);
  expect(n).toEqual(dim(155));
});

test('math acos', () => {
  const env = context().newEnv();

  let n = MATH.acos.invoke(env, [dim(1)]);
  expect(n).toEqual(dim(0, Unit.RAD));

  n = MATH.acos.invoke(env, [dim(-1)]);
  expect(n).toEqual(dim(Math.PI, Unit.RAD));
});

test('math asin', () => {
  const env = context().newEnv();

  let n = MATH.asin.invoke(env, [dim(0)]);
  expect(n).toEqual(dim(0, Unit.RAD));

  n = MATH.asin.invoke(env, [dim(1)]);
  expect(n).toEqual(dim(Math.PI / 2, Unit.RAD));
});

test('math atan', () => {
  const env = context().newEnv();

  let n = MATH.atan.invoke(env, [dim(0)]);
  expect(n).toEqual(dim(0, Unit.RAD));

  n = MATH.atan.invoke(env, [dim(1)]);
  expect(n).toEqual(dim(0.7853981633974483, Unit.RAD));
});

test('math ceil', () => {
  const env = context().newEnv();

  let n = MATH.ceil.invoke(env, [dim(1.9)]);
  expect(n).toEqual(dim(2));

  n = MATH.ceil.invoke(env, [dim(-2.3)]);
  expect(n).toEqual(dim(-2));
});

test('math cos', () => {
  const env = context().newEnv();

  let n = MATH.cos.invoke(env, [dim(Math.PI)]);
  expect(n).toEqual(dim(-1));

  n = MATH.cos.invoke(env, [dim(Math.PI * 2)]);
  expect(n).toEqual(dim(1));
});

test('math floor', () => {
  const env = context().newEnv();

  let n = MATH.floor.invoke(env, [dim(2.7)]);
  expect(n).toEqual(dim(2));

  n = MATH.floor.invoke(env, [dim(-3.4)]);
  expect(n).toEqual(dim(-4));
});

test('math min / max', () => {
  const env = context().newEnv();

  const args = [dim(23), dim(-7), dim(0), dim(100)];
  let n = MATH.max.invoke(env, args);
  expect(n).toEqual(dim(100));

  n = MATH.min.invoke(env, args);
  expect(n).toEqual(dim(-7));

  n = MATH.max.invoke(env, [new ExpressionList([])]);
  expect(n).toEqual(undefined);

  n = MATH.min.invoke(env, [dim(1, Unit.PT), dim(2, Unit.PX)]);
  expect(n).toEqual(undefined);
});

test('math mod', () => {
  const env = context().newEnv();

  let n = MATH.mod.invoke(env, [dim(17), dim(3)]);
  expect(n).toEqual(dim(2));

  n = MATH.mod.invoke(env, [dim(21), dim(7)]);
  expect(n).toEqual(dim(0));

  n = MATH.mod.invoke(env, [dim(8), dim(7)]);
  expect(n).toEqual(dim(1));

  n = MATH.mod.invoke(env, [dim(18), dim(0)]);
  expect(n).toEqual(dim(NaN));
});

test('math percentage', () => {
  const env = context().newEnv();

  let n = MATH.percentage.invoke(env, [dim(17)]);
  expect(n).toEqual(dim(1700, Unit.PERCENTAGE));

  n = MATH.percentage.invoke(env, [dim(-0.1)]);
  expect(n).toEqual(dim(-10, Unit.PERCENTAGE));
});

test('math pi', () => {
  const env = context().newEnv();

  const n = MATH.pi.invoke(env, []);
  expect(n).toEqual(dim(Math.PI));
});

test('math pow', () => {
  const env = context().newEnv();

  let n = MATH.pow.invoke(env, [dim(10), dim(3)]);
  expect(n).toEqual(dim(1000));

  n = MATH.pow.invoke(env, [dim(-2), dim(7)]);
  expect(n).toEqual(dim(-128));
});

test('math round', () => {
  const env = context().newEnv();

  let n = MATH.round.invoke(env, [dim(3.333333), dim(3)]);
  expect(n).toEqual(dim(3.333));

  n = MATH.round.invoke(env, [dim(1.11111), dim(2)]);
  expect(n).toEqual(dim(1.11));

  n = MATH.round.invoke(env, [dim(1.11111)]);
  expect(n).toEqual(dim(1));
});

test('math sin', () => {
  const env = context().newEnv();

  let n = MATH.sin.invoke(env, [dim(0)]);
  expect(n).toEqual(dim(0));

  n = MATH.sin.invoke(env, [dim(Math.PI / 2)]);
  expect(n).toEqual(dim(1));
});

test('math sqrt', () => {
  const env = context().newEnv();

  let n = MATH.sqrt.invoke(env, [dim(4)]);
  expect(n).toEqual(dim(2));

  n = MATH.sqrt.invoke(env, [dim(400)]);
  expect(n).toEqual(dim(20));
});

test('math tan', () => {
  const env = context().newEnv();

  let n = MATH.tan.invoke(env, [dim(0)]);
  expect(n).toEqual(dim(0));

  n = MATH.tan.invoke(env, [dim(1)]);
  expect(n).toEqual(dim(1.5574077246549023));
});
