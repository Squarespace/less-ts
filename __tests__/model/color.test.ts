import { HSLColor, KeywordColor, RGBColor } from '../../src/model';

test('equals', () => {
  const black1 = new RGBColor(0, 0, 0, 1.0);
  const black2 = new RGBColor(0, 0, 0, 0.5);
  expect(black1.equals(black1)).toEqual(true);
  expect(black1.equals(black2)).toEqual(false);

  const red = new RGBColor(255, 0, 0, 1.0);
  const blue = new RGBColor(0, 0, 255, 1.0);
  expect(red.equals(red)).toEqual(true);
  expect(red.equals(black1)).toEqual(false);
  expect(red.equals(blue)).toEqual(false);

  const hslRed = red.toHSL();
  expect(red.equals(hslRed)).toEqual(false);
});
