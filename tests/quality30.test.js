import { describe, expect, it } from 'vitest';
import { GENERATORS, generateResult, getEligiblePool, getPool, rerollSlot } from '../src/engine.js';
import { isReforgeReady } from '../src/data/reforge29Library.js';
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
        expect(entries.every(isReforgeReady)).toBe(true);
        expect(entries.every((entry) => entry.forms.balanced === entry.t)).toBe(true);
        expect(entries.every((entry) => entry.forms.detailed !== entry.forms.balanced)).toBe(true);
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

  it('keeps all 32 anchors in the depth-filtered live pool and makes them reachable', () => {
    for (const [generatorId, slots] of Object.entries(QUALITY30_LIBRARY)) {
      for (const [slot, entries] of Object.entries(slots)) {
        const selected = generatorId === 'game' || generatorId === 'hero' ? targets.map(([, game]) => game) : targets.map(([story]) => story);
        entries.forEach((entry, index) => {
          const genre = selected[index];
          const dna = { detail: 'detailed' };
          const eligible = getEligiblePool(generatorId, slot, [], dna);
          expect(eligible).toContain(entry);
          const generated = generateResult(generatorId, {
            mode: 'genre', genres: { main: genre, subs: [] }, dna,
            locks: Object.fromEntries(GENERATORS.find((g) => g.id === generatorId).slots.map((s) => [s.key, s.key !== slot])),
            rng: () => 0.999999
          });
          expect(generated[slot]).toBe(entry.forms.detailed);
          expect(rerollSlot(generatorId, slot, {
            mode: 'genre', genres: { main: genre, subs: [] }, dna,
            rng: () => 0.999999
          })).toBe(entry.forms.detailed);
        });
      }
    }
  });
});
