import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { buildColumns, pageVars, PAGE_SIZES, TEMPLATES } from '../templates';

// Distribute measured block heights onto pages, keeping headings with the
// block that follows them.
// `avail` is the usable height of the first page; `availRest` of the pages after it.
function paginate(blocks, heights, avail, availRest = avail) {
  const pages = [[]];
  let used = 0;
  blocks.forEach((b, i) => {
    const h = heights[i];
    let page = pages[pages.length - 1];
    const cap = pages.length === 1 ? avail : availRest;
    if (used + h > cap + 0.5 && page.length) {
      const carry = [];
      while (page.length && blocks[page[page.length - 1]].kwn) carry.unshift(page.pop());
      if (!page.length) { page.push(...carry); carry.length = 0; }
      page = [...carry];
      pages.push(page);
      used = carry.reduce((s, j) => s + heights[j], 0);
    }
    page.push(i);
    used += h;
  });
  return pages;
}

function Page({ resume, cols, colKeys, layout, pageIndex, className = '', style }) {
  // Some templates have a full-width header across the top of the first page.
  const top = pageIndex === 0 && cols.top?.length ? cols.top : null;
  const columns = colKeys.map((c) => {
    const blocks = cols[c] || [];
    const idx = layout ? layout[c]?.[pageIndex] || [] : pageIndex === 0 ? blocks.map((_, i) => i) : [];
    return (
      <div key={c} className={`col col-${c}`}>
        <div className="col-inner">
          {idx.filter((i) => blocks[i]).map((i) => (
            <div key={blocks[i].key} className="blk">{blocks[i].node}</div>
          ))}
        </div>
      </div>
    );
  });
  return (
    <div className={`rs rs-${resume.template} page ${top ? 'has-top' : ''} ${className}`} style={{ ...pageVars(resume), ...style }}>
      {top ? (
        <>
          <div className="page-top">{top.map((b) => <div key={b.key} className="blk">{b.node}</div>)}</div>
          <div className="page-cols">{columns}</div>
        </>
      ) : columns}
    </div>
  );
}

export default function ResumePages({ resume, width, print = false, onPageCount, maxPages, gap = 20 }) {
  const tpl = TEMPLATES[resume.template] || TEMPLATES.modern;
  const colKeys = tpl.columns;
  const cols = useMemo(() => buildColumns(resume), [resume]);
  const [layout, setLayout] = useState(null);
  const measureRef = useRef(null);

  const measure = useCallback(() => {
    const root = measureRef.current;
    if (!root) return;
    const probe = root.querySelector('.probe');
    const probeTop = root.querySelector('.probe-top');
    const rect = probe.getBoundingClientRect();
    const next = { w: rect.width, h: rect.height, pages: 1 };
    const availIn = (pg, c) => {
      const col = pg.querySelector(`.col-${c}`);
      const cs = getComputedStyle(col);
      return col.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - 1;
    };
    colKeys.forEach((c) => {
      const availRest = availIn(probe, c);
      const avail = probeTop ? availIn(probeTop, c) : availRest;
      const els = root.querySelectorAll(`.flow .col-${c} .col-inner > .blk`);
      const heights = Array.from(els, (el) => el.getBoundingClientRect().height);
      const blocks = cols[c] || [];
      next[c] = blocks.length ? paginate(blocks, heights, avail, availRest) : [[]];
      next.pages = Math.max(next.pages, next[c].length);
    });
    setLayout((prev) => (prev && JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
  }, [cols, colKeys]);

  useLayoutEffect(() => { measure(); }, [measure, resume.pageSize, resume.template, resume.fontDelta, resume.spacing]);

  // Re-measure once web fonts finish loading (they change text metrics).
  useEffect(() => {
    if (!document.fonts) return;
    let alive = true;
    document.fonts.ready.then(() => alive && measure());
    const onLoad = () => alive && measure();
    document.fonts.addEventListener?.('loadingdone', onLoad);
    return () => { alive = false; document.fonts.removeEventListener?.('loadingdone', onLoad); };
  }, [measure]);

  const pageCount = layout?.pages || 1;
  useEffect(() => { onPageCount?.(pageCount); }, [pageCount, onPageCount]);

  const pw = layout?.w || 794;
  const ph = layout?.h || 1123;
  const scale = width ? width / pw : 1;
  const shown = Math.min(pageCount, maxPages || Infinity);
  const size = PAGE_SIZES[resume.pageSize] || PAGE_SIZES.A4;

  const pages = (extra) =>
    Array.from({ length: shown }, (_, i) => (
      <Page key={i} resume={resume} cols={cols} colKeys={colKeys} layout={layout} pageIndex={i} {...extra} />
    ));

  return (
    <>
      {/* Hidden measuring area: one empty page (for available height) + all blocks flowing freely. */}
      <div ref={measureRef} className="rs-measure" aria-hidden>
        <div className={`rs rs-${resume.template} page probe`} style={pageVars(resume)}>
          {colKeys.map((c) => <div key={c} className={`col col-${c}`}><div className="col-inner" /></div>)}
        </div>
        {cols.top?.length > 0 && (
          <div className={`rs rs-${resume.template} page has-top probe-top`} style={pageVars(resume)}>
            <div className="page-top">{cols.top.map((b) => <div key={b.key} className="blk">{b.node}</div>)}</div>
            <div className="page-cols">{colKeys.map((c) => <div key={c} className={`col col-${c}`}><div className="col-inner" /></div>)}</div>
          </div>
        )}
        <div className={`rs rs-${resume.template} page flow`} style={pageVars(resume)}>
          {colKeys.map((c) => (
            <div key={c} className={`col col-${c}`}>
              <div className="col-inner">
                {(cols[c] || []).map((b) => <div key={b.key} className="blk">{b.node}</div>)}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="pages" style={{ gap }}>
        {Array.from({ length: shown }, (_, i) => (
          <div key={i} className="page-frame" style={{ width: pw * scale, height: ph * scale }}>
            <div style={{ transform: `scale(${scale})`, transformOrigin: '0 0', width: pw }}>
              <Page resume={resume} cols={cols} colKeys={colKeys} layout={layout} pageIndex={i} />
            </div>
          </div>
        ))}
      </div>

      {print && document.getElementById('print-root') &&
        createPortal(
          <>
            <style>{`@page { size: ${size.css}; margin: 0; }`}</style>
            {pages({ className: 'print-page' })}
          </>,
          document.getElementById('print-root'),
        )}
    </>
  );
}
