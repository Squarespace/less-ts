import { Buffer, ExecEnv, Node, NodeType } from './types';

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
    super();
  }

  type(): NodeType {
    return NodeType.DIMENSION;
  }

  repr(buf: Buffer): void {
    buf.num(this.value);
    if (this.unit) {
      buf.str(this.unit);
    }
  }

}
