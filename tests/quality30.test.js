import { describe, expect, it } from 'vitest';
import { getPool } from '../src/engine.js';
import { genreAffinity } from '../src/genreMix.js';
import { QUALITY30_LIBRARY } from '../src/data/quality30.js';

const targets = [
  ['판', 'RPG'], ['미', '퍼즐'], ['로', '시뮬'], ['공', '생존']
];

describe('UX 2.10 genre-signature content', () => {
  it('adds four directly authored genre anchors to every upgraded slot', () => {
    for (const [generatorId, slots] of Object.entries(QUALITY30_LIBRARY)) {
      for (const [slot, entries] of Object.entries(slots)) {
        expect(entries).toHaveLength(4);
        expect(new Set(entries.map((entry) => entry.t)).size).toBe(4);
        expect(entries.every((entry) => entry.g.length >= 1)).toBe(true);
        expect(getPool(generatorId, slot).slice(-4)).toEqual(entries);
      }
    }
  });

  it('keeps each anchor semantically inside its requested genre', () => {
    for (const [generatorId, slots] of Object.entries(QUALITY30_LIBRARY)) {
      for (const [slot, entries] of Object.entries(slots)) {
        entries.forEach((entry, index) => {
          const [storyGenre, gameGenre] = targets[index];
          const selected = generatorId === 'game' || generatorId === 'hero' ? gameGenre : storyGenre;
          expect(genreAffinity(entry, generatorId, selected), `${generatorId}/${slot}/${selected}`).toBeGreaterThan(0);
        });
      }
    }
  });
});
