import { useId, useState } from 'react';
import { Icon } from './ui';

export function Field({ label, optional, help, full, children }) {
  const id = useId();
  const child = typeof children === 'function' ? children(id) : children;
  return (
    <div className={`field ${full ? 'full' : ''}`}>
      {label && <label htmlFor={id}>{label}{optional && <span className="opt"> (optional)</span>}</label>}
      {child}
      {help && <div className="help">{help}</div>}
    </div>
  );
}

export function TextInput({ label, value, onChange, placeholder, optional, help, full, type = 'text', autoFocus }) {
  return (
    <Field label={label} optional={optional} help={help} full={full}>
      {(id) => (
        <input id={id} type={type} value={value || ''} placeholder={placeholder} autoFocus={autoFocus}
          onChange={(e) => onChange(e.target.value)} />
      )}
    </Field>
  );
}

export function TextArea({ label, value, onChange, placeholder, optional, help, full = true, rows = 4 }) {
  return (
    <Field label={label} optional={optional} help={help} full={full}>
      {(id) => (
        <textarea id={id} rows={rows} value={value || ''} placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)} />
      )}
    </Field>
  );
}

export function SectionCard({ title, hint, children, tools, hidden, className = '' }) {
  return (
    <section className={`fcard ${hidden ? 'is-hidden' : ''} ${className}`}>
      <div className="fcard-head">
        <div>
          <h3>{title}{hidden && <span className="hidden-tag">Hidden from resume</span>}</h3>
          {hint && !hidden && <div className="hint">{hint}</div>}
        </div>
        {tools && <div className="tools">{tools}</div>}
      </div>
      <div className="fcard-body">{children}</div>
    </section>
  );
}

// A repeatable list of entries (jobs, schools, …) with collapse / reorder / delete.
export function ItemList({ items, onChange, create, addLabel, summary, render }) {
  const [open, setOpen] = useState(() => new Set(items.length === 1 ? [items[0].id] : []));
  const toggle = (id) => setOpen((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const set = (i, patch) => onChange(items.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  const move = (i, d) => {
    const n = [...items];
    [n[i], n[i + d]] = [n[i + d], n[i]];
    onChange(n);
  };
  const remove = (i) => onChange(items.filter((_, j) => j !== i));
  const add = () => {
    const it = create();
    onChange([...items, it]);
    setOpen((s) => new Set(s).add(it.id));
  };

  return (
    <div>
      {items.map((it, i) => {
        const isOpen = open.has(it.id);
        const [t, s] = summary(it);
        return (
          <div key={it.id} className={`item ${isOpen ? 'open' : ''}`}>
            <div className="item-head" onClick={() => toggle(it.id)}>
              <div className="ttl">
                <b>{t || <span style={{ color: '#94a3b8', fontWeight: 500 }}>Untitled — click to edit</span>}</b>
                {s && <span>{s}</span>}
              </div>
              <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex' }}>
                <button className="icon-btn" title="Move up" disabled={i === 0} onClick={() => move(i, -1)}>{Icon.up}</button>
                <button className="icon-btn" title="Move down" disabled={i === items.length - 1} onClick={() => move(i, 1)}>{Icon.down}</button>
                <button className="icon-btn danger" title="Delete" onClick={() => remove(i)}>{Icon.trash}</button>
              </div>
              <span className="chev">{Icon.down}</span>
            </div>
            {isOpen && <div className="item-body">{render(it, (patch) => set(i, patch))}</div>}
          </div>
        );
      })}
      <button className="add-btn" onClick={add}>{Icon.plus} {addLabel}</button>
    </div>
  );
}
