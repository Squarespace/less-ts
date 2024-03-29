import * as fs from 'fs';
import { join, normalize } from 'path';
import { exec, execSync } from 'child_process';
import { Callback, Semaphore } from './util';
import { POINT_CONVERSION_COMPRESSED } from 'constants';

const ROOT = normalize(join(__dirname, '..'));
const LESS_EXT = '.less';
const SUITE = join(ROOT, '__tests__/data/suite');
const LESS = join(SUITE, 'less');
const CSS = join(SUITE, 'css');
const LESS_CMD = join(ROOT, 'lessc');
const PREP_CMD = join(ROOT, 'scripts/checkout-lessc');

const ERRORS = join(ROOT, '__tests__/data/errors');

const mtime = (f: string) => fs.statSync(f).mtimeMs;
const newerThan = (a: string, b: string) => mtime(a) > mtime(b);

const prep = () => {
  if (!fs.existsSync(CSS)) {
    fs.mkdirSync(CSS);
  }
  if (!fs.existsSync(LESS_CMD)) {
    console.error(`Fail: You must symlink the 'lessc' command to the root.`);
    process.exit(1);
  }
};

const rebuild = (src: string, dst: string): boolean => !fs.existsSync(dst) || newerThan(src, dst) || newerThan(__filename, dst);

const compileAst = (slots: Semaphore, src: string, dst: string): void => {
  if (rebuild(src, dst)) {
    slots.acquire(() => {
      exec(`${LESS_CMD} --debug JSONAST ${src}`, (e, out, err) => {
        if (e) {
          console.log(String(e));
          console.log(err);
          return;
        }
        console.log(' compiled json ast..');
        console.log(`    saving ${dst}`);
        fs.writeFileSync(dst, out, { encoding: 'utf-8' });
        slots.release();
      });
    });
  }
};

const compileRepr = (slots: Semaphore, src: string, dst: string): void => {
  if (rebuild(src, dst)) {
    slots.acquire(() => {
      exec(`${LESS_CMD} --debug JSONREPR ${src}`, (e, out, err) => {
        if (e) {
          console.log(String(e));
          console.log(err);
          return;
        }
        console.log('  emitted json text repr..');
        console.log(`    saving ${dst}`);
        fs.writeFileSync(dst, out, { encoding: 'utf-8' });
        slots.release();
      });
    });
  }
};

const run = () => {
  prep();

  const slots = new Semaphore(12);
  let names = fs.readdirSync(LESS).filter((n) => n.endsWith(LESS_EXT));
  names.forEach((n) => {
    const base = join(CSS, n.slice(0, -LESS_EXT.length));
    const src = join(LESS, n);

    // TODO: since there are subtle differences in the way Java and JavaScript
    // deal with certain types, like floating point numbers above the max
    // range, we hand-correct the css test cases.

    compileAst(slots, src, base + '.json');
    compileRepr(slots, src, base + '.txt');
  });

  names = fs.readdirSync(ERRORS).filter((n) => n.endsWith(LESS_EXT));
  names.forEach((n) => {
    const base = join(ERRORS, n.slice(0, -LESS_EXT.length));
    const src = join(ERRORS, n);
    compileAst(slots, src, base + '.json');
    compileRepr(slots, src, base + '.txt');
  });
};

run();
