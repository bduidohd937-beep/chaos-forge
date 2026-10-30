/* CHAOS FORGE - 공통 생성 엔진
 * 네 생성기(STORY / GAME / CHARACTER / HERO)가 공유하는
 * 가중 랜덤 선택기와 하이브리드 모드 로직.
 *
 * 모드
 *  - genre   : 장르 맞춤 (장르 태그/호환 태그 매칭만 허용)
 *  - random  : 완전 랜덤 (태그 무시, 가중치만 적용)
 *  - hybrid  : 혼합 (혼돈 레벨 1~5로 장르 외 키워드 출현 확률 조절)
 *
 * 혼돈 레벨 p_out = (chaos - 1) / 4 * 0.9
 *  - 1레벨: 0.000 (장르 일치만)
 *  - 3레벨: 0.450
 *  - 5레벨: 0.900 (거의 무작위)
 */

import { STORY_GENRES, GAME_GENRES, GENRE_NAME_MAP, K } from './data/genres.js';
import { DATA_STORY } from './data/story.js';
import { DATA_GAME } from './data/game.js';
import { DATA_CHARACTER } from './data/character.js';
import { DATA_HERO } from './data/hero.js';
import { ALPHA3_KEYWORDS } from './data/alpha3.js';
import { ALPHA5_LIBRARY } from './data/alpha5.js';
import { allowedKeywords, dnaWeight, renderedText, normalizeDNA, isExactBanned, isBanned } from './creativeDNA.js';
import { ALL_GENRES, normalizeGenreSelection, pickWithGenreMix } from './genreMix.js';
import { planGenreSlots } from './composition.js';
import { preferFreshKeywords } from './quality.js';

export { GENRE_NAME_MAP, STORY_GENRES, GAME_GENRES, ALL_GENRES, normalizeGenreSelection, planGenreSlots };

export const MODES = [
  { k: 'genre', n: '장르 맞춤' },
  { k: 'random', n: '완전 랜덤' },
  { k: 'hybrid', n: '하이브리드' }
];

export const GENERATORS = [
  {
    id: 'story',
    tab: 'STORY',
    title: '소설 생성기',
    desc: '소설의 뼈대를 한 번에',
    genreList: STORY_GENRES,
    data: DATA_STORY,
    slots: [
      { key: 'genre', label: '장르' },
      { key: 'setting', label: '배경' },
      { key: 'protagonist', label: '주인공' },
      { key: 'event', label: '핵심 사건' },
      { key: 'conflict', label: '갈등' },
      { key: 'twist', label: '반전' },
      { key: 'mood', label: '분위기' },
      { key: 'ending', label: '결말' }
    ]
  },
  {
    id: 'game',
    tab: 'GAME',
    title: '게임 생성기',
    desc: '게임 기획서의 출발점',
    genreList: GAME_GENRES,
    data: DATA_GAME,
    slots: [
      { key: 'genre', label: '게임 장르' },
      { key: 'gameplay', label: '플레이 방식' },
      { key: 'mechanic', label: '핵심 메커니즘' },
      { key: 'growth', label: '성장 시스템' },
      { key: 'special', label: '특수 규칙' },
      { key: 'enemy', label: '적 유형' },
      { key: 'victory', label: '승리 조건' },
      { key: 'art', label: '아트 스타일' }
    ]
  },
  {
    id: 'character',
    tab: 'CHARACTER',
    title: '인물 생성기',
    desc: '설정으로 끝나지 않는 사람',
    genreList: STORY_GENRES,
    data: DATA_CHARACTER,
    slots: [
      { key: 'job', label: '직업' },
      { key: 'personality', label: '성격' },
      { key: 'desire', label: '욕망' },
      { key: 'past', label: '과거' },
      { key: 'secret', label: '비밀' },
      { key: 'belief', label: '신념' },
      { key: 'relationship', label: '인간관계' },
      { key: 'inner', label: '내적 갈등' },
      { key: 'growth', label: '성장 방향' }
    ]
  },
  {
    id: 'hero',
    tab: 'HERO',
    title: '영웅 생성기',
    desc: '전투 스펙부터 약점까지',
    genreList: GAME_GENRES,
    data: DATA_HERO,
    slots: [
      { key: 'race', label: '종족' },
      { key: 'class', label: '직업' },
      { key: 'weapon', label: '무기' },
      { key: 'element', label: '속성' },
      { key: 'role', label: '전투 역할' },
      { key: 'active', label: '액티브 스킬' },
      { key: 'passive', label: '패시브 스킬' },
      { key: 'ultimate', label: '궁극기' },
      { key: 'weakness', label: '약점' }
    ]
  }
];

