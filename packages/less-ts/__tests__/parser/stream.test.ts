import { LessCompiler, LessStream } from '../../src';

const COMPILER = new LessCompiler({});

const stream = (raw: string): LessStream =>
  new LessStream(COMPILER.context(), raw);

test('anon rule value', () => {
  const stm = stream('foo bar;');
  expect(stm.matchAnonRuleValue()).toBe(true);
  expect(stm.token()).toEqual('foo bar');
});

test('bool operators', () => {
  let stm = stream('>=');
  expect(stm.matchBoolOperator()).toBe(true);
  expect(stm.token()).toEqual('>=');

  stm = stream('<=');
  expect(stm.matchBoolOperator()).toBe(true);
  expect(stm.token()).toEqual('<=');
});

test('call name', () => {
  const stm = stream('rgba(');
  expect(stm.matchCallName()).toBe(true);
  expect(stm.token()).toEqual('rgba');
});

test('color', () => {
  const stm = stream('#000');
  expect(stm.matchHexColor()).toBe(true);
  expect(stm.token()).toEqual('#000');
});

test('element', () => {
  const stm = stream('.foo-bar-baz');
  expect(stm.matchElement1()).toBe(true);
  expect(stm.token()).toEqual('.foo-bar-baz');
  expect(stm.matchElement1()).toBe(false);
  expect(stm.token()).toEqual('');
});
