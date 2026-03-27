import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import yaml from 'yaml';
import { visit } from 'unist-util-visit';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store';
import { Check, ChevronDown, Calendar as CalendarIcon, ArrowUp, ArrowDown, Minus } from 'lucide-react';

function remarkCheckboxIndex() {
  return (tree: any) => {
    let index = 0;
    visit(tree, 'listItem', (node: any) => {
      if (node.checked !== null && node.checked !== undefined) {
        node.data = node.data || {};
        node.data.hProperties = node.data.hProperties || {};
        node.data.hProperties['data-checkbox-index'] = index++;
      }
    });
  };
}

interface NoteEditorProps {
  content: string;
  onChange: (content: string) => void;
  isEditing: boolean;
  setIsEditing: (isEditing: boolean) => void;
}

export function NoteEditor({ content, onChange, isEditing, setIsEditing }: NoteEditorProps) {
  const { tasks } = useAppStore();

  // Parse frontmatter
  let frontmatter: any = null;
  let markdownContent = content;
  const match = content.match(/^---\n([\s\S]*?)\n---\n/);
  if (match) {
    try {
      frontmatter = yaml.parse(match[1]);
      markdownContent = content.slice(match[0].length);
    } catch (e) {
      // invalid yaml, ignore
    }
  }

  const updateFrontmatter = (key: string, value: string) => {
    if (!frontmatter) return;
    const newFrontmatter = { ...frontmatter, [key]: value };
    const newYaml = yaml.stringify(newFrontmatter).trim();
    const newContent = content.replace(/^---\n([\s\S]*?)\n---/, `---\n${newYaml}\n---`);
    onChange(newContent);
  };

  const toggleCheckbox = (index: number) => {
    let currentIdx = 0;
    const newContent = content.replace(/- \[[ xX]\]/g, (match) => {
      if (currentIdx === index) {
        currentIdx++;
        return match === '- [ ]' ? '- [x]' : '- [ ]';
      }
      currentIdx++;
      return match;
    });
    onChange(newContent);
  };

  // Pre-process markdown for custom syntax
  const processedMarkdown = markdownContent
    .replace(/\[\[(.*?)\]\]/g, '[$1](internal://$1)')
    .replace(/\[([a-zA-Z0-9_-]+)::(.*?)\]/g, '[$1::$2](prop://$1/$2)');

  if (isEditing) {
    return (
      <div className="max-w-[800px] mx-auto w-full h-full px-4 md:px-0">
        <textarea
          value={content}
          onChange={(e) => onChange(e.target.value)}
          className="w-full h-full min-h-[500px] p-4 font-mono text-sm md:text-base bg-transparent border-none resize-none focus:ring-0 focus:outline-none"
          placeholder={`Start typing… (Markdown supported)\n---\npriority: high\n---`}
          autoFocus
        />
      </div>
    );
  }

  // ── Reading / preview mode ─────────────────────────────────────────────────
  // NOTE: We intentionally do NOT add onClick={() => setIsEditing(true)} to the
  // wrapper. Edit mode is toggled via the "Edit" button in the Notes panel header.
  // Only interactive elements (checkboxes, frontmatter controls, links) stop
  // propagation so clicks on them don't bubble up to parent containers.
  return (
    <div className="max-w-[800px] mx-auto w-full pb-32 px-4 md:px-0">
      {/* Frontmatter properties grid */}
      {frontmatter && Object.keys(frontmatter).length > 0 && (
        <div className="mb-8 p-3 md:p-4 bg-zinc-50/50 border border-zinc-200 rounded-xl">
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Properties</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            {Object.entries(frontmatter).map(([key, value]) => (
              <div key={key} className="flex flex-col gap-1">
                <span className="text-xs text-zinc-500 capitalize">{key.replace(/-/g, ' ')}</span>
                <FrontmatterValue
                  propKey={key}
                  value={value as string}
                  onChange={(val) => updateFrontmatter(key, val)}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rendered markdown */}
      {markdownContent.trim() ? (
        <div className="prose prose-zinc max-w-none prose-p:leading-relaxed prose-pre:bg-zinc-900 prose-pre:text-zinc-50">
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkCheckboxIndex]}
            components={{
              a: ({ href, children }) => {
                if (href?.startsWith('internal://')) {
                  const linkName = decodeURIComponent(href.replace('internal://', ''));
                  return <InternalLink name={linkName} tasks={tasks} />;
                }
                if (href?.startsWith('prop://')) {
                  const parts = href.replace('prop://', '').split('/');
                  const key = decodeURIComponent(parts[0]);
                  const value = decodeURIComponent(parts.slice(1).join('/'));
                  return <InlineProperty propKey={key} propValue={value} />;
                }
                return (
                  <a href={href} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
                    {children}
                  </a>
                );
              },
              li: ({ node, children, className, ...props }) => {
                const isTask = className?.includes('task-list-item');
                if (isTask) {
                  return (
                    <li className="group flex items-start gap-3 p-3 my-2 bg-white border border-zinc-200 rounded-lg shadow-sm hover:shadow-md transition-all relative">
                      <div className="flex-1 min-w-0 flex items-start gap-2">
                        {children}
                      </div>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-white pl-2">
                        <button
                          className="p-1 rounded hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600"
                          title="Set Status"
                          onClick={(e) => { e.stopPropagation(); }}
                        >
                          <div className="w-5 h-5 rounded flex items-center justify-center border border-zinc-200">
                            <Minus className="w-3 h-3" />
                          </div>
                        </button>
                      </div>
                    </li>
                  );
                }
                return <li className={className} {...props}>{children}</li>;
              },
              input: ({ node, type, checked, ...props }) => {
                if (type === 'checkbox') {
                  const index = (node as any)?.properties?.['data-checkbox-index'];
                  return (
                    <div
                      className={cn(
                        'mt-1 flex-shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-colors cursor-pointer',
                        checked ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-zinc-300 bg-white'
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (typeof index === 'number') toggleCheckbox(index);
                      }}
                    >
                      {checked && <Check className="w-3.5 h-3.5" />}
                    </div>
                  );
                }
                return <input type={type} checked={checked} {...props} />;
              },
            }}
          >
            {processedMarkdown}
          </ReactMarkdown>
        </div>
      ) : (
        <p className="text-zinc-400 text-sm italic">
          This note is empty. Click <span className="font-medium text-zinc-500">Edit</span> to start writing.
        </p>
      )}
    </div>
  );
}

function FrontmatterValue({ propKey, value, onChange }: { propKey: string; value: string; onChange: (val: string) => void }) {
  const lowerKey = propKey.toLowerCase();

  if (lowerKey === 'status') {
    const colors: Record<string, string> = {
      todo: 'bg-zinc-100 text-zinc-700',
      'in progress': 'bg-blue-100 text-blue-700',
      done: 'bg-emerald-100 text-emerald-700',
    };
    const colorClass = colors[value.toLowerCase()] || 'bg-zinc-100 text-zinc-700';
    return (
      <div className="relative inline-block w-fit">
        <select
          className={cn(
            'appearance-none pl-2.5 pr-6 py-0.5 rounded-full text-xs font-medium w-fit border-none cursor-pointer outline-none focus:ring-2 focus:ring-indigo-500/20',
            colorClass
          )}
          value={value.toLowerCase()}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="todo">Todo</option>
          <option value="in progress">In Progress</option>
          <option value="done">Done</option>
        </select>
        <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-50" />
      </div>
    );
  }

  if (lowerKey.includes('date')) {
    return (
      <span className="inline-flex items-center text-sm text-zinc-700 relative">
        <CalendarIcon className="w-4 h-4 mr-1.5 text-zinc-400" />
        <input
          type="date"
          className="border-none bg-transparent p-0 text-sm text-zinc-700 focus:ring-0 cursor-pointer w-[120px]"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </span>
    );
  }

  if (lowerKey === 'priority') {
    const icons: Record<string, React.ReactNode> = {
      high: <ArrowUp className="w-4 h-4 text-red-500 mr-1" />,
      medium: <Minus className="w-4 h-4 text-amber-500 mr-1" />,
      low: <ArrowDown className="w-4 h-4 text-blue-500 mr-1" />,
    };
    return (
      <div className="relative inline-block w-fit">
        <select
          className="appearance-none pl-6 pr-6 py-0.5 rounded-md text-sm text-zinc-700 capitalize border-none bg-transparent cursor-pointer outline-none focus:ring-0"
          value={value.toLowerCase()}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
        <div className="absolute left-0 top-1/2 -translate-y-1/2 pointer-events-none">
          {icons[value.toLowerCase()] || <Minus className="w-4 h-4 text-zinc-400 mr-1" />}
        </div>
        <ChevronDown className="w-3 h-3 absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none opacity-50" />
      </div>
    );
  }

  return (
    <input
      type="text"
      className="text-sm text-zinc-900 border-none bg-transparent p-0 focus:ring-0 w-full"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function InternalLink({ name, tasks }: { name: string; tasks: any[] }) {
  const [isHovered, setIsHovered] = useState(false);
  const { updateTask, notes } = useAppStore();

  const linkedTask = tasks.find(t => t.title.toLowerCase() === name.toLowerCase());
  const linkedNote = notes.find(n => n.title.toLowerCase() === name.toLowerCase());

  return (
    <span
      className="relative inline-flex items-center group cursor-pointer mx-1"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={(e) => e.stopPropagation()}
    >
      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100 text-xs font-medium hover:bg-indigo-100 transition-colors">
        <span className="opacity-50 mr-1">#</span>
        {name}
      </span>

      {isHovered && (linkedTask || linkedNote) && (
        <div
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-4 bg-white border border-zinc-200 rounded-xl shadow-xl z-50 animate-in fade-in slide-in-from-bottom-2"
          onClick={(e) => e.stopPropagation()}
        >
          {linkedTask ? (
            <>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-zinc-500 uppercase">{linkedTask.type}</span>
                <select
                  className={cn(
                    'text-[10px] px-2 py-1 rounded-full font-medium border-none cursor-pointer outline-none appearance-none',
                    linkedTask.status === 'done' ? 'bg-emerald-100 text-emerald-700' :
                    linkedTask.status === 'in-progress' ? 'bg-blue-100 text-blue-700' :
                    'bg-zinc-100 text-zinc-700'
                  )}
                  value={linkedTask.status}
                  onChange={(e) => updateTask(linkedTask.id, { status: e.target.value as any })}
                >
                  <option value="todo">Todo</option>
                  <option value="in-progress">In Progress</option>
                  <option value="done">Done</option>
                </select>
              </div>
              <h4 className="text-sm font-medium text-zinc-900 mb-2 line-clamp-2">{linkedTask.title}</h4>
              {linkedTask.description && (
                <p className="text-xs text-zinc-500 line-clamp-2 mb-3">{linkedTask.description}</p>
              )}
            </>
          ) : linkedNote ? (
            <>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-zinc-500 uppercase">Note</span>
              </div>
              <h4 className="text-sm font-medium text-zinc-900 mb-1 line-clamp-2">{linkedNote.title}</h4>
              {linkedNote.content && (
                <p className="text-xs text-zinc-500 line-clamp-3">
                  {linkedNote.content.replace(/^---[\s\S]*?---\n?/, '').replace(/[#*`]/g, '').slice(0, 150)}…
                </p>
              )}
            </>
          ) : null}
        </div>
      )}
    </span>
  );
}

function InlineProperty({ propKey, propValue }: { propKey: string; propValue: string }) {
  const colors: Record<string, string> = {
    high: 'bg-red-100 text-red-700 border-red-200',
    medium: 'bg-amber-100 text-amber-700 border-amber-200',
    low: 'bg-blue-100 text-blue-700 border-blue-200',
    done: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    todo: 'bg-zinc-100 text-zinc-700 border-zinc-200',
  };
  const colorClass = colors[propValue.toLowerCase()] || 'bg-indigo-50 text-indigo-700 border-indigo-200';

  return (
    <span
      className={cn(
        'inline-flex items-center px-1.5 py-0.5 mx-1 rounded-md text-[11px] font-medium border',
        colorClass
      )}
    >
      <span className="opacity-60 mr-1">{propKey}:</span>
      {propValue}
    </span>
  );
}