import { Definition, LessCompiler, maxThreshold, NodeType, Options, THRESHOLDS } from '../src';

// The recovery matrix contract: every registry patch (17 rows) x
// level 0..2 x strict/safe = 102 cells. Each row declares its source,
// threshold, strict error type, polarity, and (per polarity) whether
// the rendered body is unchanged at the fixed level and whether its
// recovery drops the entire stylesheet. The harness pins the outcome
// class of each cell - ok, ok + recovery warning, or an error of the
// declared type - not its bytes. Byte parity is the corpus' job.
//
// Three registry patches have no row: IMPORT_URL_INLINE,
// IMPORT_EXT_CASE, IMPORT_ONCE_SUPPRESS. This compiler has no
// importer; the import patches are dormant by design.
//
// The polarities cover the fix families:
//
// REJECT_FIX - the fix rejects legacy junk: strict errors at the
// fixed level, ok below; safe recovers with a warning at the fixed
// level, clean below. At the fixed safe level the rendered body
// equals the released (level 0, safe) body iff cssUnchangedAtFix.
//
// ACCEPT_FIX - the fix accepts input the legacy side rejected:
// strict errors below the threshold, ok at/above; safe recovers with
// a warning below, ok at/above, and the body must differ from the
// released body at the fixed level (the accepted input now renders).
//
// OUTPUT_FIX - output-only change: never an error, never a recovery
// warning, at any level; the body must differ from the released body
// at the fixed level.
//
// LITERAL_IN_VALUE - the patch's construct is a function call in a
// property value, and the call is not in the default function table,
// so it renders literally and the gate has no observable outcome: ok
// at every cell, zero recovery warnings, body unchanged at every
// level including the fixed one.
//
// emptyRecovery (REJECT_FIX rows): when the recovery at the fixed
// level drops the entire stylesheet, the safe cell is a hard GENERAL
// error even in safe mode.

const Polarity = {
  REJECT_FIX: 'REJECT_FIX',
  ACCEPT_FIX: 'ACCEPT_FIX',
  OUTPUT_FIX: 'OUTPUT_FIX',
  LITERAL_IN_VALUE: 'LITERAL_IN_VALUE',
} as const;
type Polarity = (typeof Polarity)[keyof typeof Polarity];

interface Row {
  name: string;
  source: string;
  threshold: number;
  // Strict-mode error type at the failing cells ('' when the
  // polarity never errors).
  errorType: string;
  polarity: Polarity;
  // REJECT_FIX: the rendered body at the fixed safe level equals the
  // released (level 0, safe) body.
  cssUnchangedAtFix: boolean;
  // REJECT_FIX: recovery at the fixed level drops the entire
  // stylesheet; the safe cell is a hard GENERAL error.
  emptyRecovery: boolean;
}

const row = (
  name: string,
  source: string,
  threshold: number,
  errorType: string,
  polarity: Polarity,
  cssUnchangedAtFix = false,
  emptyRecovery = false,
): Row => ({ name, source, threshold, errorType, polarity, cssUnchangedAtFix, emptyRecovery });

// 65 comma-siblings wrapping 63 nested levels: the deepest combine
// exceeds the complexity limit at the fixed level.
const complexitySource = (): string => {
  const sels = Array.from({ length: 65 }, (_v, i) => '.a' + i).join(', ');
  let nested = '';
  for (let i = 0; i < 63; i++) {
    nested += '.b' + i + ' {\n';
  }
  nested += 'color: red;\n';
  for (let i = 0; i < 63; i++) {
    nested += '}\n';
  }
  return sels + ' {\n' + nested + '}\n';
};

