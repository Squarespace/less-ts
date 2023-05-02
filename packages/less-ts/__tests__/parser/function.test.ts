import { Dimension, FunctionCall, FUNCTION_CALL, LessCompiler, Node, Parselet } from '../../src';

const COMPILER = new LessCompiler({});

const parse = (raw: string): Node | undefined => COMPILER.parse(raw, FUNCTION_CALL);

test('function', () => {
  const r = parse('hsva(1, 2, 3, 4)');
  expect(r).toEqual(new FunctionCall('hsva', [new Dimension(1), new Dimension(2), new Dimension(3), new Dimension(4)]));
});
