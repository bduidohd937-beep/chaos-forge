/**
 * CHAOS FORGE V2 workspace backups: explicit, local, lossless and versioned.
 * Checksums detect accidental corruption, not malicious modification.
 */
export const WORKSPACE_BACKUP_SCHEMA = 'chaos-forge/workspace-backup@1';
export const WORKSPACE_BACKUP_SCOPE = 'chaosforge.reforge-preview.v2';
export const MAX_BACKUP_CHARS = 20 * 1024 * 1024;

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const fail = message => { throw new Error(message); };
const validStringMap = value => isRecord(value) &&
  Object.entries(value).every(([key, val]) => key !== '__proto__' && typeof val === 'string');
const validBooleanMap = value => isRecord(value) &&
  Object.entries(value).every(([key, val]) => key !== '__proto__' && typeof val === 'boolean');

function validateDraft(draft, description) {
  if (!isRecord(draft) || draft.version !== 1 ||
      !isRecord(draft.results)) fail(`${description}: 유효한 V2 초안이 아닙니다.`);
  if (draft.generatorId != null && typeof draft.generatorId !== 'string') {
    fail(`${description}: 생성기 정보가 올바르지 않습니다.`);
  }
  for (const [gen, entry] of Object.entries(draft.results)) {
    if (gen === '__proto__' || !isRecord(entry) || !validStringMap(entry.values) ||
        (entry.locks != null && !validBooleanMap(entry.locks))) {
      fail(`${description}: 카드 결과나 잠금 정보가 손상됐습니다.`);
    }
  }
  if (draft.forgeDocs != null) {
    if (!isRecord(draft.forgeDocs)) fail(`${description}: FORGE 문서가 손상됐습니다.`);
    for (const [gen, doc] of Object.entries(draft.forgeDocs)) {
      if (gen === '__proto__' || !isRecord(doc) ||
          (doc.title != null && typeof doc.title !== 'string') ||
          (doc.notes != null && typeof doc.notes !== 'string') ||
          (doc.fields != null && !validStringMap(doc.fields))) {
        fail(`${description}: FORGE 문서의 일부 항목이 손상됐습니다.`);
      }
    }
  }
  if (draft.creativeDNA != null && !isRecord(draft.creativeDNA)) {
    fail(`${description}: 취향·차단 설정이 손상됐습니다.`);
  }
  if (draft.genreSelection != null && !isRecord(draft.genreSelection)) {
    fail(`${description}: 장르 설정이 손상됐습니다.`);
  }
  if (draft.recentHistory != null && !isRecord(draft.recentHistory)) {
    fail(`${description}: 최근 추첨 기록이 손상됐습니다.`);
  }
}

function validateRecords(items, name, max, validator) {
  if (!Array.isArray(items) || items.length > max) {
    fail(`${name}: 목록의 형식이나 크기가 올바르지 않습니다.`);
  }
  const ids = new Set();
  items.forEach((item, index) => {
    if (!isRecord(item) || typeof item.id !== 'string' || !item.id.trim() || ids.has(item.id)) {
      fail(`${name}: ${index + 1}번째 항목의 ID가 없거나 중복됩니다.`);
    }
    ids.add(item.id);
    validator(item, index);
  });
}

function validateData(data) {
  if (!isRecord(data)) fail('백업 데이터 구조가 올바르지 않습니다.');
  validateDraft(data.draft, '현재 작업');
  validateRecords(data.archives, '이전 작업 기록', 1000, record => {
    if (typeof record.label !== 'string' || typeof record.savedAt !== 'number' ||
        !Number.isFinite(record.savedAt)) {
      fail('이전 작업 기록의 설명이나 날짜가 손상됐습니다.');
    }
    validateDraft(record.draft, '보관된 이전 작업');
  });
  validateRecords(data.ideas, '아이디어', 5000, record => {
    if (typeof record.title !== 'string' ||
        !validStringMap(record.values || {})) fail('아이디어 내용이 손상됐습니다.');
  });
  validateRecords(data.custom, '사용자 키워드', 5000, record => {
    if (typeof record.text !== 'string' || typeof record.generator !== 'string' ||
        typeof record.slot !== 'string' || !Array.isArray(record.genres)) {
      fail('사용자 키워드가 손상됐습니다.');
    }
  });
}

function checksum(value) {
  const source = JSON.stringify(value);
  let hash = 2166136261;
  // FNV-1a over UTF-16 code units; intentionally not a cryptographic hash.
  for (let i = 0; i < source.length; i++) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return 'fnv1a32-' + (hash >>> 0).toString(16).padStart(8, '0');
}

export function backupSummary(data) {
  return {
    ideas: data.ideas.length,
    custom: data.custom.length,
    archives: data.archives.length,
    forgeDocs: Object.values(data.draft.forgeDocs || {}).filter(doc =>
      doc && typeof doc === 'object' && (
        String(doc.title || '').trim() ||
        String(doc.notes || '').trim() ||
        Object.values(doc.fields || {}).some(value => typeof value === 'string' && value.trim())
      )
    ).length
  };
}

export function buildWorkspaceBackup(data, date = new Date()) {
  validateData(data);
  const bundle = {
    schema: WORKSPACE_BACKUP_SCHEMA,
    scope: WORKSPACE_BACKUP_SCOPE,
    createdAt: date.toISOString(),
    data,
    checksum: checksum(data)
  };
  if (JSON.stringify(bundle).length > MAX_BACKUP_CHARS) {
    fail('전체 데이터가 파일 크기 제한(20MB)을 초과합니다.');
  }
  return bundle;
}

export function inspectWorkspaceBackup(input) {
  const raw = typeof input === 'string' ? input : JSON.stringify(input);
  if (!raw || raw.length > MAX_BACKUP_CHARS) {
    fail('백업 파일이 비어 있거나 20MB 제한을 초과했습니다.');
  }
  let bundle;
  try {
    bundle = JSON.parse(raw);
  } catch {
    fail('올바른 JSON 파일이 아닙니다.');
  }
  if (!isRecord(bundle) || bundle.schema !== WORKSPACE_BACKUP_SCHEMA) {
    fail('지원하지 않는 백업 형식입니다. CHAOS FORGE V2 전체 백업 파일을 선택해 주세요.');
  }
  if (bundle.scope !== WORKSPACE_BACKUP_SCOPE) {
    fail('다른 버전 또는 다른 저장소의 백업은 이 미리보기에 복원할 수 없습니다.');
  }
  if (typeof bundle.createdAt !== 'string' || !Number.isFinite(Date.parse(bundle.createdAt))) {
    fail('백업 생성 날짜가 잘못됐습니다.');
  }
  validateData(bundle.data);
  if (bundle.checksum !== checksum(bundle.data)) {
    fail('파일 무결성 검사에 실패했습니다. 손상되거나 수정된 백업입니다.');
  }
  return { backup: bundle, summary: backupSummary(bundle.data) };
}
