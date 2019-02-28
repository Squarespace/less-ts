import { NodeType, NodeTypes } from '../src';

test('node type mapping', () => {
  expect(NodeTypes.ALPHA).toEqual(NodeType.ALPHA);
  expect(NodeTypes.EXPRESSION_LIST).toEqual(NodeType.EXPRESSION_LIST);
  expect(NodeTypes.DEFINITION).toEqual(NodeType.DEFINITION);
});
