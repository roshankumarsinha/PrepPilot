import { describe, expect, it } from 'vitest';
import { formatDuration } from './format';

describe('formatDuration', () => {
  it.each([
    [0, '0s'],
    [59, '59s'],
    [125, '2m 5s'],
    [3_660, '1h 1m'],
  ])('formats %i seconds as %s', (seconds, expected) => {
    expect(formatDuration(seconds)).toBe(expected);
  });
});
