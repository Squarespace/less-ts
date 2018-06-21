import { LessCompiler } from '../../src';
import { Node, NodeType } from '../../src/common';
import { CssModel } from '../../src/runtime';

test('model', () => {
  const compiler = new LessCompiler({ compress: true });
  const ctx = compiler.context();
  const model = new CssModel(ctx);
  model.push(NodeType.MEDIA);
  model.header('@media screen');

  model.push(NodeType.RULESET);
  model.header('.foo');
  model.pop();

  model.push(NodeType.RULESET);
  model.header('.foo');
  model.header('.bar');
  model.value('color:red');
  model.value('font-size:10px');
  model.comment('/* foo */');
  model.value('color:red'); // last distinct rule wins

  model.pop();
  model.pop();

  const s = model.render();
  expect(s).toEqual('@media screen{.foo,.bar{font-size:10px;/* foo */color:red}}');
});
