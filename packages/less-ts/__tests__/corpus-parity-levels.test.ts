import * as fs from 'fs';
import { join } from 'path';

import { LessCompiler } from '../src';

// Byte-compares the TS compiler against the pinned Java ladder reference
// outputs (data/corpus/levels/java-ladder/<level>/) at every compat level.
// Java main is the source of truth; a cell is green when TS byte-matches
// the pin at that level.
//
// Cells registered in levels/expected-diff.json are expected to diverge
// today for a documented reason (a gate not implemented yet). They assert
// inequality: when the behavior lands the assertion flips red and the
// entry must be removed. Any other cell asserts strict equality, so an
// unregistered divergence is also red.

const ROOT = join(__dirname, 'data', 'corpus');
const LESS_DIR = join(ROOT, 'less');
const LADDER_DIR = join(ROOT, 'levels', 'java-ladder');
const EXPECTED_DIFF = join(ROOT, 'levels', 'expected-diff.json');

interface Case {
  name: string;
  level: number;
  expected: string; // pinned reference bytes (css or err)
  expectedDiff: boolean;
}

// Registered divergent cells, keyed fixture|level. Entries with level
// "bare" belong to the default-surface suite, not this one.
const diffKeys = new Set<string>();

// Every pin on disk is a case: a fixture is css-pinned or err-pinned at a
// level (it may flip between levels, e.g. css at level 0, err at level 2).
const loadCases = (): Case[] => {
  const cases: Case[] = [];
  for (const level of [0, 1, 2]) {
    const dir = join(LADDER_DIR, String(level));
    if (!fs.existsSync(dir)) {
      continue;
    }
    for (const n of fs.readdirSync(dir).sort()) {
      if (!n.endsWith('.css') && !n.endsWith('.err')) {
        continue;
      }
      const name = n.replace(/\.(css|err)$/, '');
      cases.push({
        name,
        level,
        expected: fs.readFileSync(join(dir, n)).toString('utf8'),
        expectedDiff: diffKeys.has(name + '|' + String(level)),
      });
    }
  }
  return cases;
};

const loadExpectedDiff = (): void => {
  if (!fs.existsSync(EXPECTED_DIFF)) {
    return;
  }
  const entries = JSON.parse(fs.readFileSync(EXPECTED_DIFF).toString('utf8')) as Array<{
    fixture: string;
    level: string;
    reason: string;
  }>;
  for (const e of entries) {
    if (e.level !== 'bare') {
      diffKeys.add(e.fixture + '|' + e.level);
    }
  }
};

// Compile with the TS compiler at the given compat level and reduce the
// outcome to a single comparable string: css bytes for success, the first
// raw error message for failure (the same reduction as
// corpus-parity.test.ts; Java's error pin is the verbatim message).
const compileTs = (level: number, less: string): string => {
  let res;
  try {
    res = new LessCompiler({ compatLevel: level }).compile(less);
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
  if (res.errors.length === 0) {
    return res.css;
  }
  const first = res.errors[0].errors[0].message;
  return first === undefined ? '' : first;
};

loadExpectedDiff();
const pinned = [0, 1, 2].every((l) => fs.existsSync(join(LADDER_DIR, String(l))));
const cases = pinned ? loadCases() : [];

if (!pinned) {
  console.warn('corpus parity levels: java-ladder pins not present, skipping');
}

const suite = pinned ? describe : describe.skip;

suite('corpus parity vs the Java ladder (all cells)', () => {
  test.each(cases.map((tc): [string, Case] => [`${tc.name} @ ${tc.level}`, tc]))('%s', (_n, tc) => {
    const less = fs.readFileSync(join(LESS_DIR, tc.name + '.less'), 'utf8');
    const got = compileTs(tc.level, less);
    if (tc.expectedDiff) {
      // Flip detector: red once the behavior lands and the output matches.
      expect(got).not.toBe(tc.expected);
    } else {
      expect(got).toBe(tc.expected);
    }
  });
});
