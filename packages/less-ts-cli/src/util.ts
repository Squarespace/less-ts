import * as fs from 'fs';
import { join } from 'path';

export interface ProjectInfo {
  version: string;
}

export const getPackageInfo = (): ProjectInfo => {
  const path = join(__dirname, '..', 'package.json');
  const raw = fs.readFileSync(path, { encoding: 'utf-8' });
  const { version } = JSON.parse(raw);
  return { version };
};
