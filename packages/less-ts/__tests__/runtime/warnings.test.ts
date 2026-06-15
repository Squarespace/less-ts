import { renderNode, RuntimeContext } from '../../src/runtime';

const newCtx = () => new RuntimeContext({}, renderNode);

describe('warning ledger', () => {
  test('exact-message repeats are recorded once', () => {
    const ctx = newCtx();
    const env = ctx.newEnv();
    env.addWarning('first');
    env.addWarning('first');
    env.addWarning('second');
    expect(env.takeWarnings()).toEqual(['first', 'second']);
  });

  test('a drained message can be recorded again', () => {
    // Draining clears the dedupe keys: a warning raised after a
    // drain is not a repeat.
    const ctx = newCtx();
    const env = ctx.newEnv();
    env.addWarning('first');
    expect(env.takeWarnings()).toEqual(['first']);
    env.addWarning('first');
    expect(env.takeWarnings()).toEqual(['first']);
  });

  test('draining returns a copy and clears the ledger', () => {
    const ctx = newCtx();
    const env = ctx.newEnv();
    env.addWarning('first');
    const drained = env.takeWarnings();
    drained.push('mutated');
    expect(env.takeWarnings()).toEqual([]);
  });

  test('a failed compile leaves the ledger for the next compile on a reused context', () => {
    // Compile A records warnings, then fails before the evaluator
    // attaches them (no drain runs). Without the start-of-compile
    // reset, compile B on this context inherits the stale entry,
    // and its dedupe key swallows B's identical fresh warning.
    const ctx = newCtx();
    const a = ctx.newEnv();
    a.addWarning('stale');
    const b = ctx.newEnv();
    b.addWarning('stale');
    b.addWarning('fresh');
    expect(b.takeWarnings()).toEqual(['stale', 'fresh']);
  });

  test('resetWarnings starts a reused context clean', () => {
    const ctx = newCtx();
    const a = ctx.newEnv();
    a.addWarning('stale');
    // Compile start: the reset clears entries and dedupe keys, so
    // an identical fresh warning in compile B is not a repeat.
    ctx.resetWarnings();
    const b = ctx.newEnv();
    b.addWarning('stale');
    expect(b.takeWarnings()).toEqual(['stale']);
  });
});
