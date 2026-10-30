import { normalizeDNA } from '../creativeDNA.js';

const MOODS = [
  ['any', '균형'], ['bright', '따뜻함'], ['dark', '어두움'], ['comic', '유쾌함']
];
const NOVELTY = ['','정통','균형','참신','파격'];

/** Personal preferences influence selection weights; they NEVER hard-block. */
export default function CreativeDnaPanel({ dna, onChange, coverage }) {
  const d = normalizeDNA(dna);
  const change = (key, value) => onChange({ ...d, [key]: value });

  return (
    <section className="v2-panel dna-panel preference-panel" aria-labelledby="dnaPanelTitle">
      <div className="setup-block-head dna-advanced-heading">
        <span className="setup-step" aria-hidden="true">✦</span>
        <div>
          <p className="v2-kicker">CREATIVE DNA · 취향</p>
          <h3 id="dnaPanelTitle">내 취향으로 추천 조절</h3>
          <p>좋아하는 결과가 더 자주 나오도록 비중을 조절해요. 싫은 소재를 없애는 기능은 별도의 차단 관리에서 설정하세요.</p>
        </div>
      </div>
      <div className="dna-controls">
        <div className="dna-two-col">
          <div>
            <label htmlFor="dnaNovelty">소재의 새로움 <strong>{NOVELTY[d.novelty]} · {d.novelty}/4</strong></label>
            <input id="dnaNovelty" type="range" min="1" max="4" step="1"
              value={d.novelty} onChange={e=>change('novelty', Number(e.target.value))}/>
            <div className="chaos-scale"><span>정통</span><span>균형</span><span>파격</span></div>
            <p className="dna-hint">독특한 소재를 얼마나 선호할지 정해요. 혼돈(장르 혼합)과는 별개예요.</p>
          </div>
          <div>
            <label htmlFor="dnaMood">좋아하는 분위기</label>
            <select id="dnaMood" className="input" value={d.mood}
              onChange={e=>change('mood', e.target.value)}>
              {MOODS.map(([id, label])=><option key={id} value={id}>{label}</option>)}
            </select>
            <p className="dna-hint">선택한 분위기의 출현 확률을 높여요. 다른 분위기를 완전히 차단하지는 않아요.</p>
          </div>
        </div>
      </div>
      <details className="dna-likes-details">
        <summary>☆ 좋아요로 기억한 취향 {d.likes.length}개 {d.likes.length ? '· 보기/해제' : '· 카드의 ☆ 버튼으로 추가'}</summary>
        <div className="dna-likes-list">
          {d.likes.length ? d.likes.map(text=>(
            <button type="button" key={text} className="dna-ban-chip dna-like-chip"
              aria-label={`${text} 좋아요 취소`}
              onClick={()=>change('likes',d.likes.filter(s=>s!==text))}>
              {text} <span aria-hidden="true">×</span>
            </button>
          )) : <p className="dna-hint">마음에 드는 결과 카드에서 ☆를 누르면 다음 추첨에서 해당 표현이 조금 더 자주 나와요.</p>}
        </div>
      </details>
      {coverage && (
        <details className="dna-audit-details">
          <summary>✦ 키워드 데이터 현황 · {coverage.total.toLocaleString()}개</summary>
          <div className="dna-audit" aria-live="polite">
            <span>{coverage.slots.length}개 슬롯 · 깊이별 표현이 준비된 소재 {coverage.slots.reduce((s,x)=>s+x.forms,0)}개</span>
            <p className="dna-hint">숫자는 등록된 소재·표현의 보유량이며 창작 품질 점수는 아니에요.</p>
          </div>
        </details>
      )}
    </section>
  );
}
