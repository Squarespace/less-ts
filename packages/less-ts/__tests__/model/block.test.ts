import { Anonymous, Block } from '../../src/model';

test('equals', () => {
  const foo = new Anonymous('foo');
  const bar = new Anonymous('bar');

  const empty = new Block([]);
  expect(empty.equals(empty)).toBe(true);

  const b1 = new Block([foo]);
  expect(b1.equals(b1)).toBe(true);

  const b2 = new Block([foo]);
  expect(b1.equals(b2)).toBe(true);

  const b3 = new Block([foo, bar]);
  const b4 = new Block([bar, foo]);
  expect(b1.equals(b3)).toEqual(false);
  expect(b3.equals(b3)).toEqual(true);
  expect(b3.equals(b4)).toEqual(false);
});
