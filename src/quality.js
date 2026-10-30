/**
 * UX 2.8 — conservative repetition guard.
 * Detects minor rewordings in the recent-history window; it deliberately
 * does NOT claim to detect story contradictions or semantic equivalence.
 * Candidate pools, hard bans, locks and genre constraints stay authoritative.
 */
export function normalizeIdeaText(value) {
  return String(value ?? '').normalize('NFKC').toLocaleLowerCase()
    .replace(/[\s.,!?'"“”‘’·:;(){}\[\]~]/g, '');
}

function pairs(text) {
  const result = new Map();
  for (let i = 0; i < text.length - 1; i++) {
    const pair = text.slice(i, i + 2);
    result.set(pair, (result.get(pair) || 0) + 1);
  }
  return result;
}

/** Similar surface forms, not genuine semantic matches. */
export function isNearRepeat(left, right) {
  const a = normalizeIdeaText(left);
  const b = normalizeIdeaText(right);
  if (!a || !b) return false;
  if (a === b) return true;
  const min = Math.min(a.length, b.length);
  const max = Math.max(a.length, b.length);
  if (min < 10 || min / max < 0.82) return false;
  if (a.includes(b) || b.includes(a)) return true;
  if (min < 12) return false;
  const pA = pairs(a), pB = pairs(b);
  let overlap = 0;
  for (const [pair, count] of pA) overlap += Math.min(count, pB.get(pair) || 0);
  return 2 * overlap / (a.length + b.length - 2) >= 0.88;
}

export function isRecentKeyword(keyword, recent = []) {
  if (!keyword || !Array.isArray(recent) || !recent.length) return false;
  const variants = [keyword.t, ...Object.values(keyword.forms || {})]
    .filter((value) => typeof value === 'string');
  return recent.some((text) => typeof text === 'string' &&
    variants.some((variant) => isNearRepeat(variant, text)));
}

/** Keep all candidates when exclusions would exhaust the eligible pool. */
export function preferFreshKeywords(pool, recent = []) {
  if (!Array.isArray(pool) || pool.length < 2) return pool;
  const fresh = pool.filter((kw) => !isRecentKeyword(kw, recent));
  return fresh.length ? fresh : pool;
}

/** Optional offline diagnostic; never edits user-saved content. */
export function auditRepeatedSlots(values = {}) {
  const entries = Object.entries(values)
    .filter(([, text]) => typeof text === 'string' && text.trim());
  const pairsFound = [];
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      if (isNearRepeat(entries[i][1], entries[j][1])) {
        pairsFound.push([entries[i][0], entries[j][0]]);
      }
    }
  }
  return pairsFound;
}
