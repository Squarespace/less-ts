import { Buffer, ExecEnv, Node, NodeType } from '../common';

export const enum Unit {
  PERCENTAGE = '%',

  // centimeters
  CM = 'cm',
  // millimeters
  MM = 'mm',
  // inches
  IN = 'in',
  // pixels
  PX = 'px',
  // points
  PT = 'pt',
  // picas
  PC = 'pc',

  // width of the '0' (ZERO U+0030) glyph in the element's font
  CH = 'ch',
  // font size of the element
  EM = 'em',
  // x-height of the element's font
  EX = 'ex',
  // font size of the root element
  REM = 'rem',

  // 1% of viewport's height
  VH = 'vh',
  // 1% of viewport's width
  VW = 'vw',
  // 1% of viewport's smaller dimension
  VMIN = 'vmin',
  // 1% of viewport's larger dimension
  VMAX = 'vmax',
  // less 1.3.3 included this
  VM = 'vm',

  // fractions
  FR = 'fr',

  // seconds
  S = 's',
  // milliseconds
  MS = 'ms',

  // dots per inch
  DPI = 'dpi',
  // dots per centimeter
  DPCM = 'dpcm',
  // dots per 'px' unit (1dppx == 96dpi)
  DPPX = 'dppx',

  // herts
  HZ = 'hz',
  // kilohertz (1khz == 1000hz)
  KHZ = 'khz',

  // degrees
  DEG = 'deg',
  // gradians
  GRAD = 'grad',
  // radians
  RAD = 'rad',
  // turns
  TURN = 'turn',
}

export class Dimension extends Node {

  constructor(readonly value: number, readonly unit?: Unit) {
    super(NodeType.DIMENSION);
  }

  equals(n: Node): boolean {
    if (n.type === NodeType.DIMENSION) {
      return this.value === (n as Dimension).value
          && this.unit === (n as Dimension).unit;
    }
    return false;
  }

  repr(buf: Buffer): void {
    buf.num(this.value);
    if (this.unit) {
      buf.str(this.unit);
    }
  }

}

type FactorMap = { [x: string]: { [y: string]: number } };

const buildFactors = (): FactorMap => {
  const map: FactorMap = {};

  const add = (from: Unit, to: Unit, factor: number): void => {
    map[from] = (map[from] || {});
    map[from][to] = factor;
    map[to] = (map[to] || {});
    map[to][from] = 1.0 / factor;
  };

  add(Unit.IN, Unit.CM, 2.54);
  add(Unit.IN, Unit.MM, 2.54 * 1000.0);
  add(Unit.IN, Unit.PX, 96.0);
  add(Unit.IN, Unit.PT, 72.0);
  add(Unit.IN, Unit.PC, 12.0 * 72.0);

  add(Unit.CM, Unit.MM, 1000.0);
  add(Unit.CM, Unit.PX, 2.54 * 96.0);
  add(Unit.CM, Unit.PT, 2.54 * 72.0);
  add(Unit.CM, Unit.PC, 2.54 * 72.0 * 12.0);

  add(Unit.PX, Unit.MM, (2.54 * 1000.0) / 96.0);
  add(Unit.PX, Unit.PT, 0.75);
  add(Unit.PX, Unit.PC, 0.75 / 12.0);

  add(Unit.PC, Unit.MM, 1000.0 * map[Unit.PC][Unit.CM]);
  add(Unit.PC, Unit.PT, 12.0);

  add(Unit.PT, Unit.MM, (2.54 * 1000.0) / 72.0);

  add(Unit.S, Unit.MS, 1000.0);

  add(Unit.KHZ, Unit.HZ, 1000.0);

  add(Unit.DPCM, Unit.DPI, 2.54);
  add(Unit.DPPX, Unit.DPI, 96.0);
  add(Unit.DPPX, Unit.DPCM, 2.54 * 96.0);

  add(Unit.TURN, Unit.DEG, 360.0);
  add(Unit.TURN, Unit.GRAD, 400.0);
  add(Unit.TURN, Unit.RAD, 2 * Math.PI);
  add(Unit.DEG, Unit.RAD, 1.0 / (180.0 / Math.PI));
  add(Unit.DEG, Unit.GRAD, 9 / 10.0);
  add(Unit.RAD, Unit.GRAD, 1 / (Math.PI / 200.0));

  return map;
};

const FACTORS: FactorMap = buildFactors();

export const unitConversionFactor = (from: Unit | undefined, to: Unit | undefined) => {
  if (!from || !to) {
    return 1.0;
  }
  const f = FACTORS[from];
  return f ? (f[to] || 1.0) : 1.0;
};