const ROWS: Row[] = [
  // Threshold 1: the former safe-mode tolerances.
  row('BUG1', '.a { + }\n', 1, 'INCOMPLETE_PARSE', Polarity.REJECT_FIX, true),
  row(
    'BUG2',
    '@media only screen and (max-width: 640px)\n#content {\n  padding-top: 50px;\n}\n',
    1,
    'INCOMPLETE_PARSE',
    Polarity.REJECT_FIX,
    true,
  ),
  row('BUG3', '@dk-gray: #333;\n.dark-bg {\n  background-color: @dk-gray();\n}\n', 1, 'INCOMPLETE_PARSE', Polarity.REJECT_FIX),
  row('BUG4', '@foo: 10px;\n.a {\n  width: @foo + px;\n}\n', 1, 'INCOMPLETE_PARSE', Polarity.REJECT_FIX),

  // Threshold 2: the remaining patches.
  row('ATTR_SELECTOR_UNTERMINATED', 'a[href {\n  color: red;\n}\n', 2, 'INCOMPLETE_PARSE', Polarity.REJECT_FIX, false, true),
  row('SELECTOR_COMPLEXITY_OVERFLOW', complexitySource(), 2, 'SELECTOR_TOO_COMPLEX', Polarity.REJECT_FIX),
  row('NONFINITE_AS_ZERO', '.nf { w: sqrt(-1); }\n', 2, '', Polarity.OUTPUT_FIX),
  row('MOD_ZERO_STRICT', '.mz { w: mod(10, 0); }\n', 2, 'DIVIDE_BY_ZERO', Polarity.REJECT_FIX),
  row('CONVERT_INCOMPATIBLE_UNITS', '.cv { w: convert(16px, em); }\n', 2, 'INCOMPATIBLE_UNITS', Polarity.REJECT_FIX),
  row('REPLACE_REGEX_GROUPS', '.r { s: replace("abc", "b", "X"); }\n', 2, '', Polarity.LITERAL_IN_VALUE),
  row('VARIADIC_NAMED_ARG', '.m(@b...) { p: @b; }\n.x { .m(@b: 1); }\n', 2, 'ARG_NAMED_NOTFOUND', Polarity.ACCEPT_FIX),
  row('ARGUMENTS_ORDER', '.m(@a, @b) { p: @arguments; }\n.x { .m(@b: 2, @a: 1); }\n', 2, '', Polarity.OUTPUT_FIX),
  row('GUARD_COMPARE_UNCOMPARABLE', '.m(@a) when (@a != 10px) { p: 1; }\n.x { .m(red); }\n', 2, '', Polarity.OUTPUT_FIX),
  row(
    'COLOR_BLEND_ALPHA',
    '.blend { color: multiply(rgba(255, 0, 0, 0.5), rgba(0, 0, 255, 0.25)); }\n',
    2,
    '',
    Polarity.OUTPUT_FIX,
  ),
  row('COLOR_CHANNEL_PRECISION', '.cp { c: #fff * 0.5; }\n', 2, '', Polarity.OUTPUT_FIX),
  row('NUMBER_EXPO', '.ne { w: 1e2; }\n', 2, '', Polarity.OUTPUT_FIX),
  row('FUNCTION_CALL_IN_VALUE', '.fc { w: round(4.6px); }\n', 2, '', Polarity.OUTPUT_FIX),
];

// One cell's outcome, normalized: compile() can throw (parse errors,
// selector complexity) or return error events (eval errors).
type Outcome = { ok: true; css: string } | { ok: false; code: string };

// The error code is the second whitespace token of the message, minus
// a trailing ':': "SyntaxError INCOMPLETE_PARSE: ..." ->
// INCOMPLETE_PARSE, "ExecuteError SELECTOR_TOO_COMPLEX: ..." ->
// SELECTOR_TOO_COMPLEX, "SyntaxError GENERAL stylesheet produced no
// output" -> GENERAL.
const errorCode = (message: string): string => {
  const parts = message.trim().split(/\s+/);
  const token = parts.length > 1 ? parts[1] : parts[0];
  return token.endsWith(':') ? token.slice(0, -1) : token;
};

const run = (source: string, level: number, safe: boolean): Outcome => {
  try {
    const res = new LessCompiler({ compatLevel: level, safeMode: safe }).compile(source);
    if (res.errors.length > 0) {
      return { ok: false, code: errorCode(res.errors[0].errors[0].message) };
    }
    return { ok: true, css: res.css };
  } catch (e) {
    return { ok: false, code: errorCode((e as Error).message) };
  }
};

