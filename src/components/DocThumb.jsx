import '../styles/doc.css';

// Small, non-interactive preview of an uploaded document (first page).
export default function DocThumb({ html, font, width = 190 }) {
  const scale = width / 794;
  return (
    <div className="page-frame" style={{ width, height: 1123 * scale, overflow: 'hidden', background: '#fff' }}>
      <div className={`doc-thumb ${font === 'serif' ? 'font-serif' : 'font-sans'}`} style={{ transform: `scale(${scale})` }}>
        <div className="doc-content" dangerouslySetInnerHTML={{ __html: html || '' }} />
      </div>
    </div>
  );
}
