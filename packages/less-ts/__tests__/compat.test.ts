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
