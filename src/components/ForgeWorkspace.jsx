import { useState } from 'react';
import ConceptPreview from './ConceptPreview.jsx';
import {
  getForgeTemplate, forgeProgress, forgeSourceLines, normalizeForgeDoc
} from '../forgeSchema.js';

/**
 * FORGE Alpha 4: section-based editors, source-to-field copy with deliberate
 * clicks, live outline, and separate exports.
 * Generator switch remounts this component via key in App.
 */
export default function ForgeWorkspace({
  generator,
  values,
  preview,
  isRolling,
  lockedCount,
  doc,
  onUpdate,
  onUpdateField,
  onImportField,
  onExport,
  onCopyDocument,
  onCopy,
  onBack,
  saved
}) {
  const [sectionId, setSectionId] = useState(null);
  const [simpleMode, setSimpleMode] = useState(true);
  const template = getForgeTemplate(generator.id);
  const normalized = normalizeForgeDoc(generator.id, doc);
  const coreSection = template.sections[0];
  const progress = forgeProgress(generator.id, normalized);
  const coreProgress = {
    completed: coreSection.fields.filter((field) => normalized.fields[field.id].trim()).length,
    total: coreSection.fields.length
  };
  const shownProgress = simpleMode
    ? { ...coreProgress, percent: Math.round(coreProgress.completed / coreProgress.total * 100) }
    : progress;
  const selected = template.sections.find((section) => section.id === sectionId) || template.sections[0];
  const visibleSections = simpleMode ? [coreSection] : template.sections;
  const visibleFields = simpleMode ? coreSection.fields : selected.fields;
  const sectionFilled = (section) =>
    section.fields.filter((field) => normalized.fields[field.id].trim()).length;

  return (
    <section className="v2-screen forge-screen" aria-labelledby="forgeTitle">
      <div className="v2-intro forge-intro">
        <p className="v2-kicker">03 / FORGE — {template.eyebrow}</p>
        <h2 id="forgeTitle">아이디어를 작품으로 발전시키세요.</h2>
        <p>{template.subtitle} 작성한 내용은 CHAOS 추첨 결과와 분리해서 보관합니다.</p>
      </div>

      <div className="forge-topbar">
        <div className="forge-progress-summary" aria-live="polite">
          <span className="forge-progress-label">{simpleMode ? '핵심 작성 진행도' : '전문 기획서 작성 진행도'}</span>
          <strong>{shownProgress.completed}<small> / {shownProgress.total} 항목</small></strong>
          <div className="forge-progress-track" role="progressbar" aria-valuemin="0"
            aria-valuemax={shownProgress.total} aria-valuenow={shownProgress.completed}
            aria-label="구조화된 기획서 작성 진행도">
            <span style={{ width: `${shownProgress.percent}%` }} />
          </div>
        </div>
        <div className="forge-export-actions">
          <span className={`forge-save-state${saved ? '' : ' error'}`} role="status">
            {saved ? '● 자동 저장됨' : '⚠ 자동 저장 실패'}
          </span>
          <div className="forge-export-group" aria-label="파일로 내보내기">
            <span>파일로 내보내기</span>
            <button type="button" className="btn btn-outline" onClick={onCopyDocument}>기획서 복사</button>
            <button type="button" className="btn btn-outline" onClick={() => onExport('md')}>MD 저장</button>
            <button type="button" className="btn btn-outline" onClick={() => onExport('json')}>JSON 백업</button>
          </div>
        </div>
      </div>

      <div className="forge-mode-switch" role="group" aria-label="FORGE 작성 모드">
        <div>
          <strong>{simpleMode ? '간편 작성' : '전문 설정집'}</strong>
          <p>{simpleMode ? '핵심 3개만 먼저 적고, 나머지는 필요할 때 펼쳐 보세요.' : '기존 4개 섹션과 모든 세부 항목을 한 문서에서 편집합니다.'}</p>
        </div>
        <button type="button" className="btn btn-outline" onClick={() => setSimpleMode((value) => !value)}>
          {simpleMode ? '전문 설정집 펼치기' : '간편 작성으로 돌아가기'}
        </button>
      </div>

      <div className="forge-studio-layout">
        <aside className="v2-panel forge-outline" aria-label="기획서 목차">
          <p className="v2-kicker">DOCUMENT OUTLINE</p>
          <h3>설계 목차</h3>
          <p className="forge-outline-help">작업할 항목을 선택하세요. 다른 항목으로 이동해도 작성한 내용은 유지됩니다.</p>
          <nav className="forge-outline-nav" aria-label="편집 섹션">
            {visibleSections.map((section, index) => {
              const done = sectionFilled(section);
              return (
                <button type="button" key={section.id}
                  className={`forge-outline-item${selected.id === section.id ? ' selected' : ''}`}
                  aria-current={selected.id === section.id ? 'step' : undefined}
                  aria-controls="forge-fields-panel"
                  onClick={() => setSectionId(section.id)}>
                  <span className="forge-outline-index">{String(index + 1).padStart(2,'0')}</span>
                  <span className="forge-outline-name">
                    <strong>{section.title}</strong>
                    <small>{done} / {section.fields.length} 작성</small>
                  </span>
                  <span className="forge-outline-mark" aria-hidden="true">{done === section.fields.length ? '✓' : '›'}</span>
                </button>
              );
            })}
          </nav>
          <div className="forge-outline-hint">
            <strong>✦ 원본 보존</strong>
            <p>키워드 가져오기는 텍스트만 추가합니다. 이미 작성한 문장을 지우지 않아요.</p>
          </div>
          <button type="button" className="btn btn-outline forge-back" onClick={onBack}>
            ← CHAOS 추첨실
          </button>
        </aside>

        <div className="forge-content-stack">
          <section className="v2-panel forge-editor" id="forge-fields-panel"
            aria-label={`${selected.title} 편집`}>
            <div className="forge-document-head">
              <div>
                <p className="v2-kicker">PROJECT DOCUMENT</p>
                <h3>{generator.tab} 기획서</h3>
              </div>
              <span className="forge-section-count">
                {simpleMode ? '핵심 3개' : `${template.sections.findIndex((section) => section.id === selected.id) + 1} / ${template.sections.length}`}
              </span>
            </div>
            <label htmlFor="forgeTitleInput">작품 제목</label>
            <input id="forgeTitleInput" className="input forge-title-input" type="text" maxLength={100}
              value={normalized.title} onChange={(event) => onUpdate('title', event.target.value)}
              placeholder="작품의 제목을 입력하세요" />

            <div className="forge-section-head">
              <span className="forge-section-icon" aria-hidden="true">{selected.icon}</span>
              <div>
                <h4>{selected.title}</h4>
                <p>{selected.subtitle}</p>
              </div>
            </div>

            <div className="forge-fields">
              {visibleFields.map((field) => {
                const suggestions = forgeSourceLines(generator.id, field.source, values);
                const fieldId = `forge-field-${generator.id}-${field.id}`;
                const hintId = `${fieldId}-hint`;
                return (
                  <div className="forge-field" key={field.id}>
                    <div className="forge-field-top">
                      <label htmlFor={fieldId}>{field.label}</label>
                      {suggestions.length > 0 && (
                        <button type="button" className="forge-import-btn"
                          aria-label={`${field.label}에 원본 키워드 가져오기`}
                          onClick={() => onImportField(field.id, suggestions.join('\n'))}>
                          + 키워드 가져오기
                        </button>
                      )}
                    </div>
                    <p className="forge-field-guide" id={hintId}>{field.guide}</p>
                    <textarea id={fieldId} className="input forge-field-input" rows={3} maxLength={12000}
                      aria-describedby={hintId}
                      placeholder={suggestions.length
                        ? `참고 키워드: ${suggestions[0]}`
                        : '직접 설정을 작성하세요.'}
                      value={normalized.fields[field.id]}
                      onChange={(event) => onUpdateField(field.id, event.target.value)} />
                  </div>
                );
              })}
            </div>
          </section>

          <section className="v2-panel forge-notes-panel" aria-labelledby="forgeNotesTitle">
            <div className="forge-notes-heading">
              <div>
                <h3 id="forgeNotesTitle">자유 메모</h3>
                <p>기존 FORGE에 작성한 메모도 이곳에 그대로 남아 있어요.</p>
              </div>
              <span aria-hidden="true">✎</span>
            </div>
            <label className="forge-sr-only" htmlFor="forgeNotesInput">기획 메모</label>
            <textarea id="forgeNotesInput" className="input forge-textarea" rows={5} maxLength={20000}
              value={normalized.notes}
              placeholder="어느 항목에도 속하지 않는 아이디어나 추가 연구를 자유롭게 기록하세요."
              onChange={(event) => onUpdate('notes', event.target.value)} />
          </section>

          <div className="forge-reference-section">
            <details className="forge-source-details">
              <summary>◈ 생성 결과 · 원본 키워드 확인</summary>
              <section className="v2-panel forge-source" aria-label="원본 생성 키워드">
                <h3>CHAOS 원본 키워드</h3>
                {generator.slots.map((slot) => (
                  <div key={slot.key} className="forge-source-row">
                    <span>{slot.label}</span>
                    <strong>{values?.[slot.key] || '—'}</strong>
                  </div>
                ))}
              </section>
            </details>
            <ConceptPreview preview={preview} isRolling={isRolling}
              lockedCount={lockedCount} totalCount={generator.slots.length} onCopy={onCopy} />
          </div>
        </div>
      </div>
    </section>
  );
}
