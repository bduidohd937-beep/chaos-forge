import { MODES } from '../engine.js';

export default function ControlsBar({
  genres,
  genre,
  onGenreChange,
  mode,
  onModeChange,
  chaos,
  chaosHint,
  onChaosChange,
  onChaosCommit,
  onGenerate,
  onOverdrive,
  onUnlockAll
}) {
  const hybrid = mode === 'hybrid';

  return (
    <section className="controls card" aria-label="생성 옵션">
      <div className="control">
        <label className="control-label" htmlFor="genreSelect">장르</label>
        <select
          id="genreSelect"
          className="input"
          value={genre}
          onChange={(e) => onGenreChange(e.target.value)}
        >
          {genres.map((g) => (
            <option key={g.k} value={g.k}>{g.n}</option>
          ))}
        </select>
      </div>

      <div className="control">
        <span className="control-label" id="modeLabel">랜덤 모드</span>
        <div className="segmented" role="radiogroup" aria-labelledby="modeLabel">
          {MODES.map((m) => (
            <button
              key={m.k}
              type="button"
              className="seg-btn"
              role="radio"
              aria-checked={m.k === mode}
              onClick={() => onModeChange(m.k)}
            >
              {m.n}
            </button>
          ))}
        </div>
      </div>

      <div className={`control chaos-control${hybrid ? '' : ' is-disabled'}`} id="chaosControl">
        <label className="control-label" htmlFor="chaosRange">
          혼돈 레벨 <strong id="chaosValue">{chaos}</strong><span className="dim">/5</span>
        </label>
        <input
          type="range"
          id="chaosRange"
          min="1"
          max="5"
          step="1"
          value={chaos}
          disabled={!hybrid}
          onChange={(e) => onChaosChange(Number(e.target.value))}
          onPointerUp={onChaosCommit}
          onKeyUp={onChaosCommit}
          onBlur={onChaosCommit}
        />
        <div className="chaos-scale" aria-hidden="true">
          <span>정석</span><span>혼합</span><span>붕괴</span>
        </div>
        <p className="hint" id="chaosHint">{chaosHint}</p>
      </div>

      <div className="control control-action">
        <button type="button" className="btn btn-primary" id="generateBtn" onClick={onGenerate}>
          <span className="btn-spark" aria-hidden="true">◈</span> 전체 생성
        </button>
        <button type="button" className="btn btn-overdrive" id="overdriveBtn"
          title="장르는 유지하고 혼돈 5로 잠기지 않은 카드만 다시 뽑습니다"
          onClick={onOverdrive}>
          ⚡ 폭주 생성
        </button>
        <button type="button" className="btn btn-ghost" id="unlockAllBtn" onClick={onUnlockAll}>
          잠금 해제
        </button>
      </div>
    </section>
  );
}
