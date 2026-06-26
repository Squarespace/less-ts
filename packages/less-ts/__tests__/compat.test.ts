import {
  maxThreshold,
  Block,
  CompatLevel,
  Dimension,
  Keyword,
  LessCompiler,
  Patch,
  RenderEnv,
  Ruleset,
  RGBColor,
  Selector,
  Selectors,
  TextElement,
  THRESHOLDS,
  Unit,
} from '../src';
import { BLENDING } from '../src/plugins/color';
import { MATH } from '../src/plugins/math';
import { MISC } from '../src/plugins/misc';

const ALL = Object.values(Patch);

// The Java Patch enum, in declaration order, with thresholds. The TS
// registry must match it exactly.
const JAVA_REGISTRY: { [id: string]: number } = {
  BUG1: 1,
  BUG2: 1,
  BUG3: 1,
  BUG4: 1,
  SELECTOR_COMPLEXITY_OVERFLOW: 2,
  IMPORT_URL_INLINE: 2,
  NONFINITE_AS_ZERO: 2,
  MOD_ZERO_STRICT: 2,
  CONVERT_INCOMPATIBLE_UNITS: 2,
  REPLACE_REGEX_GROUPS: 2,
  VARIADIC_NAMED_ARG: 2,
  ARGUMENTS_ORDER: 2,
  GUARD_COMPARE_UNCOMPARABLE: 2,
  IMPORT_EXT_CASE: 2,
  IMPORT_ONCE_SUPPRESS: 2,
  COLOR_BLEND_ALPHA: 2,
  COLOR_CHANNEL_PRECISION: 2,
  ATTR_SELECTOR_UNTERMINATED: 2,
  NUMBER_EXPO: 2,
  FUNCTION_CALL_IN_VALUE: 2,
};

describe('Patch registry', () => {
  test('ids and thresholds match the Java enum', () => {
    expect(THRESHOLDS).toEqual(JAVA_REGISTRY);
  });

  test('declaration order matches the Java enum', () => {
    expect(ALL).toEqual(Object.keys(JAVA_REGISTRY));
  });

  test('the highest threshold is 2', () => {
    expect(maxThreshold()).toBe(2);
  });
});

describe('CompatLevel', () => {
  test('fixed: the highest level, no legacy behavior', () => {
    // The fully-fixed compiler is the highest level.
    const compat = CompatLevel.fixed();
    expect(compat.level).toBe(maxThreshold());
    for (const patch of ALL) {
      expect(compat.enabled(patch)).toBe(false);
    }
  });

  test('default: level 0, every legacy behavior active', () => {
    // The default keeps every legacy behavior active: the released
    // surface, at level 0.
    const compat = CompatLevel.defaultLevel();
    expect(compat.level).toBe(0);
    for (const patch of ALL) {
      expect(compat.enabled(patch)).toBe(true);
    }
  });

  test('a fix applies at its threshold level and above', () => {
    // The legacy-active set at level L is { patch : threshold > L }.
    for (let level = 0; level <= maxThreshold(); level++) {
      const compat = CompatLevel.at(level);
      for (const patch of ALL) {
        expect(compat.enabled(patch)).toBe(THRESHOLDS[patch] > level);
      }
    }
  });

  test('the ladder is monotone: raising a level only fixes', () => {
    // Raising a site's level can only fix behaviors, never
    // re-enable a legacy one.
    for (let level = 0; level < maxThreshold(); level++) {
      for (const patch of ALL) {
        if (CompatLevel.at(level + 1).enabled(patch)) {
          expect(CompatLevel.at(level).enabled(patch)).toBe(true);
        }
      }
    }
  });

  test('an override forces a patch on regardless of level', () => {
    const base = CompatLevel.fixed();
    const patched = base.withPatch(Patch.BUG2);
    for (const patch of ALL) {
      expect(patched.enabled(patch)).toBe(patch === Patch.BUG2);
    }
    // The original level is untouched.
    for (const patch of ALL) {
      expect(base.enabled(patch)).toBe(false);
    }
    // An override on an already-active patch is a no-op for it.
    const defaulted = CompatLevel.defaultLevel().withPatch(Patch.BUG2);
    expect(defaulted.enabled(Patch.BUG2)).toBe(true);
    expect(defaulted.level).toBe(0);
  });

  test('changing the level preserves the override set', () => {
    // Changing the level must not silently discard the override set.
    const patched = CompatLevel.at(0).withPatch(Patch.BUG3).withLevel(2);
    expect(patched.level).toBe(2);
    for (const patch of ALL) {
      expect(patched.enabled(patch)).toBe(patch === Patch.BUG3);
    }
    // Setter order on the level and the overrides is irrelevant.
    const reordered = CompatLevel.at(2).withPatch(Patch.BUG3);
    expect(reordered.level).toBe(2);
    for (const patch of ALL) {
      expect(reordered.enabled(patch)).toBe(patched.enabled(patch));
    }
    // A fresh level with no overrides still behaves like before.
    expect(CompatLevel.at(0).withLevel(maxThreshold()).level).toBe(maxThreshold());
    for (const patch of ALL) {
      expect(CompatLevel.at(0).withLevel(maxThreshold()).enabled(patch)).toBe(false);
    }
  });

  test('negative levels are rejected', () => {
    expect(() => CompatLevel.at(-1)).toThrow('compat level must be >= 0, got -1');
    expect(() => CompatLevel.at(0).withLevel(-1)).toThrow('compat level must be >= 0, got -1');
  });
});

// A sheet that touches several surfaces: variables, color math,
// dimensions, a value-position function call (literal at level 0),
// a guard and a mixin.
const SHEET = `
@base: #808080;
.a {
  color: @base;
  width: @base / 3;
  margin: 10px + 5px;
}
.b { filter: lighten(#fff, 10%); }
.c when (true) { top: 1; }
.d { .a(); }
`;

describe('options wiring', () => {
  test('default options and explicit level 0 compile byte-identical', () => {
    const a = new LessCompiler({});
    const b = new LessCompiler({ compatLevel: 0 });
    expect(a.compile(SHEET)).toEqual(b.compile(SHEET));
  });

  test('a no-op override at the default level compiles byte-identical', () => {
    // BUG1 is already legacy-active at level 0; forcing it on
    // changes nothing.
    const a = new LessCompiler({});
    const b = new LessCompiler({ compatLevel: 0, compatPatches: { BUG1: true } });
    expect(a.compile(SHEET)).toEqual(b.compile(SHEET));
  });

  test('level and overrides expand on the context', () => {
    const ctx = new LessCompiler({ compatLevel: 2, compatPatches: { BUG1: true } }).context();
    expect(ctx.compat.level).toBe(2);
    expect(ctx.compat.enabled(Patch.BUG1)).toBe(true);
    expect(ctx.compat.enabled(Patch.BUG2)).toBe(false);
    expect(ctx.compat.enabled(Patch.NUMBER_EXPO)).toBe(false);
  });

  test('the options land on the same surface as the factory chain', () => {
    // Setter-order parity: the level and the overrides compose the
    // same way in either order.
    const fromOptions = new LessCompiler({ compatLevel: 2, compatPatches: { BUG1: true, BUG2: true } }).context().compat;
    const chained = CompatLevel.at(0).withPatch(Patch.BUG1).withPatch(Patch.BUG2).withLevel(2);
    expect(fromOptions.level).toBe(chained.level);
    for (const id of ALL) {
      expect(fromOptions.enabled(id)).toBe(chained.enabled(id));
    }
  });

  test('buffers carry the compat level', () => {
    // At level 1 the threshold-1 patches are fixed; the
    // threshold-2 patches are still legacy-active.
    const ctx = new LessCompiler({ compatLevel: 1 }).context();
    const buf = ctx.newBuffer();
    expect(buf.compat.level).toBe(1);
    expect(buf.compat.enabled(Patch.BUG1)).toBe(false);
    expect(buf.compat.enabled(Patch.BUG2)).toBe(false);
    expect(buf.compat.enabled(Patch.NUMBER_EXPO)).toBe(true);
  });

  test('a negative level in options throws at context construction', () => {
    expect(() => new LessCompiler({ compatLevel: -1 }).context()).toThrow('compat level must be >= 0, got -1');
  });
});

