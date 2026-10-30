import { describe, expect, it } from 'vitest';
import { GENERATORS, generateResult, getEligiblePool, getPool, rerollSlot } from '../src/engine.js';
import { QUALITY11_LIBRARY } from '../src/data/quality11.js';
import { isReforgeReady } from '../src/data/reforge29Library.js';
import { genreAffinity } from '../src/genreMix.js';

const selected = { story: ['판', '미', '로', '공'], character: ['판', '미', '로', '공'], game: ['RPG', '퍼즐', '시뮬', '생존'], hero: ['RPG', '퍼즐', '시뮬', '생존'] };

describe('V2.11 content quality expansion', () => {
  it('adds 32 authored connective entries with three usable depths', () => {
    const entries = Object.values(QUALITY11_LIBRARY).flatMap(slots => Object.values(slots).flat()).flat();
    expect(entries).toHaveLength(32);
    expect(new Set(entries.map(entry => entry.t)).size).toBe(32);
    expect(entries.every(isReforgeReady)).toBe(true);
    expect(entries.every(entry => entry.forms.brief && !/\s/.test(entry.forms.brief))).toBe(true);
  });

  it('keeps every expansion entry in its intended genre and live pool', () => {
    for (const [generatorId, slots] of Object.entries(QUALITY11_LIBRARY)) {
      for (const [slotKey, entries] of Object.entries(slots)) {
        entries.forEach((entry, index) => {
          expect(genreAffinity(entry, generatorId, selected[generatorId][index])).toBeGreaterThan(0);
          expect(getPool(generatorId, slotKey)).toContain(entry);
          expect(getEligiblePool(generatorId, slotKey, [], { detail: 'detailed' })).toContain(entry);
        });
      }
    }
  });

  it('makes expanded entries reachable through generation and reroll', () => {
    for (const [generatorId, slots] of Object.entries(QUALITY11_LIBRARY)) {
      const gen = GENERATORS.find(item => item.id === generatorId);
      for (const [slotKey, entries] of Object.entries(slots)) {
        entries.forEach((entry, index) => {
          const locks = Object.fromEntries(gen.slots.map(slot => [slot.key, slot.key !== slotKey]));
          const base = { mode: 'genre', genres: { main: selected[generatorId][index], subs: [] }, dna: { detail: 'detailed' }, locks, values: {} };
          const generated = generateResult(generatorId, { ...base, rng: () => 0.37 })[slotKey];
          const rerolled = rerollSlot(generatorId, slotKey, { ...base, locks: undefined, rng: () => 0.63 });
          expect(generated).toBeTruthy();
          expect(rerolled).toBeTruthy();
          expect(getEligiblePool(generatorId, slotKey, [], base.dna).map(item => item.forms.detailed)).toContain(generated);
          expect(getEligiblePool(generatorId, slotKey, [], base.dna).map(item => item.forms.detailed)).toContain(rerolled);
        });
      }
    }
  });
});
