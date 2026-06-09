import * as fs from 'fs';
import { join } from 'path';

import { LessCompiler } from '../src';

// Byte-compares the TS compiler against the pinned Java main reference
// outputs (__tests__/data/corpus). Java main is the source of
// truth; TS must byte-match the `java-main/` pins at default options.
//
// Reference pins come from JavaReferenceProbe; see data/corpus/README.md
// for the regeneration workflow. The suite skips until the pins exist,
// and is RED until the alignment work (colors, fn-call rendering, color
// math, error wording) lands; per-fixture diffs show what remains.

const ROOT = join(__dirname, 'data', 'corpus');
const LESS_DIR = join(ROOT, 'less');
const JAVA_DIR = join(ROOT, 'java-main');
const EXPECTED_DIFF = join(ROOT, 'levels', 'expected-diff.json');

interface Case {
  name: string;
  expected: string; // pinned reference bytes (css or err)
  expectedDiff: boolean;
}

// Cells registered in levels/expected-diff.json with level "bare" are
// expected to diverge on the default surface today for a documented
// reason (a gate not implemented yet). They assert inequality: when the
// behavior lands the assertion flips red and the entry must be removed.
const bareDiffKeys = new Set<string>();
const loadBareDiffs = (): void => {
  if (!fs.existsSync(EXPECTED_DIFF)) {
    return;
  }
  const entries = JSON.parse(fs.readFileSync(EXPECTED_DIFF).toString('utf8')) as Array<{
    fixture: string;
    level: string;
    reason: string;
  }>;
  for (const e of entries) {
    if (e.level === 'bare') {
      bareDiffKeys.add(e.fixture);
    }
  }
};
loadBareDiffs();

const loadCases = (): Case[] =>
  fs
    .readdirSync(LESS_DIR)
    .filter((n) => n.endsWith('.less'))
    .sort()
    .map((n) => {
      const name = n.slice(0, -'.less'.length);
      const css = join(JAVA_DIR, name + '.css');
      if (fs.existsSync(css)) {
        return { name, expected: fs.readFileSync(css).toString('utf8'), expectedDiff: bareDiffKeys.has(name) };
      }
      const err = join(JAVA_DIR, name + '.err');
      return { name, expected: fs.readFileSync(err).toString('utf8'), expectedDiff: bareDiffKeys.has(name) };
    });

// Compile with the TS compiler at default options and reduce the outcome
// to a single comparable string: css bytes for success, the first raw
// error message for failure. The v1.1.5 base throws on parse errors;
// runtime failures come back as events. Java's LessException message is
// a single line, so one message is the comparison unit.
const compileTs = (c: LessCompiler, name: string): string => {
  const less = fs.readFileSync(join(LESS_DIR, name + '.less'), 'utf8');
  let res;
  try {
    res = c.compile(less);
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
  if (res.errors.length === 0) {
    return res.css;
  }
  const first = res.errors[0].errors[0].message;
  return first === undefined ? '' : first;
};

const pinned = fs.existsSync(JAVA_DIR);
const cases = pinned ? loadCases() : [];
const compiler = new LessCompiler({});

if (!pinned) {
  console.warn('corpus parity: java-main pins not present, skipping');
}

const suite = pinned ? describe : describe.skip;

suite('corpus parity (TS vs Java main)', () => {
  test.each(cases.map((tc): [string, Case] => [tc.name, tc]))('%s', (_n, tc) => {
    const got = compileTs(compiler, tc.name);
    if (tc.expectedDiff) {
      // Flip detector: red once the behavior lands and the output matches.
      expect(got).not.toBe(tc.expected);
    } else {
      expect(got).toBe(tc.expected);
    }
  });
});

// Channel math at the compat levels (COLOR_CHANNEL_PRECISION gate):
// the color op fixtures byte-match the Java ladder pins at the
// legacy and the fixed level.
const LADDER_ROOT = join(ROOT, 'levels', 'java-ladder');
const CHANNEL = ['230-color-math-div', '231-color-math-mul', '232-color-math-mul2', '235-color-math-digest'];
const ladderPinned = CHANNEL.every((n) => [0, 2].every((level) => fs.existsSync(join(LADDER_ROOT, String(level), n + '.css'))));

const ladderSuite = ladderPinned ? describe : describe.skip;

ladderSuite('corpus parity vs the Java ladder (channel math)', () => {
  for (const level of [0, 2]) {
    test.each(CHANNEL.map((n): [string, string] => [n, n]))(`level ${level}: %s`, (name) => {
      const less = fs.readFileSync(join(LESS_DIR, name + '.less'), 'utf8');
      const expected = fs.readFileSync(join(LADDER_ROOT, String(level), name + '.css')).toString('utf8');
      expect(new LessCompiler({ compatLevel: level }).compile(less).css).toBe(expected);
    });
  }
});
