import { Dimension, Unit } from '../../src/model';

test('modelRepr', () => {
  // Matches the Java DIVIDE_BY_ZERO and ALPHA_UNITS_INVALID messages,
  // which render the operand as its model repr.
  expect(new Dimension(1.0).modelRepr()).toEqual('DIMENSION 1.0');
  expect(new Dimension(1.5).modelRepr()).toEqual('DIMENSION 1.5');
  expect(new Dimension(10000000.0).modelRepr()).toEqual('DIMENSION 1.0E7');
  expect(new Dimension(1.0, Unit.PX).modelRepr()).toEqual('DIMENSION 1.0 PX (pixels)');
  expect(new Dimension(10.0, Unit.PERCENTAGE).modelRepr()).toEqual('DIMENSION 10.0 % (percentage)');
});
