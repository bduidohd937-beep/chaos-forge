import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  GENERATORS,
  GENERATOR_MAP,
  MODES,
  GENRE_NAME_MAP,
  generateResult,
  rerollSlot,
  getPool,
  auditDNACoverage,
  normalizeGenreSelection,
  ALL_GENRES
} from './engine.js';
import Storage from './storage.js';
import { buildExportData, buildJson, buildMarkdown, buildFilename, downloadFile } from './export.js';
import SetupScreen from './components/SetupScreen.jsx';
import ForgeWorkspace from './components/ForgeWorkspace.jsx';
import ResultCard from './components/ResultCard.jsx';
import IdeasPanel from './components/IdeasPanel.jsx';
import CustomPanel from './components/CustomPanel.jsx';
import ConceptPreview from './components/ConceptPreview.jsx';
import { buildConceptPreview } from './synthesis.js';
import { normalizeForgeDoc, getForgeFields, buildForgeExportData, buildForgeMarkdown } from './forgeSchema.js';
import {
  normalizeDNA, banExact, toggleLike, deriveTopics,
  auditKeywordPools
} from './creativeDNA.js';

const CHAOS_HINTS = {
  1: '장르 키워드만 골라 닮은 느낌을 유지합니다.',
  2: '장르 중심에 아주 살짝의 변형을 섞습니다.',
  3: '장르 키워드와 무작위 키워드를 절반씩 섞습니다.',
  4: '무작위 쪽 비중이 높아집니다. 기발한 충돌이 생깁니다.',
  5: '장르 제약이 거의 사라집니다. 최대 혼돈 상태.'
};

const SPIN_STEP = 70;
const STAGGER = 110;
// 실사용 속도: 클래식은 약 2.5초, 슬롯은 약 3.3초에 걸쳐 결과 확정.
// animationMs prop을 주입하는 자동 테스트는 기존 짧은 타이밍을 유지한다.
const DEFAULT_ANIMATION_MS = 1800;
const REEL_STYLES = ['classic', 'slot', 'instant'];

// 접근성: 움직임 최소화 설정에서는 슬롯 연출을 생략한다.
const motionAllowed = () =>
  typeof window === 'undefined' || !window.matchMedia ||
  !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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

/** 최근 4회 기록은 슬롯별로만 보관하며 예전 초안에는 없어도 된다. */
function restoreRecentHistory(draft) {
  const source = draft?.recentHistory;
  const restored = {};
  for (const gen of GENERATORS) {
    restored[gen.id] = {};
    for (const slot of gen.slots) {
      const items = source?.[gen.id]?.[slot.key];
      restored[gen.id][slot.key] = Array.isArray(items)
        ? items.filter((item) => typeof item === 'string').slice(-4).map((item) => item.slice(0, 5000))
        : [];
    }
  }
  return restored;
}

