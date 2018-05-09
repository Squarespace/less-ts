import * as fs from 'fs';
import { join, normalize } from 'path';
import { exec, execSync} from 'child_process';

const ROOT = normalize(join(__dirname, '..'));
const LESS_EXT = '.less';
const DATA = join(ROOT, '__tests__/data');
const LESS = join(DATA, 'less');
const CSS = join(DATA, 'css');
const LESS_CMD = join(ROOT, 'server/less-compiler/lessc');
const PREP_CMD = join(ROOT, 'scripts/checkout-lessc');

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

const run = () => {
  prep();

  const slots = new Semaphore(12);
  const names = fs.readdirSync(LESS).filter(n => n.endsWith(LESS_EXT));
  names.forEach(n => {
    const base = join(CSS, n.slice(0, -LESS_EXT.length));
    const src = join(LESS, n);

    // console.log(`\nprocessing ${src}`);

    // TODO: since there are subtle differences in the way Java and JavaScript
    // deal with certain types, like floating point numbers above the max
    // range, we hand-correct the css test cases.

    // console.log(' compiling css..');
    // out = execSync(`${LESS_CMD} ${src}`);
    // dst = base + '.css';
    // console.log(`    saving ${dst}`);
    // fs.writeFileSync(dst, out, { encoding : 'utf-8' });

    slots.acquire(() => {
      exec(`${LESS_CMD} --debug JSONAST ${src}`, (e, out, err) => {
        console.log(' compiled json ast..');
        const dst = base + '.json';
        console.log(`    saving ${dst}`);
        fs.writeFileSync(dst, out, { encoding: 'utf-8' });
        slots.release();
      });
    });

    slots.acquire(() => {
      exec(`${LESS_CMD} --debug JSONREPR ${src}`, (e, out, err) => {
        console.log('  emitted json text repr..');
        const dst = base + '.txt';
        console.log(`    saving ${dst}`);
        fs.writeFileSync(dst, out, { encoding: 'utf-8' });
        slots.release();
      });
    });
  });
};

run();
