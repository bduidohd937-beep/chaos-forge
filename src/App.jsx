import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  GENERATORS,
  GENERATOR_MAP,
  MODES,
  GENRE_NAME_MAP,
  generateResult,
  rerollSlot,
  getPool,
  normalizeGenre
} from './engine.js';
import Storage from './storage.js';
import { buildExportData, buildJson, buildMarkdown, buildFilename, downloadFile } from './export.js';
import ControlsBar from './components/ControlsBar.jsx';
import ResultCard from './components/ResultCard.jsx';
import IdeasPanel from './components/IdeasPanel.jsx';
import CustomPanel from './components/CustomPanel.jsx';

const CHAOS_HINTS = {
  1: '장르 키워드만 골라 닮은 느낌을 유지합니다.',
  2: '장르 중심에 아주 살짝의 변형을 섞습니다.',
  3: '장르 키워드와 무작위 키워드를 절반씩 섞습니다.',
  4: '무작위 쪽 비중이 높아집니다. 기발한 충돌이 생깁니다.',
  5: '장르 제약이 거의 사라집니다. 최대 혼돈 상태.'
};

const SPIN_STEP = 70;
const STAGGER = 110;

const modeName = (key) => MODES.find((m) => m.k === key)?.n || key;

/** 첫 진입용 초기 결과 (생성기 4종을 미리 채워 둔다) */
function seedResults(customKeywords) {
  const seeded = {};
  for (const gen of GENERATORS) {
    seeded[gen.id] = {
      values: generateResult(gen.id, {
        mode: 'hybrid',
        genre: gen.genreList[0].k,
        chaos: 3,
        custom: customKeywords
      }),
      locks: {}
    };
  }
  return seeded;
}

/** 저장된 초안을 현재 생성기 슬롯 구조에 맞춰 안전하게 복원한다. */
function restoreResults(draft, customKeywords) {
  const defaults = seedResults(customKeywords);
  if (!draft) return defaults;

  for (const gen of GENERATORS) {
    const saved = draft.results?.[gen.id];
    if (!saved || typeof saved !== 'object' || !saved.values ||
        typeof saved.values !== 'object') continue;

    const values = { ...defaults[gen.id].values };
    const locks = {};
    for (const slot of gen.slots) {
      if (typeof saved.values[slot.key] === 'string') {
        values[slot.key] = saved.values[slot.key].slice(0, 5000);
      }
      if (saved.locks?.[slot.key] === true) locks[slot.key] = true;
    }
    defaults[gen.id] = { values, locks };
  }
  return defaults;
}

/**
 * @param {{animationMs?: number}} props animationMs=0 이면 슬롯 연출 없이 즉시 표시 (테스트용)
 */
