import { describe, expect, it } from 'vitest';
import { K } from '../src/data/genres.js';
import { GENERATORS, generateResult, pickKeyword } from '../src/engine.js';
import {
  normalizeIdeaText, isNearRepeat, isRecentKeyword, preferFreshKeywords,
  auditRepeatedSlots
} from '../src/quality.js';

function seeded(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

describe('UX 2.8 conservative generation quality guard', () => {
  it('normalizes cosmetic punctuation and space differences', () => {
    expect(normalizeIdeaText('  하늘의  성채! ')).toBe(normalizeIdeaText('하늘의 성채'));
    expect(isNearRepeat('시간이 멈춘 마지막 왕국', '시간이 멈춘 마지막 왕국!')).toBe(true);
    expect(isNearRepeat('', '')).toBe(false);
  });

  it('suppresses trivial endings, but does not merge genuinely different concepts', () => {
    expect(isNearRepeat('마지막 왕국을 지키는 기사', '마지막 왕국을 지키는 기사님')).toBe(true);
    expect(isNearRepeat('왕국을 구원하는 용', '왕국을 파괴하는 용')).toBe(false);
    expect(isNearRepeat('기사', '기사단')).toBe(false);
  });

  it('checks short, balanced and detailed keyword variants against visible history', () => {
    const keyword = {
      ...K('다른 제목', ['판']),
      forms: {
        brief: '여행자',
        balanced: '시간이 멈춘 도시의 방문객',
        detailed: '도시 전체가 멈춘 순간에 나타난 유일한 방문객'
      }
    };
    expect(isRecentKeyword(keyword, ['시간이 멈춘 도시의 방문객!'])).toBe(true);
    expect(preferFreshKeywords([keyword, K('고대의 바다를 건너는 항해사', ['판'])],
      ['시간이 멈춘 도시의 방문객'])).toHaveLength(1);
  });

  it('uses the same freshness rule in legacy genre-only calls', () => {
    const first = {
      ...K('다른 제목', ['판']),
      forms: { detailed: '시간이 멈춘 마지막 왕국의 기록자' }
    };
    const pool = [first, K('고대 바다를 항해하는 정찰병', ['판'])];
    const picked = pickKeyword(pool, {
      mode: 'genre', genre: '판',
      exclude: ['시간이 멈춘 마지막 왕국의 기록자'],
      rng: () => 0
    });
    expect(picked.t).toBe('고대 바다를 항해하는 정찰병');
  });

  it('avoids near-identical variants in the multi-genre path', () => {
    const pool = [
      K('마지막 왕국을 지키는 기사', ['판']),
      K('마지막 왕국을 지키는 기사님', ['판']),
      K('안개 도서관에서 온 조사관', ['판']),
      K('적막한 우주 연구기지', ['SF'])
    ];
    for (let i = 0; i < 20; i++) {
      const picked = pickKeyword(pool, {
        generatorId: 'story', mode: 'genre',
        genres: { main: '판', subs: [] },
        exclude: ['마지막 왕국을 지키는 기사'], rng: seeded(i)
      });
      expect(picked.t).toBe('안개 도서관에서 온 조사관');
    }
  });

  it('retains the fitting candidate when all alternatives were seen recently', () => {
    const pool = [K('마지막 왕국을 지키는 기사', ['판']), K('우주 탐사선', ['SF'])];
    const picked = pickKeyword(pool, {
      generatorId: 'story', mode: 'genre',
      genres: { main: '판', subs: [] },
      exclude: ['마지막 왕국을 지키는 기사']
    });
    expect(picked.t).toBe('마지막 왕국을 지키는 기사');
  });

  it('does not bypass hard bans to chase novelty', () => {
    const pool = [K('좀비 군단', ['판']), K('고요한 숲의 수호자', ['판'])];
    const picked = pickKeyword(pool, {
      generatorId: 'story', mode: 'genre',
      genres: { main: '판', subs: [] },
      dna: { bannedTopics: ['undead'] },
      exclude: ['고요한 숲의 수호자']
    });
    expect(picked.t).toBe('고요한 숲의 수호자');
  });

  it('reports similar slot pairs without changing the source values', () => {
    const values = { event: '마지막 왕국을 지키는 기사', twist: '마지막 왕국을 지키는 기사님',
      ending: '모든 증거가 사라진다' };
    const snapshot = JSON.stringify(values);
    expect(auditRepeatedSlots(values)).toEqual([['event', 'twist']]);
    expect(JSON.stringify(values)).toBe(snapshot);
  });

  it('keeps 4 generators populated and diverse across seeded quality sweeps', () => {
    for (const generator of GENERATORS) {
      const rng = seeded(2800);
      const signatures = new Set();
      let previous = {};
      let recent = {};
      for (let i = 0; i < 80; i++) {
        const output = generateResult(generator.id, {
          mode: 'genre', genres: { main: '판', subs: ['미', '로'] },
          chaos: 2, rng, values: previous, recent
        });
        expect(generator.slots.every(({ key }) => typeof output[key] === 'string'
          && output[key].length > 0)).toBe(true);
        signatures.add(JSON.stringify(output));
        recent = Object.fromEntries(Object.entries(output).map(([key, value]) =>
          [key, [...(recent[key] || []), value].slice(-4)]));
        previous = output;
      }
      expect(signatures.size, generator.id).toBeGreaterThanOrEqual(76);
    }
  });
});
