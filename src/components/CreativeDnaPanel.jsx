import { useState } from 'react';
import { TOPICS, STYLE_BANS, normalizeDNA } from '../creativeDNA.js';

const DETAILS=[
  ['brief','간결','소재 중심 · 상상의 여지'],
  ['balanced','기본','설정 한 문장'],
  ['detailed','구체적','배경·갈등까지']
];
const MOODS=[
  ['any','균형'],['bright','따뜻함'],['dark','어두움'],['comic','유쾌함']
];

export default function CreativeDnaPanel({dna,onChange,coverage}) {
  const d=normalizeDNA(dna);
  const [exactText,setExactText]=useState('');
  const [openBan,setOpenBan]=useState(false);
  const change=(key,value)=>onChange({...d,[key]:value});
  const flip=(key,id)=>change(key,d[key].includes(id)?d[key].filter(x=>x!==id):[...d[key],id]);
  return (
    <section className="v2-panel dna-panel" aria-labelledby="dnaPanelTitle">
      <div className="setup-block-head">
        <span className="setup-step">04</span>
        <div>
          <p className="v2-kicker">CHAOS FORGE EXCLUSIVE</p>
          <h3 id="dnaPanelTitle">CREATIVE DNA — 나만의 창작 취향</h3>
          <p>추첨은 자유롭게, 방향은 내 취향대로. 선택한 규칙은 다음 추첨에 적용돼요.</p>
        </div>
      </div>
      <div className="dna-controls">
        <fieldset className="dna-fieldset">
          <legend>표현의 구체성</legend>
          <div className="dna-option-row">
            {DETAILS.map(([id,label,hint])=>(
              <button type="button" key={id} className={`dna-choice${d.detail===id?' selected':''}`}
                aria-pressed={d.detail===id} onClick={()=>change('detail',id)}>
                <strong>{label}</strong><small>{hint}</small>
              </button>
            ))}
          </div>
          <p className="dna-hint">짧음·상세 버전이 준비된 키워드는 실제 표현이 달라져요. 기존 키워드는 원문이 유지될 수 있어요.</p>
        </fieldset>
        <div className="dna-two-col">
          <div>
            <label htmlFor="dnaNovelty">독창성 선호 <strong>{d.novelty}/4</strong></label>
            <input id="dnaNovelty" type="range" min="1" max="4" step="1"
              value={d.novelty} onChange={e=>change('novelty',Number(e.target.value))}/>
            <div className="chaos-scale"><span>정통</span><span>균형</span><span>파격</span></div>
          </div>
          <div>
            <label htmlFor="dnaMood">선호 분위기</label>
            <select id="dnaMood" className="input" value={d.mood}
              onChange={e=>change('mood',e.target.value)}>
              {MOODS.map(([id,label])=><option key={id} value={id}>{label}</option>)}
            </select>
            <p className="dna-hint">선호 가중치로 반영하며 완전 차단은 아래 밴에서 설정해요.</p>
          </div>
        </div>
      </div>
      <details className="dna-ban-details" open={openBan}
        onToggle={e=>setOpenBan(e.currentTarget.open)}>
        <summary> <span>⛔ BAN MANAGER</span>
          <span className="dna-ban-count">주제 {d.bannedTopics.length} · 표현 {d.bannedStyles.length} · 키워드 {d.bannedExact.length}</span>
        </summary>
        <div className="dna-ban-inner">
          <div className="dna-ban-mode">
            <strong>주제·스타일 밴 강도</strong>
            <div className="dna-option-row">
              <button type="button" aria-pressed={d.banMode==='hard'} className={`dna-choice${d.banMode==='hard'?' selected':''}`}
                onClick={()=>change('banMode','hard')}><strong>완전 차단</strong><small>해당 태그 후보 제외</small></button>
              <button type="button" aria-pressed={d.banMode==='soft'} className={`dna-choice${d.banMode==='soft'?' selected':''}`}
                onClick={()=>change('banMode','soft')}><strong>출현 최소화</strong><small>일치 후보 확률 크게 감소</small></button>
            </div>
            <p className="dna-hint">개별 문구 밴은 강도 설정과 관계없이 항상 완전 차단돼요.</p>
          </div>
          <fieldset className="dna-ban-fieldset">
            <legend>피하고 싶은 소재</legend>
            <div className="dna-ban-grid">
              {TOPICS.map(t=>(
                <label key={t.id} className={`dna-check${d.bannedTopics.includes(t.id)?' selected':''}`}>
                  <input type="checkbox" checked={d.bannedTopics.includes(t.id)}
                    onChange={()=>flip('bannedTopics',t.id)}/>
                  <span>{t.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="dna-ban-fieldset">
            <legend>피하고 싶은 표현 스타일</legend>
            <div className="dna-ban-grid">
              {STYLE_BANS.map(t=>(
                <label key={t.id} className={`dna-check${d.bannedStyles.includes(t.id)?' selected':''}`}>
                  <input type="checkbox" checked={d.bannedStyles.includes(t.id)}
                    onChange={()=>flip('bannedStyles',t.id)}/>
                  <span>{t.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="dna-exact">
            <label htmlFor="dnaExactInput">특정 키워드 직접 차단</label>
            <form onSubmit={e=>{
              e.preventDefault();
              const next=exactText.trim().slice(0,200);
              if(next && !d.bannedExact.includes(next))change('bannedExact',[...d.bannedExact,next].slice(-80));
              setExactText('');
            }}>
              <input id="dnaExactInput" className="input" value={exactText} maxLength={200}
                onChange={e=>setExactText(e.target.value)} placeholder="예: 몰락한 기사" />
              <button type="submit" className="btn btn-outline">차단 추가</button>
            </form>
            <div className="dna-exact-list">
              {d.bannedExact.map(text=>(
                <button type="button" key={text} className="dna-ban-chip"
                  aria-label={`${text} 차단 해제`}
                  onClick={()=>change('bannedExact',d.bannedExact.filter(x=>x!==text))}>
                  {text} <span aria-hidden="true">×</span>
                </button>
              ))}
              {!d.bannedExact.length&&<span className="dna-hint">생성 카드에서 '제외'를 눌러도 여기에 추가돼요.</span>}
            </div>
          </div>
          <p className="dna-hint">차단은 직접 부착한 소재 태그와 알려진 동의어 표현을 기준으로 작동해요. 모든 비유·은유까지 의미 분석하지는 못해요. 조건 때문에 후보가 없어지면 차단을 무시하지 않고 알려줘요.</p>
        </div>
      </details>
      {coverage&&(
        <div className="dna-audit" aria-live="polite">
          <strong>✦ 키워드 도감</strong>
          <span>{coverage.total.toLocaleString()}개 등록 표현 · {coverage.slots.length}개 슬롯</span>
          <span>표현 3단계 보유: {coverage.slots.reduce((s,x)=>s+x.forms,0)}개</span>
        </div>
      )}
    </section>
  );
}
