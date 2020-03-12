import { Buffer, Node, NodeType } from '../common';
import { Anonymous } from './general';
import { formatDouble, hexchar, hexToRGB, nameToRGB, rgbToName } from '../utils';

const round = Math.round;

export const enum Colorspace {
  RGB = 0,
  HSL = 1
}

const HSV_PERMUTATIONS: number[][] = [
  [0, 3, 1],
  [2, 0, 1],
  [1, 0, 3],
  [1, 2, 0],
  [3, 1, 0],
  [0, 1, 2]
];

export abstract class BaseColor extends Node {

  constructor() {
    super(NodeType.COLOR);
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

  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;

  forceHex: boolean = false;

  constructor(r: number, g: number, b: number, a: number) {
    super();
    this.r = round(chan(r));
    this.g = round(chan(g));
    this.b = round(chan(b));
    this.a = clamp(a, 0, 1.0);
  }

  equals(n: Node): boolean {
    if (n instanceof RGBColor) {
      const o = n as RGBColor;
      return this.r === o.r
        && this.g === o.g
        && this.b === o.b
        && this.a === o.a;
    }
    return false;
  }

  copy(): RGBColor {
    return new RGBColor(this.r, this.g, this.b, this.a);
  }

  luma(): number {
    let r = this.r / 255;
    let g = this.g / 255;
    let b = this.b / 255;

    r = (r <= 0.03928) ? r / 12.92 : Math.pow(((r + 0.055) / 1.055), 2.4);
    g = (g <= 0.03928) ? g / 12.92 : Math.pow(((g + 0.055) / 1.055), 2.4);
    b = (b <= 0.03928) ? b / 12.92 : Math.pow(((b + 0.055) / 1.055), 2.4);

    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  repr(buf: Buffer): void {
    const { r, g, b, a } = this;
    if (a < 1.0) {
      const { listsep } = buf.chars;
      buf.str('rgba(');
      buf.num(r).str(listsep);
      buf.num(g).str(listsep);
      buf.num(b).str(listsep);
      buf.str(formatDouble(a));
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
    const hex3 = !buf.fastcolor && r0 === r1 && g0 === g1 && b0 === b1;

    // If we aren't forcing a hex value here, try to outut a name if
    // if is shorter than the hex representation.
    if (!this.forceHex && !buf.fastcolor) {
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

  toRGB(): this {
    return this;
  }

  toARGB(): Anonymous {
    const { r, g, b } = this;
    const a = Math.round(this.a * 255) | 0;
    const s = `#${hexchar(a >> 4)}${hexchar(a & 0x0F)}`
      + `${hexchar(r >> 4)}${hexchar(r & 0x0F)}`
      + `${hexchar(g >> 4)}${hexchar(g & 0x0F)}`
      + `${hexchar(b >> 4)}${hexchar(b & 0x0F)}`;
    return new Anonymous(s);
  }

  toHSL(): HSLColor {
    const r = this.r / 255;
    const g = this.g / 255;
    const b = this.b / 255;
    const max = Math.max(Math.max(r, g), b);
    const min = Math.min(Math.min(r, g), b);
    const d = max - min;
    const l = (max + min) / 2.0;
    let h = 0;
    let s = 0;

    if (max !== min) {
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if ((max - r) === 0) {
        h = (g - b) / d + (g < b ? 6 : 0);
      } else if ((max - g) === 0) {
        h = (b - r) / d + 2;
      } else if ((max - b) === 0) {
        h = (r - g) / d + 4;
      }
      h /= 6.0;
    }
    return new HSLColor(h, s, l, this.a);
  }

  static fromHSVA(h: number, s: number, v: number, a: number): RGBColor {
    h *= 360;
    const i = Math.floor((h / 60) % 6);
    const f = (h / 60) - i;
    const vals: number[] = [
      v,
      v * (1 - s),
      v * (1 - f * s),
      v * (1 - (1 - f) * s)
    ];
    const r = vals[HSV_PERMUTATIONS[i][0]] * 255;
    const g = vals[HSV_PERMUTATIONS[i][1]] * 255;
    const b = vals[HSV_PERMUTATIONS[i][2]] * 255;
    return new RGBColor(r, g, b, a);
  }
}

export class HSLColor extends BaseColor {

  readonly h: number;
  readonly s: number;
  readonly l: number;
  readonly a: number;

  constructor(h: number, s: number, l: number, a: number) {
    super();

    this.h = clamp(h * 360.0, 0, 360);
    this.s = clamp(s, 0, 1);
    this.l = clamp(l, 0, 1);
    this.a = clamp(a, 0, 1);
  }

  equals(n: Node): boolean {
    if (n instanceof HSLColor) {
      const o = n as HSLColor;
      return this.h === o.h
        && this.s === o.s
        && this.l === o.l
        && this.a === o.a;
    }
    return false;
  }

  repr(buf: Buffer): void {
    this.toRGB().repr(buf);
  }

  colorspace(): Colorspace {
    return Colorspace.HSL;
  }

  toRGB(): RGBColor {
    let r = 0;
    let g = 0;
    let b = 0;
    if (this.s === 0) {
      r = g = b = this.l;
    } else {
      const h = this.h / 360.0;
      const { l, s } = this;
      const q = l < 0.5 ? (l * (1 + s)) : (l + s - l * s);
      const p = 2 * l - q;
      r = hue(p, q, h + 1 / 3.0);
      g = hue(p, q, h);
      b = hue(p, q, h - 1 / 3.0);
    }
    return new RGBColor(r * 255, g * 255, b * 255, this.a);
  }

  toHSL(): HSLColor {
    return this;
  }
}

const hue = (p: number, q: number, h: number): number => {
  if (h < 0) {
    h += 1.0;
  }
  if (h > 1) {
    h -= 1.0;
  }
  if (h < 1 / 6.0) {
    return p + (q - p) * 6.0 * h;
  }
  if (h < 1 / 2.0) {
    return q;
  }
  if (h < 2 / 3.0) {
    return p + (q - p) * ((2 / 3.0) - h) * 6.0;
  }
  return p;
};

export class KeywordColor extends RGBColor {

  constructor(readonly keyword: string, r: number, g: number, b: number) {
    super(r, g, b, 1.0);
  }

  repr(buf: Buffer): void {
    buf.str(this.keyword);
  }
}

export const colorFromName = (name: string): RGBColor | undefined => {
  if (name === 'transparent') {
    return new KeywordColor(name, 0, 0, 0);
  }
  const c = nameToRGB(name);
  return c ? new RGBColor(c[0], c[1], c[2], 1.0) : undefined;
};

const chan = (n: number): number => clamp(n, 0, 255);

const clamp = (n: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(n, lo));
