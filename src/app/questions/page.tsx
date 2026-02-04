'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import BottomNav from '@/components/BottomNav';

interface QuestionCategory {
  icon: string;
  title: string;
  questions: string[];
}

const CATEGORIES: QuestionCategory[] = [
  {
    icon: '📋',
    title: '經營者日常',
    questions: [
      '今天五間店各自的營收？',
      '這週 vs 上週的營收比較？',
      '目前待處理的客訂和維修有多少？',
      '今天有幾位新會員加入？',
    ],
  },
  {
    icon: '💰',
    title: '銷售深度分析',
    questions: [
      '各門市的營收佔比？',
      '過去一年每月營收的季節性趨勢？',
      '週末 vs 平日的消費行為差異？',
      '客單價趨勢，哪個月份最高？',
    ],
  },
  {
    icon: '👥',
    title: '會員經營洞察',
    questions: [
      '哪些會員超過半年沒消費了？',
      '新客 vs 舊客的營收貢獻比？',
      '各消費等級的會員數和消費佔比？',
      '會員從首購到二次回購的平均天數？',
      '跨店消費的會員比例和特徵？',
    ],
  },
  {
    icon: '📦',
    title: '商品策略',
    questions: [
      '最近 30 天最暢銷的前 10 名商品？',
      '經常被一起購買的商品組合？',
      '各價格帶的銷售分佈？',
      '回購率最高的商品類別是什麼？',
    ],
  },
  {
    icon: '🎯',
    title: '行銷靈感',
    questions: [
      '哪些沉睡會員最有機會被喚醒？',
      '消費金額前 10% 的 VIP 會員名單？',
      'LINE 已綁定但從未消費的會員？',
      '一週中哪天消費最集中？',
    ],
  },
  {
    icon: '📱',
    title: '數位化追蹤',
    questions: [
      'QR Code 掃碼次數和熱門掃碼類型？',
      'LINE 綁定率各門市比較？',
      'VIP 會員的消費特徵？',
      '本月新增會員數？',
    ],
  },
];

export default function QuestionsPage() {
  const router = useRouter();
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('hamm_fav_questions');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    }
    return new Set();
  });

  const toggleFavorite = (q: string) => {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(q)) next.delete(q);
      else next.add(q);
      localStorage.setItem('hamm_fav_questions', JSON.stringify([...next]));
      return next;
    });
  };

  const askQuestion = (q: string) => {
    // Navigate to /ask with the question as a query param
    router.push(`/ask?q=${encodeURIComponent(q)}`);
  };

  const favList = [...favorites];

  return (
    <div className="pb-20 min-h-screen">
      {/* Header */}
      <div className="px-5 pt-12 pb-4">
        <h1 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>💡 問題靈感庫</h1>
        <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>點擊問題直接查詢，⭐ 收藏常用問題</p>
      </div>

      <div className="px-5">
        {/* Favorites */}
        {favList.length > 0 && (
          <div className="mb-5">
            <h2 className="text-[13px] font-semibold mb-2" style={{ color: 'var(--color-warning)' }}>⭐ 我的收藏</h2>
            <div className="space-y-2">
              {favList.map(q => (
                <div key={q} className="flex items-center gap-2">
                  <button
                    onClick={() => askQuestion(q)}
                    className="flex-1 text-left px-3 py-2.5 rounded-xl text-sm transition-opacity active:opacity-70"
                    style={{ background: 'var(--color-bg-card)', color: 'var(--color-text-secondary)' }}
                  >
                    {q}
                  </button>
                  <button onClick={() => toggleFavorite(q)} className="text-base flex-shrink-0 p-1">⭐</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Categories */}
        {CATEGORIES.map(cat => (
          <div key={cat.title} className="mb-5">
            <h2 className="text-[13px] font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>
              {cat.icon} {cat.title}
            </h2>
            <div className="space-y-2">
              {cat.questions.map(q => (
                <div key={q} className="flex items-center gap-2">
                  <button
                    onClick={() => askQuestion(q)}
                    className="flex-1 text-left px-3 py-2.5 rounded-xl text-sm transition-opacity active:opacity-70"
                    style={{ background: 'var(--color-bg-card)', color: 'var(--color-text-secondary)' }}
                  >
                    {q}
                  </button>
                  <button
                    onClick={() => toggleFavorite(q)}
                    className="text-base flex-shrink-0 p-1 opacity-30 hover:opacity-100 transition-opacity"
                  >
                    {favorites.has(q) ? '⭐' : '☆'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <BottomNav active="questions" />
    </div>
  );
}
