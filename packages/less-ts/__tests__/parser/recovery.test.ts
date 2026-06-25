import { LessCompiler } from '../../src';

// Parser recovery in safe mode (best effort). On a hard parse error
// the broken region is dropped at the next synchronization point - a
// depth-0 ';' (consumed), a depth-0 '}' (left for the caller), or the
// start of the following statement's block - a warning records the
// skip, and parsing continues with the next statement. A sheet that
// recovers to nothing is a hard error even in safe mode: comments do
// not count as output, definitions do (a def-only sheet is a
// legitimate variables file). The bytes below are the reference
// output, captured at level 0.

const NO_OUTPUT =
  'SyntaxError GENERAL stylesheet produced no output; all input was skipped during recovery';
const INCOMPLETE = 'SyntaxError INCOMPLETE_PARSE Unable to complete parse.';

const run = (opts: { safeMode?: boolean }, src: string): { css: string; err: string } => {
  let res;
  try {
    res = new LessCompiler(opts).compile(src);
  } catch (e) {
    return { css: '', err: e instanceof Error ? e.message : String(e) };
  }
  return { css: res.css, err: res.errors.length ? res.errors[0].errors[0].message : '' };
};

// [name, source, safe-mode css, safe-mode error, strict css, strict error]
const CASES: Array<[string, string, string, string, string, string]> = [
  [
    'garbage only recovers to nothing: hard error in both modes',
    '!!! broken\n@@@\n',
    '',
    NO_OUTPUT,
    '',
    INCOMPLETE,
  ],
  [
    'comment plus garbage: comments do not count as output',
    '/* note */\n!!! broken\n',
    '',
    NO_OUTPUT,
    '',
    INCOMPLETE,
  ],
  [
    'definition plus garbage: salvaged, empty output plus warning',
    '@def: 1px;\n!!! broken\n',
    '/* WARNING[1] raised during recovery: skipped invalid statement at line 2; rest of input truncated */\n',
    '',
    '',
    INCOMPLETE,
  ],
  [
    'definition only: a legitimate variables file',
    '@def: 1px;\n',
    '',
    '',
    '',
    '',
  ],
  [
    'garbage between rules: the following block re-parses fresh',
    '.a { color: red; }\n!!! broken\n.b { color: blue; }\n',
    '/* WARNING[1] raised during recovery: skipped invalid statement at line 2 */\n.a {\n  color: red;\n}\n.b {\n  color: blue;\n}\n',
    '',
    '',
    INCOMPLETE,
  ],
  [
    'garbage in a nested block: the enclosing brace ends the block',
    '.a {\n  !!! broken\n}\n.b { color: blue; }\n',
    '/* WARNING[1] raised during recovery: skipped invalid statement at line 2 */\n.b {\n  color: blue;\n}\n',
    '',
    '',
    INCOMPLETE,
  ],
  [
    'garbage to end of input: the tail is truncated',
    '.a { color: red; }\n!!! broken to eof',
    '/* WARNING[1] raised during recovery: skipped invalid statement at line 2; rest of input truncated */\n.a {\n  color: red;\n}\n',
    '',
    '',
    INCOMPLETE,
  ],
  [
    'garbage line ending in a semicolon: the semicolon is consumed',
    '.a { color: red; }\n!!! broken;\n.b { color: blue; }\n',
    '/* WARNING[1] raised during recovery: skipped invalid statement at line 2 */\n.a {\n  color: red;\n}\n.b {\n  color: blue;\n}\n',
    '',
    '',
    INCOMPLETE,
  ],
  [
    'garbage line before a full statement: resumed at its block start',
    '.a { color: red; }\n!!!\n.c { color: green; }\n.b { color: blue; }\n',
    '/* WARNING[1] raised during recovery: skipped invalid statement at line 2 */\n.a {\n  color: red;\n}\n.c {\n  color: green;\n}\n.b {\n  color: blue;\n}\n',
    '',
    '',
    INCOMPLETE,
  ],
  [
    // The import parse commits on failure: the skip is recorded at the
    // line where the parse stopped (past the path and its trailing
    // whitespace), not at the statement start.
    'import without a semicolon: recovery starts past the path',
    '@import "foo.css"\n.a { b: 1; }\n',
    '/* WARNING[1] raised during recovery: skipped invalid statement at line 2 */\n.a {\n  b: 1;\n}\n',
    '',
    '',
    INCOMPLETE,
  ],
  [
    'import without a semicolon at end of input: recovers to nothing',
    '@import "foo.css"\n',
    '',
    NO_OUTPUT,
    '',
    INCOMPLETE,
  ],
];

describe('parser recovery in safe mode', () => {
  test.each(CASES)('%s: safe mode', (_name, src, safeCss, safeErr) => {
    expect(run({ safeMode: true }, src)).toEqual({ css: safeCss, err: safeErr });
  });

  test.each(CASES)('%s: strict mode is unchanged', (_name, src, _safeCss, _safeErr, strictCss, strictErr) => {
    expect(run({}, src)).toEqual({ css: strictCss, err: strictErr });
  });

  test('the recovery warning counts against the per-compile budgets', () => {
    // A tight per-type budget suppresses the second skip; the summary
    // trails the output, as with any budget-suppressed warning.
    const src = '.a { color: red; }\n!!! one;\n!!! two;\n.b { color: blue; }\n';
    const res = new LessCompiler({ safeMode: true, maxWarningsPerType: 1 }).compile(src);
    expect(res.errors.length).toBe(0);
    expect(res.css).toContain('skipped invalid statement at line 2');
    expect(res.css).not.toContain('skipped invalid statement at line 3');
    expect(res.css).toContain('suppressed:');
  });

  test('recovery positions advance: no loop on repeated garbage', () => {
    // The repeated-start guard allows resuming at the scan start once;
    // a sheet of pure garbage must terminate with the no-output error,
    // not spin.
    const res = run({ safeMode: true }, '!!!\n!!!\n!!!\n');
    expect(res.err).toBe(NO_OUTPUT);
  });
});
