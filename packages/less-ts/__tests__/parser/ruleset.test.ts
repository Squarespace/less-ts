import {
  Anonymous,
  AttributeElement,
  Block,
  Combinator,
  Definition,
  Dimension,
  LessCompiler,
  LessStream,
  Node,
  Parselet,
  Property,
  Quoted,
  Rule,
  Ruleset,
  RGBColor,
  RULESET,
  Selector,
  Selectors,
  TextElement,
  Unit,
  Variable
} from '../../src';

const COMPILER = new LessCompiler({});

const parse = (raw: string): Node | undefined => COMPILER.parse(raw, RULESET);

test('ruleset', () => {
  let r = parse('.foo, .bar { color: red; font-size: 10em; }');
  expect(r).toEqual(new Ruleset(
    new Selectors([
      new Selector([new TextElement(Combinator.DESC, '.foo')]),
      new Selector([new TextElement(Combinator.DESC, '.bar')])
    ]), new Block([
      new Rule(new Property('color'), new RGBColor(255, 0, 0, 1.0), false),
      new Rule(new Property('font-size'), new Dimension(10, Unit.EM), false)
    ])));

  r = parse('.foo, .bar { }');
  expect(r).toEqual(new Ruleset(
    new Selectors([
      new Selector([new TextElement(Combinator.DESC, '.foo')]),
      new Selector([new TextElement(Combinator.DESC, '.bar')])
    ]),
    new Block([])
  ));

  r = parse('input[type="submit"].button { @color: red; color: @color; }');
  expect(r).toEqual(new Ruleset(
    new Selectors([
      new Selector([
        new TextElement(Combinator.DESC, 'input'),
        new AttributeElement(undefined, [
          new Anonymous('type'),
          new Anonymous('='),
          new Quoted('"', false, [new Anonymous('submit')])
        ]),
        new TextElement(undefined, '.button')
      ]),
    ]), new Block([
      new Definition('@color', new RGBColor(255, 0, 0, 1.0)),
      new Rule(new Property('color'), new Variable('@color', false, false), false)
    ])));
});
