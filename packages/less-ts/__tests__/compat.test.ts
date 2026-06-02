import { CompatLevel, LessCompiler, Patch, THRESHOLDS, maxThreshold } from '../src';

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
