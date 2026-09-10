'use client';

import { useState, useRef, useEffect } from 'react';
import DashboardShell from '@/components/DashboardShell';
import { Button } from '@zyra/ui';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4020';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

const suggestedQuestions = [
  'How is my revenue trending?',
  'Which products are selling best?',
  'What are my top customers?',
  'Show me commission breakdown',
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text?: string) => {
    const content = text || input.trim();
    if (!content || loading) return;

    const userMessage: Message = { role: 'user', content, timestamp: new Date().toLocaleTimeString() };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/agents/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: 'cmtsybniv005krtzxn2up82q4',
          message: content,
          conversation_id: conversationId,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const convId = data.conversation_id;
        if (!conversationId && convId) {
          setConversationId(convId);
        }
        setMessages((prev) => [...prev, { role: 'assistant', content: data.content, timestamp: new Date().toLocaleTimeString() }]);
      } else {
        setMessages((prev) => [...prev, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.', timestamp: new Date().toLocaleTimeString() }]);
      }
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Could not reach the AI service. Please try again later.', timestamp: new Date().toLocaleTimeString() }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardShell
      sidebarProps={{
        logo: <span className="text-lg font-bold text-indigo-600">ZYRA</span>,
        navLinks: [
          { href: '/dashboard', label: 'Overview' },
          { href: '/dashboard/chat', label: 'Talk to ZYRA', active: true },
          { href: '/dashboard/approvals', label: 'Approvals' },
          { href: '/dashboard/orders', label: 'Orders' },
          { href: '/dashboard/products', label: 'Products' },
          { href: '/dashboard/customers', label: 'Customers' },
          { href: '/dashboard/finance', label: 'Finance' },
          { href: '/dashboard/reports', label: 'Reports' },
        ],
        user: { name: 'Admin', email: 'owner@demo.com', initials: 'A' },
      }}
      headerProps={{
        title: 'Talk to ZYRA',
        subtitle: 'Ask your AI business assistant anything',
      }}
    >
      <div className="flex h-[calc(100vh-12rem)] flex-col">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto rounded-xl border border-slate-200 bg-white">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center p-8">
              <div className="text-6xl">💬</div>
              <h3 className="mt-4 text-lg font-semibold text-slate-900">Start a conversation</h3>
              <p className="mt-2 text-sm text-slate-500 text-center max-w-md">
                Ask ZYRA about your revenue, products, customers, commissions, or any business question.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {suggestedQuestions.map((q) => (
                  <button
                    key={q}
                    onClick={() => sendMessage(q)}
                    className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-4 space-y-4">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-br-md'
                      : 'bg-slate-100 text-slate-900 rounded-bl-md'
                  }`}>
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    <p className={`mt-1 text-xs ${msg.role === 'user' ? 'text-indigo-200' : 'text-slate-400'}`}>
                      {msg.timestamp}
                    </p>
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="rounded-2xl rounded-bl-md bg-slate-100 px-4 py-3">
                    <div className="flex items-center gap-1">
                      <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:0ms]" />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:150ms]" />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:300ms]" />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <div className="mt-4 flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Ask ZYRA anything about your business..."
            disabled={loading}
            className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50"
          />
          <Button
            onClick={() => sendMessage()}
            disabled={loading || !input.trim()}
            size="md"
          >
            Send
          </Button>
        </div>
      </div>
    </DashboardShell>
  );
}
