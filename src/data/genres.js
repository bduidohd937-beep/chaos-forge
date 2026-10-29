/* CHAOS FORGE - 장르 정의 및 키워드 생성 헬퍼
 * 각 키워드는 [텍스트, 장르태그[], 호환태그[], 가중치] 구조로 정의한다.
 * 장르태그(g): 이 키워드가 "그 장르스러운" 지표
 * 호환태그(c): 다른 장르와도 자연스럽게 어울리는 지표
 * 가중치(w): 높을수록 자주 등장 (기본 1)
 */

export const STORY_GENRES = [
  { k: '판', n: '판타지' },
  { k: '현', n: '현대 판타지' },
  { k: '무', n: '무협' },
  { k: 'SF', n: 'SF' },
  { k: '사이', n: '사이버펑크' },
  { k: '스팀', n: '스팀펑크' },
  { k: '로', n: '로맨스' },
  { k: '코', n: '코미디' },
  { k: '공', n: '공포' },
  { k: '미', n: '미스터리' },
  { k: '스', n: '스릴러' },
  { k: '밀', n: '밀리터리' },
  { k: '아', n: '아포칼립스' },
  { k: '일', n: '일상' },
  { k: '학', n: '학원' },
  { k: '사', n: '역사' },
  { k: '신', n: '신화' }
];

export const GAME_GENRES = [
  { k: 'RPG', n: 'RPG' },
  { k: '로그', n: '로그라이크' },
  { k: '디펜', n: '디펜스' },
  { k: '전략', n: '전략' },
  { k: '액션', n: '액션' },
  { k: '시뮬', n: '시뮬레이션' },
  { k: '생존', n: '생존' },
  { k: '퍼즐', n: '퍼즐' }
];

export const GENRE_NAME_MAP = {};
for (const genre of [...STORY_GENRES, ...GAME_GENRES]) {
  GENRE_NAME_MAP[genre.k] = genre.n;
}

/** 키워드 항목 생성 헬퍼 */
export function K(text, genres, compat, weight) {
  return {
    t: text,
    g: genres || [],
    c: compat || [],
    w: typeof weight === 'number' ? weight : 1
  };
}
