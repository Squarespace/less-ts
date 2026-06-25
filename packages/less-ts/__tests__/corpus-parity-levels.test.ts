import * as fs from 'fs';
import { join } from 'path';

import { LessCompiler } from '../src';

// The standing cross-runtime parity gate over the full matrix: every
// corpus fixture x level {0, 1, 2} x mode {strict, safe}, byte-
// comparing the TS compiler against the pinned Java reference
// outputs. Java main is the source of truth; a cell is green when TS
// byte-matches the pin for that level and mode.
//
// The strict family (data/corpus/levels/java-ladder/<level>/) is the
// reference at the default (strict) recovery mode; the safe family
// (data/corpus/levels/java-ladder-safe/<level>/) is the same context
// with safe mode on. TS is always wired, so its level-N output maps
// onto the wired reference at level N for every cell.
//
// Cells registered in levels/expected-diff.json are expected to
// diverge today for a documented reason. They assert inequality: when
// the behavior lands the assertion flips red and the entry must be
// removed. Any other cell asserts strict equality, so an unregistered
// divergence is red.

const ROOT = join(__dirname, 'data', 'corpus');
const LESS_DIR = join(ROOT, 'less');
const LADDER_ROOT = join(ROOT, 'levels', 'java-ladder');
const SAFE_ROOT = join(ROOT, 'levels', 'java-ladder-safe');
const EXPECTED_DIFF = join(ROOT, 'levels', 'expected-diff.json');

interface Case {
  name: string;
  level: number;
  safe: boolean;
  expected: string; // pinned reference bytes (css or err)
  expectedDiff: boolean;
}

// Registered divergent cells, keyed fixture|level|safe. Entries with
// level "bare" belong to the default-surface suite, not this one.
const diffKeys = new Set<string>();

// Every pin on disk is a case: a fixture is css-pinned or err-pinned
// at a level and mode (it may flip between cells, e.g. css at the
// fixed strict level, err at the legacy one).
const loadCases = (): Case[] => {
  const cases: Case[] = [];
  for (const safe of [false, true]) {
    const familyRoot = safe ? SAFE_ROOT : LADDER_ROOT;
    for (const level of [0, 1, 2]) {
      const dir = join(familyRoot, String(level));
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
          safe,
          expected: fs.readFileSync(join(dir, n)).toString('utf8'),
          expectedDiff: diffKeys.has(name + '|' + String(level) + '|' + (safe ? 'safe' : 'strict')),
        });
      }
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
      diffKeys.add(e.fixture + '|' + e.level + '|strict');
    }
  }
};

// Compile with the TS compiler at the given level and recovery mode
// and reduce the outcome to a single comparable string: css bytes for
// success, the first raw error message for failure (the same
// reduction as corpus-parity.test.ts; Java's error pin is the verbatim
// message).
const compileTs = (level: number, safe: boolean, less: string): string => {
  const opts: { compatLevel: number; safeMode?: boolean } = { compatLevel: level };
  if (safe) {
    opts.safeMode = true;
  }
  let res;
  try {
    res = new LessCompiler(opts).compile(less);
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
const pinned =
  [0, 1, 2].every((l) => fs.existsSync(join(LADDER_ROOT, String(l)))) &&
  [0, 1, 2].every((l) => fs.existsSync(join(SAFE_ROOT, String(l))));
const cases = pinned ? loadCases() : [];

if (!pinned) {
  console.warn('corpus parity levels: java-ladder or java-ladder-safe pins not present, skipping');
}

const suite = pinned ? describe : describe.skip;

suite('corpus parity vs the Java ladder (all cells, full matrix)', () => {
  test.each(cases.map((tc): [string, Case] => [`${tc.name} @ L${tc.level} ${tc.safe ? 'safe' : 'strict'}`, tc]))(
    '%s',
    (_n, tc) => {
      const less = fs.readFileSync(join(LESS_DIR, tc.name + '.less'), 'utf8');
      const got = compileTs(tc.level, tc.safe, less);
      if (tc.expectedDiff) {
        // Flip detector: red once the behavior lands and the output
        // matches.
        expect(got).not.toBe(tc.expected);
      } else {
        expect(got).toBe(tc.expected);
      }
    },
  );
});
