/**
 * CHAOS FORGE V2 — 자유 장르 조합의 데이터 모델.
 *
 * 구형 STORY/GAME 키워드에는 각각 다른 장르 태그 체계가 존재한다.
 * 선택기는 통합 목록을 보여 주되, 미태깅 장르는 명시적 호환 테이블로 연결한다.
 * 신규 키워드는 통합 장르 키를 직접 부착할 수 있다.
 */
import { STORY_GENRES, GAME_GENRES } from './data/genres.js';

export const ALL_GENRES = [...STORY_GENRES, ...GAME_GENRES];
export const ALL_GENRE_KEYS = new Set(ALL_GENRES.map((g) => g.k));

const STORY_FOR_GAME = {
  RPG: ['판', '현', '무', '신'], '로그': ['아', '미', '공'],
  '디펜': ['밀', '아', '판'], '전략': ['밀', '사', '미'],
  '액션': ['판', '무', '밀'], '시뮬': ['일', '현', '로'],
  '생존': ['아', '공', '일'], '퍼즐': ['미', '스', 'SF']
};
const GAME_FOR_STORY = {
  '판': ['RPG', '전략'], '현': ['RPG', '시뮬'], '무': ['액션', 'RPG'],
  'SF': ['RPG', '전략'], '사이': ['전략', 'RPG'], '스팀': ['RPG', '시뮬'],
  '로': ['시뮬', 'RPG'], '코': ['시뮬', '퍼즐'],
  '공': ['생존', '로그'], '미': ['퍼즐', '전략'],
  '스': ['생존', '로그'], '밀': ['전략', '액션'],
  '아': ['생존', '디펜'], '일': ['시뮬'],
  '학': ['시뮬', 'RPG'], '사': ['전략', '시뮬'], '신': ['RPG']
};

export function normalizeGenreSelection(generatorId, selection) {
  const game = generatorId === 'game' || generatorId === 'hero';
  const fallback = game ? 'RPG' : '판';
  const input = selection && typeof selection === 'object' ? selection : {};
  const main = ALL_GENRE_KEYS.has(input.main) ? input.main : fallback;
  const subs = Array.isArray(input.subs) ? input.subs : [];
  return {
    main,
    subs: [...new Set(subs.filter((key) => ALL_GENRE_KEYS.has(key) && key !== main))].slice(0, 3)
  };
}

export function mappedGenreKeys(generatorId, selectedGenre) {
  const game = generatorId === 'game' || generatorId === 'hero';
  return game
    ? (GAME_FOR_STORY[selectedGenre] || [])
    : (STORY_FOR_GAME[selectedGenre] || []);
}

/**
 * 0 = 무관, 0.55 = 구형 데이터 호환, 0.9 = 호환 태그, 1.6 = 직접 장르 태그
 * 직접 연결된 장르가 호환 사전보다 우선한다.
 */
export function genreAffinity(keyword, generatorId, selectedGenre) {
  const tags = Array.isArray(keyword?.g) ? keyword.g : [];
  const compat = Array.isArray(keyword?.c) ? keyword.c : [];
  if (tags.includes(selectedGenre)) return 1.6;
  if (compat.includes(selectedGenre)) return 0.9;
  const fallbackTags = mappedGenreKeys(generatorId, selectedGenre);
  if (fallbackTags.some((key) => tags.includes(key))) return 0.55;
  if (fallbackTags.some((key) => compat.includes(key))) return 0.35;
  return 0;
}

/**
 * 선택 장르군에서 메인 55%, 서브 합계 45%를 기준으로 뽑는다.
 * 특정 슬롯에 해당 장르 키워드가 없으면 나머지 선택 장르로 폴백한다.
 * 모두 없다면 원본 풀로 돌아간다. 필터 실패로 빈 결과는 만들지 않는다.
 * @param {Function} weightedPick 엔진의 가중치 추첨 함수
 */
export function pickWithGenreMix(pool, {
  generatorId,
  genres,
  mode = 'hybrid',
  chaos = 3,
  rng = Math.random,
  weightedPick,
  chaosOutProbability
}) {
  if (!pool?.length) return null;
  if (mode === 'random') return weightedPick(pool, null, rng);
  const { main, subs } = normalizeGenreSelection(generatorId, genres);
  const selected = [main, ...subs];
  const affinity = (kw, genre) => genreAffinity(kw, generatorId, genre);
  const unionFit = pool.filter((kw) => selected.some((g) => affinity(kw, g) > 0));
  const outside = pool.filter((kw) => selected.every((g) => affinity(kw, g) === 0));

  if (mode === 'hybrid' && outside.length &&
      rng() < chaosOutProbability(chaos)) {
    return weightedPick(outside, null, rng);
  }

  if (!unionFit.length) return weightedPick(pool, null, rng);

  const candidates = selected
    .map((g, idx) => ({
      genre: g,
      priority: idx === 0 ? 0.55 : 0.45 / subs.length,
      options: pool.filter((kw) => affinity(kw, g) > 0)
    }))
    .filter(({ options }) => options.length > 0);
  const group = weightedPick(
    candidates,
    ({ priority }) => priority,
    rng
  );
  return weightedPick(
    group.options,
    (kw) => (Number(kw.w) > 0 ? kw.w : 1) * affinity(kw, group.genre),
    rng
  );
}
