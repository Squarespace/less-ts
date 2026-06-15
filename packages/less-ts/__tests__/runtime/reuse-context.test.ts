import { LessCompiler } from '../../src';

// Compiler-instance reuse. One LessCompiler may be held across
// compiles: each compile() builds a fresh context, evaluator, and
// environment, so nothing scoped to one parse or eval (the mixin depth
// counter, the definition evaluating flag, per-node warnings, the
// warning ledger and budgets) may survive one compile into the next.
// The compiler owns no shared parse tree and no importer, so there is
// no import memo or closure cache to reset; this suite pins the
// contract so a refactor that introduces shared state goes red.

describe('compiler instance reuse across compiles', () => {
  // Normalizes the two failure surfaces (a thrown error, error events)
  // into one comparable shape.
  const run = (c: LessCompiler, src: string): { css: string; errors: string[] } => {
    try {
      const r = c.compile(src);
      return {
        css: r.css,
        errors: r.errors.map((e) => e.errors.map((x) => x.message).join('; ')),
      };
    } catch (e) {
      return { css: '', errors: [e instanceof Error ? e.message : String(e)] };
    }
  };

  // A sheet with a mixin definition and call: the stable-baseline
  // case, where captured closure state would show up first.
  const MIXIN_SHEET = '.m { color: red; }\n.a {\n  .m();\n}\n';
  const UNTERMINATED = '.a { color: 1px\n';
  const UNDEF = '.a { x: @undef; }\n';
  const RECURSIVE = '.m { .m(); }\n.x { .m(); }\n';
  const PLAIN_MIXIN = '.m2 { color: red; }\n.y { .m2(); }\n';
  const CIRCULAR = '@a: @a;\n.a { x: @a; }\n';

  // 42 distinct warnings of one type: two families of incompatible
  // unit pairs against px, so the messages differ (dedupe keeps all
  // of them) while the type bucket is INCOMPATIBLE_UNITS throughout.
  // At the default budgets 25 render inline and the rest land in the
  // trailing suppressed summary.
  const UNITS = [
    'ch', 'em', 'ex', 'rem', 'vh', 'vw', 'vmin', 'vmax', 'vm', 'fr', 's', 'ms',
    'dpi', 'dpcm', 'dppx', 'hz', 'khz', 'deg', 'grad', 'rad', 'turn',
  ];
  const flood = (): string => {
    let sheet = '';
    for (let i = 0; i < UNITS.length; i++) {
      sheet += `.f${i} { x: 90${UNITS[i]} + 5px; }\n`;
    }
    for (let i = 0; i < UNITS.length; i++) {
      sheet += `.g${i} { x: 90px + 5${UNITS[i]}; }\n`;
    }
    return sheet;
  };

  test('a mixin sheet is byte-stable across repeated compiles', () => {
    const c = new LessCompiler({});
    const first = run(c, MIXIN_SHEET);
    expect(first.errors.length).toBe(0);
    for (let i = 0; i < 2; i++) {
      expect(run(c, MIXIN_SHEET)).toEqual(first);
    }
  });

  test('a failed parse does not taint the next compile', () => {
    const c = new LessCompiler({});
    const bad = run(c, UNTERMINATED);
    expect(bad.errors.length).toBeGreaterThan(0);
    const next = run(c, MIXIN_SHEET);
    expect(next).toEqual(run(new LessCompiler({}), MIXIN_SHEET));
  });

  test('an evaluation error does not taint the next compile', () => {
    const c = new LessCompiler({});
    const bad = run(c, UNDEF);
    expect(bad.errors.length).toBeGreaterThan(0);
    const next = run(c, MIXIN_SHEET);
    expect(next).toEqual(run(new LessCompiler({}), MIXIN_SHEET));
  });

  test('the warning ledger and budgets are per-compile', () => {
    const c = new LessCompiler({});
    const first = run(c, flood());
    expect(first.css).toContain('WARNING[');
    expect(first.css).toContain('suppressed:');
    // A second flood on the same instance must not accumulate the
    // first one's warnings or summary.
    expect(run(c, flood())).toEqual(first);
    const clean = run(c, MIXIN_SHEET);
    expect(clean.errors.length).toBe(0);
    expect(clean.css).not.toContain('WARNING[');
    expect(clean.css).not.toContain('suppressed:');
    expect(clean).toEqual(run(new LessCompiler({}), MIXIN_SHEET));
  });

  test('the suppression summary does not carry over', () => {
    // A tight overall budget: the flood summarizes most of its
    // warnings in the trailing comment.
    const c = new LessCompiler({ maxWarnings: 3 });
    const first = run(c, flood());
    expect(first.css).toContain('suppressed:');
    expect(run(c, flood())).toEqual(first);
    const clean = run(c, MIXIN_SHEET);
    expect(clean.errors.length).toBe(0);
    expect(clean.css).not.toContain('suppressed:');
    expect(clean).toEqual(run(new LessCompiler({ maxWarnings: 3 }), MIXIN_SHEET));
  });

  test('the mixin depth counter resets between compiles', () => {
    // A hits the limit and errors; B stays under it. If A's depth
    // leaked, B would hit the limit on its first call and fail.
    const c = new LessCompiler({ mixinRecursionLimit: 3 });
    const deep = run(c, RECURSIVE);
    expect(deep.errors.length).toBeGreaterThan(0);
    expect(deep.css).toBe('');
    const shallow = run(c, PLAIN_MIXIN);
    expect(shallow).toEqual(run(new LessCompiler({ mixinRecursionLimit: 3 }), PLAIN_MIXIN));
  });

  test('the circular-reference guard is stable across compiles', () => {
    const c = new LessCompiler({});
    const first = run(c, CIRCULAR);
    expect(first.errors.join(' ')).toContain('references itself');
    expect(run(c, CIRCULAR)).toEqual(first);
    // And the next ordinary compile is unaffected.
    expect(run(c, MIXIN_SHEET)).toEqual(run(new LessCompiler({}), MIXIN_SHEET));
  });

  test('the options are never mutated by a compile', () => {
    const c = new LessCompiler({ maxWarnings: 3, mixinRecursionLimit: 3 });
    const snapshot = JSON.stringify(c.opts);
    run(c, UNTERMINATED);
    run(c, UNDEF);
    run(c, flood());
    expect(JSON.stringify(c.opts)).toBe(snapshot);
  });
});
