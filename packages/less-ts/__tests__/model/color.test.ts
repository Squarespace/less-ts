import { HSLColor, KeywordColor, RGBColor } from '../../src/model';
import { hexvalue, hexToRGB, nameToRGB, rgbToName } from '../../src/utils';
import { LessCompiler } from '../../src';

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

test('conversion', () => {
  expect(hexvalue('0')).toEqual(0);
  expect(hexvalue('5')).toEqual(5);
  expect(hexvalue('a')).toEqual(10);
  expect(hexvalue('C')).toEqual(12);
  expect(hexvalue('f')).toEqual(15);
  expect(hexvalue('F')).toEqual(15);

  expect(hexToRGB('fff')).toEqual([255, 255, 255]);
});

test('the name table resolves saddlebrown both ways', () => {
  expect(nameToRGB('saddlebrown')).toEqual([0x8b, 0x45, 0x13]);
  expect(rgbToName(0x8b, 0x45, 0x13)).toBe('saddlebrown');
  // black is registered once and resolves both ways
  expect(nameToRGB('black')).toEqual([0x00, 0x00, 0x00]);
  expect(rgbToName(0x00, 0x00, 0x00)).toBe('black');
});

test('saddlebrown and #8b4513 are the same rendered color', () => {
  // The reference emits the shorter form: the 11-character name loses
  // to the 7-character hex, so both inputs render #8b4513.
  const named = new LessCompiler({}).compile('.a { c: saddlebrown; }\n');
  const hex = new LessCompiler({}).compile('.a { c: #8b4513; }\n');
  expect(named.errors.length).toBe(0);
  expect(hex.css).toBe(named.css);
  expect(hex.css).toContain('c: #8b4513');
});