// The rendered body: recovery-warning comment lines stripped, trimmed.
const body = (css: string): string => css.replace(/\/\* WARNING\[[0-9]+\][^\n]*\*\/\n?/g, '').trim();

// Recovery warnings carry the "raised during recovery" phrase.
const recoveryWarnings = (css: string): number => (css.match(/raised during recovery/g) || []).length;

const matrixViolations = (rows: Row[]): string[] => {
  const violations: string[] = [];
  const topLevel = maxThreshold();
  for (const r of rows) {
    // Released reference: level 0 in safe mode always compiles,
    // giving the body the released behavior renders.
    const released = run(r.source, 0, true);
    const releasedBody = released.ok ? body(released.css) : '';
    for (let level = 0; level <= topLevel; level++) {
      const fixed = level >= r.threshold;
      const cell = `L${level}`;

      // Strict mode.
      const strict = run(r.source, level, false);
      let expectError = false;
      if (r.polarity === Polarity.REJECT_FIX) {
        expectError = fixed;
      } else if (r.polarity === Polarity.ACCEPT_FIX) {
        expectError = !fixed;
      }
      if (expectError) {
        if (strict.ok) {
          violations.push(`${r.name} ${cell} strict: expected ${r.errorType}, compiled`);
        } else if (strict.code !== r.errorType) {
          violations.push(`${r.name} ${cell} strict: expected ${r.errorType}, got ${strict.code}`);
        }
      } else if (!strict.ok) {
        violations.push(`${r.name} ${cell} strict: expected ok, got ${strict.code}`);
      } else if (recoveryWarnings(strict.css) !== 0) {
        violations.push(`${r.name} ${cell} strict: unexpected recovery warnings`);
      }

      // Safe mode: always compiles, except rows whose recovery drops
      // the entire stylesheet (emptyRecovery): a hard GENERAL error
      // even in safe mode.
      let recoveryExpected = false;
      if (r.polarity === Polarity.REJECT_FIX) {
        recoveryExpected = fixed;
      } else if (r.polarity === Polarity.ACCEPT_FIX) {
        recoveryExpected = !fixed;
      }
      const emptyRecoveryExpected = r.emptyRecovery && recoveryExpected;
      const safe = run(r.source, level, true);
      if (!safe.ok) {
        if (!emptyRecoveryExpected) {
          violations.push(`${r.name} ${cell} safe: expected ok, got ${safe.code}`);
        } else if (safe.code !== 'GENERAL') {
          violations.push(`${r.name} ${cell} safe: expected the empty-recovery error (GENERAL), got ${safe.code}`);
        }
        continue;
      }
      if (emptyRecoveryExpected) {
        violations.push(`${r.name} ${cell} safe: expected the empty-recovery error, compiled`);
        continue;
      }
      const warns = recoveryWarnings(safe.css);
      if (recoveryExpected) {
        if (warns === 0) {
          violations.push(`${r.name} ${cell} safe: expected a recovery warning`);
        }
        if (r.polarity === Polarity.REJECT_FIX) {
          const same = body(safe.css) === releasedBody;
          if (same !== r.cssUnchangedAtFix) {
            violations.push(
              `${r.name} ${cell} safe: body ${same ? 'unchanged but expected change' : 'changed but expected unchanged'}`,
            );
          }
        }
      } else if (warns !== 0) {
        violations.push(`${r.name} ${cell} safe: unexpected recovery warnings`);
      } else if (r.polarity === Polarity.LITERAL_IN_VALUE) {
        // The gate has no observable outcome: the body renders the
        // same at every level, including the fixed one.
        if (body(safe.css) !== releasedBody) {
          violations.push(`${r.name} ${cell} safe: body changed but expected unchanged`);
        }
      } else if (
        fixed &&
        (r.polarity === Polarity.ACCEPT_FIX || r.polarity === Polarity.OUTPUT_FIX) &&
        body(safe.css) === releasedBody
      ) {
        violations.push(`${r.name} ${cell} safe: expected a css change at the fixed level, body unchanged`);
      }
    }
  }
  return violations;
};

