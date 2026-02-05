'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import BottomNav from '@/components/BottomNav';

const STORES = ['台南', '高雄', '台中', '台北', '美術'];

interface PurchaseItem {
  product_name: string;
  product_id: string;
  transaction_date: string;
  store: string;
}

export default function CreateRepairPage() {
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
  const [repairDesc, setRepairDesc] = useState('');
  const [estimate, setEstimate] = useState('');
  const [prepayment, setPrepayment] = useState('');
  const [technician, setTechnician] = useState('');
  const [staffName, setStaffName] = useState('');

  // Purchase history state
  const [purchaseHistory, setPurchaseHistory] = useState<PurchaseItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Fetch purchase history from member transactions
  const fetchPurchaseHistory = async (memberPhone: string) => {
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/reports/members/${encodeURIComponent(memberPhone)}`);
      const json = await res.json();

      if (json.success && json.data?.transactions) {
        // Filter transactions with product_name and deduplicate
        const unique = new Map<string, PurchaseItem>();
        json.data.transactions
          .filter((t: { product_name?: string; transaction_type?: string }) =>
            t.product_name && t.transaction_type === '收銀'
          )
          .forEach((t: { product_name: string; product_id?: string; transaction_date: string; store: string }) => {
            if (!unique.has(t.product_name)) {
              unique.set(t.product_name, {
                product_name: t.product_name,
                product_id: t.product_id || '',
                transaction_date: t.transaction_date,
                store: t.store,
              });
            }
          });
        setPurchaseHistory(Array.from(unique.values()));
      } else {
        setPurchaseHistory([]);
      }
    } catch {
      setPurchaseHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  const lookupMember = async () => {
    if (!phone || phone.length < 10) {
      setError('請輸入完整手機號碼');
      return;
    }

    setLookingUp(true);
    setError(null);
    setPurchaseHistory([]);

    try {
      const res = await fetch(`/api/erp/member?phone=${encodeURIComponent(phone)}&store=${encodeURIComponent(store)}`);
      const json = await res.json();

      if (json.success && json.data) {
        setMemberName(json.data.name);
        setMemberId(json.data.id);
        // Also fetch purchase history
        fetchPurchaseHistory(phone);
      } else {
        setError('查無此會員，請手動輸入姓名');
        // Still try to fetch purchase history from local DB
        fetchPurchaseHistory(phone);
      }
    } catch {
      setError('會員查詢失敗');
    } finally {
      setLookingUp(false);
    }
  };

  // Add product to repair description
  const addToRepairDesc = (item: PurchaseItem) => {
    setRepairDesc(prev => prev ? `${prev}\n${item.product_name}` : item.product_name);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!phone || !memberName || !repairDesc) {
      setError('請填寫必要欄位');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/erp/repair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone,
          memberName,
          memberId,
          repairDesc,
          estimate: Number(estimate) || 0,
          prepayment: Number(prepayment) || 0,
          technician: technician || undefined,
          store,
          staffName: staffName || undefined,
        }),
      });

      const json = await res.json();

      if (json.success) {
        setSuccess(`維修單 ${json.data.repairNumber} 建立成功！`);
        // Clear form
        setPhone('');
        setMemberName('');
        setMemberId('');
        setRepairDesc('');
        setEstimate('');
        setPrepayment('');
        setTechnician('');
        setPurchaseHistory([]);
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
          🔧 新增維修單
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

        {/* Purchase History */}
        {(purchaseHistory.length > 0 || loadingHistory) && (
          <div className="rounded-2xl p-4" style={{ background: 'var(--color-bg-card)' }}>
            <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>
              📦 顧客購買紀錄
            </h3>
            <p className="text-xs mb-3" style={{ color: 'var(--color-text-muted)' }}>
              點擊商品可加入維修說明
            </p>

            {loadingHistory ? (
              <div className="flex items-center justify-center py-4">
                <div className="w-5 h-5 border-2 rounded-full animate-spin"
                  style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }} />
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {purchaseHistory.map((item, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => addToRepairDesc(item)}
                    className="w-full p-2 rounded-lg text-left transition-opacity hover:opacity-80"
                    style={{ background: 'var(--color-bg-card-alt)' }}
                  >
                    <div className="text-sm truncate" style={{ color: 'var(--color-text-primary)' }}>
                      {item.product_name}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        {item.transaction_date}
                      </span>
                      <span className="text-xs px-1.5 py-0.5 rounded"
                        style={{ background: 'var(--color-bg-card)', color: 'var(--color-text-muted)' }}>
                        {item.store}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Repair Info */}
        <div className="rounded-2xl p-4" style={{ background: 'var(--color-bg-card)' }}>
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>
            維修資料
          </h3>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--color-text-muted)' }}>
                維修說明 *
              </label>
              <textarea
                value={repairDesc}
                onChange={e => setRepairDesc(e.target.value)}
                placeholder="例：後輪破胎、煞車調整、變速器調整"
                rows={4}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none"
                style={{ background: 'var(--color-bg-card-alt)', color: 'var(--color-text-primary)' }}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--color-text-muted)' }}>
                  預估報價
                </label>
                <input
                  type="number"
                  value={estimate}
                  onChange={e => setEstimate(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background: 'var(--color-bg-card-alt)', color: 'var(--color-text-primary)' }}
                />
              </div>

              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--color-text-muted)' }}>
                  暫付款
                </label>
                <input
                  type="number"
                  value={prepayment}
                  onChange={e => setPrepayment(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background: 'var(--color-bg-card-alt)', color: 'var(--color-text-primary)' }}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--color-text-muted)' }}>
                技師（選填）
              </label>
              <input
                type="text"
                value={technician}
                onChange={e => setTechnician(e.target.value)}
                placeholder="留空則由系統指派"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ background: 'var(--color-bg-card-alt)', color: 'var(--color-text-primary)' }}
              />
            </div>
          </div>
        </div>

        {/* Staff Name (optional) */}
        <div className="rounded-2xl p-4" style={{ background: 'var(--color-bg-card)' }}>
          <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--color-text-muted)' }}>
            開單人員（選填）
          </label>
          <input
            type="text"
            value={staffName}
            onChange={e => setStaffName(e.target.value)}
            placeholder="留空則顯示 Hamm"
            className="w-full px-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: 'var(--color-bg-card-alt)', color: 'var(--color-text-primary)' }}
          />
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-2xl text-base font-semibold transition-opacity disabled:opacity-50"
          style={{ background: 'var(--color-accent)', color: '#fff' }}
        >
          {loading ? '建立中...' : '建立維修單'}
        </button>
      </form>

      <BottomNav active="reports" />
    </div>
  );
}
