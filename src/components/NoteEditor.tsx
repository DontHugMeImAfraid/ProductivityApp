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
};

// ═════════════════════════════════════════════════════════════════════════════
// SYNTAX HIGHLIGHTER — zero dependencies, pure tokenizer
// ═════════════════════════════════════════════════════════════════════════════

type TokenType =
  | 'keyword' | 'string' | 'comment' | 'number' | 'operator'
  | 'function' | 'type' | 'builtin' | 'tag' | 'attr' | 'value'
  | 'selector' | 'property' | 'punctuation' | 'regex' | 'plain';

interface Token { type: TokenType; value: string; }

// ── Language aliases ──────────────────────────────────────────────────────────
const LANG_ALIASES: Record<string, string> = {
  js: 'javascript', ts: 'typescript', jsx: 'javascript', tsx: 'typescript',
  sh: 'bash', shell: 'bash', zsh: 'bash',
  yml: 'yaml',
  py: 'python', py3: 'python',
  rb: 'ruby',
  rs: 'rust',
  cs: 'csharp',
  'c++': 'cpp', cc: 'cpp', cxx: 'cpp',
  md: 'markdown',
  htm: 'html',
};

function normalizeLanguage(lang: string): string {
  const lo = lang.toLowerCase().trim();
  return LANG_ALIASES[lo] ?? lo;
}

