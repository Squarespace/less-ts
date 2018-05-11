import { Node } from '../../common';
import { BaseColor, HSLColor, RGBColor } from '../../model';

export const hsl = (c: Node): HSLColor => (c as BaseColor).toHSL();

export const rgb = (c: Node): RGBColor => (c as BaseColor).toRGB();