describe('recovery matrix contract (patch x level x mode)', () => {
  test('the 102-cell matrix holds', () => {
    expect(matrixViolations(ROWS)).toEqual([]);
  });

  test('a mutated row produces a named violation', () => {
    // BUG1 with the wrong strict error type.
    const wrongType = ROWS.map((r) => (r.name === 'BUG1' ? { ...r, errorType: 'SELECTOR_TOO_COMPLEX' } : r));
    const typeViolations = matrixViolations(wrongType);
    expect(typeViolations.length).toBeGreaterThan(0);
    expect(typeViolations.every((v) => v.startsWith('BUG1'))).toBe(true);

    // BUG1 with the polarity flipped: the cells below the threshold
    // now expect errors, the fixed cells expect no recovery warning.
    const flipped = ROWS.map((r) => (r.name === 'BUG1' ? { ...r, polarity: Polarity.ACCEPT_FIX } : r));
    const flippedViolations = matrixViolations(flipped);
    expect(flippedViolations.length).toBeGreaterThan(0);
    expect(flippedViolations.every((v) => v.startsWith('BUG1'))).toBe(true);
  });

  test('each row threshold matches the registry', () => {
    for (const r of ROWS) {
      expect(THRESHOLDS[r.name]).toBe(r.threshold);
    }
  });
});

// A definition whose value fails to evaluate is reported in the
// definition's own scope, even when it is the last member of the
// sheet and no later rule captures the env's error list. The strict
// cells pin the first error message, the css bytes (empty, or the
// rule after the definition still renders), and the event's node.
// The safe cells pin the drop-warning bytes and zero error events.
// Level 0 strict equals the default surface; the reference bytes
// come from the bare strict and level-0 safe probes.
describe('a trailing failing definition', () => {
  const TRAIL_ERR =
    'ExecuteError VAR_UNDEFINED: Failed to locate a definition for the variable @undef in current scope';
  const TRAIL_DROP =
    '/* WARNING[1] raised during recovery: eval: dropped definition: ' + TRAIL_ERR + ' */\n';
  const strictCells: Options[] = [{}, { compatLevel: 0 }, { compatLevel: 1 }, { compatLevel: 2 }];
  const safeCells: Options[] = [
    { compatLevel: 0, safeMode: true },
    { compatLevel: 1, safeMode: true },
    { compatLevel: 2, safeMode: true },
  ];

  test('definition alone: strict errors in scope, safe drops it', () => {
    const src = '@a: @undef;\n';
    for (const opts of strictCells) {
      const res = new LessCompiler(opts).compile(src);
      expect(res.css).toBe('');
      expect(res.errors.length).toBe(1);
      expect(res.errors[0].errors[0].message).toBe(TRAIL_ERR);
      expect(res.errors[0].node.type).toBe(NodeType.DEFINITION);
      expect((res.errors[0].node as Definition).name).toBe('@a');
    }
    for (const opts of safeCells) {
      const res = new LessCompiler(opts).compile(src);
      expect(res.css).toBe(TRAIL_DROP);
      expect(res.errors.length).toBe(0);
    }
  });

  test('definition followed by a rule: strict reports the definition, safe keeps the rule', () => {
    const src = '@a: @undef;\n.a { x: 1px; }\n';
    for (const opts of strictCells) {
      const res = new LessCompiler(opts).compile(src);
      expect(res.css).toBe('.a {\n  x: 1px;\n}\n');
      expect(res.errors.length).toBe(1);
      expect(res.errors[0].errors[0].message).toBe(TRAIL_ERR);
      expect(res.errors[0].node.type).toBe(NodeType.DEFINITION);
      expect((res.errors[0].node as Definition).name).toBe('@a');
    }
    for (const opts of safeCells) {
      const res = new LessCompiler(opts).compile(src);
      expect(res.css).toBe(TRAIL_DROP + '.a {\n  x: 1px;\n}\n');
      expect(res.errors.length).toBe(0);
    }
  });
});
