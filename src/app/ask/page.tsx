'use client';

import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import BottomNav from '@/components/BottomNav';
import AskChart from '@/components/AskChart';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  chart_type?: string | null;
  chart_data?: Record<string, unknown>[] | null;
  insights?: string[];
  sql?: string;
  query_time_ms?: number;
  error?: boolean;
}

const SUGGESTION_CHIPS = [
  '上個月各門市的營收排名？',
  '最近 30 天最暢銷的前 10 名商品？',
  '哪些會員超過半年沒消費了？',
  'LINE 綁定率各門市比較？',
  '一週中哪天消費最集中？',
  '客單價趨勢，哪個月份最高？',
  'VIP 會員的消費特徵？',
  '新客 vs 舊客的營收貢獻比？',
  '各消費等級的會員數？',
  '過去一年每月營收趨勢？',
  '回購率最高的商品？',
  '本月新增會員數？',
];

function AskPageInner() {
  const searchParams = useSearchParams();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const initialSent = useRef(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => { scrollToBottom(); }, [messages]);

  // Auto-send question from query param (from Questions page)
  useEffect(() => {
    const q = searchParams.get('q');
    if (q && !initialSent.current) {
      initialSent.current = true;
      sendQuestionDirect(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const sendQuestionDirect = (question: string) => {
    sendQuestion(question);
  };

  const sendQuestion = async (question: string) => {
    if (!question.trim() || loading) return;

    const userMsg: ChatMessage = { role: 'user', content: question.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      // Build context from recent messages, filtering out empty content
      const context = messages.slice(-6)
        .filter(m => m.content && m.content.trim())
        .map(m => m.role === 'user' ? `問：${m.content}` : `答：${m.content}`);

      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: question.trim(), context }),
      });

      const json = await res.json();

      if (json.data) {
        const assistantMsg: ChatMessage = {
          role: 'assistant',
          content: json.data.answer,
          chart_type: json.data.chart_type,
          chart_data: json.data.chart_data,
          insights: json.data.insights,
          sql: json.data.sql,
          query_time_ms: json.data.query_time_ms,
          error: !!json.data.error,
        };
        setMessages(prev => [...prev, assistantMsg]);
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: json.error || '查詢失敗，請重試',
          error: true,
        }]);
      }
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '網路錯誤，請重試',
        error: true,
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendQuestion(input);
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="px-5 pt-12 pb-3" style={{ background: 'var(--color-bg-primary)' }}>
        <h1 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
          🐷 提問
        </h1>
        <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
          用中文問任何關於營收、會員、商品的問題
        </p>
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto px-4 pb-4" style={{ paddingBottom: '140px' }}>
        {/* Empty state with suggestion chips */}
        {messages.length === 0 && (
          <div className="mt-4">
            <p className="text-xs mb-3" style={{ color: 'var(--color-text-muted)' }}>試試這些問題：</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTION_CHIPS.map((chip) => (
                <button
                  key={chip}
                  onClick={() => sendQuestion(chip)}
                  className="px-3 py-2 rounded-xl text-xs transition-opacity active:opacity-70"
                  style={{
                    background: 'var(--color-bg-card)',
                    color: 'var(--color-text-secondary)',
                    border: '1px solid var(--color-bg-card-alt)',
                  }}
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        {messages.map((msg, i) => (
          <div key={i} className={`mt-4 ${msg.role === 'user' ? 'flex justify-end' : ''}`}>
            {msg.role === 'user' ? (
              <div
                className="max-w-[85%] px-4 py-2.5 rounded-2xl rounded-br-md text-sm"
                style={{ background: 'var(--color-accent)', color: '#fff' }}
              >
                {msg.content}
              </div>
            ) : (
              <div className="space-y-3">
                {/* Answer text */}
                <div
                  className="px-4 py-3 rounded-2xl rounded-bl-md text-sm"
                  style={{
                    background: 'var(--color-bg-card)',
                    color: msg.error ? 'var(--color-negative)' : 'var(--color-text-primary)',
                  }}
                >
                  {msg.content}
                </div>

                {/* Chart */}
                {msg.chart_type && msg.chart_data && msg.chart_data.length > 0 && (
                  <div className="rounded-2xl p-3 overflow-hidden" style={{ background: 'var(--color-bg-card)' }}>
                    <AskChart type={msg.chart_type} data={msg.chart_data} />
                  </div>
                )}

                {/* Insights */}
                {msg.insights && msg.insights.length > 0 && (
                  <div className="rounded-2xl px-4 py-3" style={{ background: 'var(--color-bg-card)' }}>
                    <p className="text-xs font-medium mb-2" style={{ color: 'var(--color-warning)' }}>💡 AI 洞察</p>
                    <div className="space-y-1.5">
                      {msg.insights.map((insight, j) => (
                        <p key={j} className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                          {insight}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {/* SQL (collapsible) */}
                {msg.sql && <SqlCollapsible sql={msg.sql} timeMs={msg.query_time_ms} />}
              </div>
            )}
          </div>
        ))}

        {/* Loading indicator */}
        {loading && (
          <div className="mt-4 flex items-center gap-2 px-4 py-3 rounded-2xl rounded-bl-md w-fit"
            style={{ background: 'var(--color-bg-card)' }}>
            <div className="flex gap-1">
              <div className="w-2 h-2 rounded-full animate-bounce" style={{ background: 'var(--color-accent)', animationDelay: '0ms' }} />
              <div className="w-2 h-2 rounded-full animate-bounce" style={{ background: 'var(--color-accent)', animationDelay: '150ms' }} />
              <div className="w-2 h-2 rounded-full animate-bounce" style={{ background: 'var(--color-accent)', animationDelay: '300ms' }} />
            </div>
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>分析中...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input bar - fixed at bottom */}
      <div className="fixed left-0 right-0 px-4 pb-2" style={{ bottom: '64px', background: 'var(--color-bg-primary)' }}>
        {/* Quick chips when there are messages */}
        {messages.length > 0 && (
          <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-2">
            {SUGGESTION_CHIPS.slice(0, 5).map((chip) => (
              <button
                key={chip}
                onClick={() => sendQuestion(chip)}
                className="flex-shrink-0 px-2.5 py-1.5 rounded-lg text-[11px] transition-opacity active:opacity-70"
                style={{
                  background: 'var(--color-bg-card)',
                  color: 'var(--color-text-muted)',
                }}
                disabled={loading}
              >
                {chip.length > 12 ? chip.slice(0, 12) + '...' : chip}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="輸入問題..."
            disabled={loading}
            className="flex-1 h-11 px-4 rounded-xl text-sm outline-none"
            style={{
              background: 'var(--color-bg-card)',
              color: 'var(--color-text-primary)',
              border: '1px solid var(--color-bg-card-alt)',
            }}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="h-11 px-4 rounded-xl text-sm font-medium transition-opacity disabled:opacity-30"
            style={{ background: 'var(--color-accent)', color: '#fff' }}
          >
            送出
          </button>
        </form>
      </div>

      <BottomNav active="ask" />
    </div>
  );
}

export default function AskPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-[3px] rounded-full animate-spin"
          style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }} />
      </div>
    }>
      <AskPageInner />
    </Suspense>
  );
}

function SqlCollapsible({ sql, timeMs }: { sql: string; timeMs?: number }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--color-bg-card)' }}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-2 text-xs"
        style={{ color: 'var(--color-text-muted)' }}
      >
        <span>🔍 SQL 查詢{timeMs ? ` (${timeMs}ms)` : ''}</span>
        <span>{open ? '收起' : '展開'}</span>
      </button>
      {open && (
        <pre className="px-4 pb-3 text-[11px] leading-relaxed overflow-x-auto hide-scrollbar whitespace-pre-wrap"
          style={{ color: 'var(--color-text-secondary)' }}>
          {sql}
        </pre>
      )}
    </div>
  );
}
