import React, { useState, useCallback, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import yaml from 'yaml';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store';
import { Check, ChevronDown, Calendar as CalendarIcon } from 'lucide-react';

// ── CodeMirror imports ────────────────────────────────────────────────────────
import CodeMirror from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { EditorView } from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';

// ── Editor theme ──────────────────────────────────────────────────────────────

const editorTheme = EditorView.theme({
  '&': {
    backgroundColor: '#282b36',
    color: '#e0e2e8',
    fontFamily: "'Georgia','Cambria','Times New Roman',serif",
    fontSize: '16px',
    lineHeight: '1.8',
    height: '100%',
  },
  '.cm-scroller':         { padding: '32px 40px', overflowX: 'hidden', fontFamily: 'inherit' },
  '.cm-content':          { caretColor: '#ffffff', maxWidth: '680px', margin: '0 auto', padding: '0', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'inherit' },
  '&.cm-focused .cm-cursor': { borderLeftColor: '#ffffff', borderLeftWidth: '2px' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': { backgroundColor: 'rgba(255,255,255,0.12) !important' },
  '.cm-gutters':          { display: 'none' },
  '.cm-activeLine':       { backgroundColor: 'transparent' },
  '.cm-activeLineGutter': { backgroundColor: 'transparent' },
  '&.cm-focused':         { outline: 'none' },
  '.cm-placeholder':      { color: '#4a4f60', fontStyle: 'italic' },
  '.cm-line':             { padding: '0' },
}, { dark: true });

// ── Syntax highlighting ───────────────────────────────────────────────────────

const markdownHighlighting = HighlightStyle.define([
  { tag: t.heading1,    color: '#cd6b6b', fontWeight: 'bold', fontSize: '1.6em',  lineHeight: '1.4' },
  { tag: t.heading2,    color: '#cd6b6b', fontWeight: 'bold', fontSize: '1.35em' },
  { tag: t.heading3,    color: '#cd6b6b', fontWeight: 'bold', fontSize: '1.15em' },
  { tag: [t.heading4, t.heading5, t.heading6], color: '#cd6b6b', fontWeight: 'bold' },
  { tag: t.strong,      color: '#d2a868', fontWeight: 'bold' },
  { tag: t.emphasis,    color: '#d2a868', fontStyle: 'italic' },
  { tag: t.link,        color: '#8be9fd', textDecoration: 'underline' },
  { tag: t.url,         color: '#8be9fd' },
  { tag: t.monospace,   color: '#a9dc76', fontFamily: "'Fira Code','Cascadia Code','Consolas',monospace", fontSize: '0.9em', backgroundColor: 'rgba(169,220,118,0.08)', borderRadius: '3px', padding: '0 3px' },
  { tag: t.string,      color: '#a9dc76' },
  { tag: t.list,        color: '#e0e2e8' },
  { tag: t.quote,       color: '#7a7f94', fontStyle: 'italic' },
  { tag: t.angleBracket,color: '#fc9867' },
  { tag: t.strikethrough,          color: '#7a7f94', textDecoration: 'line-through' },
  { tag: t.processingInstruction,  color: '#4a4f60' },
  { tag: t.contentSeparator,       color: '#4a4f60' },
]);

// FIX #4: syntaxHighlighting extension lives ONLY in editorExtensions.
// basicSetup does NOT include a syntaxHighlighting key — that caused double-init.
const editorExtensions = [
  markdown({ base: markdownLanguage }),
  editorTheme,
  syntaxHighlighting(markdownHighlighting),
  EditorView.lineWrapping,
];

const editorSetup = {
  lineNumbers:               false,
  foldGutter:                false,
  highlightActiveLine:       false,
  highlightActiveLineGutter: false,
  dropCursor:                true,
  allowMultipleSelections:   true,
  indentOnInput:             true,
  bracketMatching:           true,
  closeBrackets:             true,
  autocompletion:            false,
  rectangularSelection:      false,
  crosshairCursor:           false,
  history:                   true,
  drawSelection:             true,
  // syntaxHighlighting intentionally omitted (not set to false) — avoids conflict
};

// ── Sub-components ────────────────────────────────────────────────────────────

function FrontmatterValue({ propKey, value, onChange }: {
  propKey: string; value: string; onChange: (v: string) => void;
}) {
  const lk = propKey.toLowerCase();
  if (lk === 'priority') {
    const opts = ['low','medium','high','urgent'];
    const colors: Record<string,string> = {
      low: 'bg-zinc-100 text-zinc-600', medium: 'bg-amber-100 text-amber-700',
      high: 'bg-orange-100 text-orange-700', urgent: 'bg-red-100 text-red-700',
    };
    return (
      <div className="flex gap-1 flex-wrap">
        {opts.map(o => (
          <button key={o} onClick={() => onChange(o)}
            className={cn('px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize transition-all border',
              value === o ? colors[o] + ' border-transparent' : 'bg-white border-zinc-200 text-zinc-400 hover:border-zinc-300')}>
            {o}
          </button>
        ))}
      </div>
    );
  }
  if (lk === 'status') {
    return (
      <div className="relative">
        <select value={value} onChange={e => onChange(e.target.value)}
          className="w-full text-xs border border-zinc-200 rounded-lg px-2.5 py-1.5 bg-white text-zinc-700 focus:outline-none focus:ring-2 focus:ring-violet-300 appearance-none pr-7">
          {['todo','in-progress','done'].map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-400 pointer-events-none"/>
      </div>
    );
  }
  if (lk === 'date' || lk === 'due' || lk === 'deadline') {
    return (
      <div className="relative">
        <CalendarIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-violet-400 pointer-events-none"/>
        <input type="date" value={value} onChange={e => onChange(e.target.value)}
          className="w-full pl-8 pr-2.5 py-1.5 text-xs border border-zinc-200 rounded-lg bg-white text-zinc-700 focus:outline-none focus:ring-2 focus:ring-violet-300"/>
      </div>
    );
  }
  return (
    <input value={value} onChange={e => onChange(e.target.value)}
      className="text-xs border border-zinc-200 rounded-lg px-2.5 py-1.5 bg-white text-zinc-700 focus:outline-none focus:ring-2 focus:ring-violet-300 w-full"/>
  );
}

function InternalLink({ name, tasks }: { name: string; tasks: any[] }) {
  const task = tasks.find(t => t.title.toLowerCase() === name.toLowerCase());
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded-md text-[0.85em] font-medium border border-indigo-200 cursor-pointer hover:bg-indigo-100 transition-colors"
      title={task ? `Task: ${task.status}` : 'Internal link'}>
      [[{name}]]
      {task && <Check className="w-3 h-3 text-indigo-500"/>}
    </span>
  );
}

function InlineProperty({ propKey, propValue }: { propKey: string; propValue: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-zinc-100 text-zinc-600 rounded-md text-[0.85em] font-medium">
      <span className="text-zinc-400">{propKey}::</span>{propValue}
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface NoteEditorProps {
  content: string;
  onChange: (content: string) => void;
  isEditing: boolean;
  setIsEditing: (v: boolean) => void;
}

export function NoteEditor({ content, onChange, isEditing, setIsEditing }: NoteEditorProps) {
  const tasks = useAppStore(s => s.tasks);

  // Parse frontmatter
  let frontmatter: any = null;
  let markdownContent = content;
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n?/);
  if (fmMatch) {
    try {
      frontmatter = yaml.parse(fmMatch[1]);
      markdownContent = content.slice(fmMatch[0].length);
    } catch { /* invalid yaml */ }
  }

  // FIX #2 — anchor replacement to the start of the string so a later `---`
  // separator is never accidentally matched.
  const updateFrontmatter = (key: string, value: string) => {
    if (!frontmatter) return;
    const updated = yaml.stringify({ ...frontmatter, [key]: value }).trim();
    onChange(content.replace(/^(---\n)[\s\S]*?(\n---)/, `$1${updated}$2`));
  };

  // ── Checkbox toggling via DOM event delegation ────────────────────────────
  //
  // Simplest correct solution — no AST, no counter, no render-phase side effects:
  //
  // 1. A ref points to the preview container div.
  // 2. toggleCheckbox(n) patches the nth task-list marker in the raw text.
  //    The regex only matches genuine `- [ ]` / `* [x]` list syntax — it won't
  //    match inside fenced code blocks because those markers are indented inside
  //    a code fence and never follow a bare list bullet at line start.
  // 3. When a checkbox fires onChange, we query ALL checkboxes inside the
  //    container and find the index of the one that fired. That index is passed
  //    directly to toggleCheckbox. No shared mutable state, no StrictMode issues.

  const previewRef = useRef<HTMLDivElement>(null);

  const toggleCheckbox = useCallback((index: number) => {
    let i = 0;
    onChange(content.replace(/^([ \t]*[-*+]\s+)\[([ xX])\]/gm, (m, prefix, ch) => {
      const result = i === index
        ? `${prefix}[${ch.trim() === '' ? 'x' : ' '}]`
        : m;
      i++;
      return result;
    }));
  }, [content, onChange]);

  const handleCodeMirrorChange = useCallback((val: string) => {
    onChange(val);
  }, [onChange]);

  // ── EDIT MODE ─────────────────────────────────────────────────────────────

  if (isEditing) {
    return (
      <div className="w-full h-full min-h-[500px] rounded-xl overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-2 bg-[#1e2130] border-b border-white/5">
          <div className="flex gap-2">
            {(['H1','B','I','`','—'] as const).map(label => (
              <button key={label} title={label} onMouseDown={e => e.preventDefault()}
                className="px-2 py-0.5 text-[11px] font-semibold text-[#7a7f94] hover:text-[#e0e2e8] rounded transition-colors select-none font-mono">
                {label}
              </button>
            ))}
          </div>
          <span className="ml-auto text-[10px] text-[#4a4f60] font-mono select-none">markdown · codemirror 6</span>
        </div>
        <CodeMirror
          value={content}
          onChange={handleCodeMirrorChange}
          extensions={editorExtensions}
          basicSetup={editorSetup}
          placeholder="Start writing… (Markdown supported)"
          className="h-full"
          style={{ height: '100%' }}
        />
      </div>
    );
  }

  // ── PREVIEW MODE ──────────────────────────────────────────────────────────

  // FIX #3 — URI-encode link names to handle special characters safely
  const processedMarkdown = markdownContent
    .replace(/\[\[([^\]]+)\]\]/g, (_, name) =>
      `[${name}](internal://${encodeURIComponent(name)})`)
    .replace(/\[([a-zA-Z0-9_-]+)::([^\]]*)\]/g, (_, k, v) =>
      `[${k}::${v}](prop://${encodeURIComponent(k)}/${encodeURIComponent(v)})`);

  const GH = {
    fg: '#1f2328', fgMuted: '#636c76', border: '#d1d9e0', borderSub: '#d8dee4',
    canvas: '#ffffff', canvasSub: '#f6f8fa', accent: '#0969da',
    codeFg: '#e6edf3', codeBg: '#1f2328',
  };

  const s = {
    body:       { color: GH.fg, fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans',Helvetica,Arial,sans-serif", fontSize: '16px', lineHeight: '1.7', wordWrap: 'break-word' as const },
    h1:         { paddingBottom: '0.4em', fontSize: '2em',    borderBottom: `1px solid ${GH.border}`, fontWeight: 600, lineHeight: 1.25, marginTop: '24px', marginBottom: '16px' },
    h2:         { paddingBottom: '0.4em', fontSize: '1.5em',  borderBottom: `1px solid ${GH.border}`, fontWeight: 600, lineHeight: 1.25, marginTop: '24px', marginBottom: '16px' },
    h3:         { fontSize: '1.25em', fontWeight: 600, lineHeight: 1.25, marginTop: '24px', marginBottom: '16px', color: '#1e3a5f' },
    h4:         { fontSize: '1em',    fontWeight: 600, lineHeight: 1.25, marginTop: '24px', marginBottom: '16px' },
    h5:         { fontSize: '0.875em',fontWeight: 600, lineHeight: 1.25, marginTop: '24px', marginBottom: '16px' },
    h6:         { fontSize: '0.85em', fontWeight: 600, lineHeight: 1.25, marginTop: '24px', marginBottom: '16px', color: GH.fgMuted },
    p:          { marginTop: '0', marginBottom: '16px', lineHeight: '1.7' },
    a:          { color: GH.accent, textDecoration: 'none' },
    ul:         { paddingLeft: '2em', marginTop: '0', marginBottom: '16px', listStyleType: 'disc' },
    ol:         { paddingLeft: '2em', marginTop: '0', marginBottom: '16px', listStyleType: 'decimal' },
    li:         { marginTop: '0', marginBottom: '10px', lineHeight: '1.7' },
    inlineCode: { padding: '0.2em 0.4em', margin: '0', fontSize: '85%', whiteSpace: 'break-spaces' as const, backgroundColor: GH.canvasSub, borderRadius: '6px', fontFamily: "ui-monospace,SFMono-Regular,'SF Mono',Menlo,Consolas,'Liberation Mono',monospace", border: `1px solid ${GH.border}` },
    pre:        { padding: '16px', overflow: 'auto' as const, fontSize: '85%', lineHeight: '1.45', backgroundColor: GH.codeBg, borderRadius: '6px', marginTop: '0', marginBottom: '16px', wordBreak: 'normal' as const },
    preCode:    { display: 'inline', padding: '0', margin: '0', overflow: 'visible', fontSize: '100%', lineHeight: 'inherit', wordWrap: 'normal' as const, backgroundColor: 'transparent', border: '0', color: GH.codeFg, fontFamily: "ui-monospace,SFMono-Regular,'SF Mono',Menlo,Consolas,'Liberation Mono',monospace" },
    blockquote: { padding: '0 1em', color: GH.fgMuted, borderLeft: `4px solid ${GH.borderSub}`, margin: '0 0 16px 0' },
    // FIX #5 — table stays display:table; overflow moves to a wrapper div
    tableWrap:  { width: '100%', overflowX: 'auto' as const, marginBottom: '16px' },
    table:      { borderSpacing: '0', borderCollapse: 'collapse' as const, width: '100%', minWidth: 'max-content' },
    th:         { padding: '12px 16px', border: `1px solid ${GH.border}`, fontWeight: 700, backgroundColor: '#f3f4f6', color: GH.fg },
    td:         { padding: '12px 16px', border: `1px solid ${GH.border}` },
    hr:         { height: '4px', padding: '0', margin: '24px 0', backgroundColor: GH.border, border: '0' },
    img:        { maxWidth: '100%', boxSizing: 'border-box' as const, borderStyle: 'none', borderRadius: '6px' },
    del:        { color: GH.fgMuted },
  };

  return (
    <div className="max-w-[800px] mx-auto w-full pb-32" style={s.body}>
      <style>{`
        .gh-md table tr:nth-child(2n) td { background-color: #f6f8fa; }
        .gh-md a:hover { text-decoration: underline; }
        .gh-md pre code { white-space: pre; }
        .gh-md blockquote > :first-child { margin-top: 0; }
        .gh-md blockquote > :last-child  { margin-bottom: 0; }
        .gh-md ul ul,.gh-md ul ol,.gh-md ol ul,.gh-md ol ol { margin-top:0;margin-bottom:0; }
        .gh-md li > p { margin-top: 16px; }
        .gh-md li > p:first-child { margin-top: 0; }
        .gh-md input[type="checkbox"] { width:1em; height:1em; margin-right:0.4em; vertical-align:middle; cursor:pointer; accent-color:#0969da; flex-shrink:0; margin-top:0.15em; }
      `}</style>

      {frontmatter && Object.keys(frontmatter).length > 0 && (
        <div className="mb-8 p-4 bg-zinc-50/50 border border-zinc-200 rounded-xl">
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Properties</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(frontmatter).map(([key, value]) => (
              <div key={key} className="flex flex-col gap-1">
                <span className="text-xs text-zinc-500 capitalize">{key.replace(/-/g, ' ')}</span>
                <FrontmatterValue propKey={key} value={value as string} onChange={val => updateFrontmatter(key, val)}/>
              </div>
            ))}
          </div>
        </div>
      )}

      {markdownContent.trim() ? (
        <div className="gh-md" ref={previewRef}>
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h1: ({children}) => <h1 style={s.h1}>{children}</h1>,
              h2: ({children}) => <h2 style={s.h2}>{children}</h2>,
              h3: ({children}) => <h3 style={s.h3}>{children}</h3>,
              h4: ({children}) => <h4 style={s.h4}>{children}</h4>,
              h5: ({children}) => <h5 style={s.h5}>{children}</h5>,
              h6: ({children}) => <h6 style={s.h6}>{children}</h6>,
              p:  ({children}) => <p  style={s.p }>{children}</p>,

              a: ({ href, children, title }) => {
                if (href?.startsWith('internal://'))
                  return <InternalLink name={decodeURIComponent(href.replace('internal://', ''))} tasks={tasks}/>;
                if (href?.startsWith('prop://')) {
                  const [k, ...rest] = href.replace('prop://', '').split('/');
                  return <InlineProperty propKey={decodeURIComponent(k)} propValue={decodeURIComponent(rest.join('/'))}/>;
                }
                return (
                  <a href={href} title={title} target="_blank" rel="noopener noreferrer" style={s.a}
                    onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                    onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}>
                    {children}
                  </a>
                );
              },

              strong: ({children}) => <strong style={{fontWeight: 600}}>{children}</strong>,
              em:     ({children}) => <em     style={{fontStyle: 'italic'}}>{children}</em>,
              del:    ({children}) => <del    style={s.del}>{children}</del>,

              // FIX #6 — react-markdown v9 removed the `inline` prop.
              // Block code always has a language-* className from the fenced fence;
              // inline code has no className. That's the only reliable discriminator.
              code: ({ className, children }) => (
                className
                  ? <code style={s.preCode} className={className}>{children}</code>
                  : <code style={s.inlineCode}>{children}</code>
              ),

              pre: ({children}) => <pre style={s.pre}>{children}</pre>,
              blockquote: ({children}) => <blockquote style={s.blockquote}>{children}</blockquote>,

              ul: ({children}) => <ul style={s.ul}>{children}</ul>,
              ol: ({children}) => <ol style={s.ol}>{children}</ol>,
              li: ({children, className}) => {
                const isTask = className?.includes('task-list-item');
                return isTask
                  ? <li style={{...s.li, listStyle:'none', marginLeft:'-1.5em', display:'flex', alignItems:'flex-start', gap:'0.5em'}}>{children}</li>
                  : <li style={s.li}>{children}</li>;
              },


              // Remove `disabled` that remarkGfm adds, wire onClick directly.
              // This is simpler and more reliable than event delegation on a disabled input.
              input: ({ checked, node }: any) => (
                <input
                  type="checkbox"
                  defaultChecked={!!checked}
                  onClick={(e) => {
                    e.preventDefault();
                    const container = previewRef.current;
                    if (!container) return;
                    const all = Array.from(container.querySelectorAll('input[type="checkbox"]'));
                    const idx = all.indexOf(e.currentTarget);
                    if (idx !== -1) toggleCheckbox(idx);
                  }}
                  style={{
                    width: '1em', height: '1em', marginRight: '0.4em',
                    verticalAlign: 'middle', cursor: 'pointer',
                    accentColor: '#0969da', flexShrink: 0, marginTop: '0.15em',
                  }}
                />
              ),

              // FIX #5 — overflow wrapper around the table, not on the table itself
              table: ({children}) => (
                <div style={s.tableWrap}>
                  <table style={s.table}>{children}</table>
                </div>
              ),
              thead: ({children}) => <thead>{children}</thead>,
              tbody: ({children}) => <tbody>{children}</tbody>,
              tr:    ({children}) => <tr style={{backgroundColor: GH.canvas, borderTop: `1px solid ${GH.border}`}}>{children}</tr>,
              th:    ({children, style}) => <th style={{...s.th, textAlign:(style?.textAlign as any) ?? 'left'}}>{children}</th>,
              td:    ({children, style}) => <td style={{...s.td, textAlign:(style?.textAlign as any) ?? 'left'}}>{children}</td>,

              hr:  () => <hr  style={s.hr}/>,
              img: ({src, alt, title}) => <img src={src} alt={alt} title={title} style={s.img}/>,
            }}
          >
            {processedMarkdown}
          </ReactMarkdown>
        </div>
      ) : (
        <div style={{display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'80px 0', color: GH.fgMuted}}>
          <div style={{width:'48px', height:'48px', borderRadius:'12px', backgroundColor:GH.canvasSub, border:`1px solid ${GH.border}`, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:'16px'}}>
            <span style={{fontSize:'24px', fontFamily:'Georgia,serif', color:GH.fgMuted}}>M</span>
          </div>
          <p style={{fontSize:'14px', color:GH.fgMuted, margin:'0 0 4px'}}>Nothing written yet.</p>
          <p style={{fontSize:'12px', color:GH.fgMuted, margin:'0', opacity:0.7}}>Click <strong>Edit</strong> to start writing in Markdown.</p>
        </div>
      )}
    </div>
  );
}