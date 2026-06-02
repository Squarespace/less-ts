/**
 * Legacy behaviors gated by a compat level. A patch's legacy behavior is
 * active when the compile level is below its threshold (its fix not yet
 * applied), or when a per-site override forces it on.
 *
 * A fix that changes output ships with a legacy path gated by a new
 * patch at a new higher threshold, so higher levels apply more fixes
 * without changing the released surface at level 0. The default level
 * is 0, preserving released behavior until sites migrate up.
 *
 * BUG1..BUG4 are the former safe-mode tolerances. Retire a patch when
 * no site needs it: remove the legacy path, its tests, and the entry
 * together.
 */

export const Patch = {
  // Extraneous '+' at block scope is tolerated.
  BUG1: 'BUG1',

  // Block-less '@media' is dropped. The statements that follow attach
  // to the enclosing block.
  BUG2: 'BUG2',

  // A variable followed by empty parens, e.g. '@dk-gray();', is
  // accepted.
  BUG3: 'BUG3',

  // Invalid addition like 'random(90) + px' is tolerated. Parse
  // backtracking is skipped.
  BUG4: 'BUG4',

  // Selector-complexity overflow in a nested rule is swallowed: the
  // current selector is dropped instead of failing the compile.
  SELECTOR_COMPLEXITY_OVERFLOW: 'SELECTOR_COMPLEXITY_OVERFLOW',

  // '@import url("x.less")' is emitted literally instead of being
  // resolved and inlined.
  IMPORT_URL_INLINE: 'IMPORT_URL_INLINE',

  // NaN and Infinity values render as '0' instead of visible text.
  NONFINITE_AS_ZERO: 'NONFINITE_AS_ZERO',

  // 'mod(x, 0)' silently returns NaN instead of obeying the division
  // contract (strict fails, lenient warns).
  MOD_ZERO_STRICT: 'MOD_ZERO_STRICT',

  // convert() to an incompatible unit silently emits 0 instead of
  // failing the compile.
  CONVERT_INCOMPATIBLE_UNITS: 'CONVERT_INCOMPATIBLE_UNITS',

  // replace() treats '$' and '\\' in the replacement as regex group
  // references instead of inserting them literally.
  REPLACE_REGEX_GROUPS: 'REPLACE_REGEX_GROUPS',

  // A named argument that targets the variadic parameter is rejected
  // instead of binding to it.
  VARIADIC_NAMED_ARG: 'VARIADIC_NAMED_ARG',

  // 'arguments' is emitted in binding insertion order instead of
  // parameter declaration order.
  ARGUMENTS_ORDER: 'ARGUMENTS_ORDER',

  // Uncomparable guard operands keep acting like -1: <=, >= and !=
  // evaluate true instead of false.
  GUARD_COMPARE_UNCOMPARABLE: 'GUARD_COMPARE_UNCOMPARABLE',

  // @import extensions are matched case-sensitively, so "FOO.LESS"
  // is not resolved as a less file.
  IMPORT_EXT_CASE: 'IMPORT_EXT_CASE',

  // An @import-once after a plain import re-inlines the file instead
  // of suppressing the duplicate.
  IMPORT_ONCE_SUPPRESS: 'IMPORT_ONCE_SUPPRESS',

  // Color-blend functions drop the alpha channel: the result is
  // opaque instead of keeping the larger input alpha.
  COLOR_BLEND_ALPHA: 'COLOR_BLEND_ALPHA',

  // Color channel math truncates fractional intermediates to ints
  // before the final rounding.
  COLOR_CHANNEL_PRECISION: 'COLOR_CHANNEL_PRECISION',

  // An unterminated attribute selector or parenthesized element is
  // silently dropped instead of failing the compile.
  ATTR_SELECTOR_UNTERMINATED: 'ATTR_SELECTOR_UNTERMINATED',

  // Exponents are not part of a number: '1e3' tokenizes as the number
  // 1 and the identifier 'e3' (emitted literally, invalid CSS), and
  // '7E705E' as 7 and 'E705E'. At the fixed level '1e2', '2E2' and
  // '1.5e-3' parse as single CSS numbers; em/ex units are unaffected
  // (e is an exponent only when a digit follows).
  NUMBER_EXPO: 'NUMBER_EXPO',
} as const;

