import { buildWorkspaceBackup, inspectWorkspaceBackup } from './workspaceBackup.js';

/* CHAOS FORGE - 로컬 저장소
 * 저장된 아이디어(idea)와 사용자 키워드(custom)를 다룬다.
 * localStorage가 막힌 환경(시크릿 모드, 테스트)에서도 메모리로 동작한다.
 */

// 별도 경로의 Alpha 미리보기는 운영 사이트와 같은 도메인이므로
// 로컬스토리지 키를 분리해야 기존 사용자 데이터가 덮어써지지 않는다.
const IS_PREVIEW = typeof window !== 'undefined' &&
  window.location.pathname.includes('/preview/v2/');
const scope = (name) => IS_PREVIEW ? `chaosforge.reforge-preview.v2.${name}` : `chaosforge.${name}.v1`;

const IDEAS_KEY = scope('ideas');
const CUSTOM_KEY = scope('custom');
const DRAFT_KEY = scope('draft');
// Independent, opt-in checkpoints for explicitly starting a new idea.
// Never overwrite or rotate old archives automatically.
const ARCHIVES_KEY = scope('draft-archives');
// Crash-recovery journal for replacing all workspace data together.
const RESTORE_JOURNAL_KEY = scope('restore-transaction');
const WORKSPACE_KEYS = [DRAFT_KEY, IDEAS_KEY, CUSTOM_KEY, ARCHIVES_KEY];

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
    // A pending failed import must not be overwritten by unrelated UI writes.
    // The durable rollback journal is handled only by restore/recovery methods.
    if (store.getItem(RESTORE_JOURNAL_KEY) !== null) return false;
    store.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    memory.set(key, value);
    return false;
  }
}

/** Read every backed-up collection strictly: corrupted JSON must NEVER become an empty backup. */
function strictRead(key, fallback) {
  const store = rawStorage();
  if (!store) throw new Error('브라우저 저장소에 접근할 수 없습니다. 현재 작업을 복원하거나 전체 백업할 수 없어요.');
  const raw = store.getItem(key);
  if (raw === null) return fallback;
  try { return JSON.parse(raw); }
  catch { throw new Error('저장된 자료가 손상돼 전체 백업을 중단했습니다.'); }
}

/** Restore raw, byte-for-byte values from a journal; retain journal if rollback fails. */
function rollbackRaw(store, previous) {
  if (!previous || typeof previous !== 'object' || Array.isArray(previous) ||
      WORKSPACE_KEYS.some(key => !Object.hasOwn(previous, key) ||
        (previous[key] !== null && typeof previous[key] !== 'string'))) {
    throw new Error('복구 기록이 올바르지 않아 자동 복구를 진행할 수 없습니다.');
  }
  // Clear imported values first so the old snapshot can fit under quota.
  WORKSPACE_KEYS.forEach(key => store.removeItem(key));
  WORKSPACE_KEYS.forEach(key => {
    if (previous[key] !== null) store.setItem(key, previous[key]);
  });
  WORKSPACE_KEYS.forEach(key => {
    if (store.getItem(key) !== previous[key]) throw new Error('이전 작업의 검증에 실패했습니다.');
  });
  store.removeItem(RESTORE_JOURNAL_KEY);
}

