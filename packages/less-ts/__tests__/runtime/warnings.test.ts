import { renderNode, RuntimeContext } from '../../src/runtime';
import { LessCompiler } from '../../src';

const newCtx = () => new RuntimeContext({}, renderNode);

describe('warning ledger', () => {
  test('exact-message repeats are recorded once', () => {
    const ctx = newCtx();
    const env = ctx.newEnv();
    env.addWarning('first');
    env.addWarning('first');
    env.addWarning('second');
    expect(env.takeWarnings()).toEqual(['first', 'second']);
  });

  test('a drained message can be recorded again', () => {
    // Draining clears the dedupe keys: a warning raised after a
    // drain is not a repeat.
    const ctx = newCtx();
    const env = ctx.newEnv();
    env.addWarning('first');
    expect(env.takeWarnings()).toEqual(['first']);
    env.addWarning('first');
    expect(env.takeWarnings()).toEqual(['first']);
  });

  test('draining returns a copy and clears the ledger', () => {
    const ctx = newCtx();
    const env = ctx.newEnv();
    env.addWarning('first');
    const drained = env.takeWarnings();
    drained.push('mutated');
    expect(env.takeWarnings()).toEqual([]);
  });

  test('a failed compile leaves the ledger for the next compile on a reused context', () => {
    // Compile A records warnings, then fails before the evaluator
    // attaches them (no drain runs). Without the start-of-compile
    // reset, compile B on this context inherits the stale entry,
    // and its dedupe key swallows B's identical fresh warning.
    const ctx = newCtx();
    const a = ctx.newEnv();
    a.addWarning('stale');
    const b = ctx.newEnv();
    b.addWarning('stale');
    b.addWarning('fresh');
    expect(b.takeWarnings()).toEqual(['stale', 'fresh']);
  });

  test('resetWarnings starts a reused context clean', () => {
    const ctx = newCtx();
    const a = ctx.newEnv();
    a.addWarning('stale');
    // Compile start: the reset clears entries and dedupe keys, so
    // an identical fresh warning in compile B is not a repeat.
    ctx.resetWarnings();
    const b = ctx.newEnv();
    b.addWarning('stale');
    expect(b.takeWarnings()).toEqual(['stale']);
  });
});

