import { ALL_GENRES, GENERATORS, MODES } from '../engine.js';

export default function SetupScreen({
  generatorId, onGeneratorChange, mainGenre, subgenres, onMainChange, onSubChange,
  mode, onModeChange, chaos, onChaosChange, onBegin
}) {
  const selected = [mainGenre, ...subgenres];
  return (
    <section className="v2-screen setup-screen" aria-labelledby="setupTitle">
      <div className="v2-intro">
        <p className="v2-kicker">01 / SETUP — CREATIVE CONFIGURATION</p>
        <h2 id="setupTitle">새로운 세계의 규칙을 정하세요.</h2>
        <p>장르를 자유롭게 섞고, 추첨 방식을 선택하세요. 설정은 다음 생성에서도 유지됩니다.</p>
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
              <strong>서브 장르</strong>
              <span>{subgenres.length} / 3 선택</span>
            </div>
            <div className="v2-genre-grid" role="group" aria-label="서브 장르 선택">
              {ALL_GENRES.filter((g) => g.k !== mainGenre).map((g) => {
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
            </div>
            <p className="setup-tip">서브 장르는 선택하지 않아도 돼요. 모든 조합을 허용합니다.</p>
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
                  aria-label={item.n} aria-checked={mode === item.k} onClick={() => onModeChange(item.k)}>
                  <span>{mode === item.k ? '◉' : '○'}</span>
                  <strong>{item.n}</strong>
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
            <span className="v2-kicker">YOUR CREATIVE FORMULA</span>
            <h3>{ALL_GENRES.find((g) => g.k === mainGenre)?.n}</h3>
            <div className="v2-tags">
              {subgenres.map((key) => (
                <span className="v2-tag" key={key}>+ {ALL_GENRES.find((g) => g.k === key)?.n}</span>
              ))}
              {!subgenres.length && <span className="setup-empty-sub">서브 장르 없음 · 정통 장르</span>}
            </div>
            <p>설정을 확정한 뒤, 생성실에서 잠금과 부분 재추첨을 자유롭게 이용하세요.</p>
            <button type="button" className="btn btn-primary btn-block setup-start"
              onClick={onBegin}>◈ 이 설정으로 창조하기 →</button>
            <span className="setup-footnote">기존 결과는 유지되며 새로운 추첨에서만 설정이 적용됩니다.</span>
          </section>
        </aside>
      </div>
    </section>
  );
}
