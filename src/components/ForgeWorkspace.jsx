import ConceptPreview from './ConceptPreview.jsx';

export default function ForgeWorkspace({
  generator,
  values,
  preview,
  isRolling,
  lockedCount,
  doc,
  onUpdate,
  onCopy,
  onBack
}) {
  return (
    <section className="v2-screen forge-screen" aria-labelledby="forgeTitle">
      <div className="v2-intro">
        <p className="v2-kicker">03 / FORGE — CREATIVE WORKSPACE</p>
        <h2 id="forgeTitle">이제 아이디어를 작품으로.</h2>
        <p>생성한 키워드를 참고하면서 작품 제목과 기획 메모를 직접 작성할 수 있어요. 이 내용도 브라우저에 자동 저장됩니다.</p>
      </div>
      <div className="forge-layout">
        <div className="v2-panel forge-editor">
          <div className="setup-block-head">
            <span className="setup-step">✎</span>
            <div>
              <h3>{generator.title} 기획 노트</h3>
              <p>작성한 메모는 원본 랜덤 결과와 별개로 유지돼요.</p>
            </div>
          </div>
          <label htmlFor="forgeTitleInput">작품 제목</label>
          <input id="forgeTitleInput" className="input" type="text" maxLength={100}
            value={doc.title || ''}
            placeholder="예: 달이 사라진 왕국의 탐정"
            onChange={(e) => onUpdate('title', e.target.value)} />
          <label htmlFor="forgeNotesInput">기획 메모</label>
          <textarea id="forgeNotesInput" className="input forge-textarea" rows={13}
            value={doc.notes || ''}
            placeholder="이 조합에서 무엇이 가장 재미있나요? 주인공의 목표, 세계관의 규칙, 갈등 등을 자유롭게 정리해 보세요."
            onChange={(e) => onUpdate('notes', e.target.value)} />
          <div className="forge-editor-actions">
            <span>● 작업 초안에 자동 저장</span>
            <button type="button" className="btn btn-outline" onClick={onBack}>← 추첨실 돌아가기</button>
          </div>
        </div>
        <aside className="forge-reference">
          <ConceptPreview preview={preview} isRolling={isRolling}
            lockedCount={lockedCount} totalCount={generator.slots.length} onCopy={onCopy} />
          <section className="v2-panel forge-source" aria-label="원본 생성 키워드">
            <h3>원본 키워드</h3>
            {generator.slots.map((slot) => (
              <div key={slot.key} className="forge-source-row">
                <span>{slot.label}</span>
                <strong>{values?.[slot.key] || '—'}</strong>
              </div>
            ))}
          </section>
        </aside>
      </div>
    </section>
  );
}
