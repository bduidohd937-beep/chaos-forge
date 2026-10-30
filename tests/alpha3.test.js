import { describe, it, expect } from 'vitest';
import { ALL_GENRES, GENERATORS, generateResult, getPool, pickKeyword, rerollSlot } from '../src/engine.js';
import { genreAffinity } from '../src/genreMix.js';
import { planGenreSlots } from '../src/composition.js';
import { ALPHA3_KEYWORDS } from '../src/data/alpha3.js';
import { ALPHA5_LIBRARY } from '../src/data/alpha5.js';
import { REFORGE_LIBRARY } from '../src/data/reforge29Library.js';
import { K } from '../src/data/genres.js';

function seeded(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const selections = [
  { main: '판', subs: ['로', '미', '코'] },
  { main: 'SF', subs: ['공', '미', '로'] },
  { main: '미', subs: ['코', '판', '로'] },
  { main: 'RPG', subs: ['로', '미', '코'] }
];

function usedGenres(generatorId, result, selection) {
  const hits = new Set();
  const gen = GENERATORS.find((item) => item.id === generatorId);
  for (const slot of gen.slots) {
    const keyword = getPool(generatorId, slot.key).find((item) => item.t === result[slot.key]);
    if (!keyword) continue;
    for (const genre of [selection.main, ...selection.subs]) {
      if (genreAffinity(keyword, generatorId, genre) > 0) hits.add(genre);
    }
  }
  return hits;
}

describe('Alpha 3 curated keywords', () => {
  it('adds exactly 127 manually curated creative prompts to existing pools', () => {
    const actual = Object.values(ALPHA3_KEYWORDS)
      .flatMap((perGenerator) => Object.values(perGenerator))
      .reduce((sum, pool) => sum + pool.length, 0);
    expect(actual).toBe(127);
  });

  it('all curated entries have valid genre tags, positive weights and distinct text per slot', () => {
    const valid = new Set(ALL_GENRES.map((g) => g.k));
    for (const gen of GENERATORS) {
      for (const slot of gen.slots) {
        const extras = ALPHA3_KEYWORDS[gen.id]?.[slot.key] || [];
        expect(extras.length).toBeGreaterThan(0);
        const pool = getPool(gen.id, slot.key);
        expect(pool.length).toBe(gen.data[slot.key].length + extras.length + (ALPHA5_LIBRARY[gen.id]?.[slot.key]?.length || 0) + (REFORGE_LIBRARY[gen.id]?.[slot.key]?.length || 0));
        expect(new Set(pool.map((kw) => kw.t)).size, gen.id + '.' + slot.key).toBe(pool.length);
        for (const kw of extras) {
          expect(kw.t.length).toBeGreaterThanOrEqual(5);
          expect(Number.isFinite(kw.w) && kw.w > 0).toBe(true);
          expect(kw.g.length).toBeGreaterThan(0);
          for (const tag of [...kw.g, ...kw.c]) expect(valid.has(tag)).toBe(true);
        }
      }
    }
  });

  it('GAME/HERO now have direct semantic keywords for romance, mystery, comedy, fantasy and SF', () => {
    for (const generatorId of ['game', 'hero']) {
      for (const tag of ['로', '미', '코', '판', 'SF']) {
        const count = Object.values(ALPHA3_KEYWORDS[generatorId])
          .flat().filter((kw) => kw.g.includes(tag)).length;
        expect(count, generatorId + '/' + tag).toBeGreaterThan(0);
      }
    }
  });
});

describe('Alpha 3 whole-result composition', () => {
  it('plans MAIN + 3 SUB assignments to distinct nonlocked slots where feasible', () => {
    for (const gen of GENERATORS) {
      const genres = selections[0];
      const pools = Object.fromEntries(gen.slots.map((slot) => [slot.key, getPool(gen.id, slot.key)]));
      const assignments = planGenreSlots({
        generatorId: gen.id, genres, mode: 'genre',
        chaos: 1, slots: gen.slots, pools
      });
      const tags = Object.values(assignments);
      for (const tag of [genres.main, ...genres.subs]) {
        expect(tags.includes(tag), gen.id + '/' + tag).toBe(true);
      }
      expect(new Set(Object.keys(assignments)).size).toBe(tags.length);
      for (const [key, tag] of Object.entries(assignments)) {
        expect(pools[key].some((kw) => genreAffinity(kw, gen.id, tag) > 0)).toBe(true);
      }
    }
  });

  it('MAIN and SUB genres are represented in real STORY, GAME, CHARACTER, HERO outputs', () => {
    for (const gen of GENERATORS) {
      const rng = seeded(41);
      const genres = selections[0];
      for (let i = 0; i < 70; i++) {
        const result = generateResult(gen.id, {
          mode: 'genre', genres, chaos: 1, rng
        });
        const represented = usedGenres(gen.id, result, genres);
        for (const key of [genres.main, ...genres.subs]) {
          expect(represented.has(key), gen.id + '/' + key + '/' + i).toBe(true);
        }
      }
    }
  });

  it('a locked slot is preserved and is not reallocated', () => {
    const genres = selections[0];
    const slots = GENERATORS[0].slots;
    const pools = Object.fromEntries(slots.map((slot) => [slot.key, getPool('story', slot.key)]));
    const locks = { genre: true, event: true };
    const values = { genre: '하이 판타지', event: '내가 직접 만든 사건' };
    const assignments = planGenreSlots({
      generatorId: 'story', genres, slots, pools, locks, values, mode: 'genre'
    });
    expect(assignments).not.toHaveProperty('genre');
    expect(assignments).not.toHaveProperty('event');
    const result = generateResult('story', {
      genres, mode: 'genre', locks, values, chaos: 1, rng: seeded(3)
    });
    expect(result.genre).toBe('하이 판타지');
    expect(result.event).toBe('내가 직접 만든 사건');
  });

  it('high chaos reserves only one main-theme anchor, preserving wild combinations', () => {
    const gen = GENERATORS[0];
    const pools = Object.fromEntries(gen.slots.map((slot) => [slot.key, getPool(gen.id, slot.key)]));
    const base = {
      generatorId: 'story', genres: selections[0],
      slots: gen.slots, pools
    };
    expect(Object.keys(planGenreSlots({ ...base, mode: 'random', chaos: 3 }))).toHaveLength(0);
    expect(Object.keys(planGenreSlots({ ...base, mode: 'hybrid', chaos: 5 }))).toHaveLength(1);
    expect(Object.keys(planGenreSlots({ ...base, mode: 'genre', chaos: 5 })).length)
      .toBeGreaterThanOrEqual(4);
  });

  it('global mixed-genre plans produce diverse full result combinations across 120 draws', () => {
    const rng = seeded(912);
    const all = new Set();
    let previous = {};
    let recent = {};
    for (let i = 0; i < 120; i++) {
      const values = generateResult('story', {
        mode: 'genre', genres: selections[0], chaos: 2,
        rng, values: previous, recent
      });
      all.add(JSON.stringify(values));
      recent = Object.fromEntries(Object.entries(values).map(([key, value]) => [
        key, [...(recent[key] || []), value].slice(-4)
      ]));
      previous = values;
    }
    expect(all.size).toBeGreaterThan(110);
  });

  it('representative genre mixtures remain nonempty across four generators', () => {
    for (const gen of GENERATORS) {
      for (const genres of selections) {
        const values = generateResult(gen.id, {
          mode: 'hybrid', chaos: 3, genres, rng: seeded(3)
        });
        expect(gen.slots.every((slot) => typeof values[slot.key] === 'string' &&
          values[slot.key].length > 0), gen.id + '/' + genres.main).toBe(true);
      }
    }
  });
});

describe('Alpha 3 anti-repeat and weighted choice', () => {
  it('prefers unseen keyword within the chosen genre', () => {
    const pool = [
      K('이전 장르 표현', ['판']),
      K('새로운 장르 표현', ['판']),
      K('관련 없는 표현', ['공'])
    ];
    for (let i = 0; i < 30; i++) {
      const picked = pickKeyword(pool, {
        mode: 'genre', generatorId: 'story', genres: { main: '판', subs: [] },
        exclude: ['이전 장르 표현'], rng: seeded(i)
      });
      expect(picked.t).toBe('새로운 장르 표현');
    }
  });

  it('does not escape genre constraints when all fitting keywords were recently used', () => {
    const pool = [K('유일한 맞춤', ['로']), K('무관한 표현', ['아'])];
    const picked = pickKeyword(pool, {
      mode: 'genre', generatorId: 'story',
      genres: { main: '로', subs: [] },
      exclude: ['유일한 맞춤'], rng: seeded(10)
    });
    expect(picked.t).toBe('유일한 맞춤');
  });

  it('can switch to another selected genre when one group is exhausted by recency', () => {
    const pool = [K('메인 전용', ['판']), K('서브 전용', ['로'])];
    const rng = seeded(10);
    for (let i = 0; i < 20; i++) {
      const picked = pickKeyword(pool, {
        mode: 'genre', generatorId: 'story',
        genres: { main: '판', subs: ['로'] },
        exclude: ['메인 전용'], rng
      });
      expect(picked.t).toBe('서브 전용');
    }
  });

  it('single-slot reroll respects short history while keeping a valid result', () => {
    const prev = '마력이 말라버린 왕국';
    const out = rerollSlot('story', 'setting', {
      mode: 'genre', genres: { main: '판', subs: ['로'] },
      previous: prev, recent: [prev], rng: seeded(12)
    });
    expect(out).not.toBe(prev);
    expect(getPool('story', 'setting').map((kw) => kw.t)).toContain(out);
  });

  it('unchanged random mode ignores composition but still avoids recent exact repeats', () => {
    const pool = [K('OLD', ['판']), K('NEW', ['아'])];
    const result = pickKeyword(pool, {
      mode: 'random', generatorId: 'story', genres: { main: '판', subs: ['로'] },
      exclude: ['OLD'], rng: seeded(14)
    });
    expect(result.t).toBe('NEW');
  });
});