describe('safeMode wiring', () => {
  const PLAIN = '.a {\n  x: 1px;\n}\n';

  test('the default is strict', () => {
    expect(new LessCompiler({}).context().safeMode()).toBe(false);
    expect(new LessCompiler({ safeMode: false }).context().safeMode()).toBe(false);
  });

  test('the option lands on the context', () => {
    expect(new LessCompiler({ safeMode: true }).context().safeMode()).toBe(true);
  });

  test('the override wins over the option', () => {
    const ctx = new LessCompiler({ safeMode: true }).context();
    ctx.safeModeOverride(false);
    expect(ctx.safeMode()).toBe(false);
  });

  test('the override persists on the context', () => {
    // One compile per context is the assumed usage: the override is
    // still in effect on a later use of the same context.
    const ctx = new LessCompiler({}).context();
    ctx.safeModeOverride(true);
    expect(ctx.safeMode()).toBe(true);
    expect(ctx.safeMode()).toBe(true);
  });

  test('undefined clears the override', () => {
    const ctx = new LessCompiler({ safeMode: true }).context();
    ctx.safeModeOverride(false);
    expect(ctx.safeMode()).toBe(false);
    ctx.safeModeOverride();
    expect(ctx.safeMode()).toBe(true);
  });

  test('the override never mutates the shared options', () => {
    const opts = { safeMode: false };
    const c = new LessCompiler(opts);
    const ctx = c.context();
    ctx.safeModeOverride(true);
    expect(opts.safeMode).toBe(false);
    expect(ctx.safeMode()).toBe(true);
    // A context built later from the same options sees the option
    // value, not the earlier override.
    expect(c.context().safeMode()).toBe(false);
  });

  test('no output change yet', () => {
    // Plumbing only: nothing reads the mode for behavior.
    expect(new LessCompiler({ safeMode: true }).compile(PLAIN)).toEqual(new LessCompiler({}).compile(PLAIN));
  });
});

// The message Java attaches to a parse that cannot complete.
const PARSE_ERROR = 'SyntaxError INCOMPLETE_PARSE Unable to complete parse.';

// A compile that fails at the parse stage: no css, one event, and the
// message is the complete report.
const parseFail = (src: string, opts: { compatLevel?: number } = {}): void => {
  const res = new LessCompiler(opts).compile(src);
  expect(res.css).toEqual('');
  expect(res.errors.length).toEqual(1);
  expect(res.errors[0].errors[0].message).toEqual(PARSE_ERROR);
};

describe('BUG1: a stray + before the closing brace', () => {
  const src = '.a {\n  x: 1;\n  + }\n';
  const bare = '.a {\n  + }\n';
  const nested = '.a {\n  .b { x: 1; + }\n}\n';

  test('legacy levels drop the + and close the block', () => {
    // The stray + is consumed; the rule survives.
    expect(new LessCompiler({}).compile(src).css).toEqual('.a {\n  x: 1;\n}\n');
    expect(new LessCompiler({ compatLevel: 0 }).compile(src).css).toEqual('.a {\n  x: 1;\n}\n');
  });

  test('legacy levels: a ruleset left empty renders nothing', () => {
    expect(new LessCompiler({}).compile(bare).css).toEqual('');
  });

  test('legacy levels: the tolerance applies in nested blocks', () => {
    expect(new LessCompiler({}).compile(nested).css).toEqual('.a .b {\n  x: 1;\n}\n');
  });

  test('legacy levels: only whitespace may follow the +', () => {
    parseFail('.a {\n  x: 1;\n  + /* c */ }\n');
    parseFail('.a {\n  x: 1;\n  + foo }\n');
  });

  test('fixed levels reject the stray +', () => {
    for (const level of [1, 2]) {
      parseFail(src, { compatLevel: level });
      parseFail(bare, { compatLevel: level });
      parseFail(nested, { compatLevel: level });
    }
  });

  test('a + in a value or a leading selector combinator is unaffected', () => {
    expect(new LessCompiler({}).compile('.a {\n  width: 1px + 2px;\n}\n').css).toEqual('.a {\n  width: 3px;\n}\n');
    for (const level of [0, 1, 2]) {
      expect(new LessCompiler({ compatLevel: level }).compile('+ .a {\n  x: 1;\n}\n').css).toEqual('+ .a {\n  x: 1;\n}\n');
    }
  });

  test('an override forces the tolerance on at a fixed level', () => {
    expect(new LessCompiler({ compatLevel: 2, compatPatches: { BUG1: true } }).compile(src).css).toEqual('.a {\n  x: 1;\n}\n');
  });
});

describe('BUG2: a block-less @media', () => {
  const root = '@media all\n.a {\n  x: 1;\n}\n';
  const nested = '.a {\n  x: 1;\n  @media all }\n';

  test('legacy levels drop the directive at the root', () => {
    expect(new LessCompiler({}).compile(root).css).toEqual('.a {\n  x: 1;\n}\n');
    expect(new LessCompiler({ compatLevel: 0 }).compile(root).css).toEqual('.a {\n  x: 1;\n}\n');
  });

  test('legacy levels drop the directive in a nested block', () => {
    expect(new LessCompiler({}).compile(nested).css).toEqual('.a {\n  x: 1;\n}\n');
  });

  test('legacy levels: statements that follow attach to the enclosing block', () => {
    expect(new LessCompiler({}).compile('.a { @media all .b { x: 1; } }\n').css).toEqual('.a .b {\n  x: 1;\n}\n');
    expect(new LessCompiler({}).compile('@media all { @media screen .a { x: 1; } }\n').css).toEqual(
      '@media all {\n  .a {\n    x: 1;\n  }\n}\n',
    );
  });

  test('legacy levels: a trailing semicolon is dropped with the directive', () => {
    expect(new LessCompiler({}).compile('@media all; .a { x: 1; }\n').css).toEqual('.a {\n  x: 1;\n}\n');
  });

  test('fixed levels reject the block-less directive', () => {
    for (const level of [1, 2]) {
      parseFail(root, { compatLevel: level });
      parseFail(nested, { compatLevel: level });
    }
  });

  test('an @media with a block is unaffected', () => {
    const src = '@media all {\n  .a { x: 1; }\n}\n';
    for (const level of [0, 1, 2]) {
      expect(new LessCompiler({ compatLevel: level }).compile(src).css).toEqual('@media all {\n  .a {\n    x: 1;\n  }\n}\n');
    }
  });

  test('an override forces the tolerance on at a fixed level', () => {
    expect(new LessCompiler({ compatLevel: 2, compatPatches: { BUG2: true } }).compile(root).css).toEqual('.a {\n  x: 1;\n}\n');
  });
});

