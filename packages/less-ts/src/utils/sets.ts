export const setOf = <T>(...values: T[]): Set<T> => {
  const r: Set<T> = new Set();
  for (const v of values) {
    r.add(v);
  }
  return r;
};
