/** Deterministic, offline affinity helpers for V2.14 Smart Synergy. */
export const SYNERGY_LEVELS = [
  { k: 'free', n: '자유', desc: '예측 불가능한 조합을 우선합니다.' },
  { k: 'balanced', n: '균형', desc: '앵커와 어울리되 새로운 변주를 남깁니다.' },
  { k: 'high', n: '높음', desc: '핵심 소재 중심으로 강하게 연결합니다.' }
];

const ROLE_TAGS = {
  story: { setting:['world','place'], protagonist:['character','agency'], event:['action','change'], conflict:['tension','opposition'], twist:['reveal','secret'], ending:['resolution','choice'] },
  game: { gameplay:['loop','choice','cooperation'], mechanic:['action','combat','rule'], growth:['progression','reward'], special:['risk','rule'], enemy:['threat','combat'], victory:['goal','choice'], art:['mood','world'] },
  character: { job:['identity','role'], personality:['character'], desire:['motivation','goal'], past:['history'], secret:['secret','reveal'], belief:['value'], relationship:['bond','conflict'], inner:['conflict'], growth:['change','progression'] },
  hero: { race:['identity'], class:['role'], weapon:['combat'], element:['affinity'], role:['role','team'], active:['combat','action'], passive:['rule','synergy'], ultimate:['combat','risk'], weakness:['risk','counter'] }
};

const words = (text) => String(text || '').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(/\s+/).filter(Boolean);
const grams = (text) => { const s = String(text || '').replace(/\s+/g, ''); const out = new Set(); for (let i=0;i<s.length-1;i++) out.add(s.slice(i,i+2)); return out; };
export function textSimilarity(a, b) {
  if (!a || !b) return 0;
  const aw = new Set(words(a)), bw = new Set(words(b));
  const common = [...aw].filter(x => bw.has(x)).length;
  const ag = grams(a), bg = grams(b);
  const gcommon = [...ag].filter(x => bg.has(x)).length;
  return Math.min(1, common / Math.max(1, Math.min(aw.size, bw.size)) * .65 + gcommon / Math.max(1, Math.min(ag.size, bg.size)) * .35);
}

export function synergyScore(keyword, { generatorId, slotKey, anchors = [], genre = '' } = {}) {
  if (!keyword) return 0;
  const roleTags = ROLE_TAGS[generatorId]?.[slotKey] || [];
  const kwTags = new Set([...(keyword.g || []), ...(keyword.c || []), ...(keyword.tags || [])]);
  let score = roleTags.filter(tag => kwTags.has(tag)).length * 0.12;
  for (const anchor of anchors) {
    const anchorTags = new Set([...(anchor.g || []), ...(anchor.c || []), ...(anchor.tags || [])]);
    const overlap = [...anchorTags].filter(tag => kwTags.has(tag)).length;
    score += Math.min(.34, overlap * .11);
    score += Math.min(.26, textSimilarity(keyword.t, anchor.t) * .26);
  }
  if (genre && (keyword.g || []).includes(genre)) score += .08;
  return Math.min(1, score);
}

export function synergyWeight(keyword, opts = {}) {
  if (opts.synergy === 'free' || !opts.synergy) return keyword?.w || 1;
  const score = synergyScore(keyword, opts);
  const strength = opts.synergy === 'high' ? 2.8 : 1.35;
  return (keyword?.w || 1) * (1 + score * strength);
}

export function isMeaningfullyDuplicate(keyword, selected = [], threshold = .62) {
  return selected.some(item => textSimilarity(keyword?.t, item?.t || item) >= threshold);
}
