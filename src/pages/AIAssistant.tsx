import React, { useState, useRef, useEffect } from 'react';
import { useAppStore } from '@/store';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Sparkles, Send, Bot, User, Loader2 } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import ReactMarkdown from 'react-markdown';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export function AIAssistant() {
  const { workspace, tasks, notes } = useAppStore();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: `Hello! I'm your Nexus AI Assistant. I can help you analyze your ${workspace.toLowerCase()} tasks, summarize notes, or generate new project structures. What would you like to do?`
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // In a real app, we'd use the actual API key from env
      // For this prototype, if the key is missing/placeholder, we'll mock the response
      const apiKey = process.env.GEMINI_API_KEY;
      
      if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
        // Mock response for preview without real API key
        setTimeout(() => {
          const mockResponse: Message = {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: `*Note: This is a simulated response because no valid Gemini API key was found.* \n\nBased on your request "${userMessage.content}", I can see you have ${tasks.filter(t => t.workspace === workspace).length} tasks and ${notes.filter(n => n.workspace === workspace).length} notes in your ${workspace} workspace. \n\nTo enable real AI capabilities, please configure your Gemini API key in the settings.`
          };
          setMessages(prev => [...prev, mockResponse]);
          setIsLoading(false);
        }, 1500);
        return;
      }

      const ai = new GoogleGenAI({ apiKey });
      
      // Prepare context
      const context = `
        Current Workspace: ${workspace}
        Tasks: ${JSON.stringify(tasks.filter(t => t.workspace === workspace))}
        Notes: ${JSON.stringify(notes.filter(n => n.workspace === workspace))}
        
        You are Nexus AI, a helpful productivity assistant. Use the provided context about the user's tasks and notes to answer their questions. Be concise and helpful.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `${context}\n\nUser Question: ${userMessage.content}`,
      });

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response.text || 'Sorry, I could not generate a response.'
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('AI Error:', error);
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'Sorry, I encountered an error while processing your request. Please check your API key configuration.'
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col max-w-4xl mx-auto p-4 md:p-8">
      <header className="mb-6 md:mb-8">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-zinc-900 flex items-center gap-3">
          <Sparkles className="w-6 h-6 md:w-8 md:h-8 text-indigo-500" />
          AI Assistant
        </h1>
        <p className="text-zinc-500 mt-1 text-sm md:text-base">Powered by Gemini. Ask about your projects, generate content, or summarize notes.</p>
      </header>

      <Card className="flex-1 flex flex-col overflow-hidden border-zinc-200 shadow-sm">
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.map((message) => (
            <div 
              key={message.id} 
              className={`flex gap-4 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                message.role === 'user' ? 'bg-indigo-100 text-indigo-700' : 'bg-zinc-900 text-zinc-50'
              }`}>
                {message.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>
              <div className={`max-w-[80%] rounded-2xl px-5 py-3.5 ${
                message.role === 'user' 
                  ? 'bg-indigo-600 text-white rounded-tr-sm' 
                  : 'bg-zinc-100 text-zinc-900 rounded-tl-sm'
              }`}>
                {message.role === 'user' ? (
                  <p>{message.content}</p>
                ) : (
                  <div className="prose prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-zinc-800 prose-pre:text-zinc-50">
                    <ReactMarkdown>{message.content}</ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-zinc-900 text-zinc-50 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="bg-zinc-100 rounded-2xl rounded-tl-sm px-5 py-3.5 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />
                <span className="text-sm text-zinc-500">Thinking...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        
        <div className="p-4 border-t border-zinc-200 bg-white">
          <form 
            onSubmit={(e) => { e.preventDefault(); handleSend(); }}
            className="flex gap-2"
          >
            <Input 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask me to summarize your notes, or draft a new project plan..."
              className="flex-1"
              disabled={isLoading}
            />
            <Button type="submit" disabled={isLoading || !input.trim()}>
              <Send className="w-4 h-4" />
            </Button>
          </form>
          <p className="text-center text-xs text-zinc-400 mt-2">
            AI can make mistakes. Consider verifying important information.
          </p>
        </div>
      </Card>
    </div>
  );
}
