import {
  Block,
  Condition,
  Dimension,
  FunctionCall,
  Guard,
  Keyword,
  LessCompiler,
  LessParseError,
  Mixin,
  MixinParams,
  MIXIN,
  Node,
  Operator,
  Parameter,
  Property,
  Rule,
  Unit,
  Variable,
} from '../../src';

const COMPILER = new LessCompiler({});

const parse = (raw: string): Node | undefined => COMPILER.parse(raw, MIXIN);

test('mixin def', () => {
  // A call in a guard is a math operand only at the fixed level; at
  // the default level the guard condition fails the parse.
  const raw = '.mixin-1(@color) when (lightness(@color) > 60%) { content1: A }';
  const r = new LessCompiler({ compatLevel: 2 }).parse(raw, MIXIN);
  expect(r).toEqual(
    new Mixin(
      '.mixin-1',
      new MixinParams([new Parameter('@color', undefined, false)]),
      new Guard([
        new Condition(
          Operator.GREATER_THAN,
          new FunctionCall('lightness', [new Variable('@color', false, false)]),
          new Dimension(60, Unit.PERCENTAGE),
          false
        ),
      ]),
      new Block([new Rule(new Property('content1'), new Keyword('A'), false)])
    )
  );
  let thrown: unknown;
  try {
    COMPILER.parse(raw, MIXIN);
  } catch (e) {
    thrown = e;
  }
  expect(thrown).toBeInstanceOf(LessParseError);
  expect((thrown as Error).message).toEqual("SyntaxError EXPECTED Expected right parenthesis ')' to end guard condition");
});

test('guard', () => {
  const r = parse('.m (@a) when (@a <= 10px), (@a >= 20px) { }');
  expect(r).toEqual(
    new Mixin(
      '.m',
      new MixinParams([new Parameter('@a', undefined, false)]),
      new Guard([
        new Condition(Operator.LESS_THAN_OR_EQUAL, new Variable('@a', false, false), new Dimension(10, Unit.PX), false),
        new Condition(Operator.GREATER_THAN_OR_EQUAL, new Variable('@a', false, false), new Dimension(20, Unit.PX), false),
      ]),
      new Block([])
    )
  );
});
