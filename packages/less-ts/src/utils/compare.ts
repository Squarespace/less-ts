
export interface Eq {
  equals(n: Eq): boolean;
}

export const arrayEquals = <T extends Eq>(a: T[], b: T[]): boolean => {
  if (!Array.isArray(a) || !Array.isArray(b)) {
    return false;
  }
  const sz = a.length;
  if (sz === b.length) {
    for (let i = 0; i < sz; i++) {
      if (!safeEquals(a[i], b[i])) {
        return false;
      }
    }
    return true;
  }
  return false;
};

export const safeEquals = <T extends Eq>(a: T | undefined, b: T | undefined): boolean =>
  a === undefined ? b === undefined : b === undefined ? false : a.equals(b);
