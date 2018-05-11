import { Function } from '../common';

import { BLENDING, CHANNELS, DEFINITIONS, OPERATIONS } from './color';
import { LIST } from './list';
import { MATH } from './math';
import { MISC } from './misc';

export const FUNCTIONS: { [x: string]: Function } = {
  ...BLENDING,
  ...CHANNELS,
  ...DEFINITIONS,
  ...OPERATIONS,

  ...LIST,

  ...MATH,

  ...MISC
};
