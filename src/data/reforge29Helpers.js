/**
 * UX 2.9 curated source contract.
 * Each row is reviewed, separately authored at all three depths.
 * No tokenization/truncation of legacy sentences.
 */
export function fromRows(source) {
  return Object.fromEntries(Object.entries(source).map(([slot, rows]) => [
    slot,
    rows.map((line, index) => {
      const parts = line.split('|');
      if (parts.length !== 4) throw new Error(`Invalid three-depth row at ${slot}:${index}`);
      const [brief, balanced, detailed, genreTags] = parts.map(s => s.trim());
      if (!brief || /\s/.test(brief) || !balanced || !detailed ||
          !genreTags || balanced === detailed || balanced === brief) {
        throw new Error(`Incomplete curated forms at ${slot}:${index}`);
      }
      return {
        t: balanced, g: genreTags.split(',').map(s=>s.trim()), c: [],
        w: 1, origin: 'ux29-curated',
        forms: { brief, balanced, detailed }, novelty: 3
      };
    })
  ]));
}
