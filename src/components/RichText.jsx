// Text boxes with formatting (bold, italic, underline, links, bullet lists) and the
// floating formatting bar that appears at the bottom while one of them is being edited.
import { useEffect, useId, useReducer, useRef, useState, useSyncExternalStore } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import { Extension } from '@tiptap/core';
import { Plugin, TextSelection } from '@tiptap/pm/state';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import LinkExt from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { fromEditorJson, toEditorHtml } from '../lib/rich';

// ---- which text box is being edited (shared with the formatting bar) ----
let active = null; // { editor, mode }
const subs = new Set();
const emit = () => subs.forEach((f) => f());
const setActive = (a) => { if (active?.editor !== a?.editor || active?.mode !== a?.mode) { active = a; emit(); } };
const useActive = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => active);

// Leaving a list one step at a time (Enter or Backspace on an empty line):
//   empty bullet          → plain line, still indented under the item above
//   empty indented line   → one level further out … until you're out of the list
// Backspace at the start of a bullet removes the bullet but keeps the indent.
// Esc leaves the list completely. A list at the end always has an empty line under it.
const isList = (n) => n && (n.type.name === 'bulletList' || n.type.name === 'orderedList');
const ListExit = Extension.create({
  name: 'listExit',
  priority: 1000, // before the built-in list keys
  addKeyboardShortcuts() {
    const ed = this.editor;
    // Where the cursor is, if it's inside a list item.
    const where = () => {
      const { $from, empty } = ed.state.selection;
      if (!empty || $from.depth < 3 || $from.node(-1).type.name !== 'listItem') return null;
      return {
        $from,
        para: $from.parent,
        li: $from.node(-1),
        liPos: $from.before(-1),
        inLi: $from.index(-1), // 0 = the bullet's own line
        list: $from.node(-2),
        inList: $from.index(-2),
      };
    };
    // Move content from this item into the item above (it loses its bullet, keeps the indent).
    const intoPrevious = (w, content) => {
      const { state, view } = ed;
      const prev = w.list.child(w.inList - 1);
      const prevEnd = w.liPos - 1; // just inside the end of the previous item
      const tr = state.tr.delete(w.liPos, w.liPos + w.li.nodeSize);
      tr.insert(prevEnd, content);
      tr.setSelection(TextSelection.create(tr.doc, prevEnd + 1));
      view.dispatch(tr.scrollIntoView());
      return !!prev;
    };
    // Move an indented line one level out (or out of the list at the top level).
    const stepOut = (w) => {
      const { state, view } = ed;
      const at = w.$from.before();
      const afterList = w.$from.after(-2);
      const tr = state.tr.delete(at, at + w.para.nodeSize);
      const pos = tr.mapping.map(afterList);
      tr.insert(pos, w.para); // keeps any text on the line
      tr.setSelection(TextSelection.create(tr.doc, pos + 1 + w.$from.parentOffset));
      view.dispatch(tr.scrollIntoView());
      return true;
    };
    return {
      Enter: () => {
        const w = where();
        if (!w) return false;
        const empty = w.para.content.size === 0;
        if (w.inLi === 0) {
          // Empty bullet with an item above it → plain indented line under that item.
          if (empty && w.li.childCount === 1 && w.inList > 0) return intoPrevious(w, ed.state.schema.nodes.paragraph.create());
          return false; // normal list behaviour
        }
        // On an indented line: Enter makes another indented line; on an empty one, step out a level.
        return empty ? stepOut(w) : ed.commands.splitBlock();
      },
      Backspace: () => {
        const w = where();
        if (!w || w.$from.parentOffset !== 0) return false;
        if (w.inLi === 0) {
          if (w.inList > 0) return intoPrevious(w, w.li.content); // drop the bullet, keep the indent
          return ed.commands.liftListItem('listItem');
        }
        return w.para.content.size === 0 ? stepOut(w) : false;
      },
      // On an indented line, Tab turns it into a sub-item and Shift+Tab moves it out a level.
      Tab: () => {
        const w = where();
        if (!w || w.inLi === 0) return false;
        return ed.commands.wrapInList(w.list.type.name);
      },
      'Shift-Tab': () => {
        const w = where();
        if (!w || w.inLi === 0) return false;
        return stepOut(w);
      },
      Escape: () => {
        if (!ed.isActive('listItem')) return false;
        let guard = 0;
        while (ed.isActive('listItem') && guard++ < 10) { if (!ed.commands.liftListItem('listItem')) break; }
        return true;
      },
    };
  },
  addProseMirrorPlugins() {
    return [new Plugin({
      appendTransaction: (trs, _old, state) => {
        const last = state.doc.lastChild;
        if (!isList(last)) return null;
        return state.tr.insert(state.doc.content.size, state.schema.nodes.paragraph.create());
      },
    })];
  },
});

