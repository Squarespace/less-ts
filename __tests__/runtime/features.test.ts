import { LessCompiler } from '../../src';
import { Feature, Features, Keyword, Property, Dimension, Unit } from '../../src/model';
import { combineFeatures } from '../../src/runtime/combine';

test('combine', () => {
  const ancestors = new Features([
    new Keyword('screen'),
    new Feature(
      new Property('min-width'),
      new Dimension(900, Unit.PX)
    )
  ]);
  const current = new Features([
    new Feature(
      new Property('min-resolution'),
      new Dimension(96, Unit.DPI)
    )
  ]);

  const compiler = new LessCompiler({ compress: false });
  const ctx = compiler.context();
  const { features } = combineFeatures(ancestors, current);
  expect(features.length).toEqual(2);
  expect(ctx.render(features[0])).toEqual('screen and min-resolution: 96dpi');
  expect(ctx.render(features[1])).toEqual('min-width: 900px and min-resolution: 96dpi');
});