describe('BUG3: a variable followed by empty parens', () => {
  const src = '@foo: 1;\n.a {\n  x: @foo();\n}\n';

  test('legacy levels drop the parens and keep the reference', () => {
    expect(new LessCompiler({}).compile(src).css).toEqual('.a {\n  x: 1;\n}\n');
    expect(new LessCompiler({ compatLevel: 0 }).compile(src).css).toEqual('.a {\n  x: 1;\n}\n');
  });

  test('legacy levels: the tolerance applies mid-block', () => {
    const mid = '@foo: 1;\n.a {\n  x: @foo();\n  y: 2;\n}\n';
    expect(new LessCompiler({}).compile(mid).css).toEqual('.a {\n  x: 1;\n  y: 2;\n}\n');
    expect(new LessCompiler({ compatLevel: 0 }).compile(mid).css).toEqual('.a {\n  x: 1;\n  y: 2;\n}\n');
  });

  test('fixed levels reject the input', () => {
    for (const level of [1, 2]) {
      parseFail(src, { compatLevel: level });
    }
  });

  test('an override forces the tolerance on at a fixed level', () => {
    expect(new LessCompiler({ compatLevel: 2, compatPatches: { BUG3: true } }).compile(src).css).toEqual('.a {\n  x: 1;\n}\n');
  });
});

