import {
  Block,
  Condition,
  Dimension,
  FunctionCall,
  Guard,
  Keyword,
  LessCompiler,
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
  const r = parse('.mixin-1(@color) when (lightness(@color) > 60%) { content1: A }');
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
