import { useRef, useState } from 'react';
import { MAX_BACKUP_CHARS } from '../workspaceBackup.js';
import Storage from '../storage.js';

/**
 * This panel deliberately separates safe export from dangerous replacement.
 * Selecting a JSON file only previews it; nothing writes until the user
 * checks the warning and clicks the final explicit restore button.
 */
export default function WorkspaceBackupPanel({ onBackup, onRestore, currentCounts }) {
  const [candidate, setCandidate] = useState(null);
  const [filename, setFilename] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [status, setStatus] = useState('');
  const requestRef = useRef(0);

  const selectFile = async event => {
    const file = event.target.files?.[0];
    const request = ++requestRef.current;
    setCandidate(null);
    setConfirmed(false);
    setStatus('');
    setFilename(file?.name || '');
    if (!file) return;
    if (file.size > MAX_BACKUP_CHARS) {
      setStatus('파일 크기가 20MB 제한을 넘었습니다. 기존 데이터는 변경되지 않았습니다.');
      return;
    }
    try {
      const text = await file.text();
      if (request !== requestRef.current) return;
      const inspected = Storage.inspectFullBackup(text);
      setCandidate(inspected);
      setStatus('백업 파일을 확인했어요. 아래 항목을 검토하고 복원을 결정하세요.');
    } catch (error) {
      if (request !== requestRef.current) return;
      setStatus('파일 확인 실패: ' + String(error?.message || '알 수 없는 오류'));
    }
  };

  const restore = () => {
    if (!candidate || !confirmed) return;
    try {
      onRestore(candidate.backup);
      setStatus('전체 작업을 복원했습니다. 기존 화면과 저장 데이터도 갱신됐어요.');
      setCandidate(null);
      setConfirmed(false);
      setFilename('');
    } catch (error) {
      setStatus('복원 실패: ' + String(error?.message || '알 수 없는 오류'));
    }
  };

  const download = () => {
    try {
      if (onBackup()) setStatus('전체 작업 JSON 백업 다운로드를 시작했습니다. 다운로드 폴더에서 파일을 확인해 주세요.');
      else setStatus('파일 저장에 실패했습니다. 저장 권한을 확인해 주세요.');
    } catch (error) {
      setStatus('백업 실패: ' + String(error?.message || '알 수 없는 오류'));
    }
  };

  return (
    <section className="v2-panel full-backup-panel" aria-labelledby="fullBackupHeading">
      <div className="full-backup-header">
        <div>
          <p className="v2-kicker">DATA SAFETY · LOCAL BACKUP</p>
          <h3 id="fullBackupHeading">전체 작업 백업 · 복원</h3>
          <p>현재 작업, FORGE 원고, 잠금·취향, 이전 작업 기록, 아이디어와 직접 추가한 키워드를 한 파일로 보관해요.</p>
        </div>
        <button type="button" className="btn btn-primary" id="downloadFullBackupBtn"
          onClick={download}>↓ 전체 작업 JSON 백업</button>
      </div>
      <div className="full-backup-stats">
        <span>현재 저장된 아이디어 <strong>{currentCounts.ideas}</strong>개</span>
        <span>사용자 키워드 <strong>{currentCounts.custom}</strong>개</span>
        <span>이전 작업 기록 <strong>{currentCounts.archives}</strong>개</span>
      </div>
      <p className="full-backup-help">브라우저 데이터는 자동으로 클라우드에 저장되지 않아요. 기기 변경이나 브라우저 초기화 전에 이 파일을 따로 보관하세요. 파일에는 작성 내용과 개인 취향이 포함됩니다.</p>
      <details className="full-backup-import" id="fullBackupImport">
        <summary>↺ 백업 파일에서 전체 복원하기 (기존 자료 교체)</summary>
        <div className="full-backup-import-body">
          <p>먼저 위 버튼으로 <strong>현재 작업을 별도 백업</strong>해 두는 것을 권장해요. 파일을 선택하는 것만으로는 아무것도 바뀌지 않습니다. 복원하기 전 다른 CHAOS FORGE 탭을 닫아 주세요.</p>
          <label htmlFor="fullBackupFile">CHAOS FORGE V2 전체 백업 JSON 선택</label>
          <input id="fullBackupFile" type="file" accept=".json,application/json"
            onChange={selectFile}/>
          {filename && <p className="full-backup-filename">선택한 파일: {filename}</p>}
          {candidate && (
            <div className="full-backup-compare">
              <strong>복원 전 비교</strong>
              <div className="full-backup-counts">
                <span>항목</span><span>현재</span><span>백업 파일</span>
                <span>아이디어</span><span>{currentCounts.ideas}</span><strong>{candidate.summary.ideas}</strong>
                <span>사용자 키워드</span><span>{currentCounts.custom}</span><strong>{candidate.summary.custom}</strong>
                <span>이전 작업 기록</span><span>{currentCounts.archives}</span><strong>{candidate.summary.archives}</strong>
                <span>작성된 FORGE 문서</span><span>{currentCounts.forgeDocs}</span><strong>{candidate.summary.forgeDocs}</strong>
              </div>
              <p>백업 생성일: {new Date(candidate.backup.createdAt).toLocaleString('ko-KR')}</p>
              <label className="full-backup-consent">
                <input type="checkbox" checked={confirmed} onChange={event=>setConfirmed(event.target.checked)}/>
                <span>현재 작업·FORGE 원고·아이디어·사용자 키워드·이전 작업 기록이 <strong>모두 백업 파일의 내용으로 교체</strong>된다는 것을 이해했습니다.</span>
              </label>
              <button type="button" className="btn btn-outline full-backup-restore" id="confirmFullRestoreBtn"
                disabled={!confirmed} onClick={restore}>검토한 백업으로 전체 복원</button>
            </div>
          )}
        </div>
      </details>
      {status && <p className="full-backup-status" role="status" aria-live="polite">{status}</p>}
    </section>
  );
}
