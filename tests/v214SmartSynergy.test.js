import { describe, expect, it } from 'vitest';
import { generateResult, GENERATOR_MAP } from '../src/engine.js';
import { isMeaningfullyDuplicate, synergyScore } from '../src/synergy.js';

const seeded = (seed) => () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};

describe('V2.14 SMART SYNERGY', () => {
  it('exposes three persisted connection levels', async () => {
    const { SYNERGY_LEVELS } = await import('../src/synergy.js');
    expect(SYNERGY_LEVELS.map((x) => x.k)).toEqual(['free', 'balanced', 'high']);
  });

  it('keeps locked anchors unchanged while regenerating other slots', () => {
    const result = generateResult('game', {
      mode: 'genre', genre: GENERATOR_MAP.game.genreList[0].k, synergy: 'high',
      locks: { mechanic: true }, values: { mechanic: '방패 밀치기로 자세를 무너뜨린다' }, rng: seeded(7)
    });
    expect(result.mechanic).toBe('방패 밀치기로 자세를 무너뜨린다');
    expect(Object.values(result).filter(Boolean).length).toBe(8);
  });

  it('does not treat free mode as a semantic duplicate filter', () => {
    const values = generateResult('game', { mode: 'random', synergy: 'free', rng: seeded(42) });
    expect(Object.values(values).filter(Boolean).length).toBe(8);
  });

  it('scores shared role/tag affinity and detects similar text', () => {
    const a = { t: '방패로 적의 자세를 무너뜨린다', g: ['전투'], c: [], tags: ['combat', 'action'] };
    const b = { t: '창으로 무너진 적을 관통한다', g: ['전투'], c: [], tags: ['combat', 'action'] };
    expect(synergyScore(b, { generatorId: 'game', slotKey: 'mechanic', anchors: [a] })).toBeGreaterThan(0);
    expect(isMeaningfullyDuplicate({ t: '방패로 적의 자세를 무너뜨린다' }, [a])).toBe(true);
  });
});