export default function App({ animationMs = 620 }) {
  const [draft] = useState(() => Storage.loadDraft());
  const [custom, setCustom] = useState(() => Storage.loadCustom());
  const [results, setResults] = useState(() => restoreResults(draft, Storage.loadCustom()));
  const [generatorId, setGeneratorId] = useState(
    () => (GENERATOR_MAP[draft?.generatorId] ? draft.generatorId : 'story')
  );
  const [mode, setMode] = useState(
    () => (MODES.some((m) => m.k === draft?.mode) ? draft.mode : 'hybrid')
  );
  const [genre, setGenre] = useState(() => normalizeGenre(
    GENERATOR_MAP[draft?.generatorId] ? draft.generatorId : 'story',
    draft?.genre ?? '판'
  ));
  const [chaos, setChaos] = useState(() => {
    const value = Number(draft?.chaos);
    return Number.isInteger(value) && value >= 1 && value <= 5 ? value : 3;
  });
  const [draftSaved, setDraftSaved] = useState(true);
  const [spinning, setSpinning] = useState({});
  const [spinText, setSpinText] = useState({});
  const [toast, setToast] = useState('');
  const [ideas, setIdeas] = useState(() => Storage.loadIdeas());
  const [search, setSearch] = useState('');
  const [title, setTitle] = useState('');

  const tickRef = useRef(null);
  const stopRef = useRef([]);
  const toastRef = useRef(null);

  const gen = GENERATOR_MAP[generatorId];
  const current = results[generatorId] ?? { values: {}, locks: {} };
  const filteredIdeas = useMemo(() => Storage.searchIdeas(search), [ideas, search]);

  // 저장된 아이디어와 달리 현재 편집 중인 결과/잠금/옵션은 초안으로 자동 보존한다.
  useEffect(() => {
    const ok = Storage.saveDraft({ generatorId, mode, genre, chaos, results });
    setDraftSaved(ok);
  }, [generatorId, mode, genre, chaos, results]);

  const showToast = useCallback((message) => {
    setToast(message);
    if (toastRef.current) clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToast(''), 2400);
  }, []);

  const clearAnimations = useCallback(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    stopRef.current.forEach(clearTimeout);
    stopRef.current = [];
    setSpinning({});
  }, []);

  useEffect(
    () => () => {
      if (tickRef.current) clearInterval(tickRef.current);
      stopRef.current.forEach(clearTimeout);
      if (toastRef.current) clearTimeout(toastRef.current);
    },
    []
  );

  /** 전체 생성 (잠긴 항목은 값 유지) */
  const generate = useCallback(
    (overrides = {}, options = {}) => {
      const gid = overrides.generatorId ?? generatorId;
      const nextMode = overrides.mode ?? mode;
      const nextGenre = normalizeGenre(gid, overrides.genre ?? genre);
      const nextChaos = overrides.chaos ?? chaos;
      const target = GENERATOR_MAP[gid];
      const snapshot = results[gid] ?? { values: {}, locks: {} };

      const finalValues = generateResult(gid, {
        mode: nextMode,
        genre: nextGenre,
        chaos: nextChaos,
        custom,
        locks: snapshot.locks,
        values: snapshot.values
      });

      // 연출과 무관하게 데이터는 즉시 확정 (연출 중 저장/복사 대비)
      setResults((prev) => ({ ...prev, [gid]: { values: finalValues, locks: snapshot.locks } }));
      clearAnimations();

      const unlocked = target.slots
        .filter((slot) => !snapshot.locks[slot.key])
        .map((slot) => slot.key);

      if (animationMs > 0 && unlocked.length > 0) {
        const pools = {};
        for (const key of unlocked) pools[key] = getPool(gid, key, custom);

        setSpinText(finalValues);
        setSpinning(Object.fromEntries(unlocked.map((key) => [key, true])));

        tickRef.current = setInterval(() => {
          setSpinText((prev) => {
            const next = { ...prev };
            for (const key of unlocked) {
              const pool = pools[key];
              if (pool && pool.length) next[key] = pool[Math.floor(Math.random() * pool.length)].t;
            }
            return next;
          });
        }, SPIN_STEP);

        unlocked.forEach((key, index) => {
          const timer = setTimeout(() => {
            setSpinText((prev) => ({ ...prev, [key]: finalValues[key] }));
            setSpinning((prev) => {
              const next = { ...prev };
              delete next[key];
              return next;
            });
            if (index === unlocked.length - 1 && tickRef.current) {
              clearInterval(tickRef.current);
              tickRef.current = null;
            }
          }, animationMs + index * STAGGER);
          stopRef.current.push(timer);
        });
      }

      if (!options.silent) {
        showToast(
          `${target.title} 생성 완료 · ${modeName(nextMode)}` +
            (nextMode === 'hybrid' ? ` (혼돈 ${nextChaos})` : '')
        );
      }
    },
    [generatorId, mode, genre, chaos, results, custom, animationMs, clearAnimations, showToast]
  );

  const reroll = (slotKey) => {
    if (current.locks[slotKey]) {
      showToast('잠긴 항목은 재추첨되지 않습니다');
      return;
    }
    const text = rerollSlot(generatorId, slotKey, { mode, genre, chaos, custom });
    setResults((prev) => ({
      ...prev,
      [generatorId]: {
        values: { ...prev[generatorId].values, [slotKey]: text },
        locks: prev[generatorId].locks
      }
    }));

    clearAnimations();
    if (animationMs <= 0) return;

    const pool = getPool(generatorId, slotKey, custom);
    const duration = Math.max(260, animationMs * 0.6);
    setSpinning({ [slotKey]: true });
    setSpinText((prev) => ({ ...prev, [slotKey]: text }));

    tickRef.current = setInterval(() => {
      setSpinText((prev) => ({
        ...prev,
        [slotKey]: pool.length ? pool[Math.floor(Math.random() * pool.length)].t : text
      }));
    }, SPIN_STEP);

    const timer = setTimeout(() => {
      setSpinText((prev) => ({ ...prev, [slotKey]: text }));
      setSpinning({});
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
    }, duration);
    stopRef.current.push(timer);
  };

  const toggleLock = (slotKey) => {
    const nextLocked = !current.locks[slotKey];
    setResults((prev) => ({
      ...prev,
      [generatorId]: {
        values: prev[generatorId].values,
        locks: { ...prev[generatorId].locks, [slotKey]: nextLocked }
      }
    }));
    const label = gen.slots.find((slot) => slot.key === slotKey)?.label ?? slotKey;
    showToast(nextLocked ? `‘${label}’ 항목 잠금` : `‘${label}’ 잠금 해제`);
  };

  const updateValue = (slotKey, text) => {
    setResults((prev) => ({
      ...prev,
      [generatorId]: {
        values: { ...prev[generatorId].values, [slotKey]: text },
        locks: prev[generatorId].locks
      }
    }));
  };

  const unlockAll = () => {
    setResults((prev) => ({
      ...prev,
      [generatorId]: { values: prev[generatorId].values, locks: {} }
    }));
    clearAnimations();
    showToast('모든 잠금을 해제했습니다');
  };

  const switchGenerator = (id) => {
    if (id === generatorId) return;
    clearAnimations();
    setSpinText({});
    setGeneratorId(id);
    setGenre((prev) => normalizeGenre(id, prev));
  };

  const changeGenre = (value) => {
    setGenre(value);
    generate({ genre: value });
  };

  const changeMode = (value) => {
    setMode(value);
    generate({ mode: value });
  };

  const commitChaos = () => {
    if (mode === 'hybrid') generate({ chaos });
  };

  const buildText = () => {
    const lines = [
      `◈ CHAOS FORGE · ${gen.tab} (${gen.title})`,
      `모드: ${modeName(mode)} | 장르: ${GENRE_NAME_MAP[genre] || genre}` +
        (mode === 'hybrid' ? ` | 혼돈: ${chaos}/5` : ''),
      '----------------------------'
    ];
    for (const slot of gen.slots) {
      const value = current.values[slot.key];
      if (value) lines.push(`[${slot.label}] ${value}${current.locks[slot.key] ? '  ⛒잠금' : ''}`);
    }
    return lines.join('\n');
  };

  const copy = async () => {
    const text = buildText();
    try {
      await navigator.clipboard.writeText(text);
      showToast('결과를 클립보드에 복사했습니다');
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try {
        ok = document.execCommand('copy');
      } catch {
        ok = false;
      }
      document.body.removeChild(ta);
      showToast(ok ? '결과를 클립보드에 복사했습니다' : '복사에 실패했습니다. 직접 선택해 복사해 주세요');
    }
  };

  /** 결과를 마크다운/JSON 파일로 내려받는다 */
  const exportResult = (format) => {
    const isJson = format === 'json';
    const data = buildExportData({
      generatorId,
      mode,
      genre,
      chaos,
      values: current.values,
      locks: current.locks
    });
    const filename = buildFilename(generatorId, isJson ? 'json' : 'md');
    const ok = downloadFile(
      filename,
      isJson ? buildJson(data) : buildMarkdown(data),
      isJson ? 'application/json;charset=utf-8' : 'text/markdown;charset=utf-8'
    );
    showToast(
      ok
        ? `${isJson ? 'JSON' : '마크다운'} 파일을 저장했습니다`
        : '이 브라우저에서는 파일 저장을 지원하지 않습니다'
    );
    return ok;
  };

  const saveIdea = () => {
    const values = {};
    let hasValue = false;
    for (const slot of gen.slots) {
      const value = (current.values[slot.key] || '').trim();
      values[slot.key] = value;
      if (value) hasValue = true;
    }
    if (!hasValue) {
      showToast('먼저 생성 결과를 만들어 주세요');
      return;
    }

    const firstFilled = gen.slots.map((slot) => values[slot.key]).find(Boolean);
    const saved = Storage.saveIdea({
      title: title.trim() || firstFilled || gen.title,
      generator: gen.id,
      mode,
      genre,
      chaos,
      values
    });
    if (!saved) {
      showToast('저장에 실패했습니다. JSON 파일로 백업해 주세요');
      return;
    }
    setTitle('');
    setIdeas(Storage.loadIdeas());
    showToast('아이디어를 저장했습니다');
  };

  const deleteIdea = (id) => {
    const target = Storage.getIdea(id);
    const ok = target ? window.confirm(`“${target.title}” 아이디어를 삭제할까요?`) : false;
    if (!ok) return;
    if (!Storage.deleteIdea(id)) {
      showToast('삭제 내용을 저장하지 못했습니다');
      return;
    }
    setIdeas(Storage.loadIdeas());
    showToast('아이디어를 삭제했습니다');
  };

  const loadIdea = (id) => {
    const idea = Storage.getIdea(id);
    if (!idea || !GENERATOR_MAP[idea.generator]) {
      showToast('아이디어를 찾을 수 없습니다');
      return;
    }
    clearAnimations();
    setSpinText({});
    setGeneratorId(idea.generator);
    setMode(MODES.some((m) => m.k === idea.mode) ? idea.mode : 'hybrid');
    setGenre(normalizeGenre(idea.generator, idea.genre));
    setChaos(Number(idea.chaos) || 3);

    const values = {};
    for (const [key, value] of Object.entries(idea.values || {})) values[key] = String(value);
    setResults((prev) => ({ ...prev, [idea.generator]: { values, locks: {} } }));

    showToast('저장한 아이디어를 불러왔습니다');
    if (typeof window !== 'undefined' && window.scrollTo) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const addCustom = (entry) => {
    const saved = Storage.addCustom(entry);
    if (!saved) {
      showToast('중복 키워드이거나 저장 공간이 부족합니다');
      return;
    }
    setCustom(Storage.loadCustom());
    showToast('키워드가 생성기에 즉시 반영되었습니다');
  };

  const deleteCustom = (id) => {
    if (!Storage.deleteCustom(id)) {
      showToast('삭제 내용을 저장하지 못했습니다');
      return;
    }
    setCustom(Storage.loadCustom());
    showToast('키워드를 삭제했습니다');
  };

  return (
    <>
      <header className="site-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 32 32" width="34" height="34" fill="none">
              <path
                d="M16 2l4.6 9.3L30 12.8l-7 6.8 1.7 9.6L16 24.4 7.3 29.2 9 19.6 2 12.8l9.4-1.5L16 2z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <div className="brand-text">
            <h1>CHAOS FORGE</h1>
            <p>장르 적합성 × 혼돈 · 아이디어 생성기 v1.1</p>
          </div>
        </div>

        <nav className="tabs" id="generatorTabs" role="tablist" aria-label="생성기 선택">
          {GENERATORS.map((g) => (
            <button
              key={g.id}
              type="button"
              className="tab"
              role="tab"
              aria-selected={g.id === generatorId}
              title={`${g.title} — ${g.desc}`}
              onClick={() => switchGenerator(g.id)}
            >
              {g.tab}
            </button>
          ))}
        </nav>
      </header>

      <main className="wrap">
        <div className="workspace-bar" aria-label="작업 상태">
          <span className="workspace-name">◈ CHAOS MODE <span>발견하고, 고정하고, 다듬기</span></span>
          <span className={`autosave-status${draftSaved ? '' : ' is-error'}`} role="status">
            {draftSaved ? '● 초안 자동 저장됨' : '⚠ 자동 저장 실패 · JSON 백업 권장'}
          </span>
        </div>
        <ControlsBar
          genres={gen.genreList}
          genre={genre}
          onGenreChange={changeGenre}
          mode={mode}
          onModeChange={changeMode}
          chaos={chaos}
          chaosHint={
            mode === 'hybrid'
              ? CHAOS_HINTS[chaos]
              : mode === 'genre'
                ? '선택한 장르와 어울리는 키워드만 등장합니다.'
                : '장르 제약 없이 모든 키워드가 동일 확률로 섞입니다.'
          }
          onChaosChange={setChaos}
          onChaosCommit={commitChaos}
          onGenerate={() => generate()}
          onUnlockAll={unlockAll}
        />

        <section className="results" id="results" aria-live="polite" aria-label="생성 결과">
          {gen.slots.map((slot) => {
            const isSpinning = Boolean(spinning[slot.key]);
            const value = isSpinning
              ? spinText[slot.key] ?? current.values[slot.key] ?? ''
              : current.values[slot.key] ?? '';

            return (
              <ResultCard
                key={`${gen.id}-${slot.key}`}
                slotKey={slot.key}
                label={slot.label}
                value={value}
                locked={Boolean(current.locks[slot.key])}
                spinning={isSpinning}
                onChange={(text) => updateValue(slot.key, text)}
                onLock={() => toggleLock(slot.key)}
                onReroll={() => reroll(slot.key)}
              />
            );
          })}
        </section>

        <section className="result-actions">
          <button type="button" className="btn btn-outline" id="copyBtn" onClick={copy}>
            결과 복사
          </button>
          <div className="export-group">
            <button
              type="button"
              className="btn btn-outline"
              id="exportMdBtn"
              onClick={() => exportResult('md')}
            >
              MD 저장
            </button>
            <button
              type="button"
              className="btn btn-outline"
              id="exportJsonBtn"
              onClick={() => exportResult('json')}
            >
              JSON 저장
            </button>
          </div>
          <input
            type="text"
            id="ideaTitle"
            className="input input-inline"
            placeholder="저장할 제목 (선택)"
            maxLength={60}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <button type="button" className="btn btn-accent" id="saveBtn" onClick={saveIdea}>
            아이디어 저장
          </button>
        </section>

        <div className="panels">
          <IdeasPanel
            ideas={filteredIdeas}
            total={ideas.length}
            search={search}
            onSearch={setSearch}
            onLoad={loadIdea}
            onDelete={deleteIdea}
          />
          <CustomPanel custom={custom} onAdd={addCustom} onDelete={deleteCustom} />
        </div>
      </main>

      <footer className="site-footer">
        <p>CHAOS FORGE v1.1 · 자동 저장되는 초안과 아이디어는 이 브라우저에만 보관됩니다.</p>
      </footer>

      <div className={`toast${toast ? ' is-show' : ''}`} id="toast" role="status" aria-live="polite">
        {toast}
      </div>
    </>
  );
}
