/* CHAOS FORGE - 로컬 저장소
 * 저장된 아이디어(idea)와 사용자 키워드(custom)를 다룬다.
 * localStorage가 막힌 환경(시크릿 모드, 테스트)에서도 메모리로 동작한다.
 */

const IDEAS_KEY = 'chaosforge.ideas.v1';
const CUSTOM_KEY = 'chaosforge.custom.v1';
const DRAFT_KEY = 'chaosforge.draft.v1';

const memory = new Map();

function rawStorage() {
  try {
    if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
      return globalThis.localStorage;
    }
  } catch {
    /* 접근 차단 환경 */
  }
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    /* 접근 차단 환경 */
  }
  return null;
}

function read(key, fallback) {
  const store = rawStorage();
  if (!store) {
    const cached = memory.get(key);
    return cached === undefined ? fallback : cached;
  }
  try {
    const raw = store.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed == null ? fallback : parsed;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  const store = rawStorage();
  if (!store) {
    memory.set(key, value);
    // 메모리에만 보관되면 새로고침 시 유실될 수 있어 성공으로 취급하지 않는다.
    return false;
  }
  try {
    store.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    memory.set(key, value);
    return false;
  }
}

function uid() {
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

const Storage = {
  /** 화면의 작업 초안을 자동 저장한다. 기존 아이디어 보관함과 별도로 관리한다. */
  saveDraft(draft) {
    if (!draft || typeof draft !== 'object') return false;
    return write(DRAFT_KEY, { ...draft, version: 1 });
  },

  loadDraft() {
    const draft = read(DRAFT_KEY, null);
    if (!draft || typeof draft !== 'object' || Array.isArray(draft) ||
        draft.version !== 1 || !draft.results ||
        typeof draft.results !== 'object' || Array.isArray(draft.results)) return null;
    return draft;
  },

  /** 저장된 아이디어 전체 (최신순) */
  loadIdeas() {
    const list = read(IDEAS_KEY, []);
    return Array.isArray(list) ? list : [];
  },

  /** 아이디어 저장. id가 있으면 갱신, 없으면 새로 추가 */
  saveIdea(idea) {
    const list = this.loadIdeas();
    const now = Date.now();
    const index = idea && idea.id ? list.findIndex((x) => x.id === idea.id) : -1;

    const record = {
      id: index >= 0 ? list[index].id : uid(),
      title: String(idea.title || '제목 없음').slice(0, 80),
      generator: idea.generator || '',
      mode: idea.mode || '',
      genre: idea.genre || '',
      genres: idea.genres && typeof idea.genres === 'object' ? {
        main: String(idea.genres.main || idea.genre || ''),
        subs: Array.isArray(idea.genres.subs) ? idea.genres.subs.slice(0, 3) : []
      } : { main: String(idea.genre || ''), subs: [] },
      chaos: idea.chaos == null ? null : idea.chaos,
      values: idea.values || {},
      createdAt: index >= 0 ? list[index].createdAt : now,
      updatedAt: now
    };

    if (index >= 0) list[index] = record;
    else list.unshift(record);
    return write(IDEAS_KEY, list) ? record : null;
  },

  deleteIdea(id) {
    const list = this.loadIdeas().filter((x) => x.id !== id);
    return write(IDEAS_KEY, list) ? list : null;
  },

  getIdea(id) {
    return this.loadIdeas().find((x) => x.id === id) || null;
  },

  /** 제목/본문 키워드 검색 (대소문자 무시) */
  searchIdeas(query) {
    const list = this.loadIdeas();
    const q = String(query || '').trim().toLowerCase();
    if (!q) return list;
    return list.filter((idea) => {
      if (String(idea.title || '').toLowerCase().includes(q)) return true;
      return Object.values(idea.values || {}).some((v) => String(v).toLowerCase().includes(q));
    });
  },

  /** 사용자 키워드 전체 */
  loadCustom() {
    const list = read(CUSTOM_KEY, []);
    return Array.isArray(list) ? list : [];
  },

  /** 사용자 키워드 추가 */
  addCustom(entry) {
    const list = this.loadCustom();
    const record = {
      id: uid(),
      generator: entry.generator,
      slot: entry.slot,
      text: String(entry.text || '').trim().slice(0, 60),
      genres: Array.isArray(entry.genres) ? entry.genres : [],
      weight: typeof entry.weight === 'number' && entry.weight > 0 ? entry.weight : 1
    };
    if (!record.text || list.some((item) =>
      item.generator === record.generator && item.slot === record.slot &&
      String(item.text).trim().toLocaleLowerCase() === record.text.toLocaleLowerCase()
    )) return null;
    list.push(record);
    return write(CUSTOM_KEY, list) ? record : null;
  },

  deleteCustom(id) {
    const list = this.loadCustom().filter((x) => x.id !== id);
    return write(CUSTOM_KEY, list) ? list : null;
  }
};

export default Storage;
export { Storage };