// A list at the very end gets an empty line under it, so there's somewhere to click.
const editorHtml = (v, lists) => {
  const h = toEditorHtml(v, { lists });
  return lists && /<\/(ul|ol)>$/.test(h) ? `${h}<p></p>` : h;
};

// mode:
//  'rich'  – paragraphs, plus bullet / numbered lists and indenting from the formatting bar
//  'plain' – no lists (skills)
export function RichTextArea({ label, value, onChange, placeholder, optional, help, full = true, rows = 4, mode = 'rich' }) {
  const id = useId();
  const lists = mode === 'rich';
  const last = useRef(value || '');
  const changeRef = useRef(onChange);
  changeRef.current = onChange;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false, codeBlock: false, blockquote: false, horizontalRule: false, code: false, strike: false,
        orderedList: lists ? {} : false, bulletList: lists ? {} : false, listItem: lists ? {} : false,
      }),
      Underline,
      LinkExt.configure({ openOnClick: false, autolink: false, linkOnPaste: true, HTMLAttributes: { rel: 'noopener noreferrer' } }),
      Placeholder.configure({ placeholder: placeholder || '' }),
      ...(lists ? [ListExit] : []),
    ],
    content: editorHtml(value, lists),
    editorProps: {
      // keep the cursor clear of the floating formatting bar
      scrollMargin: { top: 24, bottom: 110, left: 0, right: 0 },
      scrollThreshold: { top: 24, bottom: 110, left: 0, right: 0 },
      attributes: { id, class: 'rt-input', role: 'textbox', 'aria-multiline': 'true', ...(label ? { 'aria-label': label } : {}) } },
    onUpdate: ({ editor: ed }) => {
      const v = fromEditorJson(ed.getJSON());
      if (v === last.current) return; // e.g. only an empty line was added under a list
      last.current = v;
      changeRef.current(v);
    },
    onFocus: ({ editor: ed }) => setActive({ editor: ed, mode }),
  });

  // Keep in step when the value changes from outside (e.g. "Clear example content").
  useEffect(() => {
    if (!editor || (value || '') === last.current) return;
    last.current = value || '';
    editor.commands.setContent(editorHtml(value, lists), false);
  }, [value, editor, lists]);

  useEffect(() => () => { if (active?.editor === editor) setActive(null); }, [editor]);

  return (
    <div className={`field ${full ? 'full' : ''}`}>
      {label && <label htmlFor={id} onClick={() => editor?.commands.focus()}>{label}{optional && <span className="opt"> (optional)</span>}</label>}
      <div className={`rt rt-${mode}`} style={{ '--rows': rows }}>
        <EditorContent editor={editor} />
      </div>
      {help && <div className="help">{help}</div>}
    </div>
  );
}

