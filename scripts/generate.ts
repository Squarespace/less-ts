import * as fs from 'fs';
import { join, normalize } from 'path';
import { exec, execSync} from 'child_process';

const ROOT = normalize(join(__dirname, '..'));
const LESS_EXT = '.less';
const SUITE = join(ROOT, '__tests__/data/suite');
const LESS = join(SUITE, 'less');
const CSS = join(SUITE, 'css');
const LESS_CMD = join(ROOT, 'server/less-compiler/lessc');
const PREP_CMD = join(ROOT, 'scripts/checkout-lessc');

const ERRORS = join(ROOT, '__tests__/data/errors');

const mtime = (f: string) => fs.statSync(f).mtimeMs;
const newerThan = (a: string, b: string) => mtime(a) > mtime(b);

const prep = () => {
  if (!fs.existsSync(CSS)) {
    fs.mkdirSync(CSS);
  }
  if (!fs.existsSync(LESS_CMD)) {
    execSync(PREP_CMD);
  }
};

type Callback = () => void;

class Semaphore {

  active: number = 0;
  waiting: Callback[] = [];

  constructor(readonly max: number) {}

  acquire(cb: Callback): void {
    if (this.active >= this.max) {
      this.waiting.push(cb);
    } else {
      this.lock(cb);
    }
  }

  release(): void {
    if (this.active === 0) {
      return;
    }
    this.active--;
    this.lock(this.waiting.pop());
  }

  private lock(cb: Callback | undefined): void {
    if (cb) {
      cb();
      this.active++;
    }
  }
}

const rebuild = (src: string, dst: string): boolean =>
  !fs.existsSync(dst) || newerThan(src, dst) || newerThan(__filename, dst);

const compileAst = (slots: Semaphore, src: string, dst: string): void => {
  if (rebuild(src, dst)) {
    slots.acquire(() => {
      exec(`${LESS_CMD} --debug JSONAST ${src}`, (e, out, err) => {
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
  let names = fs.readdirSync(LESS).filter(n => n.endsWith(LESS_EXT));
  names.forEach(n => {
    const base = join(CSS, n.slice(0, -LESS_EXT.length));
    const src = join(LESS, n);

    // TODO: since there are subtle differences in the way Java and JavaScript
    // deal with certain types, like floating point numbers above the max
    // range, we hand-correct the css test cases.

    compileAst(slots, src, base + '.json');
    compileRepr(slots, src, base + '.txt');
  });

  names = fs.readdirSync(ERRORS).filter(n => n.endsWith(LESS_EXT));
  names.forEach(n => {
    const base = join(ERRORS, n.slice(0, -LESS_EXT.length));
    const src = join(ERRORS, n);
    compileAst(slots, src, base + '.json');
    compileRepr(slots, src, base + '.txt');
  });
};

run();
