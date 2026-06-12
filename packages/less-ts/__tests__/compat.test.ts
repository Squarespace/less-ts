import { Block, CompatLevel, LessCompiler, Patch, RGBColor, RenderEnv, Ruleset, Selector, Selectors, THRESHOLDS, TextElement, maxThreshold } from '../src';
import { BLENDING } from '../src/plugins/color';

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

// The message Java attaches to a parse that cannot complete.
const PARSE_ERROR = 'SyntaxError INCOMPLETE_PARSE Unable to complete parse.';

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
    expect(() => new LessCompiler({}).compile('.a {\n  x: 1;\n  + /* c */ }\n')).toThrow(PARSE_ERROR);
    expect(() => new LessCompiler({}).compile('.a {\n  x: 1;\n  + foo }\n')).toThrow(PARSE_ERROR);
  });

  test('fixed levels reject the stray +', () => {
    for (const level of [1, 2]) {
      expect(() => new LessCompiler({ compatLevel: level }).compile(src)).toThrow(PARSE_ERROR);
      expect(() => new LessCompiler({ compatLevel: level }).compile(bare)).toThrow(PARSE_ERROR);
      expect(() => new LessCompiler({ compatLevel: level }).compile(nested)).toThrow(PARSE_ERROR);
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
      expect(() => new LessCompiler({ compatLevel: level }).compile(root)).toThrow(PARSE_ERROR);
      expect(() => new LessCompiler({ compatLevel: level }).compile(nested)).toThrow(PARSE_ERROR);
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
      expect(() => new LessCompiler({ compatLevel: level }).compile(src)).toThrow(PARSE_ERROR);
    }
  });

  test('an override forces the tolerance on at a fixed level', () => {
    expect(new LessCompiler({ compatLevel: 2, compatPatches: { BUG3: true } }).compile(src).css).toEqual('.a {\n  x: 1;\n}\n');
  });
});

describe('BUG4: invalid additions', () => {
  const src = '@foo: 10px;\n.a {\n  x: @foo + px;\n  y: 1 + px;\n  z: 2 -;\n}\n';
  const legacyCss = '.a {\n  x: 10px px;\n  y: 1 px;\n  z: 2 -;\n}\n';

  test('legacy levels keep the dangling operator', () => {
    expect(new LessCompiler({}).compile(src).css).toEqual(legacyCss);
    expect(new LessCompiler({ compatLevel: 0 }).compile(src).css).toEqual(legacyCss);
  });

  test('fixed levels reject the input', () => {
    for (const level of [1, 2]) {
      expect(() => new LessCompiler({ compatLevel: level }).compile(src)).toThrow(PARSE_ERROR);
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

  test('an override forces the tolerance on at a fixed level', () => {
    expect(new LessCompiler({ compatLevel: 2, compatPatches: { BUG4: true } }).compile(src).css).toEqual(legacyCss);
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
});
