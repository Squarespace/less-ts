// Shell-level exit code tests for the CLI: spawn the bin entry and
// check the code plus the stdout/stderr split per error class. The
// CLI compiles in recovery (safe) mode by default: a broken statement
// is dropped with a warning and the run still succeeds; a hard error
// (including a recovery that rescues nothing) fails. Requires the
// package build (bin/lessc.js loads lib/).

import { spawnSync } from 'child_process';
import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const BIN = join(__dirname, '..', 'bin', 'lessc.js');

const run = (...args: string[]): { code: number; out: string; err: string } => {
  const r = spawnSync(process.execPath, [BIN, ...args], { encoding: 'utf8' });
  return { code: r.status ?? -1, out: r.stdout, err: r.stderr };
};

const sheet = (name: string, body: string): string => {
  const dir = mkdtempSync(join(tmpdir(), 'lessc-'));
  const path = join(dir, name);
  writeFileSync(path, body);
  return path;
};

const GOOD = '.a {\n  color: red;\n}\n';
const BROKEN = '!!! broken\n.b { color: blue; }\n';
const JUNK = '!!!\n@@@\n';

test('a clean sheet exits 0 and prints the css', () => {
  const file = sheet('good.less', GOOD);
  const r = run(file);
  expect(r.code).toBe(0);
  expect(r.out).toBe('.a {\n  color: red;\n}\n');
  expect(r.err).toBe('');
});

test('a broken statement recovers: exit 0 with a warning', () => {
  const file = sheet('broken.less', BROKEN);
  const r = run(file);
  expect(r.code).toBe(0);
  expect(r.out).toContain('raised during recovery');
  expect(r.out).toContain('.b {\n  color: blue;\n}\n');
});

test('a recovery that rescues nothing is a hard error: exit 1', () => {
  const file = sheet('junk.less', JUNK);
  const r = run(file);
  expect(r.code).toBe(1);
  expect(r.out).toBe('');
  expect(r.err).toContain('stylesheet produced no output');
});

test('parse-only mode exits 0 on success', () => {
  const file = sheet('good.less', GOOD);
  const r = run('--parse', file);
  expect(r.code).toBe(0);
  expect(r.err).toContain(`Parse of '${file}' successful`);
});

test('parse-only mode exits 1 on a parse failure', () => {
  const file = sheet('bad.less', '.a { .b { c: 2');
  const r = run('--parse', file);
  expect(r.code).toBe(1);
});

test('a missing file exits 1', () => {
  const r = run('/no/such/file.less');
  expect(r.code).toBe(1);
  expect(r.err).toContain('cannot be read');
});

test('an unknown option exits 1 with usage on stderr', () => {
  const r = run('--nope', sheet('good.less', GOOD));
  expect(r.code).toBe(1);
  expect(r.out).toBe('');
  expect(r.err).toContain('Unknown argument');
  expect(r.err).toContain('[options] <source>');
});

test('a missing source exits 1', () => {
  const r = run();
  expect(r.code).toBe(1);
  expect(r.err).toContain('non-option arguments');
});

test('-h exits 0 with usage on stdout', () => {
  const r = run('-h');
  expect(r.code).toBe(0);
  expect(r.out).toContain('[options] <source>');
  expect(r.out).toContain('--parse');
  expect(r.err).toBe('');
});

test('-v exits 0 with the version on stdout', () => {
  const r = run('-v');
  expect(r.code).toBe(0);
  expect(r.out).toContain('slessc:');
  expect(r.err).toBe('');
});

test('-- ends flag scanning: a file named -h is a path, not help', () => {
  const r = run('--', '-h');
  expect(r.code).toBe(1);
  expect(r.out).toBe('');
  expect(r.err).toContain('cannot be read');
});

test('-x compresses the output', () => {
  const file = sheet('good.less', GOOD);
  const r = run('-x', file);
  expect(r.code).toBe(0);
  expect(r.out).toBe('.a{color:red}');
});