describe('warning budgets', () => {
  // 42 distinct warnings of one type: two families of incompatible
  // unit pairs against px, so the messages differ (dedupe keeps all
  // of them) while the type bucket is INCOMPATIBLE_UNITS throughout.
  const UNITS = ['ch', 'em', 'ex', 'rem', 'vh', 'vw', 'vmin', 'vmax', 'vm', 'fr', 's', 'ms', 'dpi', 'dpcm', 'dppx', 'hz', 'khz', 'deg', 'grad', 'rad', 'turn'];
  const floodSheet = (): string => {
    let sheet = '';
    for (let i = 0; i < UNITS.length; i++) {
      sheet += `.f${i} { x: 90${UNITS[i]} + 5px; }\n`;
    }
    for (let i = 0; i < UNITS.length; i++) {
      sheet += `.g${i} { x: 90px + 5${UNITS[i]}; }\n`;
    }
    return sheet;
  };

  // Java main's output for floodSheet() at default options
  // (25 per type, no overall limit): 25 inline warnings, the other
  // 17 summarized in the trailing comment.
  const DEFAULT_CSS = `.f0 {
  /* WARNING[1] raised evaluating next rule: ExecuteError INCOMPATIBLE_UNITS: No conversion is possible from CH (advance measure of '0' glyph) to PX (pixels).. stripping unit. */
  x: 95ch;
}
.f1 {
  /* WARNING[2] raised evaluating next rule: ExecuteError INCOMPATIBLE_UNITS: No conversion is possible from EM (element font size) to PX (pixels).. stripping unit. */
  x: 95em;
}
.f2 {
  /* WARNING[3] raised evaluating next rule: ExecuteError INCOMPATIBLE_UNITS: No conversion is possible from EX (x-height of element's font) to PX (pixels).. stripping unit. */
  x: 95ex;
}
.f3 {
  /* WARNING[4] raised evaluating next rule: ExecuteError INCOMPATIBLE_UNITS: No conversion is possible from REM (font size of root element) to PX (pixels).. stripping unit. */
  x: 95rem;
}
.f4 {
  /* WARNING[5] raised evaluating next rule: ExecuteError INCOMPATIBLE_UNITS: No conversion is possible from VH (viewport's height) to PX (pixels).. stripping unit. */
  x: 95vh;
}
.f5 {
  /* WARNING[6] raised evaluating next rule: ExecuteError INCOMPATIBLE_UNITS: No conversion is possible from VW (viewport's width) to PX (pixels).. stripping unit. */
  x: 95vw;
}
.f6 {
  /* WARNING[7] raised evaluating next rule: ExecuteError INCOMPATIBLE_UNITS: No conversion is possible from VMIN (viewport's smaller dimension) to PX (pixels).. stripping unit. */
  x: 95vmin;
}
.f7 {
  /* WARNING[8] raised evaluating next rule: ExecuteError INCOMPATIBLE_UNITS: No conversion is possible from VMAX (viewport's larger dimension) to PX (pixels).. stripping unit. */
  x: 95vmax;
}
.f8 {
  /* WARNING[9] raised evaluating next rule: ExecuteError INCOMPATIBLE_UNITS: No conversion is possible from VM to PX (pixels).. stripping unit. */
  x: 95vm;
}
.f9 {
  /* WARNING[10] raised evaluating next rule: ExecuteError INCOMPATIBLE_UNITS: No conversion is possible from FR (fractions) to PX (pixels).. stripping unit. */
  x: 95fr;
}
.f10 {
  /* WARNING[11] raised evaluating next rule: ExecuteError INCOMPATIBLE_UNITS: No conversion is possible from S (seconds) to PX (pixels).. stripping unit. */
  x: 95s;
}
.f11 {
  /* WARNING[12] raised evaluating next rule: ExecuteError INCOMPATIBLE_UNITS: No conversion is possible from MS (milliseconds) to PX (pixels).. stripping unit. */
  x: 95ms;
}
.f12 {
  /* WARNING[13] raised evaluating next rule: ExecuteError INCOMPATIBLE_UNITS: No conversion is possible from DPI (dots per inch) to PX (pixels).. stripping unit. */
  x: 95dpi;
}
.f13 {
  /* WARNING[14] raised evaluating next rule: ExecuteError INCOMPATIBLE_UNITS: No conversion is possible from DPCM (dots per centimeter) to PX (pixels).. stripping unit. */
  x: 95dpcm;
}
.f14 {
  /* WARNING[15] raised evaluating next rule: ExecuteError INCOMPATIBLE_UNITS: No conversion is possible from DPPX (dots per 'px' unit) to PX (pixels).. stripping unit. */
  x: 95dppx;
}
.f15 {
  /* WARNING[16] raised evaluating next rule: ExecuteError INCOMPATIBLE_UNITS: No conversion is possible from HZ (hertz) to PX (pixels).. stripping unit. */
  x: 95hz;
}
.f16 {
  /* WARNING[17] raised evaluating next rule: ExecuteError INCOMPATIBLE_UNITS: No conversion is possible from KHZ (kilohertz) to PX (pixels).. stripping unit. */
  x: 95khz;
}
.f17 {
  /* WARNING[18] raised evaluating next rule: ExecuteError INCOMPATIBLE_UNITS: No conversion is possible from DEG (degrees) to PX (pixels).. stripping unit. */
  x: 95deg;
}
.f18 {
  /* WARNING[19] raised evaluating next rule: ExecuteError INCOMPATIBLE_UNITS: No conversion is possible from GRAD (gradians) to PX (pixels).. stripping unit. */
  x: 95grad;
}
.f19 {
  /* WARNING[20] raised evaluating next rule: ExecuteError INCOMPATIBLE_UNITS: No conversion is possible from RAD (radians) to PX (pixels).. stripping unit. */
  x: 95rad;
}
.f20 {
  /* WARNING[21] raised evaluating next rule: ExecuteError INCOMPATIBLE_UNITS: No conversion is possible from TURN (turns) to PX (pixels).. stripping unit. */
  x: 95turn;
}
.g0 {
  /* WARNING[22] raised evaluating next rule: ExecuteError INCOMPATIBLE_UNITS: No conversion is possible from PX (pixels) to CH (advance measure of '0' glyph).. stripping unit. */
  x: 95px;
}
.g1 {
  /* WARNING[23] raised evaluating next rule: ExecuteError INCOMPATIBLE_UNITS: No conversion is possible from PX (pixels) to EM (element font size).. stripping unit. */
  x: 95px;
}
.g2 {
  /* WARNING[24] raised evaluating next rule: ExecuteError INCOMPATIBLE_UNITS: No conversion is possible from PX (pixels) to EX (x-height of element's font).. stripping unit. */
  x: 95px;
}
.g3 {
  /* WARNING[25] raised evaluating next rule: ExecuteError INCOMPATIBLE_UNITS: No conversion is possible from PX (pixels) to REM (font size of root element).. stripping unit. */
  x: 95px;
}
.g4 {
  x: 95px;
}
.g5 {
  x: 95px;
}
.g6 {
  x: 95px;
}
.g7 {
  x: 95px;
}
.g8 {
  x: 95px;
}
.g9 {
  x: 95px;
}
.g10 {
  x: 95px;
}
.g11 {
  x: 95px;
}
.g12 {
  x: 95px;
}
.g13 {
  x: 95px;
}
.g14 {
  x: 95px;
}
.g15 {
  x: 95px;
}
.g16 {
  x: 95px;
}
.g17 {
  x: 95px;
}
.g18 {
  x: 95px;
}
.g19 {
  x: 95px;
}
.g20 {
  x: 95px;
}
/* WARNING[26] suppressed: 17 warnings suppressed (17 INCOMPATIBLE_UNITS); limit 25 per type */
`;

  const stripWarnings = (css: string): string => css.replace(/[ \t]*\/\* WARNING\[\d+\][^\n]*\n/g, '');
  const warningLines = (css: string): string[] => (css.match(/[ \t]*\/\* WARNING\[\d+\][^\n]*\n/g) as string[]) || [];

  test('defaults: 25 per type emit, the rest summarize in the trailing comment', () => {
    expect(new LessCompiler({}).compile(floodSheet()).css).toEqual(DEFAULT_CSS);
  });

  test('an explicit overall limit buckets the suppression overall', () => {
    const css = new LessCompiler({ maxWarnings: 3 }).compile(floodSheet()).css;
    // The rule bodies are untouched by the budget; only the warning
    // comments change.
    expect(stripWarnings(css)).toEqual(stripWarnings(DEFAULT_CSS));
    const lines = warningLines(css);
    expect(lines.length).toBe(4);
    expect(lines.slice(0, 3)).toEqual(warningLines(DEFAULT_CSS).slice(0, 3));
    expect(lines[3]).toBe('/* WARNING[4] suppressed: 39 warnings suppressed (39 overall); limit 25 per type, limit 3 overall */\n');
  });

  test('the per-type limit is checked before the overall one', () => {
    const css = new LessCompiler({ maxWarnings: 3, maxWarningsPerType: 2 }).compile(floodSheet()).css;
    expect(stripWarnings(css)).toEqual(stripWarnings(DEFAULT_CSS));
    const lines = warningLines(css);
    expect(lines.length).toBe(3);
    expect(lines.slice(0, 2)).toEqual(warningLines(DEFAULT_CSS).slice(0, 2));
    expect(lines[2]).toBe('/* WARNING[3] suppressed: 40 warnings suppressed (40 INCOMPATIBLE_UNITS); limit 2 per type, limit 3 overall */\n');
  });

  test('suppressed counts track distinct messages; repeats of a suppressed message are free', () => {
    const ctx = new RuntimeContext({ maxWarningsPerType: 2 }, renderNode);
    const env = ctx.newEnv();
    env.addWarning('ExecuteError INCOMPATIBLE_UNITS: one');
    env.addWarning('ExecuteError INCOMPATIBLE_UNITS: two');
    env.addWarning('ExecuteError INCOMPATIBLE_UNITS: three');
    // A repeat of the suppressed message takes no key and no count.
    env.addWarning('ExecuteError INCOMPATIBLE_UNITS: three');
    expect(env.takeWarnings()).toEqual(['ExecuteError INCOMPATIBLE_UNITS: one', 'ExecuteError INCOMPATIBLE_UNITS: two']);
    expect(ctx.suppressedWarningSummary()).toBe('1 warnings suppressed (1 INCOMPATIBLE_UNITS); limit 2 per type');
  });

  test('warning types bucket by error code and recovery phase', () => {
    expect(RuntimeContext.warningType('ExecuteError INCOMPATIBLE_UNITS: x')).toBe('INCOMPATIBLE_UNITS');
    expect(RuntimeContext.warningType('ExecuteError DIVIDE_BY_ZERO: x')).toBe('DIVIDE_BY_ZERO');
    // No colon after the code word: the catch-all bucket.
    expect(RuntimeContext.warningType('SyntaxError INCOMPLETE_PARSE Unable to complete parse.')).toBe('parse-recovery');
    expect(RuntimeContext.warningType('eval: dropped member')).toBe('eval-drop');
    expect(RuntimeContext.warningType('render: skipped node')).toBe('render-skip');
    expect(RuntimeContext.warningType('render: truncated list')).toBe('render-skip');
    expect(RuntimeContext.warningType('use of replace() is currently experimental')).toBe('parse-recovery');
  });

  test('resetWarnings also clears the budget accounting', () => {
    const ctx = new RuntimeContext({ maxWarningsPerType: 1 }, renderNode);
    const a = ctx.newEnv();
    a.addWarning('ExecuteError DIVIDE_BY_ZERO: one');
    a.addWarning('ExecuteError DIVIDE_BY_ZERO: two');
    ctx.resetWarnings();
    const b = ctx.newEnv();
    b.addWarning('ExecuteError DIVIDE_BY_ZERO: two');
    expect(b.takeWarnings()).toEqual(['ExecuteError DIVIDE_BY_ZERO: two']);
    expect(ctx.suppressedWarningSummary()).toBeUndefined();
  });
});
