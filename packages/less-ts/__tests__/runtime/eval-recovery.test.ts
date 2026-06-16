import { LessCompiler } from '../../src';

// Evaluation and render recovery in safe mode (best effort). A block
// member whose evaluation fails (a rule, a definition, a mixin call)
// is dropped - its pending warnings rolled back, a warning recorded -
// and the next sibling evaluates. A node that fails to render is
// skipped with a warning, and the render env and model stacks stay
// balanced so later siblings attach under the correct frame. A
// selector combine that overflows the complexity limit truncates at
// the fixed level instead of skipping the ruleset. The bytes below
// are the reference output, captured at level 0 for the eval cells
// and level 2 for the render cells.

const VAR_UNDEFINED =
  'ExecuteError VAR_UNDEFINED: Failed to locate a definition for the variable @undef in current scope';
const mixinUndefined = (sel: string): string =>
  `ExecuteError MIXIN_UNDEFINED: Failed to locate a mixin using selector ${sel}`;
const recovery = (n: number, warning: string): string =>
  `/* WARNING[${n}] raised during recovery: ${warning} */\n`;

// A 65-sibling grid nested 63 deep: the depth-62 combine exceeds the
// complexity limit at the fixed level (4160 combined elements).
const grid = (): string => {
  const sels = Array.from({ length: 65 }, (_v, i) => '.a' + i).join(', ');
  let nested = '';
  for (let i = 0; i < 63; i++) {
    nested += '.b' + i + ' {\n';
  }
  nested += 'color: red;\n';
  for (let i = 0; i < 63; i++) {
    nested += '}\n';
  }
  return sels + ' {\n' + nested + '}\n.z { color: blue; }\n';
};

// The grid rendered at the fixed level with safe mode: the depth-62
// combine overflows, so the combined set is truncated at the limit -
// all 65 selectors of the innermost frame stay, each 64 elements
// ending in .b62, the rule body is kept - and one warning trails the
// output.
const truncatedGrid = (): string => {
  const b = Array.from({ length: 63 }, (_v, i) => '.b' + i).join(' ');
  const lines: string[] = [];
  for (let i = 0; i < 64; i++) {
    lines.push('.a' + i + ' ' + b + ',');
  }
  lines.push('.a64 ' + b + ' {');
  lines.push('  color: red;');
  lines.push('}');
  lines.push('.z {');
  lines.push('  color: blue;');
  lines.push('}');
  lines.push(recovery(1, 'render: truncated selector combination exceeding complexity limit').trimEnd());
  return lines.join('\n') + '\n';
};

