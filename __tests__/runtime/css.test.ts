import { Node, NodeType } from '../../src/common';
import { RuntimeContext, CssModel } from '../../src/runtime';

test('model', () => {
  const ctx = new RuntimeContext({ compress: false });
  const model = new CssModel(ctx);
  model.push(NodeType.MEDIA);
  model.header('@media screen');

  model.push(NodeType.RULESET);
  model.header('.foo');
  model.pop();

  model.push(NodeType.RULESET);
  model.header('.foo');
  model.header('.bar');
  model.value('color: red');
  model.value('font-size: 10px');
  model.comment('/* foo */\n');
  model.value('color: red');

  model.pop();
  model.pop();

  // console.log(JSON.stringify(model, undefined, '  '));
  const s = model.render();
  console.log(s);
});
