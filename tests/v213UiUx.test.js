import { describe, expect, it } from 'vitest';
import { normalizeGenreSelection } from '../src/genreMix.js';

describe('V2.13 generator-scoped primary genres', () => {
  it('keeps the compatibility vocabulary available to the engine', () => {
    expect(normalizeGenreSelection('story', { main: '생존', subs: ['미'] }))
      .toEqual({ main: '생존', subs: ['미'] });
  });

  it('falls back when a legacy main key is unknown', () => {
    expect(normalizeGenreSelection('game', { main: '공포', subs: ['전략'] }))
      .toEqual({ main: 'RPG', subs: ['전략'] });
  });

  it('keeps optional cross-family subgenres for intentional hybrids', () => {
    expect(normalizeGenreSelection('story', { main: 'SF', subs: ['RPG', '미'] }))
      .toEqual({ main: 'SF', subs: ['RPG', '미'] });
  });
});