describe('evaluation recovery in safe mode', () => {
  test('a rule that fails to evaluate is dropped', () => {
    const res = new LessCompiler({ safeMode: true }).compile('.a { x: @undef; }\n');
    expect(res.errors.length).toBe(0);
    expect(res.css).toEqual(recovery(1, 'eval: dropped rule: ' + VAR_UNDEFINED));
  });

  test('a definition that fails to evaluate is dropped', () => {
    const res = new LessCompiler({ safeMode: true }).compile('@a: @undef;\n');
    expect(res.errors.length).toBe(0);
    expect(res.css).toEqual(recovery(1, 'eval: dropped definition: ' + VAR_UNDEFINED));
  });

  test('the failed member pending warnings are rolled back', () => {
    // The unit-mix warning raised before the undefined reference is
    // part of the dropped member: it neither renders nor consumes
    // budget (no suppressed summary).
    const res = new LessCompiler({ safeMode: true }).compile('.a { x: 90ch + 5px + @undef; }\n');
    expect(res.errors.length).toBe(0);
    expect(res.css).toEqual(recovery(1, 'eval: dropped rule: ' + VAR_UNDEFINED));
    expect(res.css).not.toContain('INCOMPATIBLE_UNITS');
    expect(res.css).not.toContain('suppressed:');
  });

  test('a nested failure drops the inner rule and prunes the empty rulesets', () => {
    const res = new LessCompiler({ safeMode: true }).compile('.a {\n  .b { x: @undef; }\n}\n');
    expect(res.errors.length).toBe(0);
    expect(res.css).toEqual(recovery(1, 'eval: dropped rule: ' + VAR_UNDEFINED));
  });

  test('a failing mixin call is dropped', () => {
    const res = new LessCompiler({ safeMode: true }).compile('.m { .m(); }\n.x { .m(); }\n');
    expect(res.errors.length).toBe(0);
    expect(res.css).toEqual(recovery(1, 'eval: dropped mixin call: ' + mixinUndefined('.m')));
  });

  test('mutual recursion drops both calls', () => {
    const res = new LessCompiler({ safeMode: true }).compile('.m1 { .m2(); }\n.m2 { .m1(); }\n.x { .m1(); }\n');
    expect(res.errors.length).toBe(0);
    expect(res.css).toEqual(
      recovery(1, 'eval: dropped mixin call: ' + mixinUndefined('.m1')) +
        recovery(2, 'eval: dropped mixin call: ' + mixinUndefined('.m2')),
    );
  });

  test('the depth counter unwinds after a dropped call', () => {
    // The failing call must not leave the depth high: the later .m()
    // call in .y still expands.
    const res = new LessCompiler({ safeMode: true }).compile('.m { color: red; }\n.x { .nope(); }\n.y { .m(); }\n');
    expect(res.errors.length).toBe(0);
    expect(res.css).toEqual(
      recovery(1, 'eval: dropped mixin call: ' + mixinUndefined('.nope')) +
        '.m {\n  color: red;\n}\n.y {\n  color: red;\n}\n',
    );
  });

  test('drop warnings count against the per-compile budgets', () => {
    // Two distinct drops of one type under a budget of one: the first
    // renders, the second is summarized in the trailing comment.
    const res = new LessCompiler({ safeMode: true, maxWarningsPerType: 1 }).compile(
      '.a { x: @u1; }\n.b { x: @u2; }\n',
    );
    expect(res.errors.length).toBe(0);
    expect(res.css).toContain('eval: dropped rule: ' + VAR_UNDEFINED.replace('@undef', '@u1'));
    expect(res.css).not.toContain('@u2');
    expect(res.css).toContain('suppressed:');
  });

  test('a clean sheet renders without warnings', () => {
    const res = new LessCompiler({ safeMode: true }).compile('.a { x: 1px; }\n');
    expect(res.errors.length).toBe(0);
    expect(res.css).toEqual(new LessCompiler({}).compile('.a { x: 1px; }\n').css);
  });

  test('the strict path is unchanged', () => {
    const res = new LessCompiler({}).compile('.a { x: @undef; }\n');
    expect(res.errors.length).toBe(1);
    expect(res.errors[0].errors[0].message).toBe(VAR_UNDEFINED);
    expect(res.css).not.toContain('WARNING[');
  });
});

describe('render recovery in safe mode', () => {
  test('an overflowing ruleset truncates at the complexity limit and the stack stays balanced', () => {
    // At the fixed level the grid overflows the complexity limit
    // mid-render. Safe mode truncates the combined set at the limit:
    // the selectors and the rule body stay, one warning trails. The
    // next sibling (.z) still attaches at the top level, which only
    // happens if the env and model stacks were balanced.
    const res = new LessCompiler({ safeMode: true, compatLevel: 2 }).compile(grid());
    expect(res.errors.length).toBe(0);
    expect(res.css).toEqual(truncatedGrid());
    expect(res.css).toContain('.z {\n  color: blue;\n}\n');
    expect(res.css).toContain('color: red');
  });

  test('a render failure at the legacy levels never happens', () => {
    // The per-flatten-call budget keeps the grid under the limit, so
    // nothing is skipped and no warning is recorded.
    const res = new LessCompiler({ safeMode: true }).compile(grid());
    expect(res.errors.length).toBe(0);
    expect(res.css).not.toContain('WARNING[');
    expect(res.css).toContain('color: red');
    expect(res.css).toContain('.z {\n  color: blue;\n}\n');
  });

  test('the strict path fails the compile on the same overflow', () => {
    expect(() => new LessCompiler({ compatLevel: 2 }).compile(grid())).toThrow(
      'ExecuteError SELECTOR_TOO_COMPLEX: Selector exceeds the complexity threshold',
    );
  });
});
