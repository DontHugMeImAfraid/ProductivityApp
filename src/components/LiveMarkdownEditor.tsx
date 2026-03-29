/**
 * LiveMarkdownEditor — Inline WYSIWYG markdown with always-visible syntax
 *
 * Architecture: CodeMirror 6 + custom ViewPlugin decorations
 * - Zero overlay/textarea hacks — cursor stability is native CM6
 * - Incremental re-decoration via ViewPlugin.fromClass (only changed viewport)
 * - Syntax tokens stay visible and editable; formatting is CSS-only (no DOM mutation)
 * - Gracefully handles incomplete/invalid markdown at all times
 *
 * Drop-in replacement for the existing LiveMarkdownEditor component.
 * Props: { content: string; onChange: (val: string) => void }
 *
 * Peer deps (already in your project):
 *   @uiw/react-codemirror, @codemirror/view, @codemirror/state,
 *   @codemirror/language, @codemirror/lang-markdown, @lezer/highlight
 */

import React, { useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { EditorView, ViewPlugin, ViewUpdate, Decoration, DecorationSet, WidgetType } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { syntaxTree } from '@codemirror/language';
import { languages } from '@codemirror/language-data';


// ─────────────────────────────────────────────────────────────────────────────
// CSS injected once into <head> — all formatting is pure CSS class application.
// Uses var(--nxs-*) tokens with fallbacks so it works standalone too.
// ─────────────────────────────────────────────────────────────────────────────
const STYLE_ID = 'lme-inline-md-styles';

function injectStyles() {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const el = document.createElement('style');
  el.id = STYLE_ID;
  el.textContent = `
    /* ── Heading levels ─────────────────────────────────────────────────── */
    .cm-line.lme-h1 { font-size: 1.75em; font-weight: 700; line-height: 1.3; color: var(--nxs-text-primary, #cd6b6b); }
    .cm-line.lme-h2 { font-size: 1.45em; font-weight: 700; line-height: 1.35; color: var(--nxs-text-primary, #cd6b6b); }
    .cm-line.lme-h3 { font-size: 1.2em;  font-weight: 700; line-height: 1.4;  color: var(--nxs-text-primary, #cd6b6b); }
    .cm-line.lme-h4 { font-size: 1.05em; font-weight: 700; color: var(--nxs-text-primary, #cd6b6b); }
    .cm-line.lme-h5 { font-size: 0.95em; font-weight: 700; color: var(--nxs-text-primary, #cd6b6b); }
    .cm-line.lme-h6 { font-size: 0.9em;  font-weight: 700; color: var(--nxs-text-primary, #cd6b6b); opacity: 0.75; }

    /* ── Heading # sigils — dimmed but visible ──────────────────────────── */
    .lme-heading-mark { opacity: 0.38; font-weight: 400; font-size: 0.75em; letter-spacing: 0.05em; }

    /* ── Bold / italic / strikethrough ──────────────────────────────────── */
    .lme-bold         { font-weight: 700; color: var(--nxs-accent, #d2a868); }
    .lme-italic       { font-style: italic; color: var(--nxs-accent, #d2a868); }
    .lme-bold-italic  { font-weight: 700; font-style: italic; color: var(--nxs-accent, #d2a868); }
    .lme-strike       { text-decoration: line-through; opacity: 0.55; }

    /* ── Syntax tokens (**, *, ~~, _) — always visible, just dimmed ─────── */
    .lme-syn          { opacity: 0.35; font-weight: 400; font-size: 0.82em; }
    .lme-syn-bold     { opacity: 0.4;  font-weight: 700; }

    /* ── Inline code ─────────────────────────────────────────────────────── */
    .lme-code-tick    { opacity: 0.35; font-family: inherit; }
    .lme-code         {
      font-family: 'Fira Code', 'Cascadia Code', 'Consolas', monospace;
      font-size: 0.88em;
      background: rgba(169, 220, 118, 0.09);
      color: #a9dc76;
      border-radius: 3px;
      padding: 0 2px;
    }

    /* ── Blockquote line ─────────────────────────────────────────────────── */
    .cm-line.lme-blockquote {
      border-left: 3px solid var(--nxs-accent, #d2a868);
      padding-left: 12px;
      margin-left: -15px;
      color: #8a8fa4;
      font-style: italic;
    }
    .lme-blockquote-mark { opacity: 0.4; font-style: normal; }

    /* ── HR widget ───────────────────────────────────────────────────────── */
    .lme-hr-widget {
      display: block;
      height: 0;
      border: none;
      border-top: 2px solid rgba(255,255,255,0.12);
      margin: 2px 0;
      width: 100%;
    }

    /* ── List bullet / number token ─────────────────────────────────────── */
    .lme-list-mark    { color: var(--nxs-accent, #d2a868); opacity: 0.65; }

    /* ── Link parts ──────────────────────────────────────────────────────── */
    .lme-link-text    { color: #8be9fd; text-decoration: underline; text-decoration-color: rgba(139,233,253,0.45); }
    .lme-link-syntax  { opacity: 0.35; font-size: 0.82em; }
    .lme-link-url     { color: #8be9fd; opacity: 0.5; font-size: 0.82em; }

    /* ── Fenced code block ───────────────────────────────────────────────── */
    .cm-line.lme-fence-line {
      font-family: 'Fira Code', 'Cascadia Code', 'Consolas', monospace;
      font-size: 0.88em;
      background: rgba(255,255,255,0.03);
      color: #a9dc76;
    }
    .lme-fence-mark   { opacity: 0.35; font-family: inherit; }
  `;
  document.head.appendChild(el);
}

// ─────────────────────────────────────────────────────────────────────────────
// HR widget — renders a <hr> element in place of `---`/`***`/`___` lines
// ─────────────────────────────────────────────────────────────────────────────
class HrWidget extends WidgetType {
  toDOM() {
    const hr = document.createElement('hr');
    hr.className = 'lme-hr-widget';
    return hr;
  }
  ignoreEvent() { return false; }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper — wrap a range in a Decoration.mark
// ─────────────────────────────────────────────────────────────────────────────
function mark(cls: string) {
  return Decoration.mark({ class: cls });
}

// ─────────────────────────────────────────────────────────────────────────────
// Core decoration builder — iterates visible lines and applies marks
// ─────────────────────────────────────────────────────────────────────────────
function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const doc = view.state.doc;

  // We walk every visible line (plus a small buffer for smooth scrolling)
  for (const { from, to } of view.visibleRanges) {
    let pos = from;
    while (pos <= to) {
      const line = doc.lineAt(pos);
      const text = line.text;

      // ── Horizontal rule: ---, ***, ___ (standalone line) ─────────────────
      if (/^[-*_]{3,}\s*$/.test(text) && text.replace(/\s/g,'').split('').every(c => c === text.replace(/\s/g,'')[0])) {
        // Add a widget after the line content
        builder.add(line.from, line.to, Decoration.replace({ widget: new HrWidget() }));
        pos = line.to + 1;
        continue;
      }

      // ── ATX Headings: # ... ###### ───────────────────────────────────────
      const headingMatch = text.match(/^(#{1,6})(\s+)(.*)/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        const lvlClass = `lme-h${level}` as string;
        // Decorate the whole line
        builder.add(line.from, line.from, Decoration.line({ class: lvlClass }));
        // Dim the # characters
        const markEnd = line.from + headingMatch[1].length;
        builder.add(line.from, markEnd, mark('lme-heading-mark'));
        // Recurse inline formatting on heading body
        const bodyStart = markEnd + headingMatch[2].length;
        applyInline(text.slice(markEnd + headingMatch[2].length), bodyStart, builder);
        pos = line.to + 1;
        continue;
      }

      // ── Blockquote: > ────────────────────────────────────────────────────
      const bqMatch = text.match(/^(>\s*)/);
      if (bqMatch) {
        builder.add(line.from, line.from, Decoration.line({ class: 'lme-blockquote' }));
        builder.add(line.from, line.from + bqMatch[1].length, mark('lme-blockquote-mark'));
        applyInline(text.slice(bqMatch[1].length), line.from + bqMatch[1].length, builder);
        pos = line.to + 1;
        continue;
      }

      // ── Fenced code blocks: ``` ──────────────────────────────────────────
      if (/^(`{3,}|~{3,})/.test(text)) {
        builder.add(line.from, line.from, Decoration.line({ class: 'lme-fence-line' }));
        builder.add(line.from, line.to, mark('lme-fence-mark'));
        pos = line.to + 1;
        continue;
      }

      // ── List items: -, *, +, 1. ──────────────────────────────────────────
      const listMatch = text.match(/^(\s*)([-*+]|\d+\.)(\s+)(.*)/);
      if (listMatch) {
        const bulletStart = line.from + listMatch[1].length;
        const bulletEnd   = bulletStart + listMatch[2].length;
        builder.add(bulletStart, bulletEnd, mark('lme-list-mark'));
        const bodyStart = bulletEnd + listMatch[3].length;
        applyInline(listMatch[4], bodyStart, builder);
        pos = line.to + 1;
        continue;
      }

      // ── Normal paragraph lines — apply inline formatting ─────────────────
      if (text.trim()) {
        applyInline(text, line.from, builder);
      }

      pos = line.to + 1;
    }
  }

  return builder.finish();
}

// ─────────────────────────────────────────────────────────────────────────────
// Inline formatter — scans a text segment for bold, italic, code, links, strike
// Adds to an existing RangeSetBuilder (ranges MUST be added in order)
// ─────────────────────────────────────────────────────────────────────────────
function applyInline(text: string, offset: number, builder: RangeSetBuilder<Decoration>) {
  // Collect all matches first, then apply sorted by position
  type IM = { start: number; end: number; decorations: Array<{ from: number; to: number; cls: string }> };
  const matches: IM[] = [];

  let i = 0;
  while (i < text.length) {

    // Inline code: `...`
    if (text[i] === '`') {
      const close = text.indexOf('`', i + 1);
      if (close !== -1) {
        const abs = offset + i;
        matches.push({
          start: i, end: close + 1,
          decorations: [
            { from: abs,         to: abs + 1,         cls: 'lme-code-tick' },
            { from: abs + 1,     to: abs + close - i, cls: 'lme-code'      },
            { from: abs + close - i, to: abs + close - i + 1, cls: 'lme-code-tick' },
          ]
        });
        i = close + 1;
        continue;
      }
    }

    // Bold+Italic: ***...***  or  ___...__
    if ((text[i] === '*' && text[i+1] === '*' && text[i+2] === '*') ||
        (text[i] === '_' && text[i+1] === '_' && text[i+2] === '_')) {
      const tok = text.slice(i, i+3);
      const close = text.indexOf(tok, i + 3);
      if (close !== -1) {
        const abs = offset + i;
        matches.push({
          start: i, end: close + 3,
          decorations: [
            { from: abs,         to: abs + 3,              cls: 'lme-syn lme-syn-bold' },
            { from: abs + 3,     to: offset + close,       cls: 'lme-bold-italic'      },
            { from: offset + close, to: offset + close + 3, cls: 'lme-syn lme-syn-bold' },
          ]
        });
        i = close + 3;
        continue;
      }
    }

    // Bold: **...** or __...__
    if ((text[i] === '*' && text[i+1] === '*' && text[i+2] !== '*') ||
        (text[i] === '_' && text[i+1] === '_' && text[i+2] !== '_')) {
      const tok = text.slice(i, i+2);
      const close = text.indexOf(tok, i + 2);
      if (close !== -1 && text[close+2] !== tok[0]) {
        const abs = offset + i;
        matches.push({
          start: i, end: close + 2,
          decorations: [
            { from: abs,             to: abs + 2,              cls: 'lme-syn lme-syn-bold' },
            { from: abs + 2,         to: offset + close,       cls: 'lme-bold'             },
            { from: offset + close,  to: offset + close + 2,   cls: 'lme-syn lme-syn-bold' },
          ]
        });
        i = close + 2;
        continue;
      }
    }

    // Italic: *...* or _..._  (not preceded/followed by same char)
    if ((text[i] === '*' && text[i+1] !== '*') ||
        (text[i] === '_' && text[i+1] !== '_')) {
      const tok = text[i];
      // Search for closing token that's not a double
      let j = i + 1;
      while (j < text.length) {
        if (text[j] === tok && text[j+1] !== tok && text[j-1] !== tok) break;
        j++;
      }
      if (j < text.length && j > i + 1) {
        const abs = offset + i;
        matches.push({
          start: i, end: j + 1,
          decorations: [
            { from: abs,     to: abs + 1,         cls: 'lme-syn' },
            { from: abs + 1, to: offset + j,      cls: 'lme-italic' },
            { from: offset + j, to: offset + j + 1, cls: 'lme-syn' },
          ]
        });
        i = j + 1;
        continue;
      }
    }

    // Strikethrough: ~~...~~
    if (text[i] === '~' && text[i+1] === '~') {
      const close = text.indexOf('~~', i + 2);
      if (close !== -1) {
        const abs = offset + i;
        matches.push({
          start: i, end: close + 2,
          decorations: [
            { from: abs,             to: abs + 2,              cls: 'lme-syn' },
            { from: abs + 2,         to: offset + close,       cls: 'lme-strike' },
            { from: offset + close,  to: offset + close + 2,   cls: 'lme-syn' },
          ]
        });
        i = close + 2;
        continue;
      }
    }

    // Links: [text](url)
    if (text[i] === '[') {
      const closeBracket = text.indexOf(']', i + 1);
      if (closeBracket !== -1 && text[closeBracket + 1] === '(') {
        const closeParen = text.indexOf(')', closeBracket + 2);
        if (closeParen !== -1) {
          const abs = offset + i;
          const textEnd = offset + closeBracket;
          const urlStart = offset + closeBracket + 2;
          const urlEnd   = offset + closeParen;
          matches.push({
            start: i, end: closeParen + 1,
            decorations: [
              { from: abs,       to: abs + 1,    cls: 'lme-link-syntax' }, // [
              { from: abs + 1,   to: textEnd,    cls: 'lme-link-text'   }, // link text
              { from: textEnd,   to: urlStart,   cls: 'lme-link-syntax' }, // ](
              { from: urlStart,  to: urlEnd,     cls: 'lme-link-url'    }, // url
              { from: urlEnd,    to: urlEnd + 1, cls: 'lme-link-syntax' }, // )
            ]
          });
          i = closeParen + 1;
          continue;
        }
      }
    }

    i++;
  }

  // Sort by start position and apply — builder requires ascending order
  matches.sort((a, b) => a.start - b.start);

  // Remove overlaps (keep earlier match)
  const valid: IM[] = [];
  let lastEnd = -1;
  for (const m of matches) {
    if (m.start >= lastEnd) {
      valid.push(m);
      lastEnd = m.end;
    }
  }

  // Apply to builder — decorations within each match are already sorted
  for (const m of valid) {
    for (const d of m.decorations) {
      if (d.from < d.to) {
        try { builder.add(d.from, d.to, mark(d.cls)); } catch { /* range order edge case */ }
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ViewPlugin — incrementally rebuilds decorations on every doc/viewport change
// ─────────────────────────────────────────────────────────────────────────────
const markdownDecorationPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      injectStyles();
      this.decorations = buildDecorations(view);
    }

    update(update: ViewUpdate) {
      // Rebuild when document changes OR visible range scrolls
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  { decorations: (v) => v.decorations }
);

// ─────────────────────────────────────────────────────────────────────────────
// Editor theme — matches the existing CodeMirror theme in NoteEditor.tsx
// ─────────────────────────────────────────────────────────────────────────────
const editorTheme = EditorView.theme(
  {
    '&': {
      backgroundColor: '#282b36',
      color: '#e0e2e8',
      fontFamily: "'Georgia','Cambria','Times New Roman',serif",
      fontSize: '16px',
      lineHeight: '1.8',
      height: '100%',
    },
    '.cm-scroller': {
      padding: '32px 40px',
      overflowX: 'hidden',
      fontFamily: 'inherit',
    },
    '.cm-content': {
      caretColor: '#ffffff',
      maxWidth: '680px',
      margin: '0 auto',
      padding: '0',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
      fontFamily: 'inherit',
    },
    '&.cm-focused .cm-cursor': {
      borderLeftColor: '#ffffff',
      borderLeftWidth: '2px',
    },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
      backgroundColor: 'rgba(255,255,255,0.12) !important',
    },
    '.cm-gutters':          { display: 'none' },
    '.cm-activeLine':       { backgroundColor: 'transparent' },
    '.cm-activeLineGutter': { backgroundColor: 'transparent' },
    '&.cm-focused':         { outline: 'none' },
    '.cm-placeholder':      { color: '#4a4f60', fontStyle: 'italic' },
    '.cm-line':             { padding: '0' },
  },
  { dark: true }
);

// ─────────────────────────────────────────────────────────────────────────────
// Extensions bundle
// ─────────────────────────────────────────────────────────────────────────────
const extensions = [
  markdown({ base: markdownLanguage, codeLanguages: languages }),
  editorTheme,
  markdownDecorationPlugin,
  EditorView.lineWrapping,
];

const basicSetup = {
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
};

// ─────────────────────────────────────────────────────────────────────────────
// Public component
// ─────────────────────────────────────────────────────────────────────────────
interface LiveMarkdownEditorProps {
  content: string;
  onChange: (val: string) => void;
}

export function LiveMarkdownEditor({ content, onChange }: LiveMarkdownEditorProps) {
  return (
    <div className="w-full h-full min-h-[500px]">
      <CodeMirror
        value={content}
        onChange={onChange}
        extensions={extensions}
        basicSetup={basicSetup}
        placeholder="Start typing… # Heading  **bold**  *italic*  `code`  [link](url)"
        className="h-full"
        style={{ height: '100%' }}
      />
    </div>
  );
}

export default LiveMarkdownEditor;
