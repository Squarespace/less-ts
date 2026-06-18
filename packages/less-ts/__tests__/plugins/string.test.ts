import { Dimension, LessCompiler, Patch, Unit } from '../../src';
import { STRING } from '../../src/plugins/string';
import { Anonymous, Block, Quoted, Rule, Ruleset, Selector, Selectors, TextElement } from '../../src/model';
import { Renderer } from '../../src/runtime/render';

const context = () => new LessCompiler({ compress: false }).context();
const quoted = (s: string) => new Quoted('"', false, [new Anonymous(s)]);

const resolve = () => {
  const env = context().newEnv();
  const result = STRING.replace.invoke(env, [quoted('abc 123'), quoted('([a-z]+) ([0-9]+)'), quoted('$2 $1')]);
  return { env, result };
};

test('replace: legacy treats $n in the replacement as group references', () => {
  const { env, result } = resolve();
  expect(env.ctx.render(result as Quoted)).toBe('"123 abc"');
});

test('replace: the experimental warning is raised on both sides', () => {
  const { env } = resolve();
  expect(env.takeWarnings()).toEqual(['use of replace() is currently experimental']);

  const fixed = new LessCompiler({ compatLevel: 2 }).context().newEnv();
  STRING.replace.invoke(fixed, [quoted('abc 123'), quoted('([a-z]+) ([0-9]+)'), quoted('$2 $1')]);
  expect(fixed.takeWarnings()).toEqual(['use of replace() is currently experimental']);
});

test('replace: fixed levels insert the replacement literally', () => {
  const env = new LessCompiler({ compatLevel: 2 }).context().newEnv();
  const result = STRING.replace.invoke(env, [quoted('abc 123'), quoted('([a-z]+) ([0-9]+)'), quoted('$2 $1')]);
  expect(env.ctx.render(result as Quoted)).toBe('"$2 $1"');
});

test('replace: an override forces the group references at a fixed level', () => {
  const env = new LessCompiler({ compatLevel: 2, compatPatches: { REPLACE_REGEX_GROUPS: true } }).context().newEnv();
  const result = STRING.replace.invoke(env, [quoted('abc 123'), quoted('([a-z]+) ([0-9]+)'), quoted('$2 $1')]);
  expect(env.ctx.render(result as Quoted)).toBe('"123 abc"');
});

test('replace: fixed levels keep dollar group references literal', () => {
  // Legacy substitutes $1 and $2 from the match; fixed keeps them as
  // written.
  const legacy = context().newEnv();
  const legacyRes = STRING.replace.invoke(legacy, [quoted('abc 123'), quoted('([a-z]+) ([0-9]+)'), quoted('$1 is $2')]);
  expect(legacy.ctx.render(legacyRes as Quoted)).toBe('"abc is 123"');

  const env = new LessCompiler({ compatLevel: 2 }).context().newEnv();
  const result = STRING.replace.invoke(env, [quoted('abc 123'), quoted('([a-z]+) ([0-9]+)'), quoted('$1 is $2')]);
  expect(env.ctx.render(result as Quoted)).toBe('"$1 is $2"');
});

test('replace: renders the pinned warning comment before the rule', () => {
  // The warning rides the same emitter the compile path uses: it
  // attaches to the next rule and renders as
  // "/* WARNING[n] raised evaluating next rule: <message> */".
  const ctx = context();
  const env = ctx.newEnv();
  const value = STRING.replace.invoke(env, [quoted('abc 123'), quoted('([a-z]+) ([0-9]+)'), quoted('$2 $1')]);
  const rule = new Rule(new Anonymous('x'), value as Quoted, false);
  rule.warnings = env.takeWarnings();
  const block = new Block([new Ruleset(new Selectors([new Selector([new TextElement(undefined, '.a')])]), new Block([rule]))]);
  expect(Renderer.renderBlock(ctx, block)).toBe(
    '.a {\n  /* WARNING[1] raised evaluating next rule: use of replace() is currently experimental */\n  x: "123 abc";\n}\n',
  );
});

test('replace: validation requires three args', () => {
  const env = context().newEnv();
  const [ok, errors] = STRING.replace.validate(env, [quoted('abc 123')]);
  expect(ok).toBe(false);
  expect(errors.length).toBe(1);

  const [ok2] = STRING.replace.validate(env, [quoted('abc 123'), new Anonymous('([a-z]+)'), quoted('x')]);
  expect(ok2).toBe(false);
});

test('replace: the function is registered in the table', () => {
  expect(STRING.replace).toBeDefined();
});

const callFormat = (fmt: string, ...args: (Quoted | Dimension)[]): string => {
  const env = context().newEnv();
  const result = STRING['%'].invoke(env, [quoted(fmt), ...args]) as Quoted;
  return env.ctx.render(result);
};

test('format: known specifiers consume arguments as before', () => {
  expect(callFormat('%s, %s', new Dimension(12, Unit.PX), quoted('foo'))).toBe('"12px, foo"');
  expect(callFormat('%s %% %d', quoted('a'), new Dimension(2))).toBe('"a % 2"');
});

test('format: unknown %X specifiers pass through and consume no argument', () => {
  // The percent before the space used to eat an argument (1005off).
  expect(callFormat('100% off', new Dimension(5))).toBe('"100% off"');
  expect(callFormat('%x', new Dimension(1))).toBe('"%x"');
  expect(callFormat('%s %x %d', new Dimension(1), new Dimension(2))).toBe('"1 %x 2"');
  expect(callFormat('%Z', new Dimension(1))).toBe('"%Z"');
});
