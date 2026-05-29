// TsProbe - compiles every .less file in a dir with the TS compiler at
// default options and prints the result per fixture, mirroring
// JavaReferenceProbe's output shape:
//
//   OK  -> <out>/<name>.css
//   ERR -> <out>/<name>.err   (first formatted error message, no trailing
//                              newline)
//
// Usage: node __tests__/data/corpus/tools/ts-probe.js <less-dir> <out-dir>
// (from the package root)
//
// Requires the package build (`npm run build`); rerun after src changes.

const fs = require('fs');
const path = require('path');
const { LessCompiler } = require('../../../../lib/index');

const srcDir = process.argv[2];
const outDir = process.argv[3];
fs.mkdirSync(outDir, { recursive: true });

const files = fs.readdirSync(srcDir).filter((n) => n.endsWith('.less'));
let ok = 0;
let err = 0;
for (const name of files) {
  const label = name.slice(0, -'.less'.length);
  const raw = fs.readFileSync(path.join(srcDir, name), 'utf8');
  const c = new LessCompiler({});
  let res;
  try {
    res = c.compile(raw);
  } catch (e) {
    // v1.1.5 base: compile() throws on parse errors; normalize to the
    // error contract the harness uses (message only).
    fs.writeFileSync(path.join(outDir, label + '.err'), e.message);
    console.log(label + '\tERR\t' + e.message.replace(/\n/g, '\\n'));
    err++;
    continue;
  }
  if (res.errors.length === 0) {
    fs.writeFileSync(path.join(outDir, label + '.css'), res.css);
    console.log(label + '\tOK\t' + res.css.replace(/\n/g, '\\n'));
    ok++;
  } else {
    // Compare the first raw error message, matching Java's single-line
    // LessException message.
    const msg = res.errors[0].errors[0].message || '';
    fs.writeFileSync(path.join(outDir, label + '.err'), msg);
    console.log(label + '\tERR\t' + msg.replace(/\n/g, '\\n'));
    err++;
  }
}
console.log('TOTAL OK=' + ok + ' ERR=' + err);
