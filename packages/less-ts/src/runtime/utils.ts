/**
 * Computes a cartesian product of multiple lists directly. Importantly
 * this maintains the original ordering of the elements, as our code
 * critically depends on this. Presence of any number of empty lists
 * does not affect the output.
 *
 * Example input:  [ [1, 2], [], ['a', 'b'] ]
 *        output:  [ [1, 'a'], [1, 'b'], [2, 'a'], [2, 'b'] ]
 */
export const cartesianProduct = <T>(lists: T[][]): T[][] => {
  const result: T[][] = [];

  lists = lists.filter(l => l.length > 0);
  const len = lists.length;
  if (len === 0) {
    return result;
  }

  // Record the indices for the current product
  const indices = new Array(len);
  indices.fill(0);
  const end = indices.length - 1;

  // Index the last element of each list
  const lasts = indices.slice(0);
  for (let i = 0; i < len; i++) {
    lasts[i] = lists[i].length - 1;
  }

done:
  while (1) {
    // Populate one element..
    const elem: T[] = new Array(len);
    for (let i = 0; i < len; i++) {
      const x = indices[i];
      elem[i] = lists[i][x];
    }

    // Append to result.
    result.push(elem);

    // Increment indices.
    for (let i = end; i >= 0; i--) {
      if (indices[i] === lasts[i]) {
        indices[i] = 0;

        // If we've reset the first index we're done
        if (i === 0) {
          break done;
        }
      } else {
        indices[i]++;
        break;
      }
    }
  }
  return result;
};
