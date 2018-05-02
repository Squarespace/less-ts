import { Buffer, Node, NodeType } from './types';
import { hexchar, hexToRGB, rgbToName } from '../utils';

export const enum Colorspace {
  RGB = 0,
  HSL = 1
}

export abstract class BaseColor extends Node {

  type(): NodeType {
    return NodeType.COLOR;
  }

  abstract colorspace(): Colorspace;

  abstract toRGB(): RGBColor;

  abstract toHSL(): HSLColor;

  static fromHex(raw: string): RGBColor {
    const [r, g, b] = hexToRGB(raw);
    return new RGBColor(r, g, b, 1.0);
  }
}

export class RGBColor extends BaseColor {

  protected _forceHex: boolean = false;

  constructor(readonly r: number, readonly g: number, readonly b: number, readonly a: number) {
    super();
  }

  repr(buf: Buffer): void {
    const { r, g, b, a } = this;
    if (a < 1.0) {
      buf.str('rgba(');
      buf.num(r).listsep();
      buf.num(g).listsep();
      buf.num(b).listsep();
      buf.num(a);
      buf.str(')');
      return;
    }

    // Get hex components
    const r0 = hexchar(r >> 4);
    const r1 = hexchar(r & 0x0F);
    const g0 = hexchar(g >> 4);
    const g1 = hexchar(g & 0x0F);
    const b0 = hexchar(b >> 4);
    const b1 = hexchar(b & 0x0F);

    // See if we can represent this as a 3-character hex color
    const hex3 = r0 === r1 && g0 === g1 && b0 === b1;

    // If we aren't forcing a hex value here, try to outut a name if
    // if is shorter than the hex representation.
    if (!this._forceHex) {
      const name = rgbToName(r, g, b);
      if (name) {
        const len = name.length;
        if ((hex3 && len <= 4) || (!hex3 && len <= 7)) {
          buf.str(name);
          return;
        }
        // Fall through
      }
    }

    buf.str('#');
    if (hex3) {
      buf.str(r0).str(g0).str(b0);
    } else {
      buf.str(r0).str(r1);
      buf.str(g0).str(g1);
      buf.str(b0).str(b1);
    }
  }

  colorspace(): Colorspace {
    return Colorspace.RGB;
  }

  forceHex(): void {
    this._forceHex = true;
  }

  toRGB(): RGBColor {
    return this;
  }

  toHSL(): HSLColor {
    return new HSLColor(0, 0, 0);
  }
}

export class HSLColor extends BaseColor {

  constructor(h: number, s: number, l: number) {
    super();
  }

  repr(buf: Buffer): void {
    this.toRGB().repr(buf);
  }

  colorspace(): Colorspace {
    return Colorspace.HSL;
  }

  toRGB(): RGBColor {
    // TODO:
    return new RGBColor(0, 0, 0, 1.0);
  }

  toHSL(): HSLColor {
    return this;
  }
}

export class KeywordColor extends RGBColor {

  constructor(readonly keyword: string, r: number, g: number, b: number) {
    super(r, g, b, 1.0);
  }

  repr(buf: Buffer): void {
    buf.str(this.keyword);
  }
}