describe('BUG4: invalid additions', () => {
  const bug4Src = '@foo: 10px;\n.a {\n  x: @foo + px;\n  y: 1 + px;\n  z: 2 -;\n}\n';
  const bug4LegacyCss = '.a {\n  x: 10px px;\n  y: 1 px;\n  z: 2 -;\n}\n';

  test('legacy levels keep the dangling operator', () => {
    expect(new LessCompiler({}).compile(bug4Src).css).toEqual(bug4LegacyCss);
    expect(new LessCompiler({ compatLevel: 0 }).compile(bug4Src).css).toEqual(bug4LegacyCss);
  });

  test('fixed levels reject the input', () => {
    for (const level of [1, 2]) {
      parseFail(bug4Src, { compatLevel: level });
    }
  });

  test('valid math is unaffected at both levels', () => {
    const math = '.a {\n  x: 1 + 2px;\n}\n';
    for (const level of [0, 1, 2]) {
      expect(new LessCompiler({ compatLevel: level }).compile(math).css).toEqual('.a {\n  x: 3px;\n}\n');
    }
  });

  test('a slash before a non-operand is dropped at legacy levels and kept at fixed levels', () => {
    // The released surface drops the slash: the value renders as
    // '10px url(x)'. Fixed levels restore the slash so the expression
    // keeps it as a separator: '10px / url(x)'.
    const slash = '.a {\n  background: 10px / url(x);\n}\n';
    expect(new LessCompiler({}).compile(slash).css).toEqual('.a {\n  background: 10px url(x);\n}\n');
    expect(new LessCompiler({ compatLevel: 0 }).compile(slash).css).toEqual('.a {\n  background: 10px url(x);\n}\n');
    for (const level of [1, 2]) {
      expect(new LessCompiler({ compatLevel: level }).compile(slash).css).toEqual('.a {\n  background: 10px / url(x);\n}\n');
    }
  });

  // The multiplication() operator-restore matrix, byte-pinned from the
  // Java reference. Level 0 keeps the released slash-drop (the slash
  // is consumed when the right side is not an operand); level 1 and 2
  // restore it. A slash between two operands is an operation at every
  // level, with or without spaces; url() is not an operand, so a slash
  // after it is never consumed. The slash decision is mode-independent:
  // safe mode differs only in error recovery, never in the restore.
  const slashCases: Array<[string, string, string]> = [
    // [value source, level 0 value, level 1/2 value]
    ['10px / url(x)', '10px url(x)', '10px / url(x)'],
    ['10px/2px', '5px', '5px'],
    ['10px /2px', '5px', '5px'],
    ['10px / 2px', '5px', '5px'],
    ['url(x) / cover center', 'url(x) / cover center', 'url(x) / cover center'],
    ['10px / cover center', '10px cover center', '10px / cover center'],
  ];

  test('slash cases match the reference at every level', () => {
    for (const [value, legacy, fixed] of slashCases) {
      const src = '.a {\n  background: ' + value + ';\n}\n';
      for (const level of [0, 1, 2]) {
        const res = new LessCompiler({ compatLevel: level }).compile(src);
        expect(res.errors.length).toEqual(0);
        expect(res.css).toEqual('.a {\n  background: ' + (level === 0 ? legacy : fixed) + ';\n}\n');
      }
    }
  });

  test('the slash decision is independent of compress', () => {
    for (const [value] of slashCases) {
      const src = '.a {\n  background: ' + value + ';\n}\n';
      for (const level of [0, 1, 2]) {
        const plain = new LessCompiler({ compatLevel: level }).compile(src).css;
        const min = new LessCompiler({ compatLevel: level, compress: true }).compile(src).css;
        expect(min.match(/\//g) || []).toHaveLength((plain.match(/\//g) || []).length);
      }
    }
  });

  test('comment-adjacent slashes fail the parse at every level', () => {
    // '// ' is a line comment that eats the rule terminator; the
    // comment after the slash leaves a bare '*' where an operand is
    // due. Both fail before the restore can matter.
    const failing = ['x: 10px // c;', 'x: 10px / * c */ 2px;'];
    for (const value of failing) {
      const src = '.a {\n  ' + value + '\n}\n';
      for (const level of [0, 1, 2]) {
        parseFail(src, { compatLevel: level });
      }
    }
  });

  test('a multiply whose right side is not an operand is dropped at legacy levels and rejected at fixed levels', () => {
    // '10px*/2' is a star operator whose right side fails to parse:
    // legacy drops the star and renders the slash as a literal;
    // fixed levels restore the operator and the rule fails.
    const src = '.a {\n  x: 10px*/2;\n}\n';
    const legacyCss = '.a {\n  x: 10px / 2;\n}\n';
    expect(new LessCompiler({}).compile(src).css).toEqual(legacyCss);
    expect(new LessCompiler({ compatLevel: 0 }).compile(src).css).toEqual(legacyCss);
    for (const level of [1, 2]) {
      parseFail(src, { compatLevel: level });
    }
  });

  test('a star after a multiply fails at every level', () => {
    // '10px**2' never parses: the second star cannot start an
    // operand, and the rule fails the same way at every level.
    const src = '.a {\n  x: 10px**2;\n}\n';
    expect(new LessCompiler({}).compile(src).css).toEqual('');
    for (const level of [0, 1, 2]) {
      parseFail(src, { compatLevel: level });
    }
  });

  test('an override forces the tolerance on at a fixed level', () => {
    expect(new LessCompiler({ compatLevel: 2, compatPatches: { BUG4: true } }).compile(bug4Src).css).toEqual(bug4LegacyCss);
  });
});

describe('NONFINITE_AS_ZERO: non-finite values render as 0', () => {
  // The Java reference produces these values with sqrt(-1) and
  // pow(2, 1024), but function dispatch is not wired in this tree, so
  // the overflow math below reaches the same render site at every
  // level. 10^160 * 10^160 is 10^320, past the largest double.
  const H = '1' + '0'.repeat(160);
  const inf = `.a {\n  x: (${H} * ${H});\n}\n`;
  const ninf = `.a {\n  x: -(${H} * ${H});\n}\n`;
  const nan = `.a {\n  x: (${H} * ${H}) - (${H} * ${H});\n}\n`;

  test('legacy levels render non-finite values as 0', () => {
    for (const level of [0, 1]) {
      expect(new LessCompiler({ compatLevel: level }).compile(inf).css).toEqual('.a {\n  x: 0;\n}\n');
      expect(new LessCompiler({ compatLevel: level }).compile(ninf).css).toEqual('.a {\n  x: 0;\n}\n');
      expect(new LessCompiler({ compatLevel: level }).compile(nan).css).toEqual('.a {\n  x: 0;\n}\n');
    }
  });

  test('the default options keep the 0 render', () => {
    expect(new LessCompiler({}).compile(inf).css).toEqual('.a {\n  x: 0;\n}\n');
    expect(new LessCompiler({}).compile(nan).css).toEqual('.a {\n  x: 0;\n}\n');
  });

  test('fixed levels render the visible text', () => {
    const fixed = new LessCompiler({ compatLevel: 2 });
    expect(fixed.compile(inf).css).toEqual('.a {\n  x: Infinity;\n}\n');
    expect(fixed.compile(ninf).css).toEqual('.a {\n  x: -Infinity;\n}\n');
    expect(fixed.compile(nan).css).toEqual('.a {\n  x: NaN;\n}\n');
  });

  test('an override forces the legacy render at a fixed level', () => {
    const legacy = new LessCompiler({ compatLevel: 2, compatPatches: { NONFINITE_AS_ZERO: true } });
    expect(legacy.compile(inf).css).toEqual('.a {\n  x: 0;\n}\n');
    expect(legacy.compile(ninf).css).toEqual('.a {\n  x: 0;\n}\n');
    expect(legacy.compile(nan).css).toEqual('.a {\n  x: 0;\n}\n');
  });
});

describe('COLOR_CHANNEL_PRECISION: channel math precision', () => {
  // #808080 / 3 is 42.67 per channel. Legacy truncates (42, #2a2a2a);
  // the fixed level keeps the fraction until the final round (43,
  // #2b2b2b).
  const div = '.a {\n  x: #808080 / 3;\n}\n';
  // #fff * 0.5 is 127.5 per channel. Legacy truncates the scalar
  // before the op (0, #000); the fixed level rounds the product
  // (128, the 'grey' keyword, not a hex).
  const mul = '.a {\n  x: #fff * 0.5;\n}\n';
  // Color-color division takes the same gate: #808080 / #010203 is
  // (128, 64, 42.67) -> #80402a legacy, #80402b fixed.
  const colorDiv = '.a {\n  x: #808080 / #010203;\n}\n';
  const digest =
    '.a {\n' +
    '  a: #808080 / 0;\n' +
    '  b: #808080 * 1.5;\n' +
    '  c: #010203 / 2;\n' +
    '  d: #808080 + 0.5;\n' +
    '  e: #808080 - 0.5;\n' +
    '}\n';
  const legacyDigest = '.a {\n' + '  a: grey;\n' + '  b: grey;\n' + '  c: #000101;\n' + '  d: grey;\n' + '  e: grey;\n' + '}\n';
  const fixedDigest =
    '.a {\n' + '  a: grey;\n' + '  b: silver;\n' + '  c: #010102;\n' + '  d: #818181;\n' + '  e: grey;\n' + '}\n';

  test('legacy levels truncate fractional intermediates', () => {
    for (const level of [0, 1]) {
      const c = new LessCompiler({ compatLevel: level });
      expect(c.compile(div).css).toEqual('.a {\n  x: #2a2a2a;\n}\n');
      expect(c.compile(mul).css).toEqual('.a {\n  x: #000;\n}\n');
      expect(c.compile(colorDiv).css).toEqual('.a {\n  x: #80402a;\n}\n');
      expect(c.compile(digest).css).toEqual(legacyDigest);
    }
  });

  test('the default options keep the truncation', () => {
    const c = new LessCompiler({});
    expect(c.compile(div).css).toEqual('.a {\n  x: #2a2a2a;\n}\n');
    expect(c.compile(mul).css).toEqual('.a {\n  x: #000;\n}\n');
    expect(c.compile(colorDiv).css).toEqual('.a {\n  x: #80402a;\n}\n');
  });

  test('fixed levels keep the fraction until the final round', () => {
    const c = new LessCompiler({ compatLevel: 2 });
    expect(c.compile(div).css).toEqual('.a {\n  x: #2b2b2b;\n}\n');
    expect(c.compile(mul).css).toEqual('.a {\n  x: grey;\n}\n');
    expect(c.compile(colorDiv).css).toEqual('.a {\n  x: #80402b;\n}\n');
    expect(c.compile(digest).css).toEqual(fixedDigest);
  });

  test('an override forces the truncation on at a fixed level', () => {
    const c = new LessCompiler({ compatLevel: 2, compatPatches: { COLOR_CHANNEL_PRECISION: true } });
    expect(c.compile(div).css).toEqual('.a {\n  x: #2a2a2a;\n}\n');
    expect(c.compile(mul).css).toEqual('.a {\n  x: #000;\n}\n');
    expect(c.compile(colorDiv).css).toEqual('.a {\n  x: #80402a;\n}\n');
    expect(c.compile(digest).css).toEqual(legacyDigest);
  });
});

describe('COLOR_BLEND_ALPHA: blends keep the larger input alpha when fixed', () => {
  // Value-position calls render literally at every level, so the
  // blend table is exercised directly; the rendered strings match
  // the corpus pins for the blend-alpha fixture.
  const c1 = new RGBColor(255, 0, 0, 0.5);
  const c2 = new RGBColor(0, 0, 255, 0.25);
  const ctxAt = (level: number, patches?: { [id: string]: boolean }) =>
    new LessCompiler(patches === undefined ? { compatLevel: level } : { compatLevel: level, compatPatches: patches }).context();
  const blend = (name: string, level: number, patches?: { [id: string]: boolean }): RGBColor =>
    BLENDING[name].invoke(ctxAt(level, patches).newEnv(), [c1, c2]) as RGBColor;
  const render = (name: string, level: number, patches?: { [id: string]: boolean }): string =>
    ctxAt(level, patches).render(blend(name, level, patches));

  test('fixed levels keep the larger input alpha', () => {
    for (const name of Object.keys(BLENDING)) {
      expect(blend(name, 2).a).toBe(0.5);
    }
    expect(render('multiply', 2)).toEqual('rgba(0, 0, 0, .5)');
  });

  test('legacy levels blend opaque', () => {
    for (const name of Object.keys(BLENDING)) {
      expect(blend(name, 0).a).toBe(1.0);
      expect(blend(name, 1).a).toBe(1.0);
    }
    expect(render('multiply', 0)).toEqual('#000');
    expect(render('multiply', 1)).toEqual('#000');
  });

  test('an override forces the opaque blend at a fixed level', () => {
    expect(render('multiply', 2, { COLOR_BLEND_ALPHA: true })).toEqual('#000');
    for (const name of Object.keys(BLENDING)) {
      expect(blend(name, 2, { COLOR_BLEND_ALPHA: true }).a).toBe(1.0);
    }
  });
});

describe('ARGUMENTS_ORDER: @arguments emission order', () => {
  // A call .m(@b: 2, @a: 1) against params (@a, @b): legacy emits in
  // binding insertion order, fixed in parameter declaration order.
  const src = '.m(@a, @b) {\n  args: @arguments;\n}\n.x {\n  .m(@b: 2, @a: 1);\n}\n';
  const legacy = '.x {\n  args: 2 1;\n}\n';
  const fixed = '.x {\n  args: 1 2;\n}\n';

  test('legacy levels emit in binding insertion order', () => {
    for (const level of [0, 1]) {
      expect(new LessCompiler({ compatLevel: level }).compile(src).css).toEqual(legacy);
    }
  });

  test('the default options keep the insertion order', () => {
    expect(new LessCompiler({}).compile(src).css).toEqual(legacy);
  });

  test('fixed levels emit in parameter declaration order', () => {
    expect(new LessCompiler({ compatLevel: 2 }).compile(src).css).toEqual(fixed);
  });

  test('an override forces the insertion order on at a fixed level', () => {
    const c = new LessCompiler({ compatLevel: 2, compatPatches: { ARGUMENTS_ORDER: true } });
    expect(c.compile(src).css).toEqual(legacy);
  });
});

describe('VARIADIC_NAMED_ARG: a named arg targeting the variadic', () => {
  // Legacy rejects the named arg; fixed levels bind it directly to the
  // variadic parameter.
  const src = '.m(@a, @rest...) {\n  a: @a;\n  rest: @rest;\n}\n.x {\n  .m(1, @rest: 2);\n}\n';
  const err = 'ExecuteError ARG_NAMED_NOTFOUND: Named arg @rest not found';

  test('legacy levels fail with ARG_NAMED_NOTFOUND', () => {
    for (const level of [0, 1]) {
      const res = new LessCompiler({ compatLevel: level }).compile(src);
      expect(res.errors[0].errors[0].message).toEqual(err);
    }
  });

  test('the default options keep the rejection', () => {
    const res = new LessCompiler({}).compile(src);
    expect(res.errors[0].errors[0].message).toEqual(err);
  });

  test('fixed levels bind the named arg to the variadic', () => {
    const res = new LessCompiler({ compatLevel: 2 }).compile(src);
    expect(res.errors.length).toEqual(0);
    expect(res.css).toEqual('.x {\n  a: 1;\n  rest: 2;\n}\n');
  });

  test('an override forces the rejection on at a fixed level', () => {
    const c = new LessCompiler({ compatLevel: 2, compatPatches: { VARIADIC_NAMED_ARG: true } });
    expect(c.compile(src).errors[0].errors[0].message).toEqual(err);
  });
});

describe('GUARD_COMPARE_UNCOMPARABLE: uncomparable guard operands', () => {
  // A color on the left, a dimension on the right: there is no
  // ordering or equality between them. The corpus pins the same
  // truth table at every level (fixtures 420-426).
  const src = (op: string): string => `.m(@a) when (@a ${op} 10px) { p: 1; }\n.x { .m(red); }\n`;

  // Released (legacy) table: uncomparable operands compare as -1, so
  // '<', '<=' and '!=' are true.
  const legacyTrue = ['<', '<=', '!='];
  const legacyFalse = ['=', '>', '>='];

  test('legacy levels follow the released truth table', () => {
    for (const level of [0, 1]) {
      const c = new LessCompiler({ compatLevel: level });
      for (const op of legacyTrue) {
        expect(c.compile(src(op)).css).toEqual('.x {\n  p: 1;\n}\n');
      }
      for (const op of legacyFalse) {
        expect(c.compile(src(op)).css).toEqual('');
      }
    }
  });

  test('the default options keep the released table', () => {
    const c = new LessCompiler({});
    for (const op of legacyTrue) {
      expect(c.compile(src(op)).css).toEqual('.x {\n  p: 1;\n}\n');
    }
    for (const op of legacyFalse) {
      expect(c.compile(src(op)).css).toEqual('');
    }
  });

  test('fixed levels keep only the < quirk', () => {
    // '<' stays true upstream (less.js ordering parity); everything
    // else is false.
    const c = new LessCompiler({ compatLevel: 2 });
    expect(c.compile(src('<')).css).toEqual('.x {\n  p: 1;\n}\n');
    for (const op of ['<=', '=', '!=', '>', '>=']) {
      expect(c.compile(src(op)).css).toEqual('');
    }
  });

  test('comparable operands are unaffected at every level', () => {
    for (const level of [0, 1, 2]) {
      const c = new LessCompiler({ compatLevel: level });
      const eq = '.m(@a) when (@a = 10px) { p: 1; }\n.x { .m(10px); }\n';
      expect(c.compile(eq).css).toEqual('.x {\n  p: 1;\n}\n');
    }
  });

  test('an override forces the legacy table on at a fixed level', () => {
    const c = new LessCompiler({ compatLevel: 2, compatPatches: { GUARD_COMPARE_UNCOMPARABLE: true } });
    for (const op of legacyTrue) {
      expect(c.compile(src(op)).css).toEqual('.x {\n  p: 1;\n}\n');
    }
    for (const op of legacyFalse) {
      expect(c.compile(src(op)).css).toEqual('');
    }
  });

  // The full uncomparable-pair matrix: every (left, right) pair that
  // hits the uncomparable path follows the same two tables. Pairs are
  // [name, mixin arg, guard operand]. Quoted on the left is comparable
  // (string compare) and stays out of the matrix.
  const pairs: [string, string, string][] = [
    ['color vs dimension', 'red', '10px'],
    ['dimension vs color', '10px', 'red'],
    ['color vs non-color keyword', 'red', 'foo'],
    ['keyword vs color', 'foo', 'red'],
    ['keyword vs dimension', 'foo', '10px'],
    ['dimension vs keyword', '10px', 'foo'],
    ['dimension vs incompatible unit', '10s', '10px'],
    ['true vs dimension', 'true', '10px'],
    ['dimension vs true', '10px', 'true'],
    ['color vs quoted', 'red', '"x"'],
    ['keyword vs quoted', 'foo', '"x"'],
    ['dimension vs quoted', '10px', '"x"'],
  ];
  const pairSrc = (op: string, left: string, right: string): string =>
    `.m(@a) when (@a ${op} ${right}) { p: 1; }\n.x { .m(${left}); }\n`;

  const expectCss = (
    c: LessCompiler,
    label: string,
    name: string,
    op: string,
    left: string,
    right: string,
    want: string,
  ) => {
    const css = c.compile(pairSrc(op, left, right)).css;
    if (css !== want) {
      throw new Error(`${label}: ${name} ${op}\n--- want ---\n${want}\n--- got ---\n${css}`);
    }
  };

  const assertTable = (c: LessCompiler, fixed: boolean, label: string) => {
    const trueOps = fixed ? ['<'] : legacyTrue;
    const falseOps = fixed ? ['<=', '=', '!=', '>', '>='] : legacyFalse;
    for (const [name, left, right] of pairs) {
      for (const op of trueOps) {
        expectCss(c, label, name, op, left, right, '.x {\n  p: 1;\n}\n');
      }
      for (const op of falseOps) {
        expectCss(c, label, name, op, left, right, '');
      }
    }
  };

  test('every uncomparable pair follows the released table at legacy levels', () => {
    for (const level of [0, 1]) {
      assertTable(new LessCompiler({ compatLevel: level }), false, `level ${level}`);
    }
  });

  test('the default options keep the released table for every uncomparable pair', () => {
    assertTable(new LessCompiler({}), false, 'default');
  });

  test('every uncomparable pair keeps only the < quirk at fixed levels', () => {
    assertTable(new LessCompiler({ compatLevel: 2 }), true, 'fixed');
  });

  test('an override forces the released table on for every uncomparable pair', () => {
    assertTable(new LessCompiler({ compatLevel: 2, compatPatches: { GUARD_COMPARE_UNCOMPARABLE: true } }), false, 'override');
  });
});

describe('SELECTOR_COMPLEXITY_OVERFLOW: selector complexity threshold', () => {
  // The error message, verbatim from the Java ladder pins.
  const TOO_COMPLEX = 'ExecuteError SELECTOR_TOO_COMPLEX: Selector exceeds the complexity threshold';

  // 64 nested rulesets, 65 sibling selectors each. At the legacy
  // per-call budget the depth-1 combine fits (65 x 2 = 130 elements
  // per call), so the grid renders as 4225 selectors. Every deeper
  // combine needs 4225 x 3 elements in its first call, over the 4096
  // limit, so the deeper levels fall back to the ancestors and the
  // output keeps the depth-1 set once. Byte-compared to the ladder.
  const grid = (): string => {
    let src = '';
    for (let i = 0; i < 64; i++) {
      const sels: string[] = [];
      for (let j = 0; j < 65; j++) {
        sels.push('.s' + i + '-' + j);
      }
      src += sels.join(',\n') + ' {\n';
    }
    src += 'x: 1;\n';
    for (let i = 0; i < 64; i++) {
      src += '}\n';
    }
    return src;
  };

  test('legacy levels drop the overflowing nested selector', () => {
    for (const level of [0, 1]) {
      const res = new LessCompiler({ compatLevel: level }).compile(grid());
      expect(res.errors.length).toEqual(0);
      expect(res.css).toContain('.s0-0 .s1-0,');
      // 4225 combined selectors + the rule + the closing brace.
      expect(res.css.split('\n').length).toBe(4228);
    }
  });

  test('the default options keep the fallback', () => {
    const res = new LessCompiler({}).compile(grid());
    expect(res.errors.length).toEqual(0);
    expect(res.css.split('\n').length).toBe(4228);
  });

  test('fixed levels fail the compile', () => {
    expect(() => new LessCompiler({ compatLevel: 2 }).compile(grid())).toThrow(TOO_COMPLEX);
  });

  test('an override forces the fallback on at a fixed level', () => {
    const c = new LessCompiler({ compatLevel: 2, compatPatches: { SELECTOR_COMPLEXITY_OVERFLOW: true } });
    const res = c.compile(grid());
    expect(res.errors.length).toEqual(0);
    expect(res.css.split('\n').length).toBe(4228);
  });

  test('legacy levels: deeper nesting falls back to the ancestors', () => {
    // 65 top-level selectors nested 63 deep. The shallow combines fit
    // the budget, but the last one (65 x 64 = 4160 elements) exceeds
    // it, so the deepest rule keeps the ancestor selector, missing the
    // final .b62. Fixed levels fail the whole compile.
    const sels = Array.from({ length: 65 }, (_v, i) => '.a' + i).join(',\n');
    let nested = '';
    for (let i = 0; i < 63; i++) {
      nested += '.b' + i + ' {\n';
    }
    nested += 'color: red;\n';
    for (let i = 0; i < 63; i++) {
      nested += '}\n';
    }
    const src = sels + ' {\n' + nested + '}\n';

    const legacy = new LessCompiler({}).compile(src);
    expect(legacy.errors.length).toEqual(0);
    expect(legacy.css).toContain('.b61 {');
    expect(legacy.css.split('\n').length).toEqual(68);

    expect(() => new LessCompiler({ compatLevel: 2 }).compile(src)).toThrow(TOO_COMPLEX);
  });

  // A ruleset with count sibling selectors '.p0'..'.pN'.
  const manySelectors = (count: number, prefix: string): Ruleset =>
    new Ruleset(
      new Selectors(Array.from({ length: count }, (_v, i) => new Selector([new TextElement(undefined, '.' + prefix + i)]))),
      new Block([]),
    );

  test('a failed push leaves the env frame and depth unchanged', () => {
    // At the fixed levels a complexity overflow is a hard error. The
    // env must not commit a new frame or depth until the merge that
    // can throw has succeeded: a caller further up the stack may
    // recover from the exception (safe mode) and keep rendering, and
    // would otherwise inherit a half-pushed env.
    const ctx = new LessCompiler({ compatLevel: 2 }).context();
    const env = new RenderEnv(ctx);
    env.push(manySelectors(100, 'a'));
    const before = env.frame;
    expect(() => env.push(manySelectors(100, 'b'))).toThrow(TOO_COMPLEX);
    expect(env.frame).toBe(before);
    expect(env.depth).toBe(1);
  });

  // A flat top-level list whose single selector exceeds the budget
  // (4097 elements). The per-call flatten overflows, but the list has
  // no ancestors: the legacy fallback keeps the current list (the
  // released overflow contract) instead of dropping the rule.
  const flatOverflow = (): string => {
    let sel = '';
    for (let i = 0; i < 4097; i++) {
      sel += (i ? ' ' : '') + '.e' + i;
    }
    return sel + ' { color: red; }\n';
  };

  test('legacy levels keep a flat list that overflows per call', () => {
    const src = flatOverflow();
    for (const opts of [{}, { compatLevel: 0 }, { compatLevel: 1 }]) {
      const res = new LessCompiler(opts).compile(src);
      expect(res.errors.length).toEqual(0);
      expect(res.css.startsWith('.e0 .e1 .e2 ')).toBe(true);
      expect(res.css.split('.e').length - 1).toBe(4097);
      expect(res.css).toContain('color: red;');
    }
  });

  test('fixed levels fail on a flat list that overflows', () => {
    expect(() => new LessCompiler({ compatLevel: 2 }).compile(flatOverflow())).toThrow(TOO_COMPLEX);
  });

  // 32 x 21 x 3 nested comma lists (the corpus 432 window). Each inner
  // combine expands one current selector against 672 ancestors: 2016
  // elements per call, under the budget; the combined set is 6048, over
  // it. Legacy levels count per call and keep every combination; the
  // fixed level shares the budget and fails.
  const window = (): string => {
    const c = Array.from({ length: 32 }, (_v, i) => '.c' + i).join(', ');
    const m = Array.from({ length: 21 }, (_v, i) => '.m' + i).join(', ');
    return c + ' {\n' + m + ' {\n' + '.x1, .x2, .x3 {\n  color: red;\n}\n}\n}\n';
  };

  test('legacy levels keep a nested window whose combined set overflows', () => {
    for (const level of [0, 1]) {
      const res = new LessCompiler({ compatLevel: level }).compile(window());
      expect(res.errors.length).toEqual(0);
      expect(res.css.match(/\.x[123]/g)).toHaveLength(2016);
      expect(res.css).toContain('color: red;');
    }
  });

  test('fixed levels fail on a nested window whose combined set overflows', () => {
    expect(() => new LessCompiler({ compatLevel: 2 }).compile(window())).toThrow(TOO_COMPLEX);
  });
});

describe('MOD_ZERO_STRICT: mod(x, 0) obeys the division contract when fixed', () => {
  // Value-position calls render literally at every level in this tree,
  // so the table is exercised directly; the message bytes match the
  // ladder pins for the mod-zero fixture.
  const ctxAt = (level: number, patches?: { [id: string]: boolean }) =>
    new LessCompiler(patches === undefined ? { compatLevel: level } : { compatLevel: level, compatPatches: patches }).context();

  test('legacy levels return NaN silently, rendered as 0', () => {
    for (const level of [0, 1]) {
      const ctx = ctxAt(level);
      const env = ctx.newEnv();
      const res = MATH.mod.invoke(env, [new Dimension(10), new Dimension(0)]) as Dimension;
      expect(env.errors.length).toEqual(0);
      expect(ctx.render(res)).toEqual('0');
    }
  });

  test('fixed levels fail with DIVIDE_BY_ZERO', () => {
    const env = ctxAt(2).newEnv();
    MATH.mod.invoke(env, [new Dimension(10), new Dimension(0)]);
    expect(env.errors[0].message).toEqual('ExecuteError DIVIDE_BY_ZERO: Attempt to divide DIMENSION 10.0 by zero.');
  });

  test('a nonzero divisor is unaffected at every level', () => {
    for (const level of [0, 1, 2]) {
      const ctx = ctxAt(level);
      const env = ctx.newEnv();
      const res = MATH.mod.invoke(env, [new Dimension(11), new Dimension(3)]) as Dimension;
      expect(env.errors.length).toEqual(0);
      expect(ctx.render(res)).toEqual('2');
    }
  });

  test('combined legacy overrides return NaN rendered as 0', () => {
    // The mod legacy path plus the zero render of non-finite values.
    const ctx = ctxAt(0, { MOD_ZERO_STRICT: true, NONFINITE_AS_ZERO: true });
    const env = ctx.newEnv();
    const res = MATH.mod.invoke(env, [new Dimension(10), new Dimension(0)]) as Dimension;
    expect(env.errors.length).toEqual(0);
    expect(ctx.render(res)).toEqual('0');
  });

  test('an override forces the silent path on at a fixed level', () => {
    // Only MOD is forced on; the NaN renders visibly.
    const ctx = ctxAt(2, { MOD_ZERO_STRICT: true });
    const env = ctx.newEnv();
    const res = MATH.mod.invoke(env, [new Dimension(10), new Dimension(0)]) as Dimension;
    expect(env.errors.length).toEqual(0);
    expect(ctx.render(res)).toEqual('NaN');
  });
});

describe('CONVERT_INCOMPATIBLE_UNITS: convert() fails to incompatible units when fixed', () => {
  // Value-position calls render literally at every level in this tree,
  // so the table is exercised directly; the message bytes match the
  // ladder pins for the convert-incompatible fixture.
  const ctxAt = (level: number, patches?: { [id: string]: boolean }) =>
    new LessCompiler(patches === undefined ? { compatLevel: level } : { compatLevel: level, compatPatches: patches }).context();

  test('legacy levels emit 0 with the target unit', () => {
    for (const level of [0, 1]) {
      const ctx = ctxAt(level);
      const env = ctx.newEnv();
      const res = MISC.convert.invoke(env, [new Dimension(16, Unit.PX), new Keyword('em')]) as Dimension;
      expect(env.errors.length).toEqual(0);
      expect(ctx.render(res)).toEqual('0em');
    }
  });

  test('fixed levels fail with INCOMPATIBLE_UNITS', () => {
    const env = ctxAt(2).newEnv();
    MISC.convert.invoke(env, [new Dimension(16, Unit.PX), new Keyword('em')]);
    expect(env.errors[0].message).toEqual(
      'ExecuteError INCOMPATIBLE_UNITS: No conversion is possible from PX (pixels) to EM (element font size)',
    );
  });

  test('a compatible conversion is unaffected at every level', () => {
    for (const level of [0, 1, 2]) {
      const ctx = ctxAt(level);
      const env = ctx.newEnv();
      const res = MISC.convert.invoke(env, [new Dimension(1, Unit.IN), new Keyword('px')]) as Dimension;
      expect(env.errors.length).toEqual(0);
      expect(ctx.render(res)).toEqual('96px');
    }
  });

  test('an override forces the silent path on at a fixed level', () => {
    const ctx = ctxAt(2, { CONVERT_INCOMPATIBLE_UNITS: true });
    const env = ctx.newEnv();
    const res = MISC.convert.invoke(env, [new Dimension(16, Unit.PX), new Keyword('em')]) as Dimension;
    expect(env.errors.length).toEqual(0);
    expect(ctx.render(res)).toEqual('0em');
  });
});

describe('NUMBER_EXPO: exponents in numbers', () => {
  // At legacy levels 'e' is not an exponent: '1e3' tokenizes as the
  // number 1 and the identifier 'e3', and '7E705E' as 7 and 'E705E'
  // (both invalid CSS, emitted literally). At the fixed level the
  // exponent parses as part of the number. 'em' and 'ex' are units
  // at every level: 'e' is an exponent only when a digit or sign
  // follows.
  const cases: Array<[string, string, string]> = [
    ['1e3', '.a {\n  width: 1e3;\n}\n', '.a {\n  width: 1 e3;\n}\n'],
    ['7E705E', '.a {\n  x: 7E705E;\n}\n', '.a {\n  x: 7 E705E;\n}\n'],
    ['1.5e-3', '.a {\n  x: 1.5e-3;\n}\n', '.a {\n  x: 1.5 e-3;\n}\n'],
    ['10em', '.a {\n  width: 10em;\n}\n', '.a {\n  width: 10em;\n}\n'],
    ['2ex', '.a {\n  x: 2ex;\n}\n', '.a {\n  x: 2ex;\n}\n'],
  ];
  // The fixed level renders each number; 7E705 overflows to
  // Infinity and the trailing E stays an identifier.
  const fixedCss: { [key: string]: string } = {
    '1e3': '.a {\n  width: 1000;\n}\n',
    '7E705E': '.a {\n  x: Infinity E;\n}\n',
    '1.5e-3': '.a {\n  x: .0015;\n}\n',
    '10em': '.a {\n  width: 10em;\n}\n',
    '2ex': '.a {\n  x: 2ex;\n}\n',
  };

  test('legacy levels keep the exponent out of the number', () => {
    for (const level of [0, 1]) {
      const c = new LessCompiler({ compatLevel: level });
      for (const [, src, legacy] of cases) {
        expect(c.compile(src).css).toEqual(legacy);
      }
    }
  });

  test('the default options keep the released tokenization', () => {
    const c = new LessCompiler({});
    for (const [, src, legacy] of cases) {
      expect(c.compile(src).css).toEqual(legacy);
    }
  });

  test('fixed levels parse the exponent as part of the number', () => {
    const c = new LessCompiler({ compatLevel: 2 });
    for (const [key, src] of cases) {
      expect(c.compile(src).css).toEqual(fixedCss[key]);
    }
  });

  test('an override forces the released tokenization on at a fixed level', () => {
    const c = new LessCompiler({ compatLevel: 2, compatPatches: { NUMBER_EXPO: true } });
    for (const [, src, legacy] of cases) {
      expect(c.compile(src).css).toEqual(legacy);
    }
  });
});

describe('FUNCTION_CALL_IN_VALUE: calls are plain values below the fixed level', () => {
  // A value-position call is not a math operand: a trailing operator
  // dangles and the statement fails the parse, a guard condition fails
  // on the expected parenthesis, and a mixin call argument fails the
  // same way. The call itself still parses as a plain value.
  const INCOMPLETE = 'SyntaxError INCOMPLETE_PARSE Unable to complete parse.';
  const GUARD_PAREN = "SyntaxError EXPECTED Expected right parenthesis ')' to end guard condition";
  const ARGS_PAREN = "SyntaxError EXPECTED Expected right parenthesis ')' to end mixin call arguments";

  const firstError = (res: { css: string; errors: Array<{ errors: Array<{ message?: string }> }> }): string =>
    res.errors.length === 0 ? res.css : res.errors[0].errors[0].message || '';

  const sources: Array<[string, string]> = [
    ['.a {\n  x: lighten(#000, 10%) + 1;\n}\n', INCOMPLETE],
    ['@x: lighten(#000, 10%) + 10;\n.a {\n  color: @x;\n}\n', INCOMPLETE],
    ['.m() when (unit(10px) = 10) {\n  a: ok;\n}\n.a {\n  .m();\n}\n', GUARD_PAREN],
    ['.m(@c) {\n  color: @c;\n}\n.a {\n  .m(lighten(#000, 10%) + 1);\n}\n', ARGS_PAREN],
  ];

  test('legacy levels keep calls out of the operand chain', () => {
    for (const level of [0, 1]) {
      for (const [src, expected] of sources) {
        expect(firstError(new LessCompiler({ compatLevel: level }).compile(src))).toEqual(expected);
      }
    }
  });

  test('the default options keep the released parse', () => {
    for (const [src, expected] of sources) {
      expect(firstError(new LessCompiler({}).compile(src))).toEqual(expected);
    }
  });

  test('an override forces the plain-value side on at a fixed level', () => {
    const c = new LessCompiler({ compatLevel: 2, compatPatches: { FUNCTION_CALL_IN_VALUE: true } });
    for (const [src, expected] of sources) {
      expect(firstError(c.compile(src))).toEqual(expected);
    }
  });
});

describe('FUNCTION_CALL_IN_VALUE: calls evaluate at the fixed level', () => {
  // At the fixed level the calls parse as math operands and dispatch
  // to the function table; unknown names render literally with their
  // arguments evaluated, and a bad argument fails with the reference
  // error.
  const INCOMPLETE = 'SyntaxError INCOMPLETE_PARSE Unable to complete parse.';
  const firstError = (res: { css: string; errors: Array<{ errors: Array<{ message?: string }> }> }): string =>
    res.errors.length === 0 ? res.css : res.errors[0].errors[0].message || '';

  test('fixed levels dispatch calls to the function table', () => {
    const c = new LessCompiler({ compatLevel: 2 });
    expect(c.compile('.a {\n  color: lighten(#000, 10%);\n}\n').css).toEqual('.a {\n  color: #1a1a1a;\n}\n');
    expect(c.compile('.a {\n  width: round(4.6px);\n}\n').css).toEqual('.a {\n  width: 5px;\n}\n');
    expect(c.compile('@x: round(4.6);\n.a {\n  color: @x;\n}\n').css).toEqual('.a {\n  color: 5;\n}\n');
  });

  test('fixed levels take calls as math operands', () => {
    const c = new LessCompiler({ compatLevel: 2 });
    expect(
      c.compile('.a {\n  x: lighten(#000, 10%) + 1;\n  y: 1 + unit(5px);\n}\n').css
    ).toEqual('.a {\n  x: #1b1b1b;\n  y: 6;\n}\n');
  });

  test('fixed levels parse and evaluate calls in guard conditions', () => {
    const c = new LessCompiler({ compatLevel: 2 });
    expect(
      c.compile('.m() when (unit(10px) = 10) {\n  a: ok;\n}\n.a {\n  .m();\n}\n').css
    ).toEqual('.a {\n  a: ok;\n}\n');
  });

  test('an unknown function renders literally with evaluated args', () => {
    const c = new LessCompiler({ compatLevel: 2 });
    expect(c.compile('@x: 5;\n.a {\n  color: foo(@x);\n}\n').css).toEqual('.a {\n  color: foo(5);\n}\n');
  });

  test('a bad argument fails the call with the reference error', () => {
    const c = new LessCompiler({ compatLevel: 2 });
    expect(firstError(c.compile('.a {\n  x: unit(calc(100% - 90%));\n}\n'))).toEqual(
      'ExecuteError INVALID_ARG_EXT: Argument 1 must be DIMENSION. Found FUNCTION_CALL: calc(10%)'
    );
  });

  test('an override keeps the plain-value side on at a fixed level', () => {
    const c = new LessCompiler({ compatLevel: 2, compatPatches: { FUNCTION_CALL_IN_VALUE: true } });
    expect(c.compile('.a {\n  color: lighten(#000, 10%);\n}\n').css).toEqual('.a {\n  color: lighten(#000, 10%);\n}\n');
    expect(firstError(c.compile('.a {\n  x: lighten(#000, 10%) + 1;\n}\n'))).toEqual(INCOMPLETE);
  });
});
