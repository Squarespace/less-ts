import { LessCompiler } from '../../src';

// Unclosed blocks at end of input. A block that runs off the end of
// input keeps its partial contents: strict fails with INCOMPLETE_PARSE
// at the completion check, safe records a truncation warning and the
// renderer closes the brace. A '}' at stylesheet scope closes nothing:
// strict fails with the GENERAL unexpected-brace error, safe drops it
// at the sync point. A tolerated block-less @media is dropped without
// counting as output (the empty-sheet check still fires on a sheet of
// only junk plus a block-less @media). A comma list in value-position
// parens does not parse: the parens must hold a single expression.
// The bytes below are the reference output, captured at level 0.

const NO_OUTPUT =
  'SyntaxError GENERAL stylesheet produced no output; all input was skipped during recovery';
const INCOMPLETE = 'SyntaxError INCOMPLETE_PARSE Unable to complete parse.';
const EXTRA_BRACE = "SyntaxError GENERAL unexpected '}' closing brace";

const unclosed = (line: number): string =>
  `/* WARNING[1] raised during recovery: unclosed block(s) at end of input; output truncated at line ${line} */\n`;
const skipped = (line: number, suffix: string = ''): string =>
  `/* WARNING[1] raised during recovery: skipped invalid statement at line ${line}${suffix} */\n`;

const run = (opts: { compatLevel?: number; safeMode?: boolean }, src: string): { css: string; err: string } => {
  const res = new LessCompiler(opts).compile(src);
  return { css: res.css, err: res.errors.length ? res.errors[0].errors[0].message : '' };
};

// [name, source, safe css, safe error, strict css, strict error]
const CASES: Array<[string, string, string, string, string, string]> = [
  [
    'an unclosed ruleset keeps its body',
    '.a { b: 1',
    unclosed(1) + '.a {\n  b: 1;\n}\n',
    '',
    '',
    INCOMPLETE,
  ],
  [
    'a nested unclosed block flattens and keeps its body',
    '.a { .b { c: 2',
    unclosed(1) + '.a .b {\n  c: 2;\n}\n',
    '',
    '',
    INCOMPLETE,
  ],
  [
    'an unclosed media block keeps its body',
    '@media screen {\n.a { b: 1 }',
    unclosed(2) + '@media screen {\n  .a {\n    b: 1;\n  }\n}\n',
    '',
    '',
    INCOMPLETE,
  ],
  [
    'an empty unclosed media block renders only the warning',
    '@media screen {',
    unclosed(1),
    '',
    '',
    INCOMPLETE,
  ],
  [
    'an unclosed block directive keeps its body',
    '@font-face { font-family: x',
    unclosed(1) + '@font-face {\n  font-family: x;\n}\n',
    '',
    '',
    INCOMPLETE,
  ],
  [
    'garbage in an unclosed block: the skip and the truncation both warn',
    '.a { !!! to eof',
    skipped(1, '; rest of input truncated') + unclosed(1).replace('WARNING[1]', 'WARNING[2]'),
    '',
    '',
    INCOMPLETE,
  ],
  [
    'a stray closing brace at stylesheet scope: strict general error',
    '.a { b: 1; } }',
    skipped(1) + '.a {\n  b: 1;\n}\n',
    '',
    '',
    EXTRA_BRACE,
  ],
  [
    'a lone closing brace recovers to nothing',
    '}',
    '',
    NO_OUTPUT,
    '',
    EXTRA_BRACE,
  ],
  [
    'a definition sheet with a trailing brace keeps the definition',
    '@x: 1;\n}',
    skipped(2),
    '',
    '',
    EXTRA_BRACE,
  ],
  [
    'a block-less @media with a trailing brace fails the empty-sheet check in safe mode',
    '@media screen\n}',
    '',
    NO_OUTPUT,
    '',
    EXTRA_BRACE,
  ],
  [
    'an unterminated attribute at EOF: no block to drop into',
    '.a[href',
    '',
    NO_OUTPUT,
    '',
    INCOMPLETE,
  ],
  [
    'an empty pair of parens in a value does not parse',
    '.a { b: (); }',
    skipped(1),
    '',
    '',
    INCOMPLETE,
  ],
  [
    'an empty pair of parens never renders an empty value',
    '.a { b: (); }\n.c { d: 2; }',
    skipped(1) + '.c {\n  d: 2;\n}\n',
    '',
    '',
    INCOMPLETE,
  ],
];

describe('unclosed blocks at end of input', () => {
  test.each(CASES)('%s: safe mode', (_name, src, safeCss, safeErr) => {
    expect(run({ safeMode: true }, src)).toEqual({ css: safeCss, err: safeErr });
  });

  test.each(CASES)('%s: strict mode', (_name, src, _safeCss, _safeErr, strictCss, strictErr) => {
    expect(run({}, src)).toEqual({ css: strictCss, err: strictErr });
  });

  test.each([0, 1, 2])('the stray brace error holds at level %i', (level) => {
    expect(run({ compatLevel: level }, '}\n').err).toBe(EXTRA_BRACE);
  });

  test('the block-less @media rejects at the fixed levels', () => {
    expect(run({ compatLevel: 1 }, '@media screen').err).toBe(INCOMPLETE);
    expect(run({ compatLevel: 2 }, '@media screen').err).toBe(INCOMPLETE);
    // Legacy drops the directive: the following statement renders.
    expect(run({}, '@media screen\n.a { b: 1; }\n')).toEqual({ css: '.a {\n  b: 1;\n}\n', err: '' });
    expect(run({ safeMode: true }, '@media screen\n.a { b: 1; }\n')).toEqual({
      css: '.a {\n  b: 1;\n}\n',
      err: '',
    });
  });

  test('a single value-position paren drops the parens', () => {
    expect(run({}, '.a { b: (1px); }\n')).toEqual({ css: '.a {\n  b: 1px;\n}\n', err: '' });
  });

  test('a comma list in value-position parens fails the parse', () => {
    expect(run({}, '.a { b: (1px, 2px); }\n').err).toBe(INCOMPLETE);
    expect(run({}, '.a { b: extract((1px, 2px, 3px), 1); }\n').err).toBe(INCOMPLETE);
  });

  test('recovery terminates on nested garbage in an unclosed block', () => {
    // The repeated-start guard plus the open-block count must end the
    // parse instead of re-scanning the same region forever.
    const res = run({ safeMode: true }, '.a { !!! { rest');
    expect(res).toEqual({
      css:
        skipped(1, '; rest of input truncated') + unclosed(1).replace('WARNING[1]', 'WARNING[2]'),
      err: '',
    });
  });
});
