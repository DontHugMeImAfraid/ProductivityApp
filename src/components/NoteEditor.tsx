import React, { useState, useCallback, useRef, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import yaml from 'yaml';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store';
import { Check, ChevronDown, Calendar as CalendarIcon } from 'lucide-react';

// ── CodeMirror imports ───────────────────────────────────────────────────────
import CodeMirror from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { EditorView } from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';

// ── Editor theme ─────────────────────────────────────────────────────────────
// Dark Obsidian-style: no gutter, no active-line, generous serif padding

const editorTheme = EditorView.theme({
  // Container
  '&': {
    backgroundColor: '#282b36',
    color: '#e0e2e8',
    fontFamily: "'Georgia', 'Cambria', 'Times New Roman', serif",
    fontSize: '16px',
    lineHeight: '1.8',
    height: '100%',
  },
  // Scrollable inner area
  '.cm-scroller': {
    padding: '32px 40px',
    overflowX: 'hidden',
    fontFamily: 'inherit',
  },
  // The actual editable content
  '.cm-content': {
    caretColor: '#ffffff',
    maxWidth: '680px',
    margin: '0 auto',
    padding: '0',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    fontFamily: 'inherit',
  },
  // Cursor
  '&.cm-focused .cm-cursor': {
    borderLeftColor: '#ffffff',
    borderLeftWidth: '2px',
  },
  // Text selection
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
    backgroundColor: 'rgba(255, 255, 255, 0.12) !important',
  },
  // Hide gutter completely (line numbers, fold markers)
  '.cm-gutters': {
    display: 'none',
  },
  // No active-line highlight
  '.cm-activeLine': {
    backgroundColor: 'transparent',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'transparent',
  },
  // Focused outline
  '&.cm-focused': {
    outline: 'none',
  },
  // Placeholder text
  '.cm-placeholder': {
    color: '#4a4f60',
    fontStyle: 'italic',
  },
  // Wrap long lines
  '.cm-line': {
    padding: '0',
  },
}, { dark: true });

// ── Syntax highlighting ───────────────────────────────────────────────────────

const markdownHighlighting = HighlightStyle.define([
  // Heading markers + text — muted red, bold
  {
    tag: t.heading1,
    color: '#cd6b6b',
    fontWeight: 'bold',
    fontSize: '1.6em',
    lineHeight: '1.4',
  },
  {
    tag: t.heading2,
    color: '#cd6b6b',
    fontWeight: 'bold',
    fontSize: '1.35em',
  },
  {
    tag: t.heading3,
    color: '#cd6b6b',
    fontWeight: 'bold',
    fontSize: '1.15em',
  },
  {
    tag: [t.heading4, t.heading5, t.heading6],
    color: '#cd6b6b',
    fontWeight: 'bold',
  },
  // Bold — gold
  {
    tag: t.strong,
    color: '#d2a868',
    fontWeight: 'bold',
  },
  // Italic — gold italic
  {
    tag: t.emphasis,
    color: '#d2a868',
    fontStyle: 'italic',
  },
  // Links and URLs — cyan
  {
    tag: t.link,
    color: '#8be9fd',
    textDecoration: 'underline',
  },
  {
    tag: t.url,
    color: '#8be9fd',
  },
  // Inline code — slightly brighter, monospace feel
  {
    tag: t.monospace,
    color: '#a9dc76',
    fontFamily: "'Fira Code', 'Cascadia Code', 'Consolas', monospace",
    fontSize: '0.9em',
    backgroundColor: 'rgba(169, 220, 118, 0.08)',
    borderRadius: '3px',
    padding: '0 3px',
  },
  // Code block content
  {
    tag: t.string,
    color: '#a9dc76',
  },
  // List markers (-, *, 1.)
  {
    tag: t.list,
    color: '#e0e2e8',
  },
  // Blockquote markers (>)
  {
    tag: t.quote,
    color: '#7a7f94',
    fontStyle: 'italic',
  },
  // HTML tags in markdown
  {
    tag: t.angleBracket,
    color: '#fc9867',
  },
  // Strikethrough
  {
    tag: t.strikethrough,
    color: '#7a7f94',
    textDecoration: 'line-through',
  },
  // Markdown punctuation (* ** ` # etc) — slightly dimmed
  {
    tag: t.processingInstruction,
    color: '#4a4f60',
  },
  // HR, separators
  {
    tag: t.contentSeparator,
    color: '#4a4f60',
  },
]);

const editorExtensions = [
  markdown({ base: markdownLanguage }),
  editorTheme,
  syntaxHighlighting(markdownHighlighting),
  EditorView.lineWrapping,
];

