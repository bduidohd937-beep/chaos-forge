/**
 * UX 2.9: strictly authored built-in output pool.
 * Legacy entries remain addressable for old drafts / exports / API calls, but
 * they cannot leak an unedited paragraph into the single-word keyword mode.
 */
import { REFORGE_STORY } from './reforge29Story.js';
import { REFORGE_GAME } from './reforge29Game.js';
import { REFORGE_CHARACTER } from './reforge29Character.js';
import { REFORGE_HERO } from './reforge29Hero.js';
import { ALPHA5_SINGLE_WORDS } from './reforge29Alpha5Brief.js';

export const REFORGE_LIBRARY = {
  story: REFORGE_STORY,
  game: REFORGE_GAME,
  character: REFORGE_CHARACTER,
  hero: REFORGE_HERO
};
export const REFORGE_COUNT = Object.values(REFORGE_LIBRARY)
  .flatMap(group=>Object.values(group).flat()).length;

export function withSingleWordAlias(keyword, generatorId, slotKey, index) {
  const brief = ALPHA5_SINGLE_WORDS[generatorId]?.[slotKey]?.[index];
  if (!brief || /\s/.test(brief)) {
    throw new Error(`Missing reviewed Alpha5 keyword: ${generatorId}/${slotKey}/${index}`);
  }
  return { ...keyword, forms: { ...keyword.forms, brief } };
}

export function isReforgeReady(keyword) {
  const forms = keyword?.forms;
  return !!(forms && typeof forms.brief==='string' && forms.brief.length > 0 &&
    !/\s/.test(forms.brief) && typeof forms.balanced==='string' &&
    forms.balanced.trim() && typeof forms.detailed==='string' &&
    forms.detailed.trim());
}