// ── Keyword sets ──────────────────────────────────────────────────────────────
const KEYWORDS: Record<string, Set<string>> = {
  javascript: new Set([
    'break','case','catch','class','const','continue','debugger','default','delete',
    'do','else','export','extends','finally','for','function','if','import','in',
    'instanceof','let','new','null','of','return','static','super','switch','this',
    'throw','try','typeof','undefined','var','void','while','with','yield',
    'async','await','from','as','true','false',
  ]),
  typescript: new Set([
    'break','case','catch','class','const','continue','debugger','default','delete',
    'do','else','enum','export','extends','finally','for','function','if','import',
    'in','instanceof','interface','let','new','null','of','private','protected',
    'public','readonly','return','static','super','switch','this','throw','try',
    'type','typeof','undefined','var','void','while','with','yield','async','await',
    'from','as','implements','namespace','abstract','declare','true','false',
    'keyof','infer','never','unknown','any','string','number','boolean','object',
  ]),
  python: new Set([
    'False','None','True','and','as','assert','async','await','break','class',
    'continue','def','del','elif','else','except','finally','for','from','global',
    'if','import','in','is','lambda','nonlocal','not','or','pass','raise','return',
    'try','while','with','yield',
  ]),
  python_builtins: new Set([
    'print','len','range','type','int','str','float','list','dict','set','tuple',
    'bool','input','open','super','isinstance','issubclass','hasattr','getattr',
    'setattr','enumerate','zip','map','filter','sorted','reversed','sum','max',
    'min','abs','round','id','dir','vars','repr','format',
  ]),
  sql: new Set([
    'SELECT','FROM','WHERE','JOIN','INNER','LEFT','RIGHT','FULL','OUTER','CROSS',
    'ON','AND','OR','NOT','IN','EXISTS','BETWEEN','LIKE','IS','NULL','AS',
    'ORDER','BY','GROUP','HAVING','LIMIT','OFFSET','UNION','ALL','DISTINCT',
    'INSERT','INTO','VALUES','UPDATE','SET','DELETE','CREATE','TABLE','ALTER',
    'DROP','INDEX','VIEW','DATABASE','SCHEMA','TRIGGER','PROCEDURE','FUNCTION',
    'BEGIN','COMMIT','ROLLBACK','TRANSACTION','PRIMARY','KEY','FOREIGN','REFERENCES',
    'UNIQUE','CHECK','DEFAULT','NOT','WITH','CASE','WHEN','THEN','ELSE','END',
    'ASC','DESC','RETURNS','DECLARE','CURSOR','OPEN','FETCH','CLOSE','EXEC',
    'COUNT','SUM','AVG','MAX','MIN','COALESCE','NULLIF','CAST','CONVERT',
    'CONCAT','SUBSTRING','TRIM','UPPER','LOWER','LEN','LENGTH','NOW','DATE',
  ]),
  bash: new Set([
    'if','then','else','elif','fi','for','in','do','done','while','until','case',
    'esac','function','return','exit','break','continue','echo','read','export',
    'local','declare','typeset','readonly','unset','shift','set','exec','eval',
    'source','alias','cd','pwd','ls','cat','grep','sed','awk','find','xargs',
    'mkdir','rm','cp','mv','chmod','chown','ln','tar','curl','wget','sudo',
    'true','false','test',
  ]),
  rust: new Set([
    'as','async','await','break','const','continue','crate','dyn','else','enum',
    'extern','false','fn','for','if','impl','in','let','loop','match','mod','move',
    'mut','pub','ref','return','self','Self','static','struct','super','trait',
    'true','type','unsafe','use','where','while','i8','i16','i32','i64','i128',
    'u8','u16','u32','u64','u128','f32','f64','bool','char','str','String','Vec',
    'Option','Result','Box','Rc','Arc','Some','None','Ok','Err',
  ]),
  go: new Set([
    'break','case','chan','const','continue','default','defer','else','fallthrough',
    'for','func','go','goto','if','import','interface','map','package','range',
    'return','select','struct','switch','type','var','true','false','nil','iota',
    'string','int','int8','int16','int32','int64','uint','float32','float64','bool',
    'byte','rune','error','make','new','len','cap','append','copy','delete','print',
  ]),
  csharp: new Set([
    'abstract','as','base','bool','break','byte','case','catch','char','checked',
    'class','const','continue','decimal','default','delegate','do','double','else',
    'enum','event','explicit','extern','false','finally','fixed','float','for',
    'foreach','goto','if','implicit','in','int','interface','internal','is','lock',
    'long','namespace','new','null','object','operator','out','override','params',
    'private','protected','public','readonly','ref','return','sbyte','sealed',
    'short','sizeof','stackalloc','static','string','struct','switch','this','throw',
    'true','try','typeof','uint','ulong','unchecked','unsafe','ushort','using',
    'var','virtual','void','volatile','while','async','await','yield','dynamic',
  ]),
  ruby: new Set([
    'BEGIN','END','alias','and','begin','break','case','class','def','defined?',
    'do','else','elsif','end','ensure','false','for','if','in','module','next',
    'nil','not','or','redo','rescue','retry','return','self','super','then',
    'true','undef','unless','until','when','while','yield',
  ]),
  java: new Set([
    'abstract','assert','boolean','break','byte','case','catch','char','class',
    'const','continue','default','do','double','else','enum','extends','final',
    'finally','float','for','goto','if','implements','import','instanceof','int',
    'interface','long','native','new','null','package','private','protected',
    'public','return','short','static','strictfp','super','switch','synchronized',
    'this','throw','throws','transient','try','void','volatile','while','true','false',
  ]),
  cpp: new Set([
    'alignas','alignof','and','and_eq','asm','auto','bitand','bitor','bool','break',
    'case','catch','char','char8_t','char16_t','char32_t','class','compl','concept',
    'const','consteval','constexpr','constinit','const_cast','continue','co_await',
    'co_return','co_yield','decltype','default','delete','do','double','dynamic_cast',
    'else','enum','explicit','export','extern','false','float','for','friend','goto',
    'if','inline','int','long','mutable','namespace','new','noexcept','not','not_eq',
    'nullptr','operator','or','or_eq','private','protected','public','register',
    'reinterpret_cast','requires','return','short','signed','sizeof','static',
    'static_assert','static_cast','struct','switch','template','this','thread_local',
    'throw','true','try','typedef','typeid','typename','union','unsigned','using',
    'virtual','void','volatile','wchar_t','while','xor','xor_eq','std','string',
    'vector','map','set','pair','auto','nullptr',
  ]),
};

// ── Per-language theme colours (GitHub Dark Dimmed inspired) ─────────────────
const THEME = {
  keyword:     '#ff7b72',  // red/orange — keywords
  string:      '#a5d6ff',  // light blue — strings
  comment:     '#8b949e',  // grey — comments
  number:      '#79c0ff',  // blue — numbers
  operator:    '#ff7b72',  // red — operators
  function:    '#d2a8ff',  // purple — function names
  type:        '#ffa657',  // orange — types
  builtin:     '#79c0ff',  // blue — builtins
  tag:         '#7ee787',  // green — HTML tags
  attr:        '#79c0ff',  // blue — HTML attrs
  value:       '#a5d6ff',  // light blue — attr values
  selector:    '#7ee787',  // green — CSS selectors
  property:    '#79c0ff',  // blue — CSS properties
  punctuation: '#c9d1d9',  // muted — brackets, commas
  regex:       '#a5d6ff',  // light blue — regex literals
  plain:       '#e6edf3',  // light — default text
};

// ═════════════════════════════════════════════════════════════════════════════
// Generic tokenizer (handles JS, TS, Python, SQL, Bash, Rust, Go, etc.)
// ═════════════════════════════════════════════════════════════════════════════

