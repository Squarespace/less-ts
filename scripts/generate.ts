import * as fs from 'fs';
import { join, normalize } from 'path';
import { execSync } from 'child_process';

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

const run = () => {
  prep();

  const names = fs.readdirSync(LESS).filter(n => n.endsWith(LESS_EXT));
  names.forEach(n => {
    const base = join(CSS, n.slice(0, -LESS_EXT.length));
    const src = join(LESS, n);
    let dst: string;
    let out: Buffer;

    console.log(`\nprocessing ${src}`);

    // TODO: since there are subtle differences in the way Java and JavaScript
    // deal with certain types, like floating point numbers above the max
    // range, we hand-correct the css test cases.

    // console.log(' compiling css..');
    // out = execSync(`${LESS_CMD} ${src}`);
    // dst = base + '.css';
    // console.log(`    saving ${dst}`);
    // fs.writeFileSync(dst, out, { encoding : 'utf-8' });

    console.log('compiling json ast..');
    out = execSync(`${LESS_CMD} --debug JSONAST ${src}`);
    dst = base + '.json';
    console.log(`    saving ${dst}`);
    fs.writeFileSync(dst, out, { encoding: 'utf-8' });

    console.log(' emitting json text repr..');
    out = execSync(`${LESS_CMD} --debug JSONREPR ${src}`);
    dst = base + '.txt';
    console.log(`    saving ${dst}`);
    fs.writeFileSync(dst, out, { encoding: 'utf-8' });
  });
};

run();
