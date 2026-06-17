import { Dimension, Keyword, LessCompiler, Node, Unit } from '../../src';
import { DEFINITIONS } from '../../src/plugins/color';

const context = () => new LessCompiler({}).context();
const dim = (n: number, u?: Unit) => new Dimension(n, u);
const pct = (n: number) => new Dimension(n, Unit.PERCENTAGE);

const call = (name: string, args: Dimension[]): string => {
  const ctx = context();
  const n = DEFINITIONS[name].invoke(ctx.newEnv(), args) as Node;
  return ctx.render(n);
};

// These pins come from the wired reference at the fixed level, where the
// function table is active. Direct invocation stands in for the dispatch
// that re-enables calls at the same level.

test('hsl wraps a negative hue onto the wheel', () => {
  expect(call('hsl', [dim(-120), pct(100), pct(50)])).toBe(
    call('hsl', [dim(240), pct(100), pct(50)]),
  );
  expect(call('hsl', [dim(240), pct(100), pct(50)])).toBe('blue');
});

test('hsl keeps the in-range rounding of the single-modulus wrap', () => {
  // The two-pass wrap perturbs in-range hues by 1 ULP and flips the 8-bit
  // channel rounding for 23 of 360 fully-saturated hues.
  expect(call('hsl', [dim(30), pct(100), pct(50)])).toBe('#ff8000');
  expect(call('hsl', [dim(360), pct(100), pct(50)])).toBe('red');
});

test('hsl accepts a unit on hue and drops it', () => {
  expect(call('hsl', [dim(360, Unit.DEG), pct(100), pct(50)])).toBe('red');
  expect(call('hsla', [dim(-0.5, Unit.GRAD), pct(50), pct(25), pct(75)])).toBe(
    'rgba(96, 32, 32, .75)',
  );
});

test('hsv wraps a negative hue without crashing', () => {
  expect(call('hsv', [dim(-60), pct(100), pct(50)])).toBe(
    call('hsv', [dim(300), pct(100), pct(50)]),
  );
  expect(call('hsv', [dim(300), pct(100), pct(50)])).toBe('purple');
  expect(call('hsv', [dim(-1), dim(0), dim(0)])).toBe('#000');
});

test('hsva takes the raw value of a unit hue', () => {
  expect(call('hsva', [dim(1.5, Unit.TURN), pct(100), pct(50), dim(0.5)])).toBe(
    'rgba(128, 3, 0, .5)',
  );
});

test('the hue arg slot takes any dimension but rejects a keyword', () => {
  const env = context().newEnv();
  // a unit on the hue is fine
  expect(DEFINITIONS.hsl.validate(env, [dim(10, Unit.DEG), pct(50), pct(50)])).toEqual([
    true,
    [],
  ]);
  // a non-dimension in the hue slot is not
  const err = DEFINITIONS.hsl.validate(env, [new Keyword('red'), pct(50), pct(50)]);
  expect(err[0]).toBe(false);
  expect(err[1].length).toBe(1);
});
