import {
  Definition,
  Dimension,
  Expression,
  ExpressionList,
  Keyword,
  LessCompiler,
  LessStream,
  Node,
  Parselet,
  Property,
  Rule,
  RGBColor,
  RULE,
  Shorthand,
  Unit
} from '../../src';

const COMPILER = new LessCompiler({});

const parse = (raw: string): Node | undefined => COMPILER.parse(raw, RULE);

test('rule', () => {
  let r = parse('foo: red;');
  expect(r).toEqual(new Rule(
    new Property('foo'),
    new RGBColor(255, 0, 0, 1.0),
    false));

  r = parse('@size: 10px;');
  expect(r).toEqual(new Definition('@size', new Dimension(10, 'px' as Unit)));

  r = parse('font: italic small-caps bold 1em/140% Helvetica, sans-serif;');
  expect(r).toEqual(new Rule(
    new Property('font'),
    new ExpressionList([
      new Expression([
        new Keyword('italic'),
        new Keyword('small-caps'),
        new Keyword('bold'),
        new Shorthand(
          new Dimension(1, Unit.EM),
          new Dimension(140, Unit.PERCENTAGE)
        ),
        new Keyword('Helvetica')
      ]),
      new Keyword('sans-serif')
    ]),
    false
  ));
});
