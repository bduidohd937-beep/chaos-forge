import { useState } from 'react';
import { ALL_GENRES, GENERATORS, MODES } from '../engine.js';

const FEATURED_SUBGENRES = new Set([
  '로', '미', '코', '공', 'SF', '무', '일', '스', '액션', 'RPG', '생존'
]);

const MODE_DESCRIPTIONS = {
  genre: '선택한 장르의 특징을 우선해서 조화로운 아이디어를 뽑아요.',
  random: '장르 경계를 벗어나 예상하지 못한 조합을 발견해요.',
  hybrid: '장르의 방향을 유지하면서 의외의 요소를 섞어요.'
};

export default function SetupScreen({
  generatorId, onGeneratorChange, mainGenre, subgenres, onMainChange, onSubChange,
  mode, onModeChange, chaos, onChaosChange, onBegin
}) {
  const [showAllGenres, setShowAllGenres] = useState(false);
  const [genreSearch, setGenreSearch] = useState('');
  const needle = genreSearch.trim().toLocaleLowerCase();
  const filteredSubgenres = ALL_GENRES.filter((item) => {
    if (item.k === mainGenre) return false;
    if (needle) return item.n.toLocaleLowerCase().includes(needle);
    return showAllGenres || FEATURED_SUBGENRES.has(item.k) || subgenres.includes(item.k);
  });
  const genreLabel = (key) => ALL_GENRES.find((item) => item.k === key)?.n ?? key;

  return (
    <section className="v2-screen setup-screen" aria-labelledby="setupTitle">
      <div className="v2-intro">
        <p className="v2-kicker">01 / SETUP — CREATIVE CONFIGURATION</p>
        <h2 id="setupTitle">새로운 세계의 규칙을 정하세요.</h2>
        <p>먼저 만들고 싶은 작품을 고른 뒤, 장르를 조합하세요. 복잡한 설정은 이 방에서만 다룹니다.</p>
      </div>

      <div className="setup-columns">
        <div className="setup-main">
          <section className="v2-panel setup-block" aria-labelledby="generatorHeading">
            <div className="setup-block-head">
              <span className="setup-step">01</span>
              <div>
                <h3 id="generatorHeading">무엇을 창조할까요?</h3>
                <p>생성기를 선택하면 각 작업에 맞는 슬롯이 준비돼요.</p>
              </div>
            </div>
            <div className="setup-generator-grid">
              {GENERATORS.map((gen) => (
                <button type="button" key={gen.id}
                  className={`setup-generator${generatorId === gen.id ? ' selected' : ''}`}
                  aria-pressed={generatorId === gen.id}
                  onClick={() => onGeneratorChange(gen.id)}>
                  <span className="setup-generator-symbol" aria-hidden="true">
                    {gen.id === 'story' ? '✧' : gen.id === 'game' ? '◈' : gen.id === 'character' ? '◇' : '⚔'}
                  </span>
                  <strong>{gen.tab}</strong>
                  <small>{gen.desc}</small>
                </button>
              ))}
            </div>
          </section>

          <section className="v2-panel setup-block" aria-labelledby="genreHeading">
            <div className="setup-block-head">
              <span className="setup-step">02</span>
              <div>
                <h3 id="genreHeading">장르를 조합하세요.</h3>
                <p>메인은 이야기의 중심. 서브는 분위기와 사건에 예상 밖의 색을 더해요.</p>
              </div>
            </div>

            <div className="setup-primary">
              <label htmlFor="genreSelect">메인 장르 <span className="required-mark">필수 · 1개</span></label>
              <select className="input" id="genreSelect" value={mainGenre}
                onChange={(e) => onMainChange(e.target.value)}>
                {ALL_GENRES.map((gen) => <option key={gen.k} value={gen.k}>{gen.n}</option>)}
              </select>
            </div>

            <div className="setup-sub-heading">
              <strong>서브 장르 <small className="setup-optional">(선택)</small></strong>
              <span aria-live="polite">{subgenres.length} / 3 선택</span>
            </div>
            <div className="setup-genre-picker">
              <label htmlFor="subGenreSearch" className="setup-search-label">원하는 장르 검색</label>
              <div className="setup-search-row">
                <input
                  id="subGenreSearch"
                  className="input setup-genre-search"
                  type="search"
                  value={genreSearch}
                  onChange={(event) => setGenreSearch(event.target.value)}
                  placeholder="장르 이름 검색 (예: SF, 로맨스)"
                />
                <button type="button" className="setup-expand-btn"
                  aria-expanded={showAllGenres}
                  onClick={() => setShowAllGenres((prev) => !prev)}>
                  {showAllGenres ? '추천만 보기' : '전체 장르 보기'}
                  <span aria-hidden="true">{showAllGenres ? ' ▴' : ' ▾'}</span>
                </button>
              </div>
              <div className="setup-picked" aria-live="polite">
                {subgenres.length ? (
                  <>
                    <span>선택한 서브</span>
                    {subgenres.map((key) => (
                      <span key={key} className="setup-picked-tag">{genreLabel(key)}</span>
                    ))}
                  </>
                ) : <span>아직 서브 장르가 없어요. 최대 3개까지 선택 가능해요.</span>}
              </div>
              <div className="v2-genre-grid" role="group" aria-label="서브 장르 선택">
                {filteredSubgenres.map((g) => {
                  const selected = subgenres.includes(g.k);
                  return (
                    <button key={g.k} type="button" className={`genre-tile${selected ? ' selected' : ''}`}
                      aria-pressed={selected}
                      disabled={!selected && subgenres.length >= 3}
                      onClick={() => onSubChange(g.k)}>
                      {selected ? '✓ ' : '+ '}{g.n}
                    </button>
                  );
                })}
                {filteredSubgenres.length === 0 &&
                  <p className="setup-genre-empty">해당하는 장르가 없어요. 다른 이름으로 검색해 보세요.</p>}
              </div>
            </div>
            <p className="setup-tip">처음엔 추천 장르만 보여요. 전체 장르를 열거나 검색하면 자유롭게 조합할 수 있어요.</p>
          </section>
        </div>

        <aside className="setup-side">
          <section className="v2-panel setup-block" aria-labelledby="randomHeading">
            <div className="setup-block-head">
              <span className="setup-step">03</span>
              <div><h3 id="randomHeading">어떻게 섞을까요?</h3><p>키워드의 자유도를 선택하세요.</p></div>
            </div>
            <div className="setup-mode-list" role="radiogroup" aria-label="랜덤 모드">
              {MODES.map((item) => (
                <button type="button" role="radio" key={item.k}
                  className={`setup-mode${mode === item.k ? ' selected' : ''}`}
                  aria-label={item.n} aria-checked={mode === item.k}
                  onClick={() => onModeChange(item.k)}>
                  <span aria-hidden="true">{mode === item.k ? '◉' : '○'}</span>
                  <span className="setup-mode-copy">
                    <strong>{item.n}</strong>
                    <small>{MODE_DESCRIPTIONS[item.k]}</small>
                  </span>
                </button>
              ))}
            </div>
            <div className={`setup-chaos${mode !== "hybrid" ? " is-disabled" : ""}`} id="chaosControl">
              <div className="setup-sub-heading">
                <label htmlFor="chaosRange">혼돈 레벨</label>
                <strong id="chaosValue">{chaos}<span className="dim"> / 5</span></strong>
              </div>
              <input type="range" id="chaosRange" min="1" max="5" step="1"
                disabled={mode !== 'hybrid'} value={chaos}
                onChange={(e) => onChaosChange(Number(e.target.value))} />
              <div className="chaos-scale"><span>정석</span><span>혼합</span><span>붕괴</span></div>
            </div>
          </section>

          <section className="v2-panel setup-summary" aria-label="현재 장르 조합">
            <span className="v2-kicker">READY TO CREATE · 현재 설정</span>
            <h3>{genreLabel(mainGenre)}</h3>
            <div className="v2-tags">
              {subgenres.map((key) => (
                <span className="v2-tag" key={key}>+ {genreLabel(key)}</span>
              ))}
              {!subgenres.length && <span className="setup-empty-sub">서브 장르 없음 · 정통 장르</span>}
            </div>
            <p className="setup-summary-caption">설정이 마음에 든다면 생성실로 이동해서 키워드를 추첨해 보세요.</p>
            <button type="button" className="btn btn-primary btn-block setup-start"
              onClick={onBegin}>◈ 이 설정으로 창조하기 →</button>
            <span className="setup-footnote">기존 결과는 보존되고, 다음 추첨에 새 설정이 적용됩니다.</span>
          </section>
        </aside>
      </div>
    </section>
  );
}
