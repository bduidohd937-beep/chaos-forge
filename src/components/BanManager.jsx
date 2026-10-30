import { useState } from 'react';
import { TOPICS, STYLE_BANS, normalizeDNA } from '../creativeDNA.js';

/** Separate, explicit negative-filter controls. No inference, no hidden override. */
export default function BanManager({ dna, onChange, initialOpen = false }) {
  const d = normalizeDNA(dna);
  const [open, setOpen] = useState(initialOpen);
  const [exactText, setExactText] = useState('');
  const total = d.bannedTopics.length + d.bannedStyles.length + d.bannedExact.length;
  const change = (key, value) => onChange({ ...d, [key]: value });
  const toggle = (key,id) => change(key,
    d[key].includes(id) ? d[key].filter(x=>x!==id) : [...d[key], id]);

  return (
    <section className="v2-panel ban-panel" aria-labelledby="banManagerTitle">
      <div className="ban-panel-header">
        <div className="ban-panel-heading">
          <p className="v2-kicker">BAN MANAGER · 제외</p>
          <h3 id="banManagerTitle">나오지 않았으면 하는 소재</h3>
          <p>취향 추천과 별개예요. 지정한 소재·스타일은 완전히 차단하거나 출현 확률을 낮출 수 있어요.</p>
        </div>
        <div className="ban-panel-summary">
          <span className="dna-ban-count" aria-live="polite">차단 설정 {total}개</span>
          <button type="button" className="btn btn-outline ban-manage-toggle"
            aria-expanded={open} aria-controls="banManagerContent"
            onClick={()=>setOpen(v=>!v)}>
            {open ? '관리 닫기 ▴' : '차단 목록 관리하기 ▾'}
          </button>
        </div>
      </div>
      {total > 0 && !open && (
        <p className="ban-panel-preview">
          소재 {d.bannedTopics.length} · 표현 {d.bannedStyles.length} · 개별 문구 {d.bannedExact.length}개
        </p>
      )}
      {open && (
        <div id="banManagerContent" className="dna-ban-inner">
          <div className="dna-ban-mode">
            <strong>소재·스타일을 얼마나 피할까요?</strong>
            <div className="dna-option-row" role="group" aria-label="차단 강도">
              <button type="button" aria-pressed={d.banMode==='hard'}
                className={`dna-choice${d.banMode==='hard'?' selected':''}`}
                onClick={()=>change('banMode','hard')}>
                <strong>완전 차단</strong><small>알려진 태그·표현과 일치하는 후보는 추첨에서 제외</small>
              </button>
              <button type="button" aria-pressed={d.banMode==='soft'}
                className={`dna-choice${d.banMode==='soft'?' selected':''}`}
                onClick={()=>change('banMode','soft')}>
                <strong>출현 줄이기</strong><small>나올 확률을 크게 낮추지만 완전히 막지는 않음</small>
              </button>
            </div>
            <p className="dna-hint">카드에서 ×를 눌러 제외한 <strong>개별 문구는 항상 완전 차단</strong>돼요.</p>
          </div>
          <fieldset className="dna-ban-fieldset">
            <legend>피하고 싶은 소재</legend>
            <div className="dna-ban-grid">
              {TOPICS.map(t=>(
                <label key={t.id} className={`dna-check${d.bannedTopics.includes(t.id)?' selected':''}`}>
                  <input type="checkbox" checked={d.bannedTopics.includes(t.id)}
                    onChange={()=>toggle('bannedTopics',t.id)}/>
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
                    onChange={()=>toggle('bannedStyles',t.id)}/>
                  <span>{t.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="dna-exact">
            <label htmlFor="dnaExactInput">특정 문구만 직접 제외</label>
            <form onSubmit={e=>{
              e.preventDefault();
              const value=exactText.trim().slice(0,200);
              if(value && !d.bannedExact.some(t=>t.toLocaleLowerCase()===value.toLocaleLowerCase())){
                change('bannedExact',[...d.bannedExact,value].slice(-80));
              }
              setExactText('');
            }}>
              <input id="dnaExactInput" className="input" value={exactText} maxLength={200}
                onChange={e=>setExactText(e.target.value)}
                placeholder="예: 몰락한 기사" />
              <button type="submit" className="btn btn-outline">문구 제외</button>
            </form>
            <div className="dna-exact-list">
              {d.bannedExact.map(text=>(
                <button type="button" key={text} className="dna-ban-chip"
                  aria-label={`${text} 차단 해제`}
                  onClick={()=>change('bannedExact',d.bannedExact.filter(v=>v!==text))}>
                  {text} <span aria-hidden="true">×</span>
                </button>
              ))}
              {!d.bannedExact.length && <p className="dna-hint">CHAOS 카드의 × 버튼에서도 문구를 바로 제외할 수 있어요.</p>}
            </div>
          </div>
          <p className="dna-hint">설정은 이 브라우저에 저장되고 다음 추첨부터 적용돼요. 완전 차단은 등록된 태그와 알려진 표현 기준이며 모든 은유·동의어를 이해하는 AI 의미 분석은 아니에요. 후보가 없으면 차단 규칙을 몰래 해제하지 않아요.</p>
        </div>
      )}
    </section>
  );
}