function uid() {
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

const Storage = {
  /**
   * On a crash halfway through an import, rollback the four independent
   * collections BEFORE App reads or auto-saves a partially restored draft.
   * Return: 'clean', 'recovered', or 'failed'.
   */
  recoverInterruptedRestore() {
    const store = rawStorage();
    if (!store) return 'failed';
    let record;
    try {
      const raw = store.getItem(RESTORE_JOURNAL_KEY);
      if (!raw) return 'clean';
      record = JSON.parse(raw);
      if (!record || record.version !== 1 || !record.previous) return 'failed';
      rollbackRaw(store, record.previous);
      return 'recovered';
    } catch {
      // Keep the journal for a later recovery; never silently discard it.
      return 'failed';
    }
  },

  /** Capture ALL collections plus the latest in-memory draft, not only the last autosave. */
  createFullBackup(liveDraft) {
    if (this.recoverInterruptedRestore() === 'failed') {
      throw new Error('중단된 복원이 남아 있어 백업을 만들 수 없습니다.');
    }
    const draft = { ...liveDraft, version: 1 };
    return buildWorkspaceBackup({
      draft,
      ideas: strictRead(IDEAS_KEY, []),
      custom: strictRead(CUSTOM_KEY, []),
      archives: strictRead(ARCHIVES_KEY, [])
    });
  },

  inspectFullBackup(input) {
    return inspectWorkspaceBackup(input);
  },

  /**
   * Validate everything before changing data. Record exact raw values in an
   * on-disk journal, replace 4 collections, verify all writes and commit by
   * deleting the journal. On any write error, rollback to the old snapshots.
   */
  restoreFullBackup(input) {
    const { backup, summary } = inspectWorkspaceBackup(input);
    const store = rawStorage();
    if (!store) throw new Error('브라우저 저장소에 접근할 수 없어 복원할 수 없습니다.');
    const recovery = this.recoverInterruptedRestore();
    if (recovery === 'failed') {
      throw new Error('이전에 중단된 복원을 복구하지 못했습니다. 현재 데이터를 변경하지 않았습니다.');
    }
    const previous = Object.fromEntries(WORKSPACE_KEYS.map(key => [key, store.getItem(key)]));
    const journal = { version: 1, createdAt: Date.now(), previous };
    // If even the protective journal cannot be saved, do not modify a byte.
    try {
      store.setItem(RESTORE_JOURNAL_KEY, JSON.stringify(journal));
    } catch {
      throw new Error('복원용 보호 기록을 저장할 공간이 부족합니다. 기존 작업은 변경하지 않았습니다.');
    }
    const incoming = [
      { ...backup.data.draft, version: 1 },
      backup.data.ideas,
      backup.data.custom,
      backup.data.archives
    ];
    try {
      WORKSPACE_KEYS.forEach((key, index) => store.setItem(key, JSON.stringify(incoming[index])));
      WORKSPACE_KEYS.forEach((key, index) => {
        if (store.getItem(key) !== JSON.stringify(incoming[index])) {
          throw new Error('저장한 데이터의 재검증에 실패했습니다.');
        }
      });
      store.removeItem(RESTORE_JOURNAL_KEY);
      if (store.getItem(RESTORE_JOURNAL_KEY) !== null) {
        throw new Error('복원 기록을 마무리하지 못했습니다.');
      }
      return { draft: backup.data.draft, summary };
    } catch (error) {
      try {
        rollbackRaw(store, previous);
      } catch {
        throw new Error('복원 중 오류가 났고 즉시 되돌리기도 실패했습니다. 다시 열어 자동 복구를 시도하세요. 새 작업을 하지 마세요.');
      }
      throw new Error('복원 저장 중 오류가 발생해 이전 작업으로 되돌렸습니다. ' + String(error.message || ''));
    }
  },

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

  /**
   * Save a complete, immutable snapshot before replacing the current idea.
   * Includes every generator, locks, FORGE documents, genre, DNA and history.
   * If durable browser storage is unavailable/full, return null; callers
   * MUST NOT reset the current draft.
   */
  archiveDraft(draft, label = '') {
    if (!draft || typeof draft !== 'object' || !draft.results ||
        typeof draft.results !== 'object') return null;
    const archives = this.loadDraftArchives();
    const record = {
      id: uid(),
      savedAt: Date.now(),
      label: String(label || '이전 작업').trim().slice(0, 80) || '이전 작업',
      generatorId: String(draft.generatorId || 'story').slice(0, 30),
      // JSON round-trip prevents subsequent React edits mutating snapshots.
      draft: JSON.parse(JSON.stringify({ ...draft, version: 1 }))
    };
    // No automatic truncation/deletion: failed quota writes are surfaced.
    return write(ARCHIVES_KEY, [record, ...archives]) ? record : null;
  },

  loadDraftArchives() {
    const archives = read(ARCHIVES_KEY, []);
    return Array.isArray(archives) ? archives.filter(item =>
      item && typeof item === 'object' && typeof item.id === 'string' &&
      item.draft?.version === 1 && item.draft?.results &&
      typeof item.draft.results === 'object'
    ) : [];
  },

  getDraftArchive(id) {
    return this.loadDraftArchives().find(item => item.id === id) || null;
  },

  /** Saved ideas are independent of full draft archives. */
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
