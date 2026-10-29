import { GENRE_NAME_MAP, GENERATOR_MAP, MODES } from '../engine.js';

function modeName(key) {
  return MODES.find((m) => m.k === key)?.n || key;
}

function formatDate(ts) {
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function IdeasPanel({ ideas, total, search, onSearch, onLoad, onDelete }) {
  return (
    <section className="card panel" aria-labelledby="ideasHeading">
      <div className="panel-head">
        <h2 id="ideasHeading">저장된 아이디어</h2>
        <span className="count" id="ideaCount">{total}</span>
      </div>

      <input
        type="search"
        id="ideaSearch"
        className="input"
        placeholder="제목이나 내용으로 검색..."
        value={search}
        onChange={(e) => onSearch(e.target.value)}
      />

      <ul className="item-list" id="ideaList">
        {ideas.map((idea) => {
          const gen = GENERATOR_MAP[idea.generator];
          const meta = [
            gen ? gen.tab : idea.generator,
            modeName(idea.mode),
            GENRE_NAME_MAP[idea.genre] || idea.genre,
            formatDate(idea.updatedAt || idea.createdAt)
          ].join(' · ');

          return (
            <li key={idea.id}>
              <div className="item-main">
                <span className="item-title">{idea.title}</span>
                <span className="item-meta">{meta}</span>
              </div>
              <div className="item-actions">
                <button type="button" className="mini-btn" onClick={() => onLoad(idea.id)}>
                  불러오기
                </button>
                <button type="button" className="mini-btn danger" onClick={() => onDelete(idea.id)}>
                  삭제
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {ideas.length === 0 && (
        <p className="empty" id="ideaEmpty">
          {total === 0
            ? '저장한 아이디어가 없습니다. 생성 후 “아이디어 저장”을 눌러보세요.'
            : '검색과 일치하는 아이디어가 없습니다.'}
        </p>
      )}
    </section>
  );
}
