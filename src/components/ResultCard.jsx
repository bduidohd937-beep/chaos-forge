import { useEffect, useRef } from 'react';

const ICONS = {
  lockOpen:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<rect x="4" y="10.5" width="16" height="10" rx="2"></rect>' +
    '<path d="M8.5 10.5V7a3.5 3.5 0 0 1 6.8-1.2"></path></svg>',
  lockClosed:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<rect x="4" y="10.5" width="16" height="10" rx="2"></rect>' +
    '<path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"></path></svg>',
  refresh:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M20.5 12a8.5 8.5 0 1 1-2.6-6.1"></path>' +
    '<path d="M20.5 4v5h-5"></path></svg>'
};

/**
 * 결과 카드 한 장.
 * 값은 contentEditable로 직접 수정하되, React 재렌더가 커서를 흔들지 않도록
 * DOM 텍스트를 effect에서만 동기화한다.
 */
export default function ResultCard({
  slotKey,
  label,
  value,
  locked,
  spinning,
  settled = false,
  onChange,
  onLock,
  onReroll,
  onBan,
  onLike,
  isLiked = false,
  isBanned = false,
  enabled = true,
  onToggleEnabled
}) {
  const valueRef = useRef(null);

  useEffect(() => {
    const node = valueRef.current;
    if (node && node.textContent !== value) node.textContent = value;
  }, [value]);

  return (
    <article
      className={
        'result-card' + (locked ? ' is-locked' : '') + (spinning ? ' is-spinning' : '') + (settled ? ' is-settled' : '') + (!enabled ? ' is-disabled' : '')
      }
      data-slot={slotKey}
    >
      <div className="card-head">
        <span className="card-label">{label}</span>
        <button type="button" className="slot-toggle" aria-pressed={enabled}
          aria-label={`${label} 슬롯 ${enabled ? '끄기' : '켜기'}`} onClick={onToggleEnabled}>
          {enabled ? 'ON' : 'OFF'}
        </button>
        <span className={`card-lock-state${locked ? ' is-locked' : ''}`}
          title={locked ? '현재 고정: 다음 전체 추첨에서도 이 내용은 유지됩니다' : '현재 열림: 다음 전체 추첨에서 이 내용은 바뀔 수 있습니다'}>
          {locked ? '🔒 고정 · 유지' : '🔓 열림 · 재추첨'}
        </span>
        {spinning && <span className="reel-indicator" aria-hidden="true">ROLLING</span>}
        {settled && !spinning && <span className="reel-indicator is-done" aria-hidden="true">✦ 결정!</span>}
        <div className="card-tools">
          <button
            type="button"
            className={`icon-btn js-lock${locked ? ' is-on' : ''}`}
            aria-pressed={locked}
            aria-label={locked ? `${label} 잠금 해제` : `${label} 잠그기`}
            title={locked ? '잠금 해제 → 다음 추첨부터 이 카드도 변경' : '카드 고정 → 다음 추첨에서 이 내용 유지'}
            onClick={onLock} disabled={!enabled}
            dangerouslySetInnerHTML={{ __html: locked ? ICONS.lockClosed : ICONS.lockOpen }}
          />
          <button type="button" className={`icon-btn js-like${isLiked?' is-on':''}`}
            aria-pressed={isLiked}
            aria-label={isLiked?`${label} 취향 저장 취소`:`${label} 취향 저장`}
            title={isLiked?'좋아요 취소':'좋아요 · 내 취향으로 저장'}
            disabled={spinning || !enabled} onClick={onLike}>
            {isLiked?'★':'☆'}
          </button>
          <button type="button" className={`icon-btn js-ban${isBanned?' is-on':''}`}
            aria-pressed={isBanned}
            aria-label={isBanned?`${label} 문구 차단 해제`:`${label} 문구 제외`}
            title={isBanned?'차단 해제':'이 문구를 앞으로 제외'}
            disabled={spinning || !enabled} onClick={onBan}>
            {isBanned?'⊘':'×'}
          </button>
          <button
            type="button"
            className="icon-btn js-reroll"
            aria-label={`${label} 다시 뽑기`}
            title={locked ? '고정된 카드입니다. 잠금을 해제하면 다시 뽑을 수 있어요' : '이 카드만 다시 뽑기'}
            onClick={onReroll} disabled={!enabled}
            dangerouslySetInnerHTML={{ __html: ICONS.refresh }}
          />
        </div>
      </div>
      <div
        ref={valueRef}
        className="card-value"
        contentEditable={!spinning && enabled}
        aria-readonly={spinning}
        suppressContentEditableWarning
        spellCheck={false}
        role="textbox"
        aria-label={`${label} 결과 (직접 수정 가능)`}
        data-slot={slotKey}
        data-placeholder="전체 생성을 눌러보세요"
        onInput={(e) => onChange(e.currentTarget.textContent)}
        onBlur={(e) => onChange(e.currentTarget.textContent)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
      />
    </article>
  );
}