export const GENERATOR_MAP = Object.fromEntries(GENERATORS.map((g) => [g.id, g]));

/** 혼돈 레벨(1~5) → 장르 외 키워드 출현 확률 */
export function chaosOutProbability(chaos) {
  const c = Math.max(1, Math.min(5, Number(chaos) || 1));
  return ((c - 1) / 4) * 0.9;
}

/** 가중 랜덤 선택. weightFn이 없으면 키워드 가중치를 그대로 쓴다. */
export function weightedPick(pool, weightFn, rng = Math.random) {
  if (!pool || pool.length === 0) return null;
  const weightOf = weightFn || ((kw) => kw.w);
  let total = 0;
  for (const kw of pool) {
    const w = weightOf(kw);
    if (w > 0) total += w;
  }
  if (total <= 0) return pool[Math.floor(rng() * pool.length)];

  let roll = rng() * total;
  for (const kw of pool) {
    const w = weightOf(kw);
    if (w <= 0) continue;
    roll -= w;
    if (roll <= 0) return kw;
  }
  return pool[pool.length - 1];
}

/** 강한 장르 태그 일치 여부 */
export function hasGenreTag(keyword, genreKey) {
  return keyword.g.includes(genreKey);
}

/** 호환 태그까지 포함한 일치 여부 */
export function isGenreFit(keyword, genreKey) {
  return keyword.g.includes(genreKey) || keyword.c.includes(genreKey);
}

/** 하이브리드에서 장르 외(아웃그룹)로 분류되는가 */
export function isOutOfGenre(keyword, genreKey) {
  return !isGenreFit(keyword, genreKey);
}

/**
 * 키워드 풀에서 항목 하나를 고른다.
 * @param {Array} pool K() 항목 배열
 * @param {{mode?: string, genre?: string, chaos?: number, rng?: () => number}} opts
 */
export function pickKeyword(inputPool, opts = {}) {
  if (!inputPool || inputPool.length === 0) return null;
  // The strict BAN filter comes BEFORE genre weighting, all fallbacks,
  // and even before random mode. No hidden escape to banned keywords.
  const pool = opts.dna ? allowedKeywords(inputPool, opts.dna).map(kw => ({
    ...kw,
    w: (Number(kw.w)>0?kw.w:1) * dnaWeight(kw, opts.dna, opts)
  })) : inputPool;
  if (!pool.length) return null;
  const mode = opts.mode || 'hybrid';
  const genre = opts.genre || '';
  const rng = typeof opts.rng === 'function' ? opts.rng : Math.random;

  if (opts.genres && opts.generatorId) {
    return pickWithGenreMix(pool, {
      generatorId: opts.generatorId,
      genres: opts.genres,
      mode,
      chaos: opts.chaos,
      rng,
      weightedPick,
      chaosOutProbability,
      preferredGenre: opts.preferredGenre,
      exclude: opts.exclude
    });
  }

  // Legacy single-genre calls still support recency exclusions, but never
  // let exclusions make a previously valid genre run out of matching values.
  const withoutRecent = (items) => preferFreshKeywords(items, opts.exclude);

  if (mode === 'random' || !genre) {
    return weightedPick(withoutRecent(pool), null, rng);
  }

  const fit = [];
  const out = [];
  for (const kw of pool) {
    if (isGenreFit(kw, genre)) fit.push(kw);
    else out.push(kw);
  }

  if (mode === 'genre') {
    // 커스텀 키워드처럼 일치 풀이 비면 전체 풀로 폴백
    if (fit.length === 0) return weightedPick(withoutRecent(pool), null, rng);
    return weightedPick(withoutRecent(fit), (kw) => kw.w * (hasGenreTag(kw, genre) ? 1.6 : 0.9), rng);
  }

  // hybrid
  const pOut = chaosOutProbability(opts.chaos);
  if (out.length > 0 && rng() < pOut) {
    return weightedPick(withoutRecent(out), null, rng);
  }
  if (fit.length === 0) return weightedPick(withoutRecent(pool), null, rng);
  return weightedPick(withoutRecent(fit), (kw) => kw.w * (hasGenreTag(kw, genre) ? 1.6 : 0.9), rng);
}