function nextRecentHistory(previous, generatorId, previousValues, nextValues, locks, slots) {
  const old = previous[generatorId] || {};
  const updated = { ...old };
  for (const slot of slots) {
    if (locks?.[slot.key]) continue;
    const key = slot.key;
    const values = [...(old[key] || []), previousValues?.[key], nextValues?.[key]]
      .filter((item) => typeof item === 'string' && item.trim());
    // A fresh roll repeats the old value as its previous value. Keep the
    // most recent occurrence only so the four-slot history stays meaningful.
    const uniqueNewestFirst = [];
    const seen = new Set();
    for (const value of values.reverse()) {
      const normalized = value.trim().toLocaleLowerCase();
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      uniqueNewestFirst.push(value);
    }
    updated[key] = uniqueNewestFirst.reverse().slice(-4);
  }
  return { ...previous, [generatorId]: updated };
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
export default function App({ animationMs = DEFAULT_ANIMATION_MS }) {
  const [draft] = useState(() => Storage.loadDraft());
  const [custom, setCustom] = useState(() => Storage.loadCustom());
  const [results, setResults] = useState(() => restoreResults(draft, Storage.loadCustom()));
  const recentHistoryRef = useRef(restoreRecentHistory(draft));
  const [generatorId, setGeneratorId] = useState(
    () => (GENERATOR_MAP[draft?.generatorId] ? draft.generatorId : 'story')
  );
  const [mode, setMode] = useState(
    () => (MODES.some((m) => m.k === draft?.mode) ? draft.mode : 'hybrid')
  );
  const initialSelection = normalizeGenreSelection(
    GENERATOR_MAP[draft?.generatorId] ? draft.generatorId : 'story',
    draft?.genreSelection || { main: draft?.genre, subs: [] }
  );
  const [genre, setGenre] = useState(initialSelection.main);
  const [subgenres, setSubgenres] = useState(initialSelection.subs);
  const [workspacePage, setWorkspacePage] = useState(
    () => ['setup','chaos','forge','library'].includes(draft?.workspacePage)
      ? draft.workspacePage : 'chaos'
  );
  const [forgeDocs, setForgeDocs] = useState(
    () => draft?.forgeDocs && typeof draft.forgeDocs === 'object'
      && !Array.isArray(draft.forgeDocs) ? draft.forgeDocs : {}
  );
  const [dna, setDNA] = useState(() => normalizeDNA(draft?.creativeDNA));
  const [mutationMessage, setMutationMessage] = useState('');
  const keywordCoverage = useMemo(
    () => auditKeywordPools(GENERATORS, (gid,key)=>getPool(gid,key,custom))
      .find(report=>report.generator===generatorId),
    [generatorId,custom]
  );
  const [chaos, setChaos] = useState(() => {
    const value = Number(draft?.chaos);
    return Number.isInteger(value) && value >= 1 && value <= 5 ? value : 3;
  });
  const [draftSaved, setDraftSaved] = useState(true);
  const [reelStyle, setReelStyle] = useState(() =>
    REEL_STYLES.includes(draft?.reelStyle)
      ? draft.reelStyle
      : (motionAllowed() ? 'classic' : 'instant')
  );
  const [activeSpinStyle, setActiveSpinStyle] = useState('classic');
  const [settled, setSettled] = useState({});
  const [spinning, setSpinning] = useState({});
  const [spinText, setSpinText] = useState({});
  const [toast, setToast] = useState('');
  const [ideas, setIdeas] = useState(() => Storage.loadIdeas());
  const [search, setSearch] = useState('');
  const [libraryTab, setLibraryTab] = useState('ideas');
  const [title, setTitle] = useState('');

  const tickRef = useRef(null);
  const stopRef = useRef([]);
  const toastRef = useRef(null);

  const gen = GENERATOR_MAP[generatorId];
  const current = results[generatorId] ?? { values: {}, locks: {} };
  const filteredIdeas = useMemo(() => Storage.searchIdeas(search), [ideas, search]);
  const preview = useMemo(
    () => buildConceptPreview(generatorId, current.values),
    [generatorId, current.values]
  );
  const lockedCount = gen.slots.filter((slot) => current.locks[slot.key]).length;
  const isRolling = Object.values(spinning).some(Boolean);

  // 저장된 아이디어와 달리 현재 편집 중인 결과/잠금/옵션은 초안으로 자동 보존한다.
  useEffect(() => {
    const ok = Storage.saveDraft({ generatorId, mode, genre, genreSelection: { main: genre, subs: subgenres }, chaos, results, reelStyle, workspacePage, forgeDocs, creativeDNA: dna, recentHistory: recentHistoryRef.current });
    setDraftSaved(ok);
  }, [generatorId, mode, genre, subgenres, chaos, results, reelStyle, workspacePage, forgeDocs, dna]);

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
    setSettled({});
  }, []);

  useEffect(
    () => () => {
      if (tickRef.current) clearInterval(tickRef.current);
      stopRef.current.forEach(clearTimeout);
      if (toastRef.current) clearTimeout(toastRef.current);
    },
    []
  );

  // SPA 탭 전환 시 이전 화면의 스크롤 위치가 남아서 새 화면 제목이
  // 고정 헤더 뒤로 가려지는 문제를 방지한다.
  useEffect(() => {
    if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }
  }, [workspacePage]);

  /** 전체 생성 (잠긴 항목은 값 유지) */
  const generate = useCallback(
    (overrides = {}, options = {}) => {
      const gid = overrides.generatorId ?? generatorId;
      const nextMode = overrides.mode ?? mode;
      const nextGenre = normalizeGenreSelection(gid, { main: overrides.genre ?? genre, subs: overrides.subgenres ?? subgenres }).main;
      const nextSubs = normalizeGenreSelection(gid, { main: nextGenre, subs: overrides.subgenres ?? subgenres }).subs;
      const nextChaos = overrides.chaos ?? chaos;
      const baseDNA = normalizeDNA(overrides.dna || dna);
      const mutation = options.mutation || baseDNA.mutation;
      const drawDNA = mutation === 'rift'
        ? {...baseDNA, mutation:'rift', novelty:Math.max(3,baseDNA.novelty)}
        : {...baseDNA, mutation:'spark'};
      const target = GENERATOR_MAP[gid];
      const snapshot = results[gid] ?? { values: {}, locks: {} };
      const open = target.slots.filter((slot)=>!snapshot.locks[slot.key]);
      if (target.slots.every((slot) => snapshot.locks[slot.key])) {
        showToast('모든 항목이 잠겨 있어요. 잠금을 하나 이상 해제해 주세요');
        return;
      }
      // Signature mutation: ECHO temporarily preserves one meaningful card
      // without changing any of the user's persistent lock switches.
      const echoPreferences = {
        story:['protagonist','setting','conflict'],
        game:['mechanic','gameplay','special'],
        character:['desire','past','personality'],
        hero:['class','active','weapon']
      };
      const preserved = mutation === 'echo' && open.length > 1
        ? (echoPreferences[gid] || []).map(key=>open.find(slot=>slot.key===key && snapshot.values[key])).find(Boolean) ||
          open.find(slot=>snapshot.values[slot.key])
        : null;
      const drawLocks = preserved
        ? {...snapshot.locks,[preserved.key]:true}
        : snapshot.locks;
      const shortage = auditDNACoverage(gid,drawDNA,custom,drawLocks,snapshot.values);
      if (shortage.empty.length) {
        showToast('BAN 설정으로 후보가 없는 항목: '+shortage.empty.slice(0,3).join(' · ')+'. 설정에서 밴을 줄여 주세요.');
        return;
      }
      if (shortage.blockedLocked.length) {
        setMutationMessage('잠긴 카드에 차단된 소재가 있어요: '+shortage.blockedLocked.join(' · '));
      } else {
        setMutationMessage(preserved
          ? `ECHO · ${preserved.label}을 한 번 계승하고 나머지를 변형했어요.`
          : mutation==='rift'?'RIFT · 파격적인 차이를 우선해 추첨했어요.':'');
      }
      const finalValues = generateResult(gid, {
        mode: nextMode,
        genre: nextGenre,
        genres: { main: nextGenre, subs: nextSubs },
        chaos: nextChaos,
        custom,
        dna: drawDNA,
        locks: drawLocks,
        values: snapshot.values,
        recent: recentHistoryRef.current[gid] || {},
        previousTopics: Object.values(snapshot.values).flatMap(text=>deriveTopics({t:text}))
      });
      recentHistoryRef.current = nextRecentHistory(
        recentHistoryRef.current, gid, snapshot.values, finalValues, drawLocks, target.slots
      );

      // 연출과 무관하게 데이터는 즉시 확정 (연출 중 저장/복사 대비)
      setResults((prev) => ({ ...prev, [gid]: { values: finalValues, locks: snapshot.locks } }));
      clearAnimations();

      const unlocked = target.slots
        .filter((slot) => !drawLocks[slot.key])
        .map((slot) => slot.key);

      const isSlot = reelStyle === 'slot' || options.overdrive === true;
      // OS의 움직임 최소화 설정은 첫 기본값만 '즉시'로 정한다.
      // 사용자가 직접 클래식/슬롯을 선택했다면 명시적인 재생 의사로 존중한다.
      const animated = reelStyle !== 'instant' && animationMs > 0 && unlocked.length > 0;
      setActiveSpinStyle(isSlot ? 'slot' : 'classic');
      const completion = `${target.title} 생성 완료 · ${modeName(nextMode)}` +
        (nextMode === 'hybrid' ? ` (혼돈 ${nextChaos})` : '');

      if (animated) {
        const pools = {};
        for (const key of unlocked) pools[key] = getPool(gid, key, custom);

        // 정답을 0.07초 먼저 보여 주지 않고 이전 결과부터 슬롯을 돌린다.
        setSpinText({ ...snapshot.values });
        setSpinning(Object.fromEntries(unlocked.map((key) => [key, true])));

        const baseMs = isSlot ? Math.max(760, Math.round(animationMs * 1.15)) : animationMs;
        const staggerMs = isSlot ? Math.max(160, Math.round(animationMs * 0.1)) : STAGGER;
        const tickMs = isSlot ? 52 : SPIN_STEP;
        const start = Date.now();
        const finished = new Set();
        let frame = 0;

        tickRef.current = setInterval(() => {
          frame += 1;
          const elapsed = Date.now() - start;
          setSpinText((prev) => {
            const next = { ...prev };
            unlocked.forEach((key, index) => {
              if (finished.has(key)) return;
              const pool = pools[key];
              if (!pool?.length) return;
              const remaining = baseMs + index * staggerMs - elapsed;
              // 슬롯 연출: 처음엔 빠르게, 끝날수록 느리게.
              if (isSlot && remaining < 230 && frame % 3 !== 0) return;
              if (isSlot && remaining >= 230 && remaining < 430 && frame % 2 !== 0) return;
              next[key] = pool[Math.floor(Math.random() * pool.length)].t;
            });
            return next;
          });
        }, tickMs);

        unlocked.forEach((key, index) => {
          const timer = setTimeout(() => {
            finished.add(key);
            setSpinText((prev) => ({ ...prev, [key]: finalValues[key] }));
            setSpinning((prev) => {
              const next = { ...prev };
              delete next[key];
              return next;
            });
            if (isSlot) setSettled((prev) => ({ ...prev, [key]: true }));
            if (index === unlocked.length - 1) {
              if (tickRef.current) {
                clearInterval(tickRef.current);
                tickRef.current = null;
              }
              if (!options.silent) showToast(completion);
              const clear = setTimeout(() => setSettled({}), 550);
              stopRef.current.push(clear);
            }
          }, baseMs + index * staggerMs);
          stopRef.current.push(timer);
        });
        if (!options.silent) showToast('◈ 키워드 추첨 중…');
      } else if (!options.silent) {
        showToast(completion);
      }
    },
    [generatorId, mode, genre, subgenres, chaos, results, custom, dna, reelStyle, animationMs, clearAnimations, showToast]
  );

  const reroll = (slotKey) => {
    if (current.locks[slotKey]) {
      showToast('잠긴 항목은 재추첨되지 않습니다');
      return;
    }
    const available = auditDNACoverage(generatorId,dna,custom,current.locks,current.values);
    if (available.empty.length && available.empty.includes(gen.slots.find(s=>s.key===slotKey)?.label)) {
      showToast('차단 규칙 때문에 이 슬롯에 선택 가능한 키워드가 없어요.');
      return;
    }
    const text = rerollSlot(generatorId, slotKey, {
      mode, genre, genres: { main: genre, subs: subgenres },
      chaos, custom, dna, previous: current.values[slotKey],
      previousTopics: Object.values(current.values).flatMap(t=>deriveTopics({t})),
      recent: recentHistoryRef.current[generatorId]?.[slotKey] || []
    });
    recentHistoryRef.current = nextRecentHistory(
      recentHistoryRef.current,
      generatorId,
      current.values,
      { ...current.values, [slotKey]: text },
      Object.fromEntries(gen.slots.filter((slot) => slot.key !== slotKey).map((slot) => [slot.key, true])),
      gen.slots
    );
    setResults((prev) => ({
      ...prev,
      [generatorId]: {
        values: { ...prev[generatorId].values, [slotKey]: text },
        locks: prev[generatorId].locks
      }
    }));

    clearAnimations();
    const isSlot = reelStyle === 'slot';
    setActiveSpinStyle(isSlot ? 'slot' : 'classic');
    if (animationMs <= 0 || reelStyle === 'instant') return;

    const pool = getPool(generatorId, slotKey, custom);
    const duration = isSlot ? Math.max(520, animationMs * 0.8) : Math.max(260, animationMs * 0.6);
    const cadence = isSlot ? 52 : SPIN_STEP;
    const start = Date.now();
    let frame = 0;
    setSpinning({ [slotKey]: true });
    setSpinText((prev) => ({ ...prev, [slotKey]: current.values[slotKey] ?? '' }));

    tickRef.current = setInterval(() => {
      frame++;
      const remaining = duration - (Date.now() - start);
      if (isSlot && remaining < 180 && frame % 3 !== 0) return;
      if (isSlot && remaining >= 180 && remaining < 300 && frame % 2 !== 0) return;
      setSpinText((prev) => ({
        ...prev,
        [slotKey]: pool.length ? pool[Math.floor(Math.random() * pool.length)].t : text
      }));
    }, cadence);

    const timer = setTimeout(() => {
      setSpinText((prev) => ({ ...prev, [slotKey]: text }));
      setSpinning({});
      if (isSlot) {
        setSettled({ [slotKey]: true });
        const clear = setTimeout(() => setSettled({}), 550);
        stopRef.current.push(clear);
      }
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
    setGenre((prev) => normalizeGenreSelection(id, { main: prev, subs: subgenres }).main);
  };

  const changeGenre = (value) => {
    setGenre(value);
    setSubgenres((prev) => prev.filter((key) => key !== value));
  };
  const toggleSubgenre = (value) => {
    if (value === genre) return;
    setSubgenres((prev) => prev.includes(value)
      ? prev.filter((key) => key !== value)
      : prev.length < 3 ? [...prev, value] : prev);
  };
  const changeMode = (value) => setMode(value);
  const updateDNA = (next) => setDNA(normalizeDNA(next));
  const quickBan = (value) => {
    const text=String(value||'').trim();
    if (!text) return;
    const banned=dna.bannedExact.some(v=>v.toLocaleLowerCase()===text.toLocaleLowerCase());
    setDNA(prev=>banned
      ? {...prev,bannedExact:prev.bannedExact.filter(v=>v.toLocaleLowerCase()!==text.toLocaleLowerCase())}
      : banExact(prev,text));
    showToast(banned?'문구 차단을 해제했습니다':'문구를 밴 목록에 추가했습니다 · 다음 추첨에 적용돼요');
  };
  const quickLike = (value) => {
    if(!String(value||'').trim())return;
    setDNA(prev=>toggleLike(prev,value));
    showToast('취향 가중치를 갱신했습니다');
  };
  const beginCreation = () => {
    setWorkspacePage('chaos');
    generate();
  };
  const updateForgeDoc = (field, value) => {
    setForgeDocs((prev) => ({
      ...prev,
      [generatorId]: { ...(prev[generatorId] || {}), [field]: value }
    }));
  };

  const updateForgeField = (fieldId, text) => {
    if (!getForgeFields(generatorId).some((field) => field.id === fieldId)) return;
    setForgeDocs((prev) => {
      const doc = normalizeForgeDoc(generatorId, prev[generatorId]);
      return {
        ...prev,
        [generatorId]: {
          ...doc,
          fields: { ...doc.fields, [fieldId]: text.slice(0, 12000) }
        }
      };
    });
  };

  /** Append an explicitly requested source snippet; never replace written prose. */
  const importForgeField = (fieldId, snippet) => {
    if (!getForgeFields(generatorId).some((field) => field.id === fieldId)) return;
    const input = typeof snippet === 'string' ? snippet.trim() : '';
    if (!input) return;
    const doc = normalizeForgeDoc(generatorId, forgeDocs[generatorId]);
    const previous = doc.fields[fieldId] || '';
    if (previous.includes(input)) {
      showToast('이미 이 키워드를 가져왔습니다');
      return;
    }
    const combined = [previous.trimEnd(), input].filter(Boolean).join('\n');
    updateForgeField(fieldId, combined);
    showToast('기존 문장을 유지하고 키워드를 추가했습니다');
  };

  /** 폭주: 선택한 장르는 유지, 하이브리드 혼돈 5로 잠금 항목을 제외하고 재추첨. */
  const overdrive = () => {
    if (lockedCount === gen.slots.length) {
      showToast('모든 항목이 잠겨 있어요. 잠금을 하나 이상 해제해 주세요');
      return;
    }
    generate({ mode: 'hybrid', chaos: 5 }, { overdrive: true });
  };

  const buildText = () => {
    const lines = [
      `◈ CHAOS FORGE · ${gen.tab} (${gen.title})`,
      `모드: ${modeName(mode)} | 장르: ${[genre, ...subgenres].map((key) => GENRE_NAME_MAP[key] || key).join(' × ')}` +
        (mode === 'hybrid' ? ` | 혼돈: ${chaos}/5` : ''),
      '----------------------------'
    ];
    for (const slot of gen.slots) {
      const value = current.values[slot.key];
      if (value) lines.push(`[${slot.label}] ${value}${current.locks[slot.key] ? '  ⛒잠금' : ''}`);
    }
    return lines.join('\n');
  };

  const copyText = async (text, label) => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(text);
      showToast(`${label} 복사 완료`);
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
      showToast(ok ? `${label} 복사 완료` : '복사에 실패했습니다. 직접 선택해 복사해 주세요');
    }
  };

  const copy = () => copyText(buildText(), '결과');
  const copyConcept = () => copyText(preview.text, '콘셉트');

  const buildForgeDocument = () =>
    buildForgeExportData(generatorId, forgeDocs[generatorId], current.values);
  const copyForgeDocument = () => copyText(buildForgeMarkdown(buildForgeDocument()), '기획서');
  const exportForgeDocument = (format) => {
    const data = buildForgeDocument();
    const isJson = format === 'json';
    const ok = downloadFile(
      buildFilename('forge-' + generatorId, isJson ? 'json' : 'md'),
      isJson ? JSON.stringify(data, null, 2) : buildForgeMarkdown(data),
      isJson ? 'application/json;charset=utf-8' : 'text/markdown;charset=utf-8'
    );
    showToast(ok ? 'FORGE 기획서를 내보냈습니다' : '파일 저장을 지원하지 않는 브라우저입니다');
    return ok;
  };

  /** 결과를 마크다운/JSON 파일로 내려받는다 */
  const exportResult = (format) => {
    const isJson = format === 'json';
    const data = buildExportData({
      generatorId,
      mode,
      genre,
      genres: { main: genre, subs: subgenres },
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
      genres: { main: genre, subs: subgenres },
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
    const restored = normalizeGenreSelection(idea.generator, idea.genres || { main: idea.genre, subs: [] });
    setGenre(restored.main);
    setSubgenres(restored.subs);
    setChaos(Number(idea.chaos) || 3);

    const values = {};
    for (const [key, value] of Object.entries(idea.values || {})) values[key] = String(value);
    setResults((prev) => ({ ...prev, [idea.generator]: { values, locks: {} } }));

    setWorkspacePage('chaos');
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

  const pages = [
    { id: 'setup', en: 'SETUP', ko: '설정실' },
    { id: 'chaos', en: 'CHAOS', ko: '생성실' },
    { id: 'forge', en: 'FORGE', ko: '창작실' },
    { id: 'library', en: 'LIBRARY', ko: '보관함' }
  ];
  const selectedGenreNames = [genre, ...subgenres].map(
    (key) => ALL_GENRES.find((item) => item.k === key)?.n || key
  );

  return (
    <>
      <header className="site-header v2-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">✦</span>
          <div className="brand-text">
            <h1>CHAOS FORGE</h1>
            <p>CREATE THE IMPOSSIBLE · PROJECT REFORGE</p>
          </div>
          <span className="v2-beta">V2.0 ALPHA</span>
        </div>
        <nav className="workspace-nav" aria-label="창작 공간 이동">
          {pages.map((page, index) => (
            <button type="button" key={page.id}
              className={`workspace-tab${page.id === workspacePage ? ' selected' : ''}`}
              aria-current={workspacePage === page.id ? 'page' : undefined}
              onClick={() => { clearAnimations(); setWorkspacePage(page.id); }}>
              <small>{String(index + 1).padStart(2, '0')}</small>
              <strong>{page.en}</strong>
              <span>{page.ko}</span>
            </button>
          ))}
        </nav>
      </header>

      <main className="wrap v2-wrap" data-screen={workspacePage}>
        <div className="v2-statusbar">
          <span>✦ 현재 작업 · {gen.title} <em>{selectedGenreNames.join(' × ')}</em></span>
          <span className={`autosave-status${draftSaved ? '' : ' is-error'}`} role="status">
            {draftSaved ? '● 이 브라우저에 자동 저장됨' : '⚠ 자동 저장 실패 · JSON 백업 권장'}
          </span>
        </div>

        {workspacePage === 'setup' && (
          <SetupScreen
            generatorId={generatorId}
            onGeneratorChange={switchGenerator}
            mainGenre={genre}
            subgenres={subgenres}
            onMainChange={changeGenre}
            onSubChange={toggleSubgenre}
            mode={mode}
            onModeChange={changeMode}
            chaos={chaos}
            onChaosChange={setChaos}
            dna={dna} onDNAChange={updateDNA} keywordCoverage={keywordCoverage}
            onBegin={beginCreation}
          />
        )}

        {workspacePage === 'chaos' && (
          <section className="v2-screen chaos-screen" aria-labelledby="chaosTitle">
            <div className="v2-intro chaos-intro">
              <p className="v2-kicker">02 / CHAOS — THE RANDOM CHAMBER</p>
              <h2 id="chaosTitle">가능성을 추첨하세요.</h2>
              <p>마음에 드는 설정은 잠그고, 나머지는 원하는 만큼 다시 뽑으세요.</p>
            </div>

            <div className="chaos-toolbar">
              <nav className="tabs" id="generatorTabs" role="tablist" aria-label="생성기 선택">
                {GENERATORS.map((g) => (
                  <button type="button" key={g.id} className="tab" role="tab"
                    aria-selected={g.id === generatorId}
                    title={`${g.title} — ${g.desc}`}
                    onClick={() => switchGenerator(g.id)}>
                    {g.tab}
                  </button>
                ))}
              </nav>
              <button type="button" className="v2-edit-setup" onClick={() => setWorkspacePage('setup')}>
                설정 편집 ↗
              </button>
            </div>

            <div className="chaos-formula" aria-label="현재 장르 설정">
              {selectedGenreNames.map((name, i) => (
                <span key={i} className={`chaos-genre-pill${i === 0 ? ' main' : ''}`}>
                  {i === 0 ? '♛ ' : '+ '}{name}
                </span>
              ))}
              <span className="chaos-meta">· {modeName(mode)}{mode === 'hybrid' ? ` · 혼돈 ${chaos}/5` : ''}</span>
            </div>
            <div className="dna-active-summary">
              <span>CREATIVE DNA</span>
              <strong>{dna.detail==='brief'?'간결':dna.detail==='detailed'?'구체적':'기본'} 표현 · 독창성 {dna.novelty}/4</strong>
              <span>⛔ 차단 {dna.bannedExact.length+dna.bannedTopics.length+dna.bannedStyles.length}개</span>
              <button type="button" className="btn btn-outline" onClick={()=>setWorkspacePage('setup')}>취향·밴 편집</button>
            </div>

            <div className="mutation-deck" aria-label="CHAOS FORGE 변이 방식">
              <div>
                <strong>✦ CREATIVE DNA · 변이 방식</strong>
                <p>SPARK 새 발상 / ECHO 핵심 한 조각 계승 / RIFT 과감한 변형</p>
              </div>
              <div className="mutation-controls" role="group" aria-label="변이 모드 선택">
                {[
                  ['spark','SPARK'],
                  ['echo','ECHO'],
                  ['rift','RIFT']
                ].map(([id,label])=>(
                  <button type="button" key={id} className={`mutation-btn${dna.mutation===id?' selected':''}`}
                    aria-pressed={dna.mutation===id} onClick={()=>updateDNA({...dna,mutation:id})}>{label}</button>
                ))}
              </div>
            </div>
            {mutationMessage && <p className="mutation-result" role="status">{mutationMessage}</p>}
            <div className="chaos-control-deck">
              <div className="chaos-deck-main">
                <div className="chaos-deck-heading">
                  <span className="v2-kicker">THE GENERATOR</span>
                  <strong>준비됐나요? 새로운 조합을 발견하세요.</strong>
                  <p>마음에 드는 키워드는 잠그고 다시 뽑을 수 있어요.</p>
                </div>
                <div className="chaos-primary-actions">
                  <button type="button" className="btn btn-primary v2-generate" id="generateBtn"
                    aria-busy={isRolling}
                    onClick={() => generate()}>{isRolling ? '◈ 추첨 진행 중…' : '◈ 전체 추첨'}</button>
                  <button type="button" className="btn btn-overdrive" id="overdriveBtn"
                    title="설정을 바꾸지 않고 이번 추첨에만 혼돈 5 적용"
                    onClick={overdrive}>⚡ 폭주 추첨</button>
                </div>
              </div>
              <div className="chaos-deck-options">
                <div className="reel-presets" role="group" aria-label="랜덤 연출 방식">
                  <span className="reel-presets-label">추첨 연출</span>
                  {[
                    ['slot', '슬롯'],
                    ['classic', '클래식'],
                    ['instant', '즉시']
                  ].map(([key, label]) => (
                    <button type="button" key={key} className="reel-preset"
                      aria-pressed={reelStyle === key}
                      onClick={() => { clearAnimations(); setReelStyle(key); }}>
                      {label}
                    </button>
                  ))}
                </div>
                <button type="button" className="btn btn-ghost chaos-unlock" id="unlockAllBtn"
                  onClick={unlockAll}>모든 잠금 해제</button>
              </div>
            </div>

            <div className="reel-status" role="status" aria-live="polite">
              <span className={`reel-dot${isRolling ? ' is-active' : ''}`} aria-hidden="true" />
              {isRolling
                ? `${activeSpinStyle === 'slot' ? '🎰 슬롯' : '✦ 클래식'} 추첨 진행 중 · ${Object.keys(spinning).length}개 남음 · 순차 확정`
                : `${lockedCount}개 고정 · ${gen.slots.length - lockedCount}개 재추첨 가능`}
            </div>
            <div className="chaos-result-heading">
              <h3>추첨 결과 <span>{gen.slots.length}개 항목</span></h3>
              <p>키워드를 클릭해 수정 · <span aria-hidden="true">🔒</span> 고정 · <span aria-hidden="true">↻</span> 개별 재추첨</p>
            </div>
            <section className={`results ${activeSpinStyle === 'slot' ? 'is-slot' : 'is-classic'}`}
              id="results" aria-live="off" aria-label="생성 결과">
              {gen.slots.map((slot) => {
                const isSpinning = Boolean(spinning[slot.key]);
                const value = isSpinning
                  ? spinText[slot.key] ?? current.values[slot.key] ?? ''
                  : current.values[slot.key] ?? '';
                return (
                  <ResultCard key={`${gen.id}-${slot.key}`} slotKey={slot.key}
                    label={slot.label} value={value} locked={Boolean(current.locks[slot.key])}
                    spinning={isSpinning} settled={Boolean(settled[slot.key])}
                    onChange={(text) => updateValue(slot.key, text)}
                    onLock={() => toggleLock(slot.key)}
                    onReroll={() => reroll(slot.key)}
                    onBan={() => quickBan(current.values[slot.key])}
                    onLike={() => quickLike(current.values[slot.key])}
                    isLiked={dna.likes.includes(current.values[slot.key])}
                    isBanned={dna.bannedExact.includes(current.values[slot.key])}
                  />
                );
              })}
            </section>

            <div className="chaos-after-actions">
              <button type="button" className="btn btn-accent v2-forge-cta"
                onClick={() => { clearAnimations(); setWorkspacePage('forge'); }}>
                ✧ 이 아이디어 다듬기 → FORGE
              </button>
              <div className="chaos-utility-actions">
                <button type="button" className="btn btn-outline" id="copyBtn" onClick={copy}>결과 복사</button>
                <button type="button" className="btn btn-outline" id="exportMdBtn"
                  onClick={() => exportResult('md')}>MD</button>
                <button type="button" className="btn btn-outline" id="exportJsonBtn"
                  onClick={() => exportResult('json')}>JSON</button>
              </div>
            </div>

            <details className="v2-save-details">
              <summary>+ 이 조합을 보관함에 저장</summary>
              <div className="result-actions">
                <input id="ideaTitle" type="text" className="input input-inline"
                  placeholder="아이디어 제목 (선택)" maxLength={60}
                  value={title} onChange={(e) => setTitle(e.target.value)} />
                <button type="button" className="btn btn-accent" id="saveBtn"
                  onClick={saveIdea}>아이디어 저장</button>
              </div>
            </details>
          </section>
        )}

        {workspacePage === 'forge' && (
          <ForgeWorkspace key={generatorId}
            generator={gen} values={current.values} preview={preview}
            isRolling={isRolling} lockedCount={lockedCount} doc={forgeDocs[generatorId] || {}}
            onUpdate={updateForgeDoc} onUpdateField={updateForgeField}
            onImportField={importForgeField}
            onExport={exportForgeDocument} onCopyDocument={copyForgeDocument}
            onCopy={copyConcept} saved={draftSaved}
            onBack={() => setWorkspacePage('chaos')} />
        )}

        {workspacePage === 'library' && (
          <section className="v2-screen library-screen" aria-labelledby="libraryTitle">
            <div className="v2-intro">
              <p className="v2-kicker">04 / LIBRARY — YOUR CREATIVE ARCHIVE</p>
              <h2 id="libraryTitle">아이디어를 잃지 마세요.</h2>
              <p>저장된 아이디어와 직접 추가한 키워드를 별도 탭으로 관리하세요.</p>
            </div>
            <div className="library-switch" role="tablist" aria-label="보관함 카테고리">
              <button type="button" role="tab" aria-selected={libraryTab === 'ideas'}
                className={`library-switch-tab${libraryTab === 'ideas' ? ' selected' : ''}`}
                onClick={() => setLibraryTab('ideas')}>
                저장된 아이디어 <span>{ideas.length}</span>
              </button>
              <button type="button" role="tab" aria-selected={libraryTab === 'custom'}
                className={`library-switch-tab${libraryTab === 'custom' ? ' selected' : ''}`}
                onClick={() => setLibraryTab('custom')}>
                사용자 키워드 <span>{custom.length}</span>
              </button>
            </div>
            <div className="panels">
              {libraryTab === 'ideas' ? (
                <IdeasPanel ideas={filteredIdeas} total={ideas.length} search={search}
                  onSearch={setSearch} onLoad={loadIdea} onDelete={deleteIdea} />
              ) : (
                <CustomPanel custom={custom} onAdd={addCustom} onDelete={deleteCustom} />
              )}
            </div>
          </section>
        )}
      </main>

      <footer className="site-footer">
        <p>CHAOS FORGE · PROJECT REFORGE ALPHA · 저장 자료는 이 브라우저에만 보관됩니다.</p>
      </footer>
      <div className={`toast${toast ? ' is-show' : ''}`} id="toast"
        role="status" aria-live="polite">{toast}</div>
    </>
  );
}
