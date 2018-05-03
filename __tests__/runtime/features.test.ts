import { Feature, Features, Keyword, Property, Dimension, Unit } from '../../src/model';
import { RuntimeBuffer, RuntimeContext } from '../../src/runtime';
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

  const ctx = new RuntimeContext({ compress: false });
  const r = combineFeatures(ancestors, current);
  const buf = ctx.newBuffer();
  r.repr(buf);
  expect(buf.toString()).toEqual(
    'screen and min-resolution: 96dpi, min-width: 900px and min-resolution: 96dpi');
});