/** 커스텀 키워드를 붙인 실제 풀 */
export function getPool(generatorId, slotKey, customKeywords = []) {
  const gen = GENERATOR_MAP[generatorId];
  if (!gen) return [];
  const base = [
    ...(gen.data[slotKey] || []),
    ...(ALPHA3_KEYWORDS[generatorId]?.[slotKey] || []),
    ...(ALPHA5_LIBRARY[generatorId]?.[slotKey] || [])
  ];
  for (const item of customKeywords) {
    if (item.generator === generatorId && item.slot === slotKey) {
      base.push(K(item.text, item.genres || [], item.genres || [], item.weight || 1));
    }
  }
  return base;
}

/** 해당 생성기에서 유효한 장르 키를 보장한다 */
export function normalizeGenre(generatorId, genreKey) {
  const gen = GENERATOR_MAP[generatorId];
  if (!gen) return '';
  const { genreList } = gen;
  if (genreList.some((g) => g.k === genreKey)) return genreKey;
  return genreList.length ? genreList[0].k : '';
}

/**
 * 전체 생성.
 * - locks[slotKey] === true 이면 values[slotKey] 값을 그대로 유지한다(빈 값 포함).
 * - 그 외 항목은 장르/모드/혼돈 규칙에 따라 새로 뽑는다.
 */
export function generateResult(generatorId, opts = {}) {
  const gen = GENERATOR_MAP[generatorId];
  if (!gen) return {};
  const locks = opts.locks || {};
  const values = opts.values || {};
  const recent = opts.recent || {};
  const result = {};
  const pools = Object.fromEntries(gen.slots.map((slot) => {
    const whole = getPool(generatorId, slot.key, opts.custom);
    return [slot.key, opts.dna ? allowedKeywords(whole, opts.dna) : whole];
  }));
  const assignments = opts.genres
    ? planGenreSlots({
      generatorId,
      genres: opts.genres,
      mode: opts.mode,
      chaos: opts.chaos,
      slots: gen.slots,
      pools,
      locks,
      values
    })
    : {};

  for (const slot of gen.slots) {
    if (locks[slot.key]) {
      result[slot.key] = typeof values[slot.key] === 'string' ? values[slot.key] : '';
      continue;
    }

    // Prefer a new result over recent outcomes, but never discard the only
    // genre-fitting candidate just to avoid a repeat.
    const exclude = [
      ...(Array.isArray(recent[slot.key]) ? recent[slot.key].slice(-4) : []),
      values[slot.key],
      ...Object.values(result)
    ];
    const kw = pickKeyword(pools[slot.key], {
      ...opts,
      generatorId,
      preferredGenre: assignments[slot.key],
      exclude,
      previousTopics: opts.previousTopics || []
    });
    // If user excludes EVERYTHING, do not generate anything banned, and
    // never erase the previous result silently.
    result[slot.key] = kw
      ? (opts.dna ? renderedText(kw, opts.dna) : kw.t)
      : (typeof values[slot.key] === 'string' ? values[slot.key] : '');
  }
  return result;
}

/** 항목별 재추첨 */
export function rerollSlot(generatorId, slotKey, opts = {}) {
  const pool = getPool(generatorId, slotKey, opts.custom);
  const exclude = [
    ...(Array.isArray(opts.recent) ? opts.recent.slice(-4) : []),
    opts.previous
  ];
  const kw = pickKeyword(pool, { ...opts, generatorId, exclude });
  return kw ? (opts.dna ? renderedText(kw, opts.dna) : kw.t) : (opts.previous || '');
}

/** Preview counts and strict BAN shortages without altering any saved results. */
export function auditDNACoverage(generatorId, dna, custom = [], locks = {}, values = {}) {
  const gen = GENERATOR_MAP[generatorId];
  if (!gen) return { empty: [], blockedLocked: [], available: 0 };
  const d = normalizeDNA(dna);
  const empty = [], blockedLocked = [];
  let available = 0;
  for (const slot of gen.slots) {
    const pool = getPool(generatorId,slot.key,custom);
    const allowed = allowedKeywords(pool,d);
    available += allowed.length;
    if (!locks[slot.key] && !allowed.length) empty.push(slot.label);
    if (locks[slot.key] && typeof values[slot.key] === 'string' && values[slot.key].trim()) {
      const matched=pool.find(kw => Object.values(kw.forms||{}).includes(values[slot.key]) || kw.t===values[slot.key]);
      // User-written values may not have a registered keyword record. Alias
      // matching is best-effort and still reports a visible conflict.
      const checked=matched || {t:values[slot.key]};
      if (isExactBanned(checked,d) || (d.banMode==='hard' && isBanned(checked,d))) {
        blockedLocked.push(slot.label);
      }
    }
  }
  return { empty, blockedLocked, available };
}