const editorSetup = {
  lineNumbers:         false,
  foldGutter:          false,
  highlightActiveLine: false,
  highlightActiveLineGutter: false,
  dropCursor:          true,
  allowMultipleSelections: true,
  indentOnInput:       true,
  bracketMatching:     true,
  closeBrackets:       true,
  autocompletion:      false,
  rectangularSelection:false,
  crosshairCursor:     false,
  history:             true,
  drawSelection:       true,
  syntaxHighlighting:  false, // we supply our own
};

// ── Frontmatter helpers ───────────────────────────────────────────────────────

function FrontmatterValue({ propKey, value, onChange }: {
  propKey: string; value: string; onChange: (v: string) => void;
}) {
  const lk = propKey.toLowerCase();
  if (lk === 'priority') {
    const opts = ['low','medium','high','urgent'];
    const colors: Record<string,string> = {
      low:'bg-zinc-100 text-zinc-600', medium:'bg-amber-100 text-amber-700',
      high:'bg-orange-100 text-orange-700', urgent:'bg-red-100 text-red-700',
    };
    return (
      <div className="flex gap-1 flex-wrap">
        {opts.map(o=>(
          <button key={o} onClick={()=>onChange(o)}
            className={cn('px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize transition-all border',
              value===o?colors[o]+' border-transparent':'bg-white border-zinc-200 text-zinc-400 hover:border-zinc-300')}>
            {o}
          </button>
        ))}
      </div>
    );
  }
  if (lk==='status') {
    const opts=['todo','in-progress','done'];
    return (
      <div className="relative">
        <select value={value} onChange={e=>onChange(e.target.value)}
          className="w-full text-xs border border-zinc-200 rounded-lg px-2.5 py-1.5 bg-white text-zinc-700 focus:outline-none focus:ring-2 focus:ring-violet-300 appearance-none pr-7">
          {opts.map(o=><option key={o} value={o}>{o}</option>)}
        </select>
        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-400 pointer-events-none"/>
      </div>
    );
  }
  if (lk==='date'||lk==='due'||lk==='deadline') {
    return (
      <div className="relative">
        <CalendarIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-violet-400 pointer-events-none"/>
        <input type="date" value={value} onChange={e=>onChange(e.target.value)}
          className="w-full pl-8 pr-2.5 py-1.5 text-xs border border-zinc-200 rounded-lg bg-white text-zinc-700 focus:outline-none focus:ring-2 focus:ring-violet-300"/>
      </div>
    );
  }
  return (
    <input value={value} onChange={e=>onChange(e.target.value)}
      className="text-xs border border-zinc-200 rounded-lg px-2.5 py-1.5 bg-white text-zinc-700 focus:outline-none focus:ring-2 focus:ring-violet-300 w-full"/>
  );
}

