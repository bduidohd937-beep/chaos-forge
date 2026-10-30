import { describe, it, expect, beforeEach } from 'vitest';
import {
  GENERATORS,
  GENERATOR_MAP,
  STORY_GENRES,
  GAME_GENRES,
  chaosOutProbability,
  weightedPick,
  isGenreFit,
  pickKeyword,
  getPool,
  normalizeGenre,
  generateResult,
  rerollSlot
} from '../src/engine.js';
import { K } from '../src/data/genres.js';
import { DATA_STORY } from '../src/data/story.js';
import Storage from '../src/storage.js';

const allPools = () =>
  GENERATORS.flatMap((gen) => gen.slots.map((slot) => ({ gen, slot, pool: gen.data[slot.key] })));

/** 재현 가능한 난수 (mulberry32) */
function seeded(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

describe('키워드 데이터', () => {
  it('총 500개 이상의 키워드를 가진다', () => {
    const total = allPools().reduce((sum, p) => sum + p.pool.length, 0);
    expect(total).toBeGreaterThanOrEqual(500);
  });

  it('생성기 4종이 모두 충분한 슬롯을 가진다', () => {
    expect(GENERATORS).toHaveLength(4);
    const expected = { story: 8, game: 8, character: 9, hero: 9 };
    for (const gen of GENERATORS) {
      expect(gen.slots).toHaveLength(expected[gen.id]);
      for (const slot of gen.slots) {
        expect(gen.data[slot.key].length).toBeGreaterThanOrEqual(10);
      }
    }
  });

  it('슬롯 안에서 키워드가 중복되지 않는다', () => {
    for (const { gen, slot, pool } of allPools()) {
      const texts = pool.map((kw) => kw.t);
      expect(new Set(texts).size, `${gen.id}.${slot.key}`).toBe(texts.length);
    }
  });

  it('모든 장르/호환 태그가 정의된 장르이고 가중치가 유효하다', () => {
    const valid = new Set([...STORY_GENRES, ...GAME_GENRES].map((g) => g.k));
    for (const { pool } of allPools()) {
      for (const kw of pool) {
        for (const tag of [...kw.g, ...kw.c]) expect(valid.has(tag), `${kw.t} → ${tag}`).toBe(true);
        expect(kw.g.length).toBeGreaterThan(0);
        expect(kw.w).toBeGreaterThan(0);
      }
    }
  });

  it('생성기별 장르 목록이 알맞게 배정된다', () => {
    expect(GENERATOR_MAP.story.genreList).toBe(STORY_GENRES);
    expect(GENERATOR_MAP.character.genreList).toBe(STORY_GENRES);
    expect(GENERATOR_MAP.game.genreList).toBe(GAME_GENRES);
    expect(GENERATOR_MAP.hero.genreList).toBe(GAME_GENRES);
  });
});

describe('혼돈 / 모드 선택', () => {
  it('혼돈 확률이 0~0.9 범위에서 단조 증가한다', () => {
    let prev = -1;
    for (let chaos = 1; chaos <= 5; chaos++) {
      const p = chaosOutProbability(chaos);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(0.9);
      expect(p).toBeGreaterThan(prev);
      prev = p;
    }
    expect(chaosOutProbability(1)).toBe(0);
    expect(chaosOutProbability(5)).toBeCloseTo(0.9, 10);
    expect(chaosOutProbability(99)).toBeCloseTo(0.9, 10);
    expect(chaosOutProbability(0)).toBe(0);
  });

  it('가중 랜덤이 가중치를 반영한다', () => {
    const pool = [K('A', ['판'], [], 1000), K('B', ['판'], [], 1)];
    const rng = seeded(7);
    let a = 0;
    for (let i = 0; i < 300; i++) if (weightedPick(pool, null, rng).t === 'A') a++;
    expect(a).toBeGreaterThan(250);
    expect(weightedPick([], null, rng)).toBeNull();
  });

  it('장르 맞춤 모드는 장르/호환 키워드만 고른다', () => {
    const rng = seeded(42);
    for (const { gen, slot, pool } of allPools()) {
      for (const g of gen.genreList) {
        const hasFit = pool.some((kw) => isGenreFit(kw, g.k));
        if (!hasFit) continue;
        for (let i = 0; i < 40; i++) {
          const kw = pickKeyword(pool, { mode: 'genre', genre: g.k, rng });
          expect(isGenreFit(kw, g.k), `${gen.id}.${slot.key} / ${g.k} → ${kw.t}`).toBe(true);
        }
      }
    }
  });

  it('완전 랜덤 모드는 장르 제약을 무시한다', () => {
    const rng = seeded(11);
    const pool = DATA_STORY.setting;
    let outside = false;
    for (let i = 0; i < 300; i++) {
      const kw = pickKeyword(pool, { mode: 'random', genre: '판', rng });
      expect(pool).toContain(kw);
      if (!isGenreFit(kw, '판')) outside = true;
    }
    expect(outside).toBe(true);
  });

  it('혼돈 1은 장르 외 키워드를 내보내지 않는다', () => {
    const rng = seeded(5);
    for (let i = 0; i < 400; i++) {
      const kw = pickKeyword(DATA_STORY.setting, { mode: 'hybrid', genre: '판', chaos: 1, rng });
      expect(isGenreFit(kw, '판')).toBe(true);
    }
  });

  it('혼돈이 오를수록 장르 외 키워드가 늘어난다', () => {
    const counts = [];
    for (let chaos = 1; chaos <= 5; chaos++) {
      const rng = seeded(1234 + chaos);
      let out = 0;
      for (let i = 0; i < 600; i++) {
        const kw = pickKeyword(DATA_STORY.setting, { mode: 'hybrid', genre: '판', chaos, rng });
        if (!isGenreFit(kw, '판')) out++;
      }
      counts.push(out);
    }
    for (let i = 1; i < counts.length; i++) {
      expect(counts[i], JSON.stringify(counts)).toBeGreaterThan(counts[i - 1]);
    }
    expect(counts[4]).toBeGreaterThan(100);
  });

  it('장르 선택이 없으면 장르를 무시한다', () => {
    const rng = seeded(3);
    const kw = pickKeyword(DATA_STORY.setting, { mode: 'genre', genre: '', rng });
    expect(DATA_STORY.setting).toContain(kw);
  });
});

describe('전체 생성 / 잠금 / 재추첨', () => {
  it('전체 생성이 모든 슬롯을 채운다', () => {
    for (const gen of GENERATORS) {
      const result = generateResult(gen.id, {
        mode: 'hybrid',
        genre: gen.genreList[0].k,
        chaos: 3
      });
      for (const slot of gen.slots) {
        expect(typeof result[slot.key]).toBe('string');
        expect(result[slot.key].length).toBeGreaterThan(0);
      }
    }
  });

  it('잠긴 항목은 전체 생성에서 값이 유지된다', () => {
    const keys = GENERATOR_MAP.story.slots.map((s) => s.key);
    const locks = {};
    const values = {};
    keys.forEach((key, i) => {
      if (i % 2 === 0) {
        locks[key] = true;
        values[key] = `고정된 값 ${i}`;
      } else {
        values[key] = '원래 값';
      }
    });

    for (let round = 0; round < 5; round++) {
      const result = generateResult('story', {
        mode: 'hybrid',
        genre: '판',
        chaos: 5,
        locks,
        values
      });
      keys.forEach((key, i) => {
        if (i % 2 === 0) expect(result[key]).toBe(`고정된 값 ${i}`);
        else expect(result[key].length).toBeGreaterThan(0);
      });
    }
  });

  it('잠긴 빈 항목은 빈 값으로 유지된다', () => {
    const result = generateResult('story', {
      mode: 'hybrid',
      genre: '판',
      chaos: 3,
      locks: { setting: true },
      values: { setting: '' }
    });
    expect(result.setting).toBe('');
  });

  it('재추첨 결과는 항상 해당 풀 안에 있다', () => {
    for (const gen of GENERATORS) {
      for (const slot of gen.slots) {
        const text = rerollSlot(gen.id, slot.key, { mode: 'random', genre: gen.genreList[0].k });
        expect(getPool(gen.id, slot.key).map((kw) => kw.t)).toContain(text);
      }
    }
  });

  it('커스텀 키워드가 풀에 병합되고 생성에 등장한다', () => {
    const custom = [
      { id: 'x1', generator: 'story', slot: 'setting', text: '내가 만든 배경', genres: ['판'], weight: 1 }
    ];
    const pool = getPool('story', 'setting', custom);
    expect(pool).toHaveLength(getPool('story', 'setting').length + 1);
    expect(pool.map((kw) => kw.t)).toContain('내가 만든 배경');
    expect(DATA_STORY.setting.length).toBeGreaterThanOrEqual(20);

    let hit = false;
    for (let i = 0; i < 400 && !hit; i++) {
      const kw = pickKeyword(pool, { mode: 'genre', genre: '판', custom });
      if (kw.t === '내가 만든 배경') hit = true;
    }
    expect(hit).toBe(true);
  });

  it('무효 장르는 첫 장르로 되돌린다', () => {
    expect(normalizeGenre('story', '없는장르')).toBe(STORY_GENRES[0].k);
    expect(normalizeGenre('hero', '없는장르')).toBe(GAME_GENRES[0].k);
    expect(normalizeGenre('story', '무')).toBe('무');
    expect(normalizeGenre('nope', '무')).toBe('');
  });
});

describe('로컬 저장소', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('아이디어 저장/조회/검색/삭제가 왕복한다', () => {
    const rec = Storage.saveIdea({
      title: '황무지의 마법사',
      generator: 'story',
      mode: 'hybrid',
      genre: '판',
      chaos: 3,
      values: { genre: '하이 판타지', setting: '사막 유적 도시' }
    });
    expect(rec.id).toBeTruthy();
    expect(Storage.loadIdeas()).toHaveLength(1);
    expect(Storage.getIdea(rec.id).title).toBe('황무지의 마법사');

    Storage.saveIdea({
      id: rec.id,
      title: '수정된 제목',
      generator: 'story',
      values: { genre: '하이 판타지', setting: '사막 유적 도시' }
    });
    expect(Storage.loadIdeas()).toHaveLength(1);
    expect(Storage.getIdea(rec.id).title).toBe('수정된 제목');

    expect(Storage.searchIdeas('수정된').map((i) => i.id)).toContain(rec.id);
    expect(Storage.searchIdeas('사막 유적').map((i) => i.id)).toContain(rec.id);
    expect(Storage.searchIdeas('존재하지않는문구')).toHaveLength(0);
    expect(Storage.searchIdeas('')).toHaveLength(1);

    Storage.deleteIdea(rec.id);
    expect(Storage.getIdea(rec.id)).toBeNull();
    expect(Storage.loadIdeas()).toHaveLength(0);
  });

  it('사용자 키워드 추가/삭제가 동작한다', () => {
    const rec = Storage.addCustom({
      generator: 'hero',
      slot: 'weapon',
      text: '나무 망치',
      genres: ['RPG', '디펜']
    });
    expect(rec.id).toBeTruthy();
    expect(Storage.loadCustom()).toHaveLength(1);
    expect(Storage.addCustom({ generator: 'hero', slot: 'weapon', text: '   ' })).toBeNull();

    Storage.deleteCustom(rec.id);
    expect(Storage.loadCustom()).toHaveLength(0);
  });

  it('손상된 저장 데이터를 안전하게 복구한다', () => {
    localStorage.setItem('chaosforge.ideas.v1', '{oops');
    expect(Storage.loadIdeas()).toHaveLength(0);
    localStorage.setItem('chaosforge.ideas.v1', '"문자열값"');
    expect(Storage.loadIdeas()).toHaveLength(0);
    localStorage.setItem('chaosforge.custom.v1', '[]');
    expect(Storage.loadCustom()).toHaveLength(0);
  });
});


