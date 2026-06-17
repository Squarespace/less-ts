import { Dimension, Unit, unitConversionFactor } from '../../src/model';

test('modelRepr', () => {
  // Matches the Java DIVIDE_BY_ZERO and ALPHA_UNITS_INVALID messages,
  // which render the operand as its model repr.
  expect(new Dimension(1.0).modelRepr()).toEqual('DIMENSION 1.0');
  expect(new Dimension(1.5).modelRepr()).toEqual('DIMENSION 1.5');
  expect(new Dimension(10000000.0).modelRepr()).toEqual('DIMENSION 1.0E7');
  expect(new Dimension(1.0, Unit.PX).modelRepr()).toEqual('DIMENSION 1.0 PX (pixels)');
  expect(new Dimension(10.0, Unit.PERCENTAGE).modelRepr()).toEqual('DIMENSION 10.0 % (percentage)');
});

// Full length-unit matrix: 1in = 2.54cm = 25.4mm = 96px = 72pt = 6pc.
// Every ordered pair must satisfy factor(a, b) = unit-per-inch(b) /
// unit-per-inch(a), and the inverse must hold in the reverse direction.
test('length unit matrix', () => {
  const units = [Unit.IN, Unit.CM, Unit.MM, Unit.PX, Unit.PT, Unit.PC];
  const perInch = [1.0, 2.54, 25.4, 96.0, 72.0, 6.0];
  for (let i = 0; i < units.length; i++) {
    for (let j = 0; j < units.length; j++) {
      const expected = perInch[j] / perInch[i];
      expect(unitConversionFactor(units[i], units[j])).toBeCloseTo(expected, 9);
      expect(unitConversionFactor(units[j], units[i])).toBeCloseTo(1.0 / expected, 9);
    }
  }
});

// Physical round-trips: converting a value to another length unit and
// back returns the original value.
test('length round trips', () => {
  const units = [Unit.IN, Unit.CM, Unit.MM, Unit.PX, Unit.PT, Unit.PC];
  for (const from of units) {
    for (const to of units) {
      expect(unitConversionFactor(from, to) * unitConversionFactor(to, from)).toBeCloseTo(1.0, 6);
    }
  }
});

// Full resolution-unit matrix: 1dppx = 96dpi = 96/2.54dpcm. dppx->dpcm is
// 96/2.54 (about 37.795), not 2.54*96 (243.84).
test('resolution unit matrix', () => {
  const units = [Unit.DPPX, Unit.DPI, Unit.DPCM];
  const perDppx = [1.0, 96.0, 96.0 / 2.54];
  for (let i = 0; i < units.length; i++) {
    for (let j = 0; j < units.length; j++) {
      const expected = perDppx[j] / perDppx[i];
      expect(unitConversionFactor(units[i], units[j])).toBeCloseTo(expected, 9);
      expect(unitConversionFactor(units[j], units[i])).toBeCloseTo(1.0 / expected, 9);
    }
  }
});

// Full angular-unit matrix: 1turn = 360deg = 400grad = 2pi rad. deg->grad
// is the exact reciprocal of grad->deg (10/9), not 9/10.
test('angle unit matrix', () => {
  const units = [Unit.TURN, Unit.DEG, Unit.GRAD, Unit.RAD];
  const perTurn = [1.0, 360.0, 400.0, 2 * Math.PI];
  for (let i = 0; i < units.length; i++) {
    for (let j = 0; j < units.length; j++) {
      const expected = perTurn[j] / perTurn[i];
      expect(unitConversionFactor(units[i], units[j])).toBeCloseTo(expected, 9);
      expect(unitConversionFactor(units[j], units[i])).toBeCloseTo(1.0 / expected, 9);
    }
  }
});