function InternalLink({ name, tasks }: { name: string; tasks: any[] }) {
  const task = tasks.find(t=>t.title.toLowerCase()===name.toLowerCase());
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded-md text-[0.85em] font-medium border border-indigo-200 cursor-pointer hover:bg-indigo-100 transition-colors"
      title={task?`Task: ${task.status}`:'Internal link'}>
      [[{name}]]
      {task&&<Check className="w-3 h-3 text-indigo-500"/>}
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

  const updateFrontmatter = (key: string, value: string) => {
    if (!frontmatter) return;
    const updated = yaml.stringify({ ...frontmatter, [key]: value }).trim();
    onChange(content.replace(/^---\n[\s\S]*?\n---/, `---\n${updated}\n---`));
  };

  const toggleCheckbox = (index: number) => {
    // Walk task-list markers in source order, toggle only the one at `index`
    let i = 0;
    onChange(content.replace(/^([ \t]*[-*+]\s+)\[([xX ])\]/gm, (m, prefix, check) => {
      const toggled = i === index
        ? `${prefix}[${check.trim() === '' ? 'x' : ' '}]`
        : m;
      i++;
      return toggled;
    }));
  };

  // Pre-compute checkbox indices from raw markdown BEFORE render.
  // Each entry is { index, checked } in document order.
  // This is the only reliable approach — mutable ref counters break in React
  // StrictMode (double-invoke) and async rendering.
  const checkboxItems = useMemo(() => {
    const items: { index: number; checked: boolean }[] = [];
    let i = 0;
    // Walk the content the same way toggleCheckbox does
    content.replace(/^[ \t]*[-*+]\s+\[([xX ])\]/gm, (_, check) => {
      items.push({ index: i++, checked: check.trim() !== '' });
      return _;
    });
    return items;
  }, [content]);

  // Stable index for each rendered <input> — consumed in document order
  const checkboxCursor = useRef(0);

  // Stable onChange handler — avoids creating a new function on every keystroke
  const handleCodeMirrorChange = useCallback((val: string) => {
    onChange(val);
  }, [onChange]);

  // ── EDIT MODE — CodeMirror 6 ─────────────────────────────────────────────

  if (isEditing) {
    return (
      <div className="w-full h-full min-h-[500px] rounded-xl overflow-hidden">
        {/* Subtle toolbar hint */}
        <div className="flex items-center gap-3 px-4 py-2 bg-[#1e2130] border-b border-white/5">
          <div className="flex gap-2">
            {[
              { label:'H1', insert:'# ',    title:'Heading 1' },
              { label:'B',  insert:'****',  title:'Bold'       },
              { label:'I',  insert:'**',    title:'Italic'     },
              { label:'`',  insert:'``',    title:'Code'       },
              { label:'—',  insert:'\n---\n',title:'Divider'  },
            ].map(btn => (
              <button
                key={btn.label}
                title={btn.title}
                onMouseDown={e => {
                  // Use mousedown to avoid blurring the editor
                  e.preventDefault();
                }}
                className="px-2 py-0.5 text-[11px] font-semibold text-[#7a7f94] hover:text-[#e0e2e8] hover:bg-white/8 rounded transition-colors select-none font-mono"
              >
                {btn.label}
              </button>
            ))}
          </div>
          <span className="ml-auto text-[10px] text-[#4a4f60] font-mono select-none">
            markdown · codemirror 6
          </span>
        </div>

        {/* CodeMirror editor */}
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

  // ── PREVIEW MODE — GitHub-style rendering ───────────────────────────────

  const processedMarkdown = markdownContent
    .replace(/\[\[(.*?)\]\]/g, '[$1](internal://$1)')
    .replace(/\[([a-zA-Z0-9_-]+)::(.*?)\]/g, '[$1::$2](prop://$1/$2)');

  // Shared GitHub colour tokens
  const GH = {
    fg:       '#1f2328',   // --color-fg-default
    fgMuted:  '#636c76',   // --color-fg-muted
    border:   '#d1d9e0',   // --color-border-default
    borderSub:'#d8dee4',
    canvas:   '#ffffff',
    canvasSub:'#f6f8fa',   // code bg, table header bg
    accent:   '#0969da',   // link blue
    accentFg: '#0550ae',
    codeFg:   '#e6edf3',   // code block text (dark bg)
    codeBg:   '#1f2328',   // code block background (dark)
  };

  // Inline style helpers — avoids Tailwind purging unused classes at runtime
  const s = {
    // Typography — constrained width, generous line-height
    body: { color: GH.fg, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif", fontSize: '16px', lineHeight: '1.7', wordWrap: 'break-word' as const },
    h1: { paddingBottom: '0.4em', fontSize: '2em', borderBottom: `1px solid ${GH.border}`, fontWeight: 600, lineHeight: 1.25, marginTop: '24px', marginBottom: '16px' },
    h2: { paddingBottom: '0.4em', fontSize: '1.5em', borderBottom: `1px solid ${GH.border}`, fontWeight: 600, lineHeight: 1.25, marginTop: '24px', marginBottom: '16px' },
    // H3 gets a distinct slate-blue colour so it reads clearly above bold body text
    h3: { fontSize: '1.25em', fontWeight: 600, lineHeight: 1.25, marginTop: '24px', marginBottom: '16px', color: '#1e3a5f' },
    h4: { fontSize: '1em',    fontWeight: 600, lineHeight: 1.25, marginTop: '24px', marginBottom: '16px' },
    h5: { fontSize: '0.875em',fontWeight: 600, lineHeight: 1.25, marginTop: '24px', marginBottom: '16px' },
    h6: { fontSize: '0.85em', fontWeight: 600, lineHeight: 1.25, marginTop: '24px', marginBottom: '16px', color: GH.fgMuted },
    p: { marginTop: '0', marginBottom: '16px', lineHeight: '1.7' },
    a: { color: GH.accent, textDecoration: 'none' },
    // Lists — generous li spacing for scannability
    ul: { paddingLeft: '2em', marginTop: '0', marginBottom: '16px', listStyleType: 'disc' },
    ol: { paddingLeft: '2em', marginTop: '0', marginBottom: '16px', listStyleType: 'decimal' },
    li: { marginTop: '0', marginBottom: '10px', lineHeight: '1.7' },
    // Code
    inlineCode: { padding: '0.2em 0.4em', margin: '0', fontSize: '85%', whiteSpace: 'break-spaces' as const, backgroundColor: GH.canvasSub, borderRadius: '6px', fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace", border: `1px solid ${GH.border}` },
    pre: { padding: '16px', overflow: 'auto' as const, fontSize: '85%', lineHeight: '1.45', backgroundColor: GH.codeBg, borderRadius: '6px', marginTop: '0', marginBottom: '16px', wordBreak: 'normal' as const },
    preCode: { display: 'inline', padding: '0', margin: '0', overflow: 'visible', fontSize: '100%', lineHeight: 'inherit', wordWrap: 'normal' as const, backgroundColor: 'transparent', border: '0', color: GH.codeFg, fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace" },
    // Blockquote
    blockquote: { padding: '0 1em', color: GH.fgMuted, borderLeft: `4px solid ${GH.borderSub}`, margin: '0 0 16px 0' },
    // Tables — increased padding, stronger header contrast, collapsed borders
    table: { borderSpacing: '0', borderCollapse: 'collapse' as const, display: 'block', width: 'max-content', maxWidth: '100%', overflow: 'auto', marginTop: '0', marginBottom: '16px' },
    th: { padding: '12px 16px', border: `1px solid ${GH.border}`, fontWeight: 700, backgroundColor: '#f3f4f6', color: GH.fg },
    td: { padding: '12px 16px', border: `1px solid ${GH.border}` },
    // HR
    hr: { height: '4px', padding: '0', margin: '24px 0', backgroundColor: GH.border, border: '0' },
    // Images
    img: { maxWidth: '100%', boxSizing: 'border-box' as const, borderStyle: 'none', borderRadius: '6px' },
    // Strikethrough
    del: { color: GH.fgMuted },
  };

  return (
    <div className="max-w-[800px] mx-auto w-full pb-32" style={s.body}>
      {/* Scoped GitHub table zebra-stripe — can't do nth-child in inline styles */}
      <style>{`
        .gh-md table tr:nth-child(2n) { background-color: #f6f8fa; }
        .gh-md table tr:nth-child(2n) td { background-color: #f6f8fa; }
        .gh-md a:hover { text-decoration: underline; }
        .gh-md pre code { white-space: pre; }
        .gh-md blockquote > :first-child { margin-top: 0; }
        .gh-md blockquote > :last-child  { margin-bottom: 0; }
        .gh-md ul ul, .gh-md ul ol, .gh-md ol ul, .gh-md ol ol { margin-top: 0; margin-bottom: 0; }
        .gh-md li + li { margin-top: 0.25em; }
        .gh-md li > p { margin-top: 16px; }
        .gh-md li > p:first-child { margin-top: 0; }
      `}</style>
      {/* Frontmatter properties grid */}
      {frontmatter && Object.keys(frontmatter).length > 0 && (
        <div className="mb-8 p-4 bg-zinc-50/50 border border-zinc-200 rounded-xl">
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Properties</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(frontmatter).map(([key, value]) => (
              <div key={key} className="flex flex-col gap-1">
                <span className="text-xs text-zinc-500 capitalize">{key.replace(/-/g,' ')}</span>
                <FrontmatterValue propKey={key} value={value as string} onChange={val => updateFrontmatter(key, val)} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rendered markdown — full GitHub spec */}
      {markdownContent.trim() ? (() => {
        // Reset cursor before each render pass
        checkboxCursor.current = 0;
        return (
        <div className="gh-md">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            // ── Headings ──────────────────────────────────────────────────
            h1: ({children}) => <h1 style={s.h1}>{children}</h1>,
            h2: ({children}) => <h2 style={s.h2}>{children}</h2>,
            h3: ({children}) => <h3 style={s.h3}>{children}</h3>,
            h4: ({children}) => <h4 style={s.h4}>{children}</h4>,
            h5: ({children}) => <h5 style={s.h5}>{children}</h5>,
            h6: ({children}) => <h6 style={s.h6}>{children}</h6>,

            // ── Paragraph ─────────────────────────────────────────────────
            p: ({children}) => <p style={s.p}>{children}</p>,

            // ── Links ─────────────────────────────────────────────────────
            a: ({ href, children, title }) => {
              if (href?.startsWith('internal://')) {
                const linkName = decodeURIComponent(href.replace('internal://',''));
                return <InternalLink name={linkName} tasks={tasks} />;
              }
              if (href?.startsWith('prop://')) {
                const parts = href.replace('prop://','').split('/');
                return <InlineProperty propKey={decodeURIComponent(parts[0])} propValue={decodeURIComponent(parts.slice(1).join('/'))} />;
              }
              return (
                <a href={href} title={title} target="_blank" rel="noopener noreferrer"
                  style={s.a}
                  onMouseEnter={e => (e.currentTarget.style.textDecoration='underline')}
                  onMouseLeave={e => (e.currentTarget.style.textDecoration='none')}>
                  {children}
                </a>
              );
            },

            // ── Emphasis ──────────────────────────────────────────────────
            strong: ({children}) => <strong style={{fontWeight: 600}}>{children}</strong>,
            em:     ({children}) => <em style={{fontStyle:'italic'}}>{children}</em>,
            del:    ({children}) => <del style={s.del}>{children}</del>,

            // ── Inline code ───────────────────────────────────────────────
            code: ({node, className, children, ...props}) => {
              const isBlock = !!(props as any).inline === false;
              // react-markdown passes inline=false for fenced blocks handled by <pre>
              // When inside <pre>, className will have language-*
              if (className || (props as any).inline === false) {
                // block code — rendered by <pre> below, just pass through
                return <code style={s.preCode} className={className}>{children}</code>;
              }
              return <code style={s.inlineCode}>{children}</code>;
            },

            // ── Code blocks ───────────────────────────────────────────────
            pre: ({children}) => (
              <pre style={s.pre}>{children}</pre>
            ),

            // ── Blockquote ────────────────────────────────────────────────
            blockquote: ({children}) => (
              <blockquote style={s.blockquote}>{children}</blockquote>
            ),

            // ── Lists ─────────────────────────────────────────────────────
            ul: ({children}) => <ul style={s.ul}>{children}</ul>,
            ol: ({children}) => <ol style={s.ol}>{children}</ol>,
            li: ({children, className}) => {
              const isTask = className?.includes('task-list-item');
              if (isTask) {
                return (
                  <li style={{...s.li, listStyle:'none', marginLeft:'-1.5em', display:'flex', alignItems:'flex-start', gap:'0.5em'}}>
                    {children}
                  </li>
                );
              }
              return <li style={s.li}>{children}</li>;
            },

            // ── Checkbox inputs ───────────────────────────────────────────
            // Read checked state and index from checkboxItems (pre-computed from
            // raw markdown). checkboxCursor tracks position in document order.
            // This survives StrictMode double-renders because checkboxItems is
            // derived from content via useMemo — stable, not mutated during render.
            input: () => {
              const cursor = checkboxCursor.current++;
              const item = checkboxItems[cursor];
              console.log(checkboxItems.length)
              if (!item){
                return null;}
              return (
                <input
                  type="checkbox"
                  checked={item.checked}
                  onChange={() => toggleCheckbox(item.index)}
                  style={{
                    marginRight: '0.4em', verticalAlign: 'middle', cursor: 'pointer',
                    accentColor: '#0969da', width: '1em', height: '1em',
                    flexShrink: 0, marginTop: '0.2em',
                  }}
                />
              );
            },

            // ── Table ─────────────────────────────────────────────────────
            table:   ({children}) => <table style={s.table}>{children}</table>,
            thead:   ({children}) => <thead>{children}</thead>,
            tbody:   ({children}) => <tbody>{children}</tbody>,
            tr:      ({children, ...props}) => {
              // Zebra stripe via inline style is tricky; use CSS var via nth-child in wrapper
              return <tr style={{backgroundColor: GH.canvas, borderTop:`1px solid ${GH.border}`}}>{children}</tr>;
            },
            th:      ({children, style}) => <th style={{...s.th, textAlign: (style?.textAlign as any) ?? 'left'}}>{children}</th>,
            td:      ({children, style}) => <td style={{...s.td, textAlign: (style?.textAlign as any) ?? 'left'}}>{children}</td>,

            // ── Horizontal rule ───────────────────────────────────────────
            hr: () => <hr style={s.hr} />,

            // ── Images ────────────────────────────────────────────────────
            img: ({src, alt, title}) => (
              <img src={src} alt={alt} title={title} style={s.img} />
            ),
          }}
        >
          {processedMarkdown}
        </ReactMarkdown>
        </div>
        );
      })() : (
        <div style={{display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'80px 0', color: GH.fgMuted}}>
          <div style={{width:'48px', height:'48px', borderRadius:'12px', backgroundColor: GH.canvasSub, border:`1px solid ${GH.border}`, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:'16px'}}>
            <span style={{fontSize:'24px', fontFamily:'Georgia, serif', color: GH.fgMuted}}>M</span>
          </div>
          <p style={{fontSize:'14px', color: GH.fgMuted, margin:'0 0 4px'}}>Nothing written yet.</p>
          <p style={{fontSize:'12px', color: GH.fgMuted, margin:'0', opacity:0.7}}>Click <strong>Edit</strong> to start writing in Markdown.</p>
        </div>
      )}
    </div>
  );
}