describe('V1.1 로컬 초안 및 키워드 검증', () => {
  beforeEach(() => localStorage.clear());

  it('초안은 독립된 저장 공간에서 저장 및 재조회된다', () => {
    expect(Storage.loadDraft()).toBeNull();
    expect(Storage.saveDraft({
      generatorId: 'story',
      mode: 'hybrid',
      genre: '판',
      chaos: 3,
      results: { story: { values: { setting: '나만의 세계' }, locks: { setting: true } } }
    })).toBe(true);
    expect(Storage.loadDraft().results.story.values.setting).toBe('나만의 세계');
    expect(Storage.loadIdeas()).toHaveLength(0);
  });

  it('손상되거나 호환되지 않는 초안은 무시한다', () => {
    localStorage.setItem('chaosforge.draft.v1', '{oops');
    expect(Storage.loadDraft()).toBeNull();
    localStorage.setItem('chaosforge.draft.v1', JSON.stringify({ version: 2, results: {} }));
    expect(Storage.loadDraft()).toBeNull();
  });

  it('같은 생성기·항목의 중복 키워드를 거부한다', () => {
    const entry = { generator: 'story', slot: 'setting', text: '유리 성채', genres: ['판'] };
    expect(Storage.addCustom(entry)).not.toBeNull();
    expect(Storage.addCustom({ ...entry, text: ' 유리 성채 ' })).toBeNull();
    expect(Storage.loadCustom()).toHaveLength(1);
    expect(Storage.addCustom({ ...entry, slot: 'event' })).not.toBeNull();
    expect(Storage.loadCustom()).toHaveLength(2);
  });
});
