import { Anonymous, Dimension, Keyword, LessCompiler, Quoted, Unit } from '../../src';
import { MISC } from '../../src/plugins/misc';

const context = (level: number = 0) => new LessCompiler({ compatLevel: level }).context();
const dim = (n: number, u?: Unit) => new Dimension(n, u);
const keyword = (s: string) => new Keyword(s);
const quoted = (s: string) => new Quoted('"', false, [new Anonymous(s)]);

const UNKNOWN = 'ExecuteError UNKNOWN_UNIT: Unknown unit ';

test('unit with an unknown keyword reports unknownUnit', () => {
  const env = context().newEnv();
  expect(MISC.unit.invoke(env, [dim(5), keyword('foo')])).toBeUndefined();
  expect(env.errors).toEqual([{ type: 'runtime', message: UNKNOWN + 'foo' }]);
});

test('unit with an unknown quoted string reports unknownUnit with the delimiters', () => {
  const env = context().newEnv();
  expect(MISC.unit.invoke(env, [dim(5), quoted('foo')])).toBeUndefined();
  // The delimiters survive into the message and are Java-escaped.
  expect(env.errors).toEqual([{ type: 'runtime', message: UNKNOWN + '\\"foo\\"' }]);
});

test('unit with a non-unit argument reports unknownUnit', () => {
  const env = context().newEnv();
  expect(MISC.unit.invoke(env, [dim(5), dim(1, Unit.PX)])).toBeUndefined();
  expect(env.errors).toEqual([{ type: 'runtime', message: UNKNOWN + '1px' }]);
});

test('unit with a known unit keeps the value', () => {
  const env = context().newEnv();
  expect(MISC.unit.invoke(env, [dim(5), keyword('em')])).toEqual(dim(5, Unit.EM));
  env.errors.length = 0;
  expect(MISC.unit.invoke(env, [dim(5), quoted('em')])).toEqual(dim(5, Unit.EM));
  env.errors.length = 0;
  expect(MISC.unit.invoke(env, [dim(5)])).toEqual(dim(5));
  expect(env.errors).toEqual([]);
});

test('convert to an unknown unit reports unknownUnit', () => {
  const env = context().newEnv();
  expect(MISC.convert.invoke(env, [dim(1, Unit.PX), keyword('foo')])).toBeUndefined();
  expect(env.errors).toEqual([{ type: 'runtime', message: UNKNOWN + 'foo' }]);
});

test('convert from a unitless source uses factor 1', () => {
  const env = context().newEnv();
  expect(MISC.convert.invoke(env, [dim(5), keyword('px')])).toEqual(dim(5, Unit.PX));
  expect(env.errors).toEqual([]);
});

test('convert between compatible units', () => {
  const env = context().newEnv();
  expect(MISC.convert.invoke(env, [dim(96, Unit.PX), keyword('in')])).toEqual(dim(1, Unit.IN));
  expect(env.errors).toEqual([]);
});

test('convert between incompatible units: legacy emits 0 with the target unit', () => {
  const env = context(0).newEnv();
  expect(MISC.convert.invoke(env, [dim(1, Unit.PX), keyword('em')])).toEqual(dim(0, Unit.EM));
  expect(env.errors).toEqual([]);
});

test('convert between incompatible units: the fixed level reports the pair', () => {
  const env = context(2).newEnv();
  expect(MISC.convert.invoke(env, [dim(1, Unit.PX), keyword('em')])).toBeUndefined();
  expect(env.errors).toEqual([
    {
      type: 'runtime',
      message: 'ExecuteError INCOMPATIBLE_UNITS: No conversion is possible from PX (pixels) to EM (element font size)',
    },
  ]);
});
