import * as fs from 'fs';

import { LessCompiler } from '..';

const main = (): void => {
  // Path to the Less stylesheet to parse
  const path = process.argv[2];

  // Read the source into a UTF-8 string
  const source = fs.readFileSync(path, { encoding: 'utf-8' });

  // Construct a compiler instance
  const compiler = new LessCompiler({
    // Compress (minify)
    compress: false,
    // Indentation (used if minify = false)
    indentSize: 2
  });

  try {
    // Parse the source code.
    // Warning: if your stylesheet contains '@import "foo.less"' statements,
    // this will currently fail, since the parser is complete except for the
    // importer.
    const tree = compiler.parse(source);

    // You can now examine the syntax tree or throw it away if you just wanted validation.
    console.log(tree);

  } catch (e) {
    // Parse failed.
    // Warning: if you log this it will (probably) print the entire stylesheet, since
    // the parser error message formatter is currently incomplete.
    // The next release will have a more useful error message.
    console.log(e);
  }
};

main();
