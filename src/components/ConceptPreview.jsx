export default function ConceptPreview({
  preview,
  isRolling,
  lockedCount,
  totalCount,
  onCopy
}) {
  const remaining = Math.max(0, totalCount - lockedCount);

  return (
    <section className={`concept-preview${isRolling ? ' is-rolling' : ''}`} aria-labelledby="previewHeading">
      <div className="preview-heading">
        <div>
          <p className="preview-eyebrow">✧ COMBO BLUEPRINT <span>AI 없이 만드는 로컬 조합 프리뷰</span></p>
          <h2 id="previewHeading">조합에서 시작하는 한 편의 기획</h2>
        </div>
        <button type="button" className="btn btn-outline preview-copy" onClick={onCopy} disabled={isRolling}>
          콘셉트 복사
        </button>
      </div>

      <div className="forge-meter" aria-label={`고정된 항목 ${lockedCount}개, 전체 ${totalCount}개`}>
        <div className="forge-meter-track">
          <span style={{ width: `${totalCount ? (lockedCount / totalCount) * 100 : 0}%` }} />
        </div>
        <p><strong>{lockedCount}</strong> / {totalCount} 고정 <span>· 다시 뽑을 수 있는 항목 {remaining}개</span></p>
      </div>

      {isRolling ? (
        <p className="preview-pending" role="status">✦ 키워드를 조합하는 중…</p>
      ) : (
        <div className="preview-content">
          <h3 className="preview-title">{preview.title}</h3>
          <div className="preview-sections">
            {preview.sections.map((item) => (
              <div className="preview-section" key={item.label}>
                <span>{item.label}</span>
                <p>{item.text}</p>
              </div>
            ))}
          </div>
          <p className="preview-caption">키워드를 수정하거나 재추첨하면 이 프리뷰도 바로 바뀝니다.</p>
        </div>
      )}
    </section>
  );
}
