import React, { useState, useRef, useEffect } from 'react';
import { useAppStore } from '@/store';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Sparkles, Send, Bot, User, Loader2, Lightbulb, FileText, CheckSquare, BarChart2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const QUICK_PROMPTS = [
  { icon: CheckSquare, label: 'Summarize my tasks',        prompt: 'Give me a concise summary of all my current tasks, grouped by status.' },
  { icon: FileText,    label: 'Summarize my notes',        prompt: 'Summarize the key ideas from all my notes in this workspace.' },
  { icon: BarChart2,   label: 'Productivity insights',     prompt: 'Analyze my tasks and tell me what I should focus on today based on priority and deadlines.' },
  { icon: Lightbulb,   label: 'Suggest time blocks',       prompt: 'Look at my upcoming tasks and suggest a daily time-blocking schedule for maximum productivity.' },
];

export function AIAssistant() {
  const { workspace, tasks, notes, events } = useAppStore();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: `Hello! I'm your Nexus AI Assistant. I have full context of your **${workspace}** workspace — tasks, notes, and calendar events.\n\nI can help you:\n- Summarize and analyze your tasks\n- Draft content and notes\n- Suggest scheduling and priorities\n- Answer questions about your projects\n\nWhat would you like to work on?`
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const buildContext = () => {
    const workspaceTasks = tasks.filter(t => t.workspace === workspace);
    const workspaceNotes = notes.filter(n => n.workspace === workspace);
    const workspaceEvents = events.filter(e => e.workspace === workspace);

    return `You are Nexus AI, a productivity assistant built into the Nexus app. You have access to the user's current workspace data.

Current Workspace: ${workspace}
Current Date/Time: ${new Date().toLocaleString()}

TASKS (${workspaceTasks.length} total):
${workspaceTasks.map(t =>
  `- [${t.status}] ${t.title}${t.priority ? ` (${t.priority})` : ''}${t.dueDate ? ` | Due: ${new Date(t.dueDate).toLocaleDateString()}` : ''}${t.description ? ` | ${t.description.slice(0, 80)}` : ''}`
).join('\n') || 'No tasks.'}

NOTES (${workspaceNotes.length} total):
${workspaceNotes.map(n =>
  `- "${n.title}": ${n.content.replace(/[#*`]/g, '').trim().slice(0, 120)}...`
).join('\n') || 'No notes.'}

UPCOMING EVENTS (${workspaceEvents.length} total):
${workspaceEvents.slice(0, 10).map(e =>
  `- ${e.title} | ${new Date(e.startTime).toLocaleString()} → ${new Date(e.endTime).toLocaleString()}`
).join('\n') || 'No events.'}

Instructions:
- Be concise and actionable. Use markdown for formatting.
- Reference specific tasks, notes or events by name when relevant.
- If suggesting priorities, reference the Impact×Effort framework (Quick Wins, Major Projects, Fill Tasks, Time Wasters).
- Do not hallucinate — only reference data you've been given above.`;
  };

  const callAnthropicAPI = async (conversationMessages: Message[]) => {
    const systemPrompt = buildContext();

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: systemPrompt,
        messages: conversationMessages
          .filter(m => m.role !== 'assistant' || m.id !== '1') // skip initial greeting
          .map(m => ({ role: m.role, content: m.content }))
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err?.error?.message || `API error ${response.status}`);
    }

    const data = await response.json();
    return data.content?.[0]?.text || 'Sorry, I could not generate a response.';
  };

  const handleSend = async (overrideInput?: string) => {
    const text = (overrideInput ?? input).trim();
    if (!text || isLoading) return;

    const userMessage: Message = { id: crypto.randomUUID(), role: 'user', content: text };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      const responseText = await callAnthropicAPI(newMessages);
      setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'assistant', content: responseText }]);
    } catch (error: any) {
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `⚠️ **Error**: ${error.message || 'Something went wrong.'}\n\nMake sure the Anthropic API is accessible from this environment.`
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col max-w-4xl mx-auto p-4 md:p-8">
      <header className="mb-5">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-zinc-900 flex items-center gap-3">
          <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          AI Assistant
        </h1>
        <p className="text-zinc-500 mt-1 text-sm">
          Powered by Claude · Full context of your <strong>{workspace}</strong> workspace
        </p>
      </header>

      {/* Quick Prompts */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
        {QUICK_PROMPTS.map(({ icon: Icon, label, prompt }) => (
          <button
            key={label}
            onClick={() => handleSend(prompt)}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-zinc-600 bg-white border border-zinc-200 rounded-lg hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 transition-colors disabled:opacity-50"
          >
            <Icon className="w-3.5 h-3.5 shrink-0" />
            <span className="text-left leading-tight">{label}</span>
          </button>
        ))}
      </div>

      {/* Messages */}
      <Card className="flex-1 flex flex-col overflow-hidden border-zinc-200 shadow-sm">
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                message.role === 'user'
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'bg-zinc-900 text-zinc-50'
              }`}>
                {message.role === 'user'
                  ? <User className="w-3.5 h-3.5" />
                  : <Bot className="w-3.5 h-3.5" />
                }
              </div>
              <div className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm ${
                message.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-tr-sm'
                  : 'bg-zinc-100 text-zinc-900 rounded-tl-sm'
              }`}>
                {message.role === 'user' ? (
                  <p className="leading-relaxed">{message.content}</p>
                ) : (
                  <div className="prose prose-sm max-w-none prose-p:leading-relaxed prose-p:my-1 prose-headings:mt-3 prose-headings:mb-1 prose-li:my-0.5 prose-pre:bg-zinc-800 prose-pre:text-zinc-50 prose-code:bg-zinc-200 prose-code:px-1 prose-code:rounded">
                    <ReactMarkdown>{message.content}</ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-zinc-900 text-zinc-50 flex items-center justify-center shrink-0">
                <Bot className="w-3.5 h-3.5" />
              </div>
              <div className="bg-zinc-100 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
                <span className="text-sm text-zinc-500">Thinking…</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 border-t border-zinc-200 bg-white">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="Ask about your tasks, notes, or schedule…"
              className="flex-1"
              disabled={isLoading}
            />
            <Button onClick={() => handleSend()} disabled={isLoading || !input.trim()}>
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-center text-[10px] text-zinc-400 mt-2">
            AI can make mistakes. Verify important information.
          </p>
        </div>
      </Card>
    </div>
  );
}