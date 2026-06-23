#!/usr/bin/env node

// main() returns the exit code instead of exiting itself, so tests can
// capture its streams. process.exitCode (not process.exit) lets stdout
// flush to pipes before the process ends.
const { main } = require('../lib/lessc');

main(process.argv.slice(2)).then((code) => {
  process.exitCode = code;
});
