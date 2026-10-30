import { describe, it, expect } from 'vitest';
import {
  ALL_GENRES, GENERATORS, pickKeyword, rerollSlot, generateResult,
  normalizeGenreSelection
} from '../src/engine.js';
import { genreAffinity, mappedGenreKeys } from '../src/genreMix.js';
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

describe('V2.0 자유 장르 설정', () => {
  it('STORY 17개와 GAME 8개가 중복 없이 통합된다', () => {
    expect(ALL_GENRES).toHaveLength(25);
    expect(new Set(ALL_GENRES.map(g => g.k)).size).toBe(25);
    expect(ALL_GENRES.map(g => g.k)).toContain('판');
    expect(ALL_GENRES.map(g => g.k)).toContain('RPG');
  });

  it('메인 하나, 서브 최대 셋, 중복·잘못된 키를 정규화한다', () => {
    expect(normalizeGenreSelection('story', {
      main: '판', subs: ['로', '미', '코', '공', '로', '판', 'invalid']
    })).toEqual({ main: '판', subs: ['로', '미', '코'] });
    expect(normalizeGenreSelection('game', { main: 'what', subs: ['미'] }))
      .toEqual({ main: 'RPG', subs: ['미'] });
    expect(normalizeGenreSelection('story', null)).toEqual({ main: '판', subs: [] });
  });

  it('메인 장르 55%, 서브 45%의 초기 추첨 비중이 실제로 반영된다', () => {
    const pool = [K('판타지', ['판']), K('로맨스', ['로'])];
    const rng = seeded(41);
    let main = 0;
    for (let i = 0; i < 4000; i++) {
      const kw = pickKeyword(pool, {
        mode: 'genre', generatorId: 'story',
        genres: { main: '판', subs: ['로'] }, rng
      });
      if (kw.t === '판타지') main++;
    }
    expect(main).toBeGreaterThan(2000);
    expect(main).toBeLessThan(2400);
  });

  it('혼돈 1은 선택 장르만, 혼돈 5는 무관 키워드를 높은 비중으로 허용한다', () => {
    const pool = [
      K('선택 메인', ['판']), K('선택 서브', ['로']),
      K('이질 1', ['공']), K('이질 2', ['SF'])
    ];
    const opts = { mode: 'hybrid', generatorId: 'story', genres: { main: '판', subs: ['로'] } };
    const rngA = seeded(88);
    for (let i = 0; i < 300; i++) {
      expect(['선택 메인', '선택 서브'])
        .toContain(pickKeyword(pool, { ...opts, chaos: 1, rng: rngA }).t);
    }
    const rngB = seeded(88);
    let outside = 0;
    for (let i = 0; i < 1500; i++) {
      if (pickKeyword(pool, { ...opts, chaos: 5, rng: rngB }).t.startsWith('이질')) outside++;
    }
    expect(outside).toBeGreaterThan(1200);
  });

  it('게임 키워드가 소설 장르 선택에 반응하도록 호환 태그를 적용한다', () => {
    expect(mappedGenreKeys('hero', '로')).toContain('시뮬');
    expect(mappedGenreKeys('story', 'RPG')).toContain('판');
    const gameKeyword = K('시뮬레이션 콘텐츠', ['시뮬']);
    expect(genreAffinity(gameKeyword, 'game', '로')).toBeGreaterThan(0);
    expect(genreAffinity(gameKeyword, 'game', '공')).toBe(0);
  });

  it('장르 맞춤 모드에서 적합 항목이 있으면 이질 키워드를 고르지 않는다', () => {
    const pool = [K('맞춤', ['판']), K('이질', ['공'])];
    const rng = seeded(9);
    for (let i = 0; i < 200; i++) {
      expect(pickKeyword(pool, {
        generatorId: 'story', mode: 'genre',
        genres: { main: '판', subs: [] }, rng
      }).t).toBe('맞춤');
    }
  });

  it('태그가 전혀 없는 소수 풀에도 빈 값을 만들지 않는다', () => {
    const kw = pickKeyword([K('사용자 정의', [])], {
      generatorId: 'story', mode: 'genre',
      genres: { main: 'SF', subs: ['RPG'] }
    });
    expect(kw.t).toBe('사용자 정의');
  });

  it('모든 생성기에서 다장르 결과가 완성되고 잠금이 유지된다', () => {
    for (const g of GENERATORS) {
      const options = {
        mode: 'hybrid', chaos: 3, genre: '판',
        genres: { main: '판', subs: ['로', '미', 'RPG'] }
      };
      const generated = generateResult(g.id, options);
      expect(Object.keys(generated)).toHaveLength(g.slots.length);
      expect(g.slots.every(slot => generated[slot.key])).toBe(true);
      const key = g.slots[0].key;
      const after = generateResult(g.id, {
        ...options, values: generated, locks: { [key]: true }
      });
      expect(after[key]).toBe(generated[key]);
    }
  });

  it('개별 재추첨은 가능한 경우 직전 키워드를 제외한다', () => {
    const first = rerollSlot('story', 'setting', { mode: 'genre', genres: { main: '판', subs: [] } });
    for (let i = 0; i < 40; i++) {
      const second = rerollSlot('story', 'setting', {
        mode: 'genre', genres: { main: '판', subs: [] }, previous: first
      });
      expect(second).not.toBe(first);
    }
  });
});