type CommentStyle = { line?: string | string[]; block?: [string, string] };

interface LangDef {
  keywords:   Set<string>;
  builtins?:  Set<string>;
  types?:     Set<string>;
  comments:   CommentStyle;
  strings:    ('single' | 'double' | 'backtick' | 'triple_single' | 'triple_double')[];
  /** extra patterns applied before the generic loop */
  extraPatterns?: { pattern: RegExp; type: TokenType }[];
  /** if true, keywords are case-insensitive */
  caseInsensitiveKw?: boolean;
}

const LANG_DEFS: Record<string, LangDef> = {
  javascript: {
    keywords:  KEYWORDS.javascript,
    comments:  { line: '//', block: ['/*', '*/'] },
    strings:   ['single', 'double', 'backtick'],
    extraPatterns: [
      { pattern: /^\/(?:[^\\/\r\n]|\\.)+\/[gimsuy]*/,   type: 'regex' },
      { pattern: /^[A-Z][A-Za-z0-9_]*/,                  type: 'type'  },
      { pattern: /^[a-zA-Z_$][\w$]*(?=\s*\()/,           type: 'function' },
    ],
  },
  typescript: {
    keywords:  KEYWORDS.typescript,
    comments:  { line: '//', block: ['/*', '*/'] },
    strings:   ['single', 'double', 'backtick'],
    extraPatterns: [
      { pattern: /^\/(?:[^\\/\r\n]|\\.)+\/[gimsuy]*/,   type: 'regex' },
      { pattern: /^[A-Z][A-Za-z0-9_]*/,                  type: 'type'  },
      { pattern: /^[a-zA-Z_$][\w$]*(?=\s*\()/,           type: 'function' },
    ],
  },
  python: {
    keywords:  KEYWORDS.python,
    builtins:  KEYWORDS.python_builtins,
    comments:  { line: '#' },
    strings:   ['triple_double', 'triple_single', 'single', 'double'],
    extraPatterns: [
      { pattern: /^[A-Z][A-Za-z0-9_]*/,        type: 'type'     },
      { pattern: /^[a-zA-Z_]\w*(?=\s*\()/,     type: 'function' },
      { pattern: /^@[a-zA-Z_][\w.]*/,          type: 'function' }, // decorators
    ],
  },
  sql: {
    keywords:  KEYWORDS.sql,
    caseInsensitiveKw: true,
    comments:  { line: '--', block: ['/*', '*/'] },
    strings:   ['single', 'double'],
    extraPatterns: [
      { pattern: /^`[^`]*`/, type: 'builtin' }, // backtick-quoted identifiers
    ],
  },
  bash: {
    keywords:  KEYWORDS.bash,
    comments:  { line: '#' },
    strings:   ['single', 'double', 'backtick'],
    extraPatterns: [
      { pattern: /^\$\{[^}]*\}/,      type: 'builtin' }, // ${VAR}
      { pattern: /^\$[A-Za-z_]\w*/,   type: 'builtin' }, // $VAR
      { pattern: /^\$\d+/,            type: 'builtin' }, // $1
      { pattern: /^-{1,2}[\w-]+/,     type: 'type'    }, // flags
    ],
  },
  rust: {
    keywords:  KEYWORDS.rust,
    comments:  { line: '//', block: ['/*', '*/'] },
    strings:   ['double'],
    extraPatterns: [
      { pattern: /^[A-Z][A-Z0-9_]+\b/,         type: 'type'     }, // CONSTANTS
      { pattern: /^[A-Z][a-zA-Z0-9_]*/,        type: 'type'     }, // Types
      { pattern: /^[a-zA-Z_]\w*(?=\s*\()/,     type: 'function' },
      { pattern: /^[a-zA-Z_]\w*!/,             type: 'function' }, // macros
      { pattern: /^'[a-zA-Z_]\w*/,             type: 'type'     }, // lifetimes
    ],
  },
  go: {
    keywords:  KEYWORDS.go,
    comments:  { line: '//', block: ['/*', '*/'] },
    strings:   ['double', 'backtick'],
    extraPatterns: [
      { pattern: /^[A-Z][a-zA-Z0-9_]*/,        type: 'type'     },
      { pattern: /^[a-zA-Z_]\w*(?=\s*\()/,     type: 'function' },
    ],
  },
  java: {
    keywords:  KEYWORDS.java,
    comments:  { line: '//', block: ['/*', '*/'] },
    strings:   ['double', 'single'],
    extraPatterns: [
      { pattern: /^[A-Z][a-zA-Z0-9_]*/,        type: 'type'     },
      { pattern: /^[a-zA-Z_]\w*(?=\s*\()/,     type: 'function' },
    ],
  },
  csharp: {
    keywords:  KEYWORDS.csharp,
    comments:  { line: '//', block: ['/*', '*/'] },
    strings:   ['double'],
    extraPatterns: [
      { pattern: /^@"(?:[^"]|"")*"/,            type: 'string'   }, // verbatim strings
      { pattern: /^[A-Z][a-zA-Z0-9_]*/,        type: 'type'     },
      { pattern: /^[a-zA-Z_]\w*(?=\s*\()/,     type: 'function' },
    ],
  },
  ruby: {
    keywords:  KEYWORDS.ruby,
    comments:  { line: '#' },
    strings:   ['single', 'double'],
    extraPatterns: [
      { pattern: /^:[a-zA-Z_]\w*/,             type: 'builtin'  }, // symbols
      { pattern: /^[A-Z][A-Za-z0-9_]*/,        type: 'type'     },
      { pattern: /^[a-zA-Z_]\w*(?=\s*[\({])/,  type: 'function' },
    ],
  },
  cpp: {
    keywords:  KEYWORDS.cpp,
    comments:  { line: '//', block: ['/*', '*/'] },
    strings:   ['double', 'single'],
    extraPatterns: [
      { pattern: /^#\s*\w+/,                   type: 'keyword'  }, // preprocessor
      { pattern: /^[A-Z][A-Z0-9_]+\b/,         type: 'type'     },
      { pattern: /^[a-zA-Z_]\w*(?=\s*\()/,     type: 'function' },
    ],
  },
};

// ─── HTML tokenizer ───────────────────────────────────────────────────────────
function tokenizeHTML(code: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < code.length) {
    // Comments
    if (code.startsWith('<!--', i)) {
      const end = code.indexOf('-->', i + 4);
      const val = end === -1 ? code.slice(i) : code.slice(i, end + 3);
      tokens.push({ type: 'comment', value: val }); i += val.length; continue;
    }
    // DOCTYPE
    if (code.startsWith('<!', i)) {
      const end = code.indexOf('>', i);
      const val = end === -1 ? code.slice(i) : code.slice(i, end + 1);
      tokens.push({ type: 'keyword', value: val }); i += val.length; continue;
    }
    // Tags
    if (code[i] === '<') {
      tokens.push({ type: 'punctuation', value: '<' }); i++;
      // Closing slash
      if (code[i] === '/') { tokens.push({ type: 'punctuation', value: '/' }); i++; }
      // Tag name
      const nameEnd = code.slice(i).search(/[\s\/>]/);
      if (nameEnd > 0) {
        tokens.push({ type: 'tag', value: code.slice(i, i + nameEnd) }); i += nameEnd;
      }
      // Attributes until >
      while (i < code.length && code[i] !== '>') {
        if (code[i] === '/') { tokens.push({ type: 'punctuation', value: '/' }); i++; continue; }
        if (code[i] === '=' ) { tokens.push({ type: 'operator',   value: '=' }); i++; continue; }
        if (code[i] === '"' || code[i] === "'") {
          const q = code[i];
          const end2 = code.indexOf(q, i + 1);
          const val = end2 === -1 ? code.slice(i) : code.slice(i, end2 + 1);
          tokens.push({ type: 'value', value: val }); i += val.length; continue;
        }
        if (/\s/.test(code[i])) {
          let ws = '';
          while (i < code.length && /\s/.test(code[i])) { ws += code[i]; i++; }
          tokens.push({ type: 'plain', value: ws }); continue;
        }
        // Attr name
        const aEnd = code.slice(i).search(/[\s=\/>]/);
        if (aEnd > 0) { tokens.push({ type: 'attr', value: code.slice(i, i + aEnd) }); i += aEnd; continue; }
        tokens.push({ type: 'plain', value: code[i] }); i++;
      }
      if (i < code.length && code[i] === '>') { tokens.push({ type: 'punctuation', value: '>' }); i++; }
      continue;
    }
    // Text content
    let text = '';
    while (i < code.length && code[i] !== '<') { text += code[i]; i++; }
    if (text) tokens.push({ type: 'plain', value: text });
  }
  return tokens;
}

// ─── CSS tokenizer ────────────────────────────────────────────────────────────
function tokenizeCSS(code: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < code.length) {
    // Block comments
    if (code.startsWith('/*', i)) {
      const end = code.indexOf('*/', i + 2);
      const val = end === -1 ? code.slice(i) : code.slice(i, end + 2);
      tokens.push({ type: 'comment', value: val }); i += val.length; continue;
    }
    // Strings
    if (code[i] === '"' || code[i] === "'") {
      const q = code[i];
      let j = i + 1;
      while (j < code.length && code[j] !== q) { if (code[j] === '\\') j++; j++; }
      const val = code.slice(i, j + 1);
      tokens.push({ type: 'value', value: val }); i = j + 1; continue;
    }
    // At-rules
    if (code[i] === '@') {
      const m = code.slice(i).match(/^@[\w-]+/);
      if (m) { tokens.push({ type: 'keyword', value: m[0] }); i += m[0].length; continue; }
    }
    // Numbers with units
    const numM = code.slice(i).match(/^-?[\d.]+(%|px|em|rem|vh|vw|vmin|vmax|deg|s|ms|fr)?/);
    if (numM && numM[0] && !isNaN(parseFloat(numM[0]))) {
      tokens.push({ type: 'number', value: numM[0] }); i += numM[0].length; continue;
    }
    // Property: inside a rule block, text before ':'
    const propM = code.slice(i).match(/^([\w-]+)(\s*:)/);
    if (propM) {
      tokens.push({ type: 'property', value: propM[1] });
      tokens.push({ type: 'operator', value: propM[2] });
      i += propM[0].length; continue;
    }
    // Selectors — just catch known start chars
    const selM = code.slice(i).match(/^[.#][\w-]*/);
    if (selM) { tokens.push({ type: 'selector', value: selM[0] }); i += selM[0].length; continue; }
    // Punctuation
    if ('{}();,'.includes(code[i])) { tokens.push({ type: 'punctuation', value: code[i] }); i++; continue; }
    // Plain
    tokens.push({ type: 'plain', value: code[i] }); i++;
  }
  return tokens;
}

// ─── JSON tokenizer ───────────────────────────────────────────────────────────
function tokenizeJSON(code: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < code.length) {
    // Whitespace
    if (/\s/.test(code[i])) {
      let ws = '';
      while (i < code.length && /\s/.test(code[i])) { ws += code[i]; i++; }
      tokens.push({ type: 'plain', value: ws }); continue;
    }
    // Strings — detect if key or value by what follows after
    if (code[i] === '"') {
      let j = i + 1;
      while (j < code.length && code[j] !== '"') { if (code[j] === '\\') j++; j++; }
      const val = code.slice(i, j + 1);
      // Peek ahead past whitespace
      let peek = j + 1;
      while (peek < code.length && /\s/.test(code[peek])) peek++;
      const isKey = code[peek] === ':';
      tokens.push({ type: isKey ? 'attr' : 'string', value: val }); i = j + 1; continue;
    }
    // Colon
    if (code[i] === ':') { tokens.push({ type: 'operator',   value: ':'   }); i++; continue; }
    // Punctuation
    if ('{}[]'.includes(code[i])) { tokens.push({ type: 'punctuation', value: code[i] }); i++; continue; }
    if (code[i] === ',') { tokens.push({ type: 'punctuation', value: ',' }); i++; continue; }
    // Numbers
    const numM = code.slice(i).match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/);
    if (numM) { tokens.push({ type: 'number', value: numM[0] }); i += numM[0].length; continue; }
    // Booleans / null
    const litM = code.slice(i).match(/^(true|false|null)\b/);
    if (litM) { tokens.push({ type: 'keyword', value: litM[0] }); i += litM[0].length; continue; }
    tokens.push({ type: 'plain', value: code[i] }); i++;
  }
  return tokens;
}

// ─── YAML tokenizer ───────────────────────────────────────────────────────────
function tokenizeYAML(code: string): Token[] {
  const tokens: Token[] = [];
  const lines = code.split('\n');
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    const isLast = li === lines.length - 1;
    // Comment
    const commentIdx = line.indexOf('#');
    if (commentIdx !== -1 && (commentIdx === 0 || /\s/.test(line[commentIdx - 1]))) {
      if (commentIdx > 0) tokens.push(...tokenizeYAMLValue(line.slice(0, commentIdx)));
      tokens.push({ type: 'comment', value: line.slice(commentIdx) });
      if (!isLast) tokens.push({ type: 'plain', value: '\n' });
      continue;
    }
    // Key: value
    const kvMatch = line.match(/^(\s*)([\w.-]+)(\s*:\s*)(.*)?$/);
    if (kvMatch) {
      if (kvMatch[1]) tokens.push({ type: 'plain',    value: kvMatch[1] });
      tokens.push({ type: 'attr',      value: kvMatch[2] });
      tokens.push({ type: 'operator',  value: kvMatch[3] });
      if (kvMatch[4]) tokens.push(...tokenizeYAMLValue(kvMatch[4]));
    } else if (line.match(/^\s*-\s/)) {
      // List item
      const m = line.match(/^(\s*-\s*)(.*)/);
      if (m) {
        tokens.push({ type: 'operator', value: m[1] });
        if (m[2]) tokens.push(...tokenizeYAMLValue(m[2]));
      }
    } else {
      tokens.push({ type: 'plain', value: line });
    }
    if (!isLast) tokens.push({ type: 'plain', value: '\n' });
  }
  return tokens;
}
function tokenizeYAMLValue(v: string): Token[] {
  const trimmed = v.trim();
  if (!trimmed) return [{ type: 'plain', value: v }];
  if (/^['"]/.test(trimmed))    return [{ type: 'string',  value: v }];
  if (/^\d/.test(trimmed))      return [{ type: 'number',  value: v }];
  if (/^(true|false|null|yes|no|on|off)$/i.test(trimmed)) return [{ type: 'keyword', value: v }];
  return [{ type: 'plain', value: v }];
}

// ─── Generic tokenizer (JS/TS/Python/Bash/Rust/etc.) ─────────────────────────
function tokenizeGeneric(code: string, def: LangDef): Token[] {
  const tokens: Token[] = [];
  let src = code;
  const addToken = (type: TokenType, value: string) => { if (value) tokens.push({ type, value }); };
  const { keywords, builtins, types, comments, strings, extraPatterns, caseInsensitiveKw } = def;

  while (src.length > 0) {
    // ── block comment ────────────────────────────────────────────────────────
    if (comments.block && src.startsWith(comments.block[0])) {
      const [open, close] = comments.block;
      const end = src.indexOf(close, open.length);
      const val = end === -1 ? src : src.slice(0, end + close.length);
      addToken('comment', val); src = src.slice(val.length); continue;
    }
    // ── line comment ─────────────────────────────────────────────────────────
    const lineComments = Array.isArray(comments.line) ? comments.line : comments.line ? [comments.line] : [];
    let lineCommentMatched = false;
    for (const lc of lineComments) {
      if (src.startsWith(lc)) {
        const end = src.indexOf('\n');
        const val = end === -1 ? src : src.slice(0, end);
        addToken('comment', val); src = src.slice(val.length); lineCommentMatched = true; break;
      }
    }
    if (lineCommentMatched) continue;

    // ── strings ──────────────────────────────────────────────────────────────
    let stringMatched = false;
    for (const stype of strings) {
      if (stype === 'triple_double' && src.startsWith('"""')) {
        const end = src.indexOf('"""', 3);
        const val = end === -1 ? src : src.slice(0, end + 3);
        addToken('string', val); src = src.slice(val.length); stringMatched = true; break;
      }
      if (stype === 'triple_single' && src.startsWith("'''")) {
        const end = src.indexOf("'''", 3);
        const val = end === -1 ? src : src.slice(0, end + 3);
        addToken('string', val); src = src.slice(val.length); stringMatched = true; break;
      }
      const q = stype === 'single' ? "'" : stype === 'double' ? '"' : stype === 'backtick' ? '`' : null;
      if (q && src[0] === q) {
        let i = 1;
        while (i < src.length && src[i] !== q) {
          if (src[i] === '\\') i++;
          if (src[i] === '\n' && q !== '`') break; // no multiline except template literals
          i++;
        }
        const val = src.slice(0, i + 1);
        addToken('string', val); src = src.slice(val.length); stringMatched = true; break;
      }
    }
    if (stringMatched) continue;

    // ── extra patterns ────────────────────────────────────────────────────────
    if (extraPatterns) {
      let matched = false;
      for (const { pattern, type } of extraPatterns) {
        const m = src.match(pattern);
        if (m) { addToken(type, m[0]); src = src.slice(m[0].length); matched = true; break; }
      }
      if (matched) continue;
    }

    // ── numbers ───────────────────────────────────────────────────────────────
    const numM = src.match(/^(?:0x[\da-fA-F_]+|0b[01_]+|0o[0-7_]+|-?(?:\d[\d_]*\.?\d*(?:[eE][+-]?\d+)?|\.\d+))[uifUIF]?[0-9]*/);
    if (numM) { addToken('number', numM[0]); src = src.slice(numM[0].length); continue; }

    // ── identifiers / keywords ────────────────────────────────────────────────
    const identM = src.match(/^[A-Za-z_$][\w$]*/);
    if (identM) {
      const word = identM[0];
      const kw = caseInsensitiveKw ? word.toUpperCase() : word;
      if (keywords.has(caseInsensitiveKw ? kw : word)) {
        addToken('keyword', word);
      } else if (builtins?.has(word)) {
        addToken('builtin', word);
      } else if (types?.has(word)) {
        addToken('type', word);
      } else {
        addToken('plain', word);
      }
      src = src.slice(word.length); continue;
    }

    // ── operators ─────────────────────────────────────────────────────────────
    const opM = src.match(/^(?:>>>=|>>=|<<=|===|!==|>>>|=>|~~|\?\?=|\?\.|[+\-*/%&|^~!<>=?:]{1,3})/);
    if (opM) { addToken('operator', opM[0]); src = src.slice(opM[0].length); continue; }

    // ── punctuation ───────────────────────────────────────────────────────────
    if ('(){}[];,.@#'.includes(src[0])) { addToken('punctuation', src[0]); src = src.slice(1); continue; }

    // ── whitespace / newline ──────────────────────────────────────────────────
    const wsM = src.match(/^[\s\S]/);
    if (wsM) { addToken('plain', wsM[0]); src = src.slice(wsM[0].length); continue; }
    break;
  }
  return tokens;
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────
function tokenize(code: string, lang: string): Token[] {
  const norm = normalizeLanguage(lang);
  if (norm === 'html' || norm === 'xml' || norm === 'svg') return tokenizeHTML(code);
  if (norm === 'css' || norm === 'scss' || norm === 'less') return tokenizeCSS(code);
  if (norm === 'json') return tokenizeJSON(code);
  if (norm === 'yaml') return tokenizeYAML(code);
  const def = LANG_DEFS[norm];
  if (def) return tokenizeGeneric(code, def);
  // Unknown language: plain text
  return [{ type: 'plain', value: code }];
}

// ─── Renderer ────────────────────────────────────────────────────────────────
const TOKEN_COLOURS: Record<TokenType, string> = THEME as Record<TokenType, string>;

interface SyntaxBlockProps { code: string; language: string; }
function SyntaxBlock({ code, language }: SyntaxBlockProps) {
  const tokens = React.useMemo(() => tokenize(code, language), [code, language]);
  const lines = splitToLines(tokens);
  const norm  = normalizeLanguage(language);
  const label = language || 'text';

  return (
    <div className="group relative my-4 rounded-xl overflow-hidden" style={{ background: '#0d1117', border: '1px solid #30363d' }}>
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-1.5" style={{ background: '#161b22', borderBottom: '1px solid #21262d' }}>
        <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: '#6e7681' }}>{label}</span>
        <CopyButton code={code} />
      </div>
      {/* Code */}
      <pre className="overflow-x-auto m-0 p-0" style={{ background: 'transparent', border: 'none' }}>
        <code className="block px-5 py-4 text-sm leading-relaxed" style={{ fontFamily: "'Fira Code','Cascadia Code','JetBrains Mono','Consolas','Menlo',monospace", background: 'transparent' }}>
          {lines.map((lineTokens, li) => (
            <div key={li} className="table-row">
              <span className="table-cell pr-6 select-none text-right text-[11px] w-8" style={{ color: '#3d444d', minWidth: '2.5rem' }}>
                {li + 1}
              </span>
              <span className="table-cell whitespace-pre">
                {lineTokens.map((tok, ti) => (
                  <span key={ti} style={{ color: TOKEN_COLOURS[tok.type] ?? THEME.plain }}>
                    {tok.value}
                  </span>
                ))}
              </span>
            </div>
          ))}
        </code>
      </pre>
    </div>
  );
}

/** Split a flat token array into per-line arrays, preserving newlines as row separators */
function splitToLines(tokens: Token[]): Token[][] {
  const lines: Token[][] = [[]];
  for (const tok of tokens) {
    const parts = tok.value.split('\n');
    for (let i = 0; i < parts.length; i++) {
      if (i > 0) lines.push([]);
      if (parts[i]) lines[lines.length - 1].push({ type: tok.type, value: parts[i] });
    }
  }
  return lines;
}

// ─── Copy button ──────────────────────────────────────────────────────────────
function CopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); }); };
  return (
    <button onClick={copy} className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all"
      style={{ color: copied ? '#7ee787' : '#6e7681', background: copied ? '#122820' : 'transparent', border: copied ? '1px solid #2ea04340' : '1px solid transparent' }}>
      {copied ? <><Check className="w-3 h-3" />Copied</> : 'Copy'}
    </button>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Sub-components (Frontmatter, InternalLink, InlineProperty)
// ═════════════════════════════════════════════════════════════════════════════

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

// ═════════════════════════════════════════════════════════════════════════════
// Main NoteEditor
// ═════════════════════════════════════════════════════════════════════════════

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
    onChange(content.replace(/^(---\n)[\s\S]*?(\n---)/, `$1${updated}$2`));
  };

  const previewRef = useRef<HTMLDivElement>(null);

  const toggleCheckbox = useCallback((index: number) => {
    let i = 0;
    onChange(content.replace(/^([ \t]*[-*+]\s+)\[([ xX])\]/gm, (m, prefix, ch) => {
      const result = i === index ? `${prefix}[${ch.trim() === '' ? 'x' : ' '}]` : m;
      i++;
      return result;
    }));
  }, [content, onChange]);

  const handleCodeMirrorChange = useCallback((val: string) => { onChange(val); }, [onChange]);

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
  const processedMarkdown = markdownContent
    .replace(/\[\[([^\]]+)\]\]/g, (_, name) => `[${name}](internal://${encodeURIComponent(name)})`)
    .replace(/\[([a-zA-Z0-9_-]+)::([^\]]*)\]/g, (_, k, v) => `[${k}::${v}](prop://${encodeURIComponent(k)}/${encodeURIComponent(v)})`);

  const GH = {
    fg: '#1f2328', fgMuted: '#636c76', border: '#d1d9e0', borderSub: '#d8dee4',
    canvas: '#ffffff', canvasSub: '#f6f8fa',
    accent: '#0969da',
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
    inlineCode: {
      padding: '0.2em 0.4em', margin: '0', fontSize: '85%', whiteSpace: 'break-spaces' as const,
      backgroundColor: '#f6f8fa', borderRadius: '6px',
      fontFamily: "ui-monospace,SFMono-Regular,'SF Mono',Menlo,Consolas,'Liberation Mono',monospace",
      border: `1px solid ${GH.border}`, color: '#24292f',
    },
    blockquote: { padding: '0 1em', color: GH.fgMuted, borderLeft: `4px solid ${GH.borderSub}`, margin: '0 0 16px 0' },
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

              // ── Code: inline vs block ───────────────────────────────────────
              // react-markdown v9+: block code has a language-* className, inline has none.
              code: ({ className, children }) => {
                // Inline code — no className
                if (!className) {
                  return <code style={s.inlineCode}>{children}</code>;
                }
                // Block code — className is e.g. "language-python"
                // (react-markdown wraps in <pre><code> — we intercept at the <code> level)
                const lang = className.replace(/^language-/, '');
                const raw  = String(children).replace(/\n$/, ''); // strip trailing newline
                return <SyntaxBlock code={raw} language={lang} />;
              },

              // Override <pre> to render nothing — SyntaxBlock handles its own container.
              // When react-markdown renders ```lang\ncode\n```, it produces:
              //   <pre><code class="language-lang">code</code></pre>
              // Our `code` component above returns <SyntaxBlock> already wrapped in a <div>,
              // so we need <pre> to be transparent.
              pre: ({ children }) => <>{children}</>,

              blockquote: ({children}) => <blockquote style={s.blockquote}>{children}</blockquote>,

              ul: ({children}) => <ul style={s.ul}>{children}</ul>,
              ol: ({children}) => <ol style={s.ol}>{children}</ol>,
              li: ({children, className}) => {
                const isTask = className?.includes('task-list-item');
                return isTask
                  ? <li style={{...s.li, listStyle:'none', marginLeft:'-1.5em', display:'flex', alignItems:'flex-start', gap:'0.5em'}}>{children}</li>
                  : <li style={s.li}>{children}</li>;
              },

              input: ({ checked }: any) => (
                <input type="checkbox" defaultChecked={!!checked}
                  onClick={(e) => {
                    e.preventDefault();
                    const container = previewRef.current;
                    if (!container) return;
                    const all = Array.from(container.querySelectorAll('input[type="checkbox"]'));
                    const idx = all.indexOf(e.currentTarget);
                    if (idx !== -1) toggleCheckbox(idx);
                  }}
                  style={{ width:'1em', height:'1em', marginRight:'0.4em', verticalAlign:'middle', cursor:'pointer', accentColor:'#0969da', flexShrink:0, marginTop:'0.15em' }}
                />
              ),

              table: ({children}) => <div style={s.tableWrap}><table style={s.table}>{children}</table></div>,
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