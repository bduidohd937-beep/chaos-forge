/**
 * Alpha 3 — whole-result genre composition.
 *
 * Genre percentages in pickWithGenreMix describe per-pick probabilities.
 * Here we reserve a small number of unlocked slots to make the MAIN genre
 * visible and to represent up to three SUB genres when the keyword data allows.
 *
 * This is NOT natural-language coherence generation: it is a constrained
 * assignment over existing, manually tagged keywords. Never fabricate values.
 */
import { genreAffinity, normalizeGenreSelection } from './genreMix.js';

const ANCHORS = {
  story: ['genre', 'setting', 'protagonist'],
  game: ['genre', 'gameplay', 'mechanic'],
  character: ['job', 'desire', 'past'],
  hero: ['class', 'race', 'weapon']
};

const THEMATIC_SLOTS = {
  story: {
    '로': ['conflict', 'protagonist', 'mood', 'ending', 'event'],
    '미': ['twist', 'event', 'conflict', 'setting', 'ending'],
    '코': ['mood', 'event', 'twist', 'conflict', 'ending'],
    '공': ['setting', 'event', 'twist', 'mood', 'ending']
  },
  game: {
    '로': ['growth', 'special', 'victory', 'mechanic', 'gameplay'],
    '미': ['mechanic', 'special', 'gameplay', 'enemy', 'victory'],
    '코': ['special', 'art', 'gameplay', 'victory', 'enemy'],
    '판': ['mechanic', 'enemy', 'art', 'special', 'gameplay']
  },
  character: {
    '로': ['relationship', 'desire', 'inner', 'growth', 'past'],
    '미': ['secret', 'past', 'inner', 'relationship', 'desire'],
    '코': ['personality', 'relationship', 'inner', 'growth', 'secret']
  },
  hero: {
    '로': ['passive', 'active', 'weakness', 'ultimate', 'role'],
    '미': ['active', 'passive', 'role', 'ultimate', 'weapon'],
    '코': ['ultimate', 'weapon', 'active', 'weakness', 'role']
  }
};

function scoreSlot(generatorId, genre, slotKey, pool) {
  const fits = pool.map((kw) => genreAffinity(kw, generatorId, genre)).filter((n) => n > 0);
  if (!fits.length) return -Infinity;
  const preferred = THEMATIC_SLOTS[generatorId]?.[genre] || [];
  const rank = preferred.indexOf(slotKey);
  // Strong tags beat approximate cross-taxonomy mappings. Thematic placement
  // breaks ties, but does not override an order-of-magnitude affinity gap.
  return Math.max(...fits) * 10 +
    (rank < 0 ? 0 : (preferred.length - rank) * 0.38) +
    Math.min(fits.length, 10) * 0.03;
}

/** A matching locked value can already satisfy one or more genre commitments. */
function lockedGenreCoverage(generatorId, genres, slots, pools, locks, values) {
  const covered = new Set();
  for (const slot of slots) {
    if (!locks?.[slot.key]) continue;
    const value = values?.[slot.key];
    const kw = pools[slot.key]?.find((item) => item.t === value);
    if (!kw) continue; // Manually edited value has no reliable metadata.
    for (const genre of genres) {
      if (genreAffinity(kw, generatorId, genre) > 0) covered.add(genre);
    }
  }
  return covered;
}

/**
 * Plan meaningful slot roles across the entire result, respecting locks.
 * Returns { [slotKey]: genreKey }; empty if mode=random or data lacks matches.
 * At chaos 4-5, only anchor MAIN so deliberate disorder stays possible.
 */
export function planGenreSlots({
  generatorId, genres, mode = 'hybrid', chaos = 3,
  slots = [], pools = {}, locks = {}, values = {}
}) {
  if (mode === 'random' || !slots.length) return {};
  const { main, subs } = normalizeGenreSelection(generatorId, genres);
  const allGenres = [main, ...subs];
  const covered = lockedGenreCoverage(generatorId, allGenres, slots, pools, locks, values);
  const openSlots = slots.filter((slot) => !locks[slot.key]);
  const result = {};
  const used = new Set();

  if (!covered.has(main)) {
    const anchors = ANCHORS[generatorId] || [];
    const choices = openSlots
      .map(({ key }) => ({
        key,
        score: scoreSlot(generatorId, main, key, pools[key] || []),
        anchorRank: anchors.indexOf(key)
      }))
      .filter(({ score }) => Number.isFinite(score))
      .sort((a, b) =>
        (a.anchorRank < 0 ? 50 : a.anchorRank) - (b.anchorRank < 0 ? 50 : b.anchorRank) ||
        b.score - a.score
      );
    if (choices.length) {
      result[choices[0].key] = main;
      used.add(choices[0].key);
    }
  }

  // High chaos: preserving the core is intentional; the other slots remain free.
  if (mode === 'hybrid' && Number(chaos) > 3) return result;

  const missing = subs.filter((g) => !covered.has(g));
  const optionsByGenre = Object.fromEntries(missing.map((g) => [
    g,
    openSlots.filter((slot) => !used.has(slot.key))
      .map(({ key }) => ({ key, score: scoreSlot(generatorId, g, key, pools[key] || []) }))
      .filter(({ score }) => Number.isFinite(score))
      .sort((a, b) => b.score - a.score)
  ]));
  // Solve a tiny maximum-coverage assignment (<=3 genres, <=9 slots).
  // The most constrained genres go first. If no full matching exists,
  // maximize represented genres rather than silently discarding them.
  const ordered = missing.slice().sort((a, b) =>
    optionsByGenre[a].length - optionsByGenre[b].length
  );
  let best = { count: -1, score: -Infinity, slots: {} };
  function search(index, chosen, seen, totalScore) {
    if (index === ordered.length) {
      const count = Object.keys(chosen).length;
      if (count > best.count || (count === best.count && totalScore > best.score)) {
        best = { count, score: totalScore, slots: { ...chosen } };
      }
      return;
    }
    const genre = ordered[index];
    for (const candidate of optionsByGenre[genre]) {
      if (seen.has(candidate.key)) continue;
      seen.add(candidate.key);
      chosen[candidate.key] = genre;
      search(index + 1, chosen, seen, totalScore + candidate.score);
      delete chosen[candidate.key];
      seen.delete(candidate.key);
    }
    search(index + 1, chosen, seen, totalScore);
  }
  search(0, {}, used, 0);
  return { ...result, ...best.slots };
}
