import { LessCompiler } from '../../src';
import { LIST } from '../../src/plugins/list';
import { Dimension, ExpressionList } from '../../src';

const context = () => new LessCompiler({ compress: false }).context();
const num = (n: number) => new Dimension(n);

test('list extract', () => {
  const env = context().newEnv();

  let n = LIST.extract.invoke(env, [num(1), num(2)]);
  expect(n).toBe(undefined);

  const nums = new ExpressionList([num(1), num(2), num(3)]);

  n = LIST.extract.invoke(env, [nums, nums]);
  expect(n).toBe(undefined);

  n = LIST.extract.invoke(env, [nums, num(1)]);
  expect(n).toEqual(num(2));

  n = LIST.extract.invoke(env, [nums, num(2)]);
  expect(n).toEqual(num(3));

  n = LIST.extract.invoke(env, [nums, num(5)]);
  expect(n).toBe(undefined);
});

test('list length', () => {
  const env = context().newEnv();

  let n = LIST.length.invoke(env, [num(123)]);
  expect(n).toEqual(num(1));

  const nums = new ExpressionList([num(1), num(2), num(3)]);

  n = LIST.length.invoke(env, [nums]);
  expect(n).toEqual(num(3));

  n = LIST.length.invoke(env, [new ExpressionList([])]);
  expect(n).toEqual(num(0));
});
