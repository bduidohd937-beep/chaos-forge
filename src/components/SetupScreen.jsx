import { useState } from 'react';
import { ALL_GENRES, GENERATORS, MODES } from '../engine.js';
import CreativeDnaPanel from './CreativeDnaPanel.jsx';
import BanManager from './BanManager.jsx';

const FEATURED_SUBGENRES = new Set([
  '로', '미', '코', '공', 'SF', '무', '일', '스', '액션', 'RPG', '생존'
]);
const MODE_HINTS = {
  genre: '장르에 집중',
  hybrid: '장르 + 의외성',
  random: '제약 없이 발견'
};
const DETAILS = [
  ['brief', '키워드', '한 단어 · 소재 중심'],
  ['balanced', '기본문장', '설정 한 문장'],
  ['detailed', '구체설정', '배경·원인·대가']
];
const detailName = (detail) => DETAILS.find(item => item[0] === detail)?.[1] || '기본';

export default function SetupScreen({
  generatorId, onGeneratorChange, mainGenre, subgenres, onMainChange, onSubChange,
  mode, onModeChange, chaos, onChaosChange, onBegin, dna, onDNAChange, keywordCoverage,
  initialAdvanced = false
  , enabledSlots = {}, onToggleSlot
}) {
  const [subOpen, setSubOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(initialAdvanced);
  const [showAllGenres, setShowAllGenres] = useState(false);
  const [genreSearch, setGenreSearch] = useState('');
  const needle = genreSearch.trim().toLocaleLowerCase();
  const generator = GENERATORS.find((item) => item.id === generatorId);
  // Keep the legacy combined picker available for saved-work compatibility;
  // the generator's own list is shown first and the remaining vocabulary is
  // retained as an explicitly separate "세계관·테마" group below.
  // Keep the primary genre scoped to the active generator family. The shared
  // vocabulary stays visible as disabled compatibility options so saved
  // hybrid work remains understandable without allowing an invalid main key.
  const primaryKeys = new Set((generator?.genreList || []).map(item => item.k));
  const genreOptions = [
    ...(generator?.genreList || []),
    ...ALL_GENRES.filter(item => !primaryKeys.has(item.k))
  ];
  const filteredSubgenres = ALL_GENRES.filter((item) => {
    if (item.k === mainGenre) return false;
    if (needle) return item.n.toLocaleLowerCase().includes(needle);
    return showAllGenres || FEATURED_SUBGENRES.has(item.k) || subgenres.includes(item.k);
  });
  const genreLabel = (key) => ALL_GENRES.find(item => item.k === key)?.n ?? key;
  const genLabel = GENERATORS.find(item => item.id === generatorId)?.tab || 'STORY';
  const modeLabel = MODES.find(item => item.k === mode)?.n || '하이브리드';
  const bans = dna.bannedTopics.length + dna.bannedStyles.length + dna.bannedExact.length;

  return (
    <section className="v2-screen setup-screen quick-setup" aria-labelledby="setupTitle">
      <div className="v2-intro quick-setup-intro">
        <p className="v2-kicker">01 / SETUP — QUICK CREATE</p>
        <h2 id="setupTitle">세 가지만 정하고, 바로 창조하세요.</h2>
        <p>창작 유형과 장르, 생성 스타일을 선택하세요. 더 자세한 조절은 아래 고급 설정에서 할 수 있어요.</p>
      </div>

      <div className="quick-setup-flow">
        <section className="v2-panel setup-block quick-setup-block quick-generator-step" aria-labelledby="generatorHeading">
          <div className="setup-block-head">
            <span className="setup-step">01</span>
            <div>
              <h3 id="generatorHeading">무엇을 만들까요?</h3>
              <p>창작할 작품 유형을 선택해 주세요.</p>
            </div>
          </div>
          <div className="setup-generator-grid quick-generator-tabs" role="group" aria-label="창작 유형 선택">
            {GENERATORS.map(gen => (
              <button type="button" key={gen.id}
                className={`setup-generator${generatorId === gen.id ? ' selected' : ''}`}
                aria-pressed={generatorId === gen.id}
                aria-label={`${gen.tab} 생성기 선택`}
                title={gen.desc}
                onClick={() => onGeneratorChange(gen.id)}>
                <span className="setup-generator-symbol" aria-hidden="true">
                  {gen.id === 'story' ? '✧' : gen.id === 'game' ? '◈' : gen.id === 'character' ? '◇' : '⚔'}
                </span>
                <strong>{gen.tab}</strong>
              </button>
            ))}
          </div>
          <div className="slot-settings" aria-label="생성 슬롯 설정">
            <div className="setup-block-head slot-settings-head"><div><h4>사용할 구성 요소</h4><p>끄면 추첨·재추첨·품질 검사에서 제외되고 값은 보존돼요.</p></div></div>
            <div className="slot-toggle-grid">
              {(GENERATORS.find((item) => item.id === generatorId)?.slots || []).map((slot) => {
                const on = enabledSlots[slot.key] !== false;
                return <button type="button" key={slot.key} className={`slot-setting${on ? ' selected' : ''}`} aria-pressed={on} onClick={() => onToggleSlot?.(slot.key)}>
                  <span>{on ? '✓' : '○'}</span>{slot.label}<small>{on ? '사용' : '비활성'}</small>
                </button>;
              })}
            </div>
          </div>
        </section>

        <div className="quick-setup-grid">
          <section className="v2-panel setup-block quick-setup-block" aria-labelledby="genreHeading">
          <div className="setup-block-head">
            <span className="setup-step">02</span>
            <div>
              <h3 id="genreHeading">어떤 장르인가요?</h3>
              <p>메인 장르 하나만 골라도 시작할 수 있어요.</p>
            </div>
          </div>
          <div className="setup-primary">
            <label htmlFor="genreSelect">메인 장르 <span className="required-mark">필수 · 1개</span></label>
            <select className="input" id="genreSelect" value={primaryKeys.has(mainGenre) ? mainGenre : generator?.genreList?.[0]?.k}
              onChange={event => onMainChange(event.target.value)}>
              {genreOptions.map(item => <option key={item.k} value={item.k} disabled={!primaryKeys.has(item.k)}>{item.n}{!primaryKeys.has(item.k) ? ' · 호환 테마' : ''}</option>)}
            </select>
          </div>
          <div className="quick-sub-summary">
            <div className="setup-sub-heading">
              <strong>서브 장르 <small className="setup-optional">(선택)</small></strong>
              <span aria-live="polite">{subgenres.length} / 3</span>
            </div>
            <div className="quick-sub-tags" aria-live="polite">
              {subgenres.length ? subgenres.map(key => (
                <button type="button" className="quick-sub-tag" key={key}
                  aria-label={`${genreLabel(key)} 서브 장르 제거`}
                  onClick={() => onSubChange(key)}>
                  {genreLabel(key)} <span aria-hidden="true">×</span>
                </button>
              )) : <span className="quick-sub-empty">추가하지 않아도 돼요.</span>}
            </div>
            <button type="button" className="quick-sub-toggle"
              aria-expanded={subOpen} aria-controls="quickSubPicker"
              onClick={() => setSubOpen(value => !value)}>
              {subOpen ? '서브 장르 닫기' : '+ 서브 장르 선택'}
              <span aria-hidden="true">{subOpen ? '▴' : '▾'}</span>
            </button>
          </div>
          {subOpen && (
            <div className="setup-genre-picker quick-sub-picker" id="quickSubPicker">
              <label htmlFor="subGenreSearch" className="setup-search-label">장르 검색</label>
              <div className="setup-search-row">
                <input id="subGenreSearch" className="input setup-genre-search" type="search"
                  value={genreSearch} onChange={event => setGenreSearch(event.target.value)}
                  placeholder="예: SF, 로맨스" />
                <button type="button" className="setup-expand-btn"
                  aria-expanded={showAllGenres}
                  onClick={() => setShowAllGenres(prev => !prev)}>
                  {showAllGenres ? '추천만 보기' : '전체 장르 보기'}
                  <span aria-hidden="true">{showAllGenres ? ' ▴' : ' ▾'}</span>
                </button>
              </div>
              <div className="v2-genre-grid" role="group" aria-label="서브 장르 선택">
                {filteredSubgenres.map(item => {
                  const selected = subgenres.includes(item.k);
                  return (
                    <button key={item.k} type="button"
                      className={`genre-tile${selected ? ' selected' : ''}`}
                      aria-pressed={selected}
                      disabled={!selected && subgenres.length >= 3}
                      onClick={() => onSubChange(item.k)}>
                      {selected ? '✓ ' : '+ '}{item.n}
                    </button>
                  );
                })}
                {!filteredSubgenres.length &&
                  <p className="setup-genre-empty">해당하는 장르가 없어요. 다른 이름으로 검색해 보세요.</p>}
              </div>
              <p className="setup-tip">최대 3개까지 자유롭게 조합할 수 있어요.</p>
            </div>
          )}
        </section>

      <section className="v2-panel quick-style" aria-labelledby="quickStyleHeading">
        <div className="setup-block-head">
          <span className="setup-step">03</span>
          <div>
            <h3 id="quickStyleHeading">어떤 느낌으로 만들까요?</h3>
            <p>추첨 방식과 결과의 구체성을 고르면 준비 끝!</p>
          </div>
        </div>
        <div className="quick-style-controls">
          <fieldset className="quick-style-fieldset">
            <legend>조합 방식</legend>
            <div className="setup-mode-list" role="radiogroup" aria-label="랜덤 모드">
              {MODES.map(item => (
                <button type="button" key={item.k} role="radio"
                  className={`setup-mode${mode === item.k ? ' selected' : ''}`}
                  aria-label={item.n} aria-checked={mode === item.k}
                  onClick={() => onModeChange(item.k)}>
                  <span className="quick-radio" aria-hidden="true">{mode === item.k ? '◉' : '○'}</span>
                  <span className="setup-mode-copy">
                    <strong>{item.n}</strong>
                    <small>{MODE_HINTS[item.k]}</small>
                  </span>
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset className="quick-style-fieldset">
            <legend>표현의 구체성</legend>
            <div className="dna-option-row quick-detail-choices" role="group" aria-label="표현 길이">
              {DETAILS.map(([id, label, hint]) => (
                <button type="button" key={id}
                  className={`dna-choice${dna.detail === id ? ' selected' : ''}`}
                  aria-pressed={dna.detail === id}
                  onClick={() => onDNAChange({ ...dna, detail: id })}>
                  <strong>{label}</strong>
                  <small>{hint}</small>
                </button>
              ))}
            </div>
            <p className="dna-hint">기본 제공 소재는 한 단어·기본문장·구체설정을 별도로 작성했어요. 직접 추가한 소재는 입력한 문구를 그대로 사용해요.</p>
          </fieldset>
        </div>
      </section>
        </div>
      </div>

      <section className="quick-setup-launch" aria-label="현재 선택 및 생성 시작">
        <div className="quick-setup-review">
          <p className="v2-kicker">READY TO CREATE</p>
          <strong>{genLabel} · {genreLabel(primaryKeys.has(mainGenre) ? mainGenre : generator?.genreList?.[0]?.k)}{subgenres.length ? ` + ${subgenres.map(genreLabel).join(' + ')}` : ''}</strong>
          <span>{modeLabel} · {detailName(dna.detail)} 표현{mode === 'hybrid' ? ` · 혼돈 ${chaos}/5` : ''}{bans ? ` · 밴 ${bans}개` : ''}</span>
          <small>기존 결과는 유지되고 새 추첨부터 현재 설정이 적용돼요.</small>
        </div>
        <button type="button" className="btn btn-primary setup-start quick-launch-button"
          onClick={onBegin}>◈ 이 설정으로 창조하기 →</button>
      </section>

      <section className="quick-advanced" aria-labelledby="advancedSetupHeading">
        <button type="button" className="quick-advanced-toggle"
          aria-expanded={advancedOpen} aria-controls="advancedSetupContent"
          onClick={() => setAdvancedOpen(open => !open)}>
          <span className="quick-advanced-icon" aria-hidden="true">⚙</span>
          <span className="quick-advanced-label">
            <strong id="advancedSetupHeading">고급 설정</strong>
            <small>혼돈 · 취향 추천 · 소재 차단 (각각 따로 관리)</small>
          </span>
          <span className="quick-advanced-summary">
            독창성 {dna.novelty}/4 · 밴 {bans}개
          </span>
          <span className="quick-advanced-chevron" aria-hidden="true">{advancedOpen ? '▴' : '▾'}</span>
        </button>
        {advancedOpen && (
          <div id="advancedSetupContent" className="quick-advanced-content">
            <section className={`setup-chaos${mode !== 'hybrid' ? ' is-disabled' : ''}`}
              id="chaosControl" aria-label="혼돈 강도">
              <div className="setup-sub-heading">
                <label htmlFor="chaosRange">혼돈 레벨</label>
                <strong id="chaosValue">{chaos}<span className="dim"> / 5</span></strong>
              </div>
              <input type="range" id="chaosRange" min="1" max="5" step="1"
                disabled={mode !== 'hybrid'} value={chaos}
                onChange={event => onChaosChange(Number(event.target.value))} />
              <div className="chaos-scale"><span>정석</span><span>혼합</span><span>붕괴</span></div>
              <p className="dna-hint">혼돈은 서로 다른 장르 요소를 섞는 정도예요. 독창성과는 별개예요.</p>
            </section>
            <div className="ux22-preference-cards">
              <CreativeDnaPanel dna={dna} onChange={onDNAChange} coverage={keywordCoverage} />
              <BanManager dna={dna} onChange={onDNAChange} />
            </div>
          </div>
        )}
      </section>
    </section>
  );
}
