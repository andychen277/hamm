'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import BottomNav from '@/components/BottomNav';

const STORES = ['台南', '高雄', '台中', '台北', '美術'];
const ORDER_TYPES = ['現貨', '組裝', '客訂'];

interface ProductItem {
  product_id: string;
  product_name: string;
  price: number;
  quantity: number;
}

interface Suggestion {
  product_id: string;
  product_name: string;
}

interface StaffMember {
  id: number;
  name: string;
  store: string;
  telegram_chat_id: string | null;
  telegram_user_id: string | null;
}

export default function CreateOrderPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [store, setStore] = useState('台南');
  const [phone, setPhone] = useState('');
  const [memberName, setMemberName] = useState('');
  const [memberId, setMemberId] = useState('');
  const [orderType, setOrderType] = useState('客訂');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [prepay_cash, setPrepay_cash] = useState('');
  const [prepay_card, setPrepay_card] = useState('');
  const [prepay_transfer, setPrepay_transfer] = useState('');
  const [prepay_remit, setPrepay_remit] = useState('');
  const [staffName, setStaffName] = useState('');

  // Product multi-select state
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searching, setSearching] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Manual input state
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualPrice, setManualPrice] = useState('');
  const [manualQty, setManualQty] = useState('1');

  // CC state
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [ccList, setCcList] = useState<string[]>([]);
  const [showCcPicker, setShowCcPicker] = useState(false);

  // Staff selection for opener
  const [showStaffPicker, setShowStaffPicker] = useState(false);
  const [manualStaffInput, setManualStaffInput] = useState(false);
  const [currentUserName, setCurrentUserName] = useState('');

  // Click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Get user info from token and fetch staff list
  useEffect(() => {
    // Parse token to get current user
    const token = document.cookie
      .split('; ')
      .find(row => row.startsWith('hamm_token='))
      ?.split('=')[1];

    let userName = '';
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.name) {
          userName = payload.name;
          setCurrentUserName(userName);
          setStaffName(userName); // Default to current user
        }
        if (payload.store) {
          setStore(payload.store);
        }
      } catch {
        // ignore
      }
    }

    // Fetch staff list
    fetch('/api/staff')
      .then(res => res.json())
      .then(json => {
        if (json.success) {
          // Sort: current user first, then by store and name
          const sorted = [...json.data].sort((a: StaffMember, b: StaffMember) => {
            if (a.name === userName) return -1;
            if (b.name === userName) return 1;
            return (a.store || '').localeCompare(b.store || '') || a.name.localeCompare(b.name);
          });
          setStaffList(sorted);
        }
      })
      .catch(() => {});
  }, []);

  // Staff with Telegram for CC notifications
  const ccAvailableStaff = staffList.filter((s: StaffMember) => s.telegram_chat_id);

  const toggleCc = (name: string) => {
    setCcList(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    );
  };

  const lookupMember = async () => {
    if (!phone || phone.length < 10) {
      setError('請輸入完整手機號碼');
      return;
    }

    setLookingUp(true);
    setError(null);

    try {
      const res = await fetch(`/api/erp/member?phone=${encodeURIComponent(phone)}&store=${encodeURIComponent(store)}`);
      const json = await res.json();

      if (json.success && json.data) {
        setMemberName(json.data.name);
        setMemberId(json.data.id);
      } else {
        setError('查無此會員，請手動輸入姓名');
      }
    } catch {
      setError('會員查詢失敗');
    } finally {
      setLookingUp(false);
    }
  };

  // Search products with debounce
  const searchProducts = async (keyword: string) => {
    if (keyword.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setSearching(true);
    try {
      const res = await fetch(`/api/reports/inventory/suggest?q=${encodeURIComponent(keyword)}`);
      const json = await res.json();
      if (json.success && json.suggestions) {
        setSuggestions(json.suggestions);
        setShowSuggestions(true);
      }
    } catch {
      // ignore
    } finally {
      setSearching(false);
    }
  };

  const handleSearchChange = (value: string) => {
    setProductSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchProducts(value), 300);
  };

  // Add product to list
  const addProduct = async (suggestion: Suggestion) => {
    // Check if already added
    if (products.some(p => p.product_id === suggestion.product_id)) {
      setProductSearch('');
      setShowSuggestions(false);
      return;
    }

    // Fetch price from inventory
    try {
      const res = await fetch(`/api/reports/inventory?q=${encodeURIComponent(suggestion.product_id)}`);
      const json = await res.json();
      const item = json.data?.[0];

      setProducts(prev => [...prev, {
        product_id: suggestion.product_id,
        product_name: suggestion.product_name,
        price: item?.price || 0,
        quantity: 1,
      }]);
    } catch {
      // Add without price
      setProducts(prev => [...prev, {
        product_id: suggestion.product_id,
        product_name: suggestion.product_name,
        price: 0,
        quantity: 1,
      }]);
    }

    setProductSearch('');
    setShowSuggestions(false);
  };

  // Update product quantity
  const updateQuantity = (index: number, qty: number) => {
    if (qty < 1) return;
    setProducts(prev => prev.map((p, i) => i === index ? { ...p, quantity: qty } : p));
  };

  // Update product price
  const updatePrice = (index: number, price: number) => {
    setProducts(prev => prev.map((p, i) => i === index ? { ...p, price } : p));
  };

  // Remove product
  const removeProduct = (index: number) => {
    setProducts(prev => prev.filter((_, i) => i !== index));
  };

  // Add manual product
  const addManualProduct = () => {
    if (!manualName.trim()) return;

    setProducts(prev => [...prev, {
      product_id: `manual-${Date.now()}`,
      product_name: manualName.trim(),
      price: Number(manualPrice) || 0,
      quantity: Number(manualQty) || 1,
    }]);

    setManualName('');
    setManualPrice('');
    setManualQty('1');
    setShowManualInput(false);
  };

  // Calculate totals
  const totalPrice = products.reduce((sum, p) => sum + (p.price * p.quantity), 0);
  const totalPrepay = (Number(prepay_cash) || 0) + (Number(prepay_card) || 0) +
    (Number(prepay_transfer) || 0) + (Number(prepay_remit) || 0);
  const balance = totalPrice - totalPrepay;

  // Build product description for ERP
  const buildProductDesc = () => {
    return products.map(p => `${p.product_name} x${p.quantity}`).join(', ');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!phone || !memberName) {
      setError('請填寫客戶資料');
      return;
    }

    if (products.length === 0) {
      setError('請至少加入一項商品');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/erp/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone,
          memberName,
          memberId,
          productDesc: buildProductDesc(),
          price: totalPrice,
          orderType,
          deliveryDate: deliveryDate || undefined,
          prepay_cash: Number(prepay_cash) || 0,
          prepay_card: Number(prepay_card) || 0,
          prepay_transfer: Number(prepay_transfer) || 0,
          prepay_remit: Number(prepay_remit) || 0,
          store,
          staffName: staffName || undefined,
          ccList: ccList.length > 0 ? ccList : undefined,
        }),
      });

      const json = await res.json();

      if (json.success) {
        setSuccess(`客訂單 ${json.data.orderNumber} 建立成功！`);
        // Clear form
        setPhone('');
        setMemberName('');
        setMemberId('');
        setProducts([]);
        setPrepay_cash('');
        setPrepay_card('');
        setPrepay_transfer('');
        setPrepay_remit('');
      } else {
        setError(json.error || '建立失敗');
      }
    } catch {
      setError('建立失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pb-24 min-h-screen">
      {/* Header */}
      <div className="px-5 pt-12 pb-3 flex items-center gap-3"
        style={{ paddingTop: 'max(3rem, env(safe-area-inset-top, 3rem))' }}>
        <button onClick={() => router.back()} className="text-xl">←</button>
        <h1 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
          📝 新增客訂單
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="px-5 space-y-4">
        {/* Success/Error Messages */}
        {success && (
          <div className="p-3 rounded-xl text-sm" style={{ background: 'var(--color-positive)', color: '#fff' }}>
            ✓ {success}
          </div>
        )}
        {error && (
          <div className="p-3 rounded-xl text-sm" style={{ background: 'var(--color-negative)', color: '#fff' }}>
            ✗ {error}
          </div>
        )}

        {/* Store Selection */}
        <div className="rounded-2xl p-4" style={{ background: 'var(--color-bg-card)' }}>
          <label className="text-xs font-medium mb-2 block" style={{ color: 'var(--color-text-muted)' }}>
            門市 *
          </label>
          <div className="flex flex-wrap gap-2">
            {STORES.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setStore(s)}
                className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                style={{
                  background: store === s ? 'var(--color-accent)' : 'var(--color-bg-card-alt)',
                  color: store === s ? '#fff' : 'var(--color-text-primary)',
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Customer Info */}
        <div className="rounded-2xl p-4" style={{ background: 'var(--color-bg-card)' }}>
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>
            客戶資料
          </h3>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--color-text-muted)' }}>
                手機號碼 *
              </label>
              <div className="flex gap-2">
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="0912345678"
                  className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background: 'var(--color-bg-card-alt)', color: 'var(--color-text-primary)' }}
                />
                <button
                  type="button"
                  onClick={lookupMember}
                  disabled={lookingUp}
                  className="px-3 py-2 rounded-lg text-sm font-medium"
                  style={{ background: 'var(--color-accent)', color: '#fff' }}
                >
                  {lookingUp ? '查詢中...' : '查會員'}
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--color-text-muted)' }}>
                客戶姓名 *
              </label>
              <input
                type="text"
                value={memberName}
                onChange={e => setMemberName(e.target.value)}
                placeholder="輸入姓名"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ background: 'var(--color-bg-card-alt)', color: 'var(--color-text-primary)' }}
              />
            </div>
          </div>
        </div>

        {/* Product Search & List */}
        <div className="rounded-2xl p-4" style={{ background: 'var(--color-bg-card)' }}>
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>
            商品資料
          </h3>

          {/* Product Search */}
          <div ref={searchRef} className="relative mb-3">
            <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--color-text-muted)' }}>
              搜尋商品
            </label>
            <input
              type="text"
              value={productSearch}
              onChange={e => handleSearchChange(e.target.value)}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              placeholder="輸入商品名稱搜尋..."
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ background: 'var(--color-bg-card-alt)', color: 'var(--color-text-primary)' }}
            />
            {searching && (
              <div className="absolute right-3 top-8 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                搜尋中...
              </div>
            )}

            {/* Suggestions dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div
                className="absolute z-10 w-full mt-1 rounded-lg shadow-lg max-h-48 overflow-y-auto"
                style={{ background: 'var(--color-bg-card-alt)' }}
              >
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => addProduct(s)}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-opacity-80 transition-colors"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    <div className="truncate">{s.product_name}</div>
                    <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{s.product_id}</div>
                  </button>
                ))}
              </div>
            )}

            {/* Manual input toggle */}
            <button
              type="button"
              onClick={() => setShowManualInput(!showManualInput)}
              className="text-xs underline mt-2"
              style={{ color: 'var(--color-accent)' }}
            >
              {showManualInput ? '取消手動輸入' : '+ 手動新增商品'}
            </button>
          </div>

          {/* Manual input form */}
          {showManualInput && (
            <div className="p-3 rounded-lg" style={{ background: 'var(--color-bg-card-alt)' }}>
              <div className="space-y-2">
                <input
                  type="text"
                  value={manualName}
                  onChange={e => setManualName(e.target.value)}
                  placeholder="商品名稱"
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background: 'var(--color-bg-card)', color: 'var(--color-text-primary)' }}
                />
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={manualPrice}
                    onChange={e => setManualPrice(e.target.value)}
                    placeholder="單價"
                    className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
                    style={{ background: 'var(--color-bg-card)', color: 'var(--color-text-primary)' }}
                  />
                  <input
                    type="number"
                    value={manualQty}
                    onChange={e => setManualQty(e.target.value)}
                    placeholder="數量"
                    className="w-20 px-3 py-2 rounded-lg text-sm outline-none"
                    style={{ background: 'var(--color-bg-card)', color: 'var(--color-text-primary)' }}
                  />
                </div>
                <button
                  type="button"
                  onClick={addManualProduct}
                  className="w-full py-2 rounded-lg text-sm font-medium"
                  style={{ background: 'var(--color-positive)', color: '#fff' }}
                >
                  加入商品
                </button>
              </div>
            </div>
          )}

          {/* Selected Products List */}
          {products.length > 0 ? (
            <div className="space-y-2">
              {products.map((p, i) => (
                <div
                  key={p.product_id}
                  className="p-3 rounded-lg"
                  style={{ background: 'var(--color-bg-card-alt)' }}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="text-sm flex-1" style={{ color: 'var(--color-text-primary)' }}>
                      {p.product_name}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeProduct(i)}
                      className="text-xs px-2 py-1 rounded"
                      style={{ color: 'var(--color-negative)' }}
                    >
                      刪除
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>單價:</span>
                      <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>$</span>
                      <input
                        type="number"
                        value={p.price || ''}
                        onChange={e => updatePrice(i, Number(e.target.value) || 0)}
                        placeholder="輸入價格"
                        className="w-24 px-2 py-1.5 rounded-lg text-sm outline-none border"
                        style={{
                          background: 'var(--color-bg-card)',
                          color: 'var(--color-text-primary)',
                          borderColor: 'var(--color-accent)',
                        }}
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>數量:</span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(i, p.quantity - 1)}
                        className="w-6 h-6 rounded flex items-center justify-center"
                        style={{ background: 'var(--color-bg-card)' }}
                      >
                        -
                      </button>
                      <span className="w-8 text-center text-sm" style={{ color: 'var(--color-text-primary)' }}>
                        {p.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(i, p.quantity + 1)}
                        className="w-6 h-6 rounded flex items-center justify-center"
                        style={{ background: 'var(--color-bg-card)' }}
                      >
                        +
                      </button>
                    </div>
                    <span className="text-sm font-medium ml-auto" style={{ color: 'var(--color-accent)' }}>
                      ${(p.price * p.quantity).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}

              {/* Total */}
              <div className="pt-2 border-t flex justify-between items-center"
                style={{ borderColor: 'var(--color-bg-card-alt)' }}>
                <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                  商品總計
                </span>
                <span className="text-lg font-bold" style={{ color: 'var(--color-accent)' }}>
                  ${totalPrice.toLocaleString()}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-center py-4" style={{ color: 'var(--color-text-muted)' }}>
              尚未加入商品
            </p>
          )}

          {/* Order Type & Delivery Date */}
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--color-text-muted)' }}>
                訂單類型
              </label>
              <select
                value={orderType}
                onChange={e => setOrderType(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ background: 'var(--color-bg-card-alt)', color: 'var(--color-text-primary)' }}
              >
                {ORDER_TYPES.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--color-text-muted)' }}>
                預計交期
              </label>
              <input
                type="date"
                value={deliveryDate}
                onChange={e => setDeliveryDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ background: 'var(--color-bg-card-alt)', color: 'var(--color-text-primary)' }}
              />
            </div>
          </div>
        </div>

        {/* Prepayment */}
        <div className="rounded-2xl p-4" style={{ background: 'var(--color-bg-card)' }}>
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>
            預付款項
          </h3>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--color-text-muted)' }}>
                💵 現金
              </label>
              <input
                type="number"
                value={prepay_cash}
                onChange={e => setPrepay_cash(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ background: 'var(--color-bg-card-alt)', color: 'var(--color-text-primary)' }}
              />
            </div>

            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--color-text-muted)' }}>
                💳 刷卡
              </label>
              <input
                type="number"
                value={prepay_card}
                onChange={e => setPrepay_card(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ background: 'var(--color-bg-card-alt)', color: 'var(--color-text-primary)' }}
              />
            </div>

            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--color-text-muted)' }}>
                📱 轉帳
              </label>
              <input
                type="number"
                value={prepay_transfer}
                onChange={e => setPrepay_transfer(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ background: 'var(--color-bg-card-alt)', color: 'var(--color-text-primary)' }}
              />
            </div>

            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--color-text-muted)' }}>
                🏦 匯款
              </label>
              <input
                type="number"
                value={prepay_remit}
                onChange={e => setPrepay_remit(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ background: 'var(--color-bg-card-alt)', color: 'var(--color-text-primary)' }}
              />
            </div>
          </div>

          {/* Summary */}
          <div className="mt-3 pt-3 border-t flex justify-between text-sm"
            style={{ borderColor: 'var(--color-bg-card-alt)' }}>
            <span style={{ color: 'var(--color-text-muted)' }}>已付: ${totalPrepay.toLocaleString()}</span>
            <span style={{ color: balance > 0 ? 'var(--color-warning)' : 'var(--color-positive)' }}>
              尾款: ${balance.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Staff Name (optional) */}
        <div className="rounded-2xl p-4" style={{ background: 'var(--color-bg-card)' }}>
          <label className="text-xs font-medium mb-2 block" style={{ color: 'var(--color-text-muted)' }}>
            開單人員（選填）
          </label>

          {/* Selected staff display */}
          {staffName && !manualStaffInput && (
            <div className="flex items-center gap-2 mb-3">
              <span
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm"
                style={{ background: 'var(--color-accent)', color: '#fff' }}
              >
                {staffName}
                <button type="button" onClick={() => setStaffName('')} className="ml-1 opacity-80 hover:opacity-100">×</button>
              </span>
            </div>
          )}

          {/* Manual input mode */}
          {manualStaffInput ? (
            <div className="space-y-2">
              <input
                type="text"
                value={staffName}
                onChange={e => setStaffName(e.target.value)}
                placeholder="輸入人員名稱"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ background: 'var(--color-bg-card-alt)', color: 'var(--color-text-primary)' }}
              />
              <button
                type="button"
                onClick={() => setManualStaffInput(false)}
                className="text-xs underline"
                style={{ color: 'var(--color-accent)' }}
              >
                從員工列表選擇
              </button>
            </div>
          ) : (
            <>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowStaffPicker(!showStaffPicker)}
                  className="flex-1 px-3 py-2 rounded-lg text-sm text-left"
                  style={{ background: 'var(--color-bg-card-alt)', color: staffName ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}
                >
                  {staffName || '選擇員工...'}
                </button>
                <button
                  type="button"
                  onClick={() => { setManualStaffInput(true); setStaffName(''); }}
                  className="px-3 py-2 rounded-lg text-xs"
                  style={{ background: 'var(--color-bg-card-alt)', color: 'var(--color-text-secondary)' }}
                >
                  手動輸入
                </button>
              </div>

              {/* Staff picker dropdown */}
              {showStaffPicker && staffList.length > 0 && (
                <div className="mt-2 p-2 rounded-lg max-h-48 overflow-y-auto" style={{ background: 'var(--color-bg-card-alt)' }}>
                  <div className="space-y-1">
                    {staffList.map(staff => (
                      <button
                        key={staff.id}
                        type="button"
                        onClick={() => { setStaffName(staff.name); setShowStaffPicker(false); }}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors hover:opacity-80"
                        style={{
                          background: staffName === staff.name ? 'var(--color-accent)' : 'var(--color-bg-card)',
                          color: staffName === staff.name ? '#fff' : 'var(--color-text-primary)',
                        }}
                      >
                        <span>{staff.name}</span>
                        <span className="text-xs opacity-70">{staff.store}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* CC Recipients */}
        <div className="rounded-2xl p-4" style={{ background: 'var(--color-bg-card)' }}>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
              📧 CC 副本通知（選填）
            </label>
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {ccList.length > 0 ? `已選 ${ccList.length} 人` : ''}
            </span>
          </div>

          {/* Selected CC tags */}
          {ccList.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {ccList.map(name => (
                <span
                  key={name}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs"
                  style={{ background: 'var(--color-bg-card-alt)', color: 'var(--color-text-primary)' }}
                >
                  {name}
                  <button type="button" onClick={() => toggleCc(name)} className="ml-1 opacity-60 hover:opacity-100">×</button>
                </span>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowCcPicker(!showCcPicker)}
            className="px-3 py-2 rounded-lg text-sm"
            style={{ background: 'var(--color-bg-card-alt)', color: 'var(--color-text-secondary)' }}
          >
            {showCcPicker ? '收起' : '選擇通知對象'}
          </button>

          {showCcPicker && ccAvailableStaff.length > 0 && (
            <div className="mt-3 p-3 rounded-lg max-h-48 overflow-y-auto" style={{ background: 'var(--color-bg-card-alt)' }}>
              <div className="space-y-2">
                {ccAvailableStaff.map(staff => (
                  <button
                    key={staff.id}
                    type="button"
                    onClick={() => toggleCc(staff.name)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors"
                    style={{
                      background: ccList.includes(staff.name) ? 'var(--color-accent)' : 'var(--color-bg-card)',
                      color: ccList.includes(staff.name) ? '#fff' : 'var(--color-text-primary)',
                    }}
                  >
                    <span>{staff.name}</span>
                    <span className="text-xs opacity-70">{staff.store}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {showCcPicker && ccAvailableStaff.length === 0 && (
            <div className="mt-3 p-3 rounded-lg text-sm" style={{ background: 'var(--color-bg-card-alt)', color: 'var(--color-text-muted)' }}>
              尚無員工設定 Telegram 通知
            </div>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-2xl text-base font-semibold transition-opacity disabled:opacity-50"
          style={{ background: 'var(--color-accent)', color: '#fff' }}
        >
          {loading ? '建立中...' : '建立客訂單'}
        </button>
      </form>

      <BottomNav active="reports" />
    </div>
  );
}