export type Patch = (typeof Patch)[keyof typeof Patch];

// Level at which each fix is applied; the legacy behavior is active
// below it. Frozen once a release ships: raising a threshold silently
// changes live sites at intermediate levels.
export const THRESHOLDS: { [id: string]: number } = {
  [Patch.BUG1]: 1,
  [Patch.BUG2]: 1,
  [Patch.BUG3]: 1,
  [Patch.BUG4]: 1,
  [Patch.SELECTOR_COMPLEXITY_OVERFLOW]: 2,
  [Patch.IMPORT_URL_INLINE]: 2,
  [Patch.NONFINITE_AS_ZERO]: 2,
  [Patch.MOD_ZERO_STRICT]: 2,
  [Patch.CONVERT_INCOMPATIBLE_UNITS]: 2,
  [Patch.REPLACE_REGEX_GROUPS]: 2,
  [Patch.VARIADIC_NAMED_ARG]: 2,
  [Patch.ARGUMENTS_ORDER]: 2,
  [Patch.GUARD_COMPARE_UNCOMPARABLE]: 2,
  [Patch.IMPORT_EXT_CASE]: 2,
  [Patch.IMPORT_ONCE_SUPPRESS]: 2,
  [Patch.COLOR_BLEND_ALPHA]: 2,
  [Patch.COLOR_CHANNEL_PRECISION]: 2,
  [Patch.ATTR_SELECTOR_UNTERMINATED]: 2,
  [Patch.NUMBER_EXPO]: 2,
};

// Highest threshold. The fully-fixed compiler sits here (every fix
// applied). The default level is 0, preserving released behavior.
export const maxThreshold = (): number => {
  let max = 0;
  for (const id of Object.keys(THRESHOLDS)) {
    max = Math.max(max, THRESHOLDS[id]);
  }
  return max;
};

/**
 * Compatibility level for one compile: how far along the fix ladder
 * the compiler sits. Level 0 keeps every legacy behavior active (the
 * released surface). At level N every patch whose threshold is at most
 * N is fixed. The highest level is the fully-fixed compiler.
 *
 * Per-site overrides force legacy behaviors on regardless of level,
 * for the rare site the ladder cannot express.
 */
export class CompatLevel {
  private constructor(
    readonly level: number,
    readonly overrides: { [id: string]: boolean },
  ) {}

  /**
   * Fully fixed compiler: every fix applied, no legacy behavior.
   */
  static fixed(): CompatLevel {
    return new CompatLevel(maxThreshold(), {});
  }

  /**
   * Default level: every legacy behavior active, preserving released
   * behavior. Safe default for unmigrated sites.
   */
  static defaultLevel(): CompatLevel {
    return new CompatLevel(0, {});
  }

  /**
   * A specific ladder position.
   */
  static at(level: number): CompatLevel {
    if (level < 0) {
      throw new Error(`compat level must be >= 0, got ${level}`);
    }
    return new CompatLevel(level, {});
  }

  /**
   * True when the legacy behavior is active at this level: the patch's
   * fix is not yet applied (level below its threshold), or the patch
   * is forced on via an override.
   */
  enabled(patch: Patch): boolean {
    return this.overrides[patch] === true || this.level < THRESHOLDS[patch];
  }

  /**
   * Copy with the patch's legacy behavior forced on.
   */
  withPatch(patch: Patch): CompatLevel {
    const copy: { [id: string]: boolean } = {};
    for (const key of Object.keys(this.overrides)) {
      copy[key] = this.overrides[key];
    }
    copy[patch] = true;
    return new CompatLevel(this.level, copy);
  }

  /**
   * Copy at a different ladder position, preserving the override set.
   * Changing the level must not silently discard per-site legacy
   * overrides, regardless of setter order on the options.
   */
  withLevel(level: number): CompatLevel {
    if (level < 0) {
      throw new Error(`compat level must be >= 0, got ${level}`);
    }
    return new CompatLevel(level, this.overrides);
  }

  toString(): string {
    return `CompatLevel(level=${this.level}, overrides=[${Object.keys(this.overrides).join(', ')}])`;
  }
}
