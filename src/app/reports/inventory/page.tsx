'use client';

import { useState, useCallback, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import BottomNav from '@/components/BottomNav';
import Link from 'next/link';

interface InventoryItem {
  store: string;
  product_id: string;
  product_name: string;
  price: number;
  quantity: number;
  vendor_code: string;
  updated_at: string;
}

interface Suggestion {
  product_id: string;
  product_name: string;
}

const STORE_COLORS: Record<string, string> = {
  '台南': 'var(--color-store-tainan)',
  '高雄': 'var(--color-store-kaohsiung)',
  '台中': 'var(--color-store-taichung)',
  '台北': 'var(--color-store-taipei)',
  '美術': 'var(--color-store-meishu)',
};

function fmt$(n: number): string {
  if (n >= 10000) return '$' + (n / 10000).toFixed(1) + '萬';
  return '$' + n.toLocaleString();
}

function InventoryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Callback 模式參數
  const isCallback = searchParams.get('callback') === 'true';
  const callbackType = searchParams.get('callback_type') || 'inventory';
  const returnUrl = searchParams.get('return_url') || '/todo/create';

  const [search, setSearch] = useState('');
  const [store, setStore] = useState('all');
  const [results, setResults] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  // 自動完成相關
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Debounce 搜尋建議
  useEffect(() => {
    if (search.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/reports/inventory/suggest?q=${encodeURIComponent(search)}`);
        const json = await res.json();
        if (json.success && json.suggestions.length > 0) {
          setSuggestions(json.suggestions);
          setShowSuggestions(true);
          setSelectedIndex(-1);
        } else {
          setSuggestions([]);
          setShowSuggestions(false);
        }
      } catch {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  // 點擊外部關閉建議
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        inputRef.current &&
        !inputRef.current.contains(event.target as Node) &&
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = useCallback(async () => {
    setLoading(true);
    setSearched(true);
    setShowSuggestions(false);
    try {
      const params = new URLSearchParams({
        ...(search && { q: search }),
        ...(store !== 'all' && { store }),
      });
      const res = await fetch(`/api/reports/inventory?${params}`);
      const json = await res.json();
      if (json.success) setResults(json.data);
      else setResults([]);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [search, store]);

  const handleSuggestionClick = (suggestion: Suggestion) => {
    setSearch(suggestion.product_name);
    setShowSuggestions(false);
    setSuggestions([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) {
      if (e.key === 'Enter') handleSearch();
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : suggestions.length - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0) {
          handleSuggestionClick(suggestions[selectedIndex]);
        } else {
          handleSearch();
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        break;
    }
  };

  // Callback 模式：選擇商品
  const handleSelect = (item: InventoryItem) => {
    const data = {
      type: callbackType,
      product_id: item.product_id,
      product_name: item.product_name,
      store: item.store,
      price: item.price,
      quantity: item.quantity,
    };
    sessionStorage.setItem('callback_data', JSON.stringify(data));
    router.push(`${returnUrl}?callback_success=true`);
  };

  return (
    <div className="pb-20 min-h-screen">
      {/* Header */}
      <div className="px-5 pt-12 pb-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-xl">←</button>
        <h1 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
          📦 庫存查詢 {isCallback && <span className="text-sm font-normal">(選擇商品)</span>}
        </h1>
      </div>

      {/* Search Form */}
      <div className="px-5 space-y-3">
        {/* Product search with autocomplete */}
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            placeholder="搜尋商品名稱... (可用逗號分隔多關鍵字)"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            className="w-full h-11 px-4 rounded-xl text-sm outline-none"
            style={{
              background: 'var(--color-bg-card)',
              color: 'var(--color-text-primary)',
              border: '1px solid var(--color-bg-card-alt)',
            }}
          />

          {/* Suggestions dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div
              ref={suggestionsRef}
              className="absolute z-50 w-full mt-1 rounded-xl overflow-hidden shadow-lg"
              style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-bg-card-alt)' }}
            >
              {suggestions.map((suggestion, index) => (
                <button
                  key={suggestion.product_id}
                  className="w-full px-4 py-3 text-left transition-colors"
                  style={{
                    background: index === selectedIndex ? 'var(--color-bg-card-alt)' : 'transparent',
                    borderBottom: index < suggestions.length - 1 ? '1px solid var(--color-bg-card-alt)' : 'none',
                  }}
                  onClick={() => handleSuggestionClick(suggestion)}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <span className="text-sm block" style={{ color: 'var(--color-text-primary)' }}>
                    {suggestion.product_name}
                  </span>
                  <span className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                    {suggestion.product_id}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Store filter */}
        <select
          value={store}
          onChange={e => setStore(e.target.value)}
          className="w-full h-10 px-3 rounded-xl text-sm outline-none"
          style={{
            background: 'var(--color-bg-card)',
            color: 'var(--color-text-primary)',
            border: '1px solid var(--color-bg-card-alt)',
          }}
        >
          <option value="all">全部門市</option>
          <option value="台南">台南</option>
          <option value="高雄">高雄</option>
          <option value="台中">台中</option>
          <option value="台北">台北</option>
          <option value="美術">美術</option>
        </select>

        {/* Search button */}
        <button
          onClick={handleSearch}
          disabled={loading}
          className="w-full h-11 rounded-xl text-sm font-medium transition-opacity disabled:opacity-50"
          style={{ background: 'var(--color-accent)', color: '#fff' }}
        >
          {loading ? '查詢中...' : '查詢'}
        </button>
      </div>

      {/* Results */}
      <div className="px-5 mt-4">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-7 h-7 border-[3px] rounded-full animate-spin"
              style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }} />
          </div>
        ) : searched && results.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>無符合條件的商品</p>
          </div>
        ) : results.length > 0 && (
          <>
            <p className="text-xs mb-3" style={{ color: 'var(--color-text-muted)' }}>
              共 {results.length} 項商品
            </p>
            <div className="space-y-2">
              {results.map((item, i) => (
                <div
                  key={`${item.store}-${item.product_id}-${i}`}
                  className="rounded-xl p-3"
                  style={{ background: 'var(--color-bg-card)' }}
                >
                  {/* 商品資訊 - 可點擊查看詳情（非 callback 模式）或顯示資訊（callback 模式） */}
                  {isCallback ? (
                    <div>
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-sm font-medium flex-1 mr-2" style={{ color: 'var(--color-text-primary)' }}>
                          {item.product_name}
                        </span>
                        <span
                          className="text-[11px] px-2 py-0.5 rounded-full font-medium"
                          style={{ background: STORE_COLORS[item.store] || 'var(--color-accent)', color: '#fff' }}
                        >
                          {item.store}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>
                        <span>售價: {fmt$(item.price)}</span>
                        <span className="font-bold" style={{ color: 'var(--color-positive)' }}>
                          庫存: {item.quantity}
                        </span>
                      </div>
                      <div className="flex justify-between text-[11px] mt-1" style={{ color: 'var(--color-text-muted)' }}>
                        <span>{item.product_id}</span>
                        {item.vendor_code && <span>廠商: {item.vendor_code}</span>}
                      </div>
                      {/* 取貨按鈕 */}
                      <button
                        onClick={() => handleSelect(item)}
                        className="w-full mt-3 py-2 rounded-lg text-sm font-medium transition-opacity active:opacity-70"
                        style={{ background: 'var(--color-positive)', color: '#fff' }}
                      >
                        取貨 ({item.store})
                      </button>
                    </div>
                  ) : (
                    <Link href={`/reports/products/${encodeURIComponent(item.product_id)}`} className="block">
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-sm font-medium flex-1 mr-2" style={{ color: 'var(--color-text-primary)' }}>
                          {item.product_name}
                        </span>
                        <span
                          className="text-[11px] px-2 py-0.5 rounded-full font-medium"
                          style={{ background: STORE_COLORS[item.store] || 'var(--color-accent)', color: '#fff' }}
                        >
                          {item.store}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>
                        <span>售價: {fmt$(item.price)}</span>
                        <span className="font-bold" style={{ color: 'var(--color-positive)' }}>
                          庫存: {item.quantity}
                        </span>
                      </div>
                      <div className="flex justify-between text-[11px] mt-1" style={{ color: 'var(--color-text-muted)' }}>
                        <span>{item.product_id}</span>
                        {item.vendor_code && <span>廠商: {item.vendor_code}</span>}
                      </div>
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <BottomNav active="reports" />
    </div>
  );
}

export default function InventoryReportPage() {
  return (
    <Suspense fallback={
      <div className="pb-20 min-h-screen flex items-center justify-center">
        <div className="w-7 h-7 border-[3px] rounded-full animate-spin"
          style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }} />
      </div>
    }>
      <InventoryContent />
    </Suspense>
  );
}