const I = {
  bold: <path d="M7 5h6a3.5 3.5 0 010 7H7zM7 12h7a3.5 3.5 0 010 7H7z" />,
  italic: <path d="M19 4h-9M14 20H5M15 4L9 20" />,
  underline: <path d="M7 4v7a5 5 0 0010 0V4M5 20h14" />,
  list: <path d="M10 6h10M10 12h10M10 18h10M5 6h.01M5 12h.01M5 18h.01" />,
  ol: <path d="M10 6h10M10 12h10M10 18h10M4 4.5h1.5V9M4 9h3M4 14.5a1.5 1.5 0 013 0c0 1.5-3 2-3 4h3" />,
  indent: <path d="M4 6h16M10 12h10M4 18h16M4 9.5l3 2.5-3 2.5" />,
  outdent: <path d="M4 6h16M10 12h10M4 18h16M7 9.5L4 12l3 2.5" />,
  link: <path d="M10 13a5 5 0 007.5.5l3-3a5 5 0 00-7-7l-1.7 1.7M14 11a5 5 0 00-7.5-.5l-3 3a5 5 0 007 7l1.7-1.7" />,
  clear: <path d="M4 7V5h12v2M10 5l-3 14M13 19h-5M15 14l5 5M20 14l-5 5" />,
  undo: <path d="M9 14L4 9l5-5M4 9h11a5 5 0 010 10h-3" />,
  redo: <path d="M15 14l5-5-5-5M20 9H9a5 5 0 000 10h3" />,
};
const Svg = ({ d }) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{d}</svg>;

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
const key = (k) => (isMac ? `⌘${k}` : `Ctrl+${k}`);

const LIST_OFF = 'Lists aren’t used here — separate skills with commas';

