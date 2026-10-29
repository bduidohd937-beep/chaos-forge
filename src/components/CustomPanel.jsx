import { useEffect, useMemo, useState } from 'react';
import { GENRE_NAME_MAP, GENERATORS, GENERATOR_MAP } from '../engine.js';

export default function CustomPanel({ custom, onAdd, onDelete }) {
  const [generatorId, setGeneratorId] = useState(GENERATORS[0].id);
  const [slotKey, setSlotKey] = useState(GENERATORS[0].slots[0].key);
  const [text, setText] = useState('');
  const [genres, setGenres] = useState([]);

  const generator = GENERATOR_MAP[generatorId];

  // 생성기를 바꾸면 항목/장르 선택을 초기화한다
  useEffect(() => {
    setSlotKey(GENERATOR_MAP[generatorId].slots[0].key);
    setGenres([]);
  }, [generatorId]);

  const slotLabel = useMemo(() => {
    const found = generator.slots.find((s) => s.key === slotKey);
    return found ? found.label : slotKey;
  }, [generator, slotKey]);

  const toggleGenre = (key) => {
    setGenres((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    onAdd({ generator: generatorId, slot: slotKey, text, genres, weight: 1 });
    setText('');
  };

  return (
    <section className="card panel" aria-labelledby="customHeading">
      <div className="panel-head">
        <h2 id="customHeading">사용자 키워드</h2>
        <span className="count" id="customCount">{custom.length}</span>
      </div>

      <form id="customForm" className="custom-form" onSubmit={handleSubmit}>
        <div className="row">
          <select
            id="customGenerator"
            className="input"
            aria-label="생성기"
            value={generatorId}
            onChange={(e) => setGeneratorId(e.target.value)}
          >
            {GENERATORS.map((g) => (
              <option key={g.id} value={g.id}>{g.tab}</option>
            ))}
          </select>
          <select
            id="customSlot"
            className="input"
            aria-label="항목"
            value={slotKey}
            onChange={(e) => setSlotKey(e.target.value)}
          >
            {generator.slots.map((s) => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
        </div>

        <input
          type="text"
          id="customText"
          className="input"
          placeholder="새 키워드 입력 (최대 60자)"
          maxLength={60}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />

        <fieldset className="genre-chips">
          <legend>장르 태그 (복수 선택 가능)</legend>
          <div id="customGenres" className="chips">
            {generator.genreList.map((g) => (
              <label className="chip" key={g.k}>
                <input
                  type="checkbox"
                  value={g.k}
                  checked={genres.includes(g.k)}
                  onChange={() => toggleGenre(g.k)}
                />
                <span>{g.n}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <button type="submit" className="btn btn-accent btn-block">키워드 추가</button>
      </form>

      <ul className="item-list" id="customList">
        {custom.map((item) => {
          const gen = GENERATOR_MAP[item.generator];
          const label = gen
            ? (gen.slots.find((s) => s.key === item.slot)?.label ?? item.slot)
            : item.slot;
          const genreText = item.genres && item.genres.length
            ? item.genres.map((k) => GENRE_NAME_MAP[k] || k).join('/')
            : '전체 장르';

          return (
            <li key={item.id}>
              <div className="item-main">
                <span className="item-title">{item.text}</span>
                <span className="item-meta">
                  {(gen ? gen.tab : item.generator) + ' · ' + label + ' · ' + genreText}
                </span>
              </div>
              <div className="item-actions">
                <button type="button" className="mini-btn danger" onClick={() => onDelete(item.id)}>
                  삭제
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {custom.length === 0 && (
        <p className="empty" id="customEmpty">직접 키워드를 추가하면 생성기에 즉시 반영됩니다.</p>
      )}
    </section>
  );
}