// The floating formatting bar. Put it once at the end of the scrolling form.
export function FormatBar() {
  const a = useActive();
  const barRef = useRef(null);
  const [, rerender] = useReducer((x) => x + 1, 0);
  const [linkOpen, setLinkOpen] = useState(false);
  const [url, setUrl] = useState('');
  const editor = a?.editor;

  // Hide the bar when focus leaves the text boxes (and the bar itself).
  useEffect(() => {
    const check = () => {
      const el = document.activeElement;
      if (el?.closest?.('.ProseMirror') || barRef.current?.contains(el)) return;
      setActive(null);
      setLinkOpen(false);
    };
    const onOut = () => setTimeout(check, 0);
    document.addEventListener('focusout', onOut);
    document.addEventListener('focusin', onOut);
    return () => { document.removeEventListener('focusout', onOut); document.removeEventListener('focusin', onOut); };
  }, []);

  // Light up buttons as the cursor moves.
  useEffect(() => {
    if (!editor) return undefined;
    editor.on('transaction', rerender);
    return () => editor.off('transaction', rerender);
  }, [editor]);

  useEffect(() => { setLinkOpen(false); }, [editor]);

  const on = (name) => !!editor?.isActive(name);
  const run = (fn) => (e) => { e.preventDefault(); if (editor) fn(editor.chain().focus()).run(); };
  const listOk = a?.mode === 'rich';
  // Cursor on an indented line inside a list item (not the bullet's own line)?
  const onIndentedLine = () => {
    const { $from } = editor.state.selection;
    return $from.depth >= 3 && $from.node(-1).type.name === 'listItem' && $from.index(-1) > 0;
  };
  const listCmd = (type) => run((c) => (onIndentedLine() ? c.wrapInList(type) : type === 'bulletList' ? c.toggleBulletList() : c.toggleOrderedList()));
  const inList = on('bulletList') || on('orderedList');

  const openLink = (e) => {
    e.preventDefault();
    if (!editor) return;
    setUrl(editor.getAttributes('link').href || '');
    setLinkOpen(true);
  };
  const applyLink = (e) => {
    e?.preventDefault();
    if (!editor) return;
    let href = url.trim();
    if (!href) { editor.chain().focus().extendMarkRange('link').unsetLink().run(); setLinkOpen(false); return; }
    if (!/^(https?:|mailto:|tel:)/i.test(href)) href = /@/.test(href) && !/\//.test(href) ? `mailto:${href}` : `https://${href}`;
    const { empty } = editor.state.selection;
    if (empty && !editor.isActive('link')) {
      const text = url.trim();
      editor.chain().focus().insertContent({ type: 'text', text, marks: [{ type: 'link', attrs: { href } }] }).run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
    }
    setLinkOpen(false);
  };

  const Btn = ({ name, icon, title, onDown, disabled }) => (
    <button type="button" className={`fbar-btn ${name && on(name) ? 'on' : ''} ${disabled ? 'off' : ''}`} title={title} aria-label={title}
      aria-pressed={name ? on(name) : undefined} aria-disabled={disabled || undefined}
      onMouseDown={(e) => { e.preventDefault(); if (!disabled) onDown(e); }}>
      <Svg d={icon} />
    </button>
  );

  return (
    <div ref={barRef} className={`fbar ${editor ? 'show' : ''}`} role="toolbar" aria-label="Text formatting" aria-hidden={!editor}
      onMouseDown={(e) => { if (e.target.tagName !== 'INPUT') e.preventDefault(); }}>
      {linkOpen ? (
        <form className="fbar-link" onSubmit={applyLink}>
          <Svg d={I.link} />
          <input autoFocus value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Paste a link, e.g. github.com/you"
            onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); setLinkOpen(false); editor?.commands.focus(); } }} />
          <button type="submit" className="fbar-apply">Apply</button>
          {on('link') && <button type="button" className="fbar-text" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().extendMarkRange('link').unsetLink().run(); setLinkOpen(false); }}>Remove</button>}
          <button type="button" className="fbar-text" onMouseDown={(e) => { e.preventDefault(); setLinkOpen(false); editor?.commands.focus(); }}>Cancel</button>
        </form>
      ) : (
        <>
          <Btn name="bold" icon={I.bold} title={`Bold (${key('B')})`} onDown={run((c) => c.toggleBold())} />
          <Btn name="italic" icon={I.italic} title={`Italic (${key('I')})`} onDown={run((c) => c.toggleItalic())} />
          <Btn name="underline" icon={I.underline} title={`Underline (${key('U')})`} onDown={run((c) => c.toggleUnderline())} />
          <span className="fbar-sep" />
          <Btn name={listOk ? 'bulletList' : null} icon={I.list} title={listOk ? 'Bullet list — Enter on an empty bullet steps out one level, Esc ends the list' : LIST_OFF}
            disabled={!listOk} onDown={listCmd('bulletList')} />
          <Btn name={listOk ? 'orderedList' : null} icon={I.ol} title={listOk ? 'Numbered list — Enter on an empty item steps out one level, Esc ends the list' : LIST_OFF}
            disabled={!listOk} onDown={listCmd('orderedList')} />
          <Btn icon={I.outdent} title="Decrease indent (Shift+Tab)" disabled={!listOk || !editor?.can().liftListItem('listItem')} onDown={run((c) => c.liftListItem('listItem'))} />
          <Btn icon={I.indent} title={listOk && !inList ? 'Increase indent — works inside a list (Tab)' : 'Increase indent (Tab)'} disabled={!listOk || !editor?.can().sinkListItem('listItem')} onDown={run((c) => c.sinkListItem('listItem'))} />
          <span className="fbar-sep" />
          <Btn name="link" icon={I.link} title="Add link" onDown={openLink} />
          <Btn icon={I.clear} title="Clear formatting" onDown={run((c) => c.unsetAllMarks())} />
          <span className="fbar-sep" />
          <Btn icon={I.undo} title={`Undo (${key('Z')})`} disabled={!editor?.can().undo()} onDown={run((c) => c.undo())} />
          <Btn icon={I.redo} title={`Redo (${key('⇧Z')})`} disabled={!editor?.can().redo()} onDown={run((c) => c.redo())} />
        </>
      )}
    </div>
  );
}
