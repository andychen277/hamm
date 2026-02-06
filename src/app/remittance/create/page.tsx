'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import BottomNav from '@/components/BottomNav';

const STORES = ['台南', '崇明', '高雄', '美術', '台中', '台北', '配貨'];

interface StaffMember {
  id: number;
  name: string;
  store: string;
  telegram_chat_id: string | null;
}

export default function CreateRemittancePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<{ no: string; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [store, setStore] = useState('台南');
  const [creator, setCreator] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [amount, setAmount] = useState('');
  const [requestDate, setRequestDate] = useState(new Date().toISOString().split('T')[0]);
  const [arrivalStore, setArrivalStore] = useState('台南');
  const [description, setDescription] = useState('');
  const [photoData, setPhotoData] = useState<string | null>(null);
  const [photoCompressing, setPhotoCompressing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // CC state
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [allStaffList, setAllStaffList] = useState<StaffMember[]>([]);
  const [ccList, setCcList] = useState<string[]>([]);
  const [showCcPicker, setShowCcPicker] = useState(false);

  // Creator mode state
  const [creatorMode, setCreatorMode] = useState<'select' | 'manual'>('select');
  const [showCreatorPicker, setShowCreatorPicker] = useState(false);

  // Check if creator is in bound staff list
  const creatorBound = staffList.some(s => s.name === creator);

  // Get user info from token on mount
  useEffect(() => {
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
          setCreator(userName);
        }
        if (payload.store) {
          setStore(payload.store);
          setArrivalStore(payload.store);
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
          setAllStaffList(sorted);
          // Only show staff with Telegram ID for CC
          setStaffList(sorted.filter((s: StaffMember) => s.telegram_chat_id));
        }
      })
      .catch(() => {});
  }, []);

  const toggleCc = (name: string) => {
    setCcList(prev =>
      prev.includes(name)
        ? prev.filter(n => n !== name)
        : [...prev, name]
    );
  };

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1200;
          let width = img.width;
          let height = img.height;
          if (width > MAX_WIDTH) {
            height = (height * MAX_WIDTH) / width;
            width = MAX_WIDTH;
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) { reject(new Error('Canvas error')); return; }
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
        img.onerror = () => reject(new Error('Image load error'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('File read error'));
      reader.readAsDataURL(file);
    });
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoCompressing(true);
    try {
      const compressed = await compressImage(file);
      setPhotoData(compressed);
    } catch {
      setError('照片處理失敗，請重試');
    } finally {
      setPhotoCompressing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!supplierName || !amount) {
      setError('請填寫廠商名稱和金額');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/erp/remittance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store,
          creator: creator || 'Hamm',
          supplierName,
          amount: Number(amount),
          requestDate,
          arrivalStore,
          description,
          ccList,
          photoData,
        }),
      });

      const json = await res.json();

      if (json.success) {
        setSuccess({
          no: json.data.remittanceNo,
          message: json.data.message,
        });
        // Clear form
        setSupplierName('');
        setAmount('');
        setDescription('');
        setPhotoData(null);
        setCcList([]);
      } else {
        setError(json.error || '建立失敗');
      }
    } catch {
      setError('建立失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="pb-24 min-h-screen">
      {/* Header */}
      <div className="px-5 pt-12 pb-3 flex items-center gap-3"
        style={{ paddingTop: 'max(3rem, env(safe-area-inset-top, 3rem))' }}>
        <button onClick={() => router.back()} className="text-xl">←</button>
        <h1 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
          💰 新增匯款需求
        </h1>
      </div>

      {/* Success Message */}
      {success && (
        <div className="mx-5 mb-4 p-4 rounded-2xl" style={{ background: 'var(--color-positive)' }}>
          <div className="text-white">
            <div className="font-semibold mb-2">✓ {success.message}</div>
            <div className="flex items-center gap-2 mt-3">
              <span className="text-sm opacity-90">匯款單號：</span>
              <span className="font-mono font-bold text-lg">{success.no}</span>
              <button
                onClick={() => copyToClipboard(success.no)}
                className="ml-2 px-2 py-1 rounded text-xs"
                style={{ background: 'rgba(255,255,255,0.2)' }}
              >
                複製
              </button>
            </div>
            <p className="text-sm mt-3 opacity-90">
              請在銀行匯款時附註此單號，方便會計對帳。
            </p>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mx-5 mb-4 p-3 rounded-xl text-sm" style={{ background: 'var(--color-negative)', color: '#fff' }}>
          ✗ {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="px-5 space-y-4">
        {/* Store Selection */}
        <div className="rounded-2xl p-4" style={{ background: 'var(--color-bg-card)' }}>
          <label className="text-xs font-medium mb-2 block" style={{ color: 'var(--color-text-muted)' }}>
            匯款門市 *
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

        {/* Creator */}
        <div className="rounded-2xl p-4" style={{ background: 'var(--color-bg-card)' }}>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
              建檔人員 *
            </label>
            <button
              type="button"
              onClick={() => setCreatorMode(creatorMode === 'select' ? 'manual' : 'select')}
              className="text-xs px-2 py-0.5 rounded"
              style={{ background: 'var(--color-bg-card-alt)', color: 'var(--color-text-muted)' }}
            >
              {creatorMode === 'select' ? '手動輸入' : '從清單選'}
            </button>
          </div>

          {creatorMode === 'manual' ? (
            // Manual input mode
            <div>
              <input
                type="text"
                value={creator}
                onChange={e => setCreator(e.target.value)}
                placeholder="輸入建檔人員姓名"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ background: 'var(--color-bg-card-alt)', color: 'var(--color-text-primary)' }}
              />
              {creator && (
                <p className="text-xs mt-1" style={{ color: creatorBound ? 'var(--color-positive)' : 'var(--color-warning)' }}>
                  {creatorBound ? '✓ 已綁定 Telegram，會收到通知' : '⚠ 未綁定 Telegram，不會收到通知'}
                </p>
              )}
            </div>
          ) : (
            // Select mode
            <div>
              {/* Selected creator display */}
              {creator && (
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm"
                    style={{ background: 'var(--color-accent)', color: '#fff' }}
                  >
                    {creator}
                    {creatorBound && <span className="text-xs opacity-70">✓</span>}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCreator('')}
                    className="text-xs"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    清除
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => setShowCreatorPicker(!showCreatorPicker)}
                className="px-3 py-2 rounded-lg text-sm"
                style={{ background: 'var(--color-bg-card-alt)', color: 'var(--color-text-secondary)' }}
              >
                {showCreatorPicker ? '收起' : creator ? '更換人員' : '選擇人員'}
              </button>

              {/* Staff Picker for Creator */}
              {showCreatorPicker && staffList.length > 0 && (
                <div className="mt-3 p-3 rounded-lg max-h-48 overflow-y-auto" style={{ background: 'var(--color-bg-card-alt)' }}>
                  <div className="space-y-2">
                    {staffList.map(staff => (
                      <button
                        key={staff.id}
                        type="button"
                        onClick={() => {
                          setCreator(staff.name);
                          setShowCreatorPicker(false);
                        }}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors"
                        style={{
                          background: creator === staff.name ? 'var(--color-accent)' : 'var(--color-bg-card)',
                          color: creator === staff.name ? '#fff' : 'var(--color-text-primary)',
                        }}
                      >
                        <span>{staff.name}</span>
                        <span className="text-xs opacity-70">{staff.store}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {showCreatorPicker && staffList.length === 0 && (
                <p className="mt-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  沒有已綁定 Telegram 的員工，請切換到手動輸入
                </p>
              )}
            </div>
          )}
        </div>

        {/* Supplier & Amount */}
        <div className="rounded-2xl p-4" style={{ background: 'var(--color-bg-card)' }}>
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>
            匯款資料
          </h3>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--color-text-muted)' }}>
                廠商簡稱 *
              </label>
              <input
                type="text"
                value={supplierName}
                onChange={e => setSupplierName(e.target.value)}
                placeholder="例：捷安特、美利達"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ background: 'var(--color-bg-card-alt)', color: 'var(--color-text-primary)' }}
              />
            </div>

            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--color-text-muted)' }}>
                需匯金額 *
              </label>
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="輸入金額"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ background: 'var(--color-bg-card-alt)', color: 'var(--color-text-primary)' }}
              />
            </div>

            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--color-text-muted)' }}>
                需求日期
              </label>
              <input
                type="date"
                value={requestDate}
                onChange={e => setRequestDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ background: 'var(--color-bg-card-alt)', color: 'var(--color-text-primary)' }}
              />
            </div>
          </div>
        </div>

        {/* Arrival Store */}
        <div className="rounded-2xl p-4" style={{ background: 'var(--color-bg-card)' }}>
          <label className="text-xs font-medium mb-2 block" style={{ color: 'var(--color-text-muted)' }}>
            到貨門市
          </label>
          <div className="flex flex-wrap gap-2">
            {STORES.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setArrivalStore(s)}
                className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                style={{
                  background: arrivalStore === s ? 'var(--color-accent)' : 'var(--color-bg-card-alt)',
                  color: arrivalStore === s ? '#fff' : 'var(--color-text-primary)',
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Description */}
        <div className="rounded-2xl p-4" style={{ background: 'var(--color-bg-card)' }}>
          <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--color-text-muted)' }}>
            商品說明
          </label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="例：Tarmac SL7 框架、Roval CLX 輪組"
            rows={3}
            className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none"
            style={{ background: 'var(--color-bg-card-alt)', color: 'var(--color-text-primary)' }}
          />
        </div>

        {/* Photo Upload */}
        <div className="rounded-2xl p-4" style={{ background: 'var(--color-bg-card)' }}>
          <label className="text-xs font-medium mb-2 block" style={{ color: 'var(--color-text-muted)' }}>
            附件照片（選填，例如匯款帳號截圖）
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handlePhotoSelect}
            className="hidden"
          />
          {photoData ? (
            <div className="space-y-2">
              <div className="relative rounded-lg overflow-hidden" style={{ maxHeight: '200px' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoData} alt="附件預覽" className="w-full object-contain rounded-lg" style={{ maxHeight: '200px' }} />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-lg text-xs"
                  style={{ background: 'var(--color-bg-card-alt)', color: 'var(--color-text-secondary)' }}
                >
                  更換照片
                </button>
                <button
                  type="button"
                  onClick={() => setPhotoData(null)}
                  className="px-3 py-1.5 rounded-lg text-xs"
                  style={{ color: 'var(--color-negative)' }}
                >
                  移除
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={photoCompressing}
              className="w-full py-8 rounded-xl text-sm border-2 border-dashed transition-colors"
              style={{
                borderColor: 'var(--color-bg-card-alt)',
                color: 'var(--color-text-muted)',
                background: 'transparent',
              }}
            >
              {photoCompressing ? '處理中...' : '📷 拍照或選擇照片'}
            </button>
          )}
        </div>

        {/* CC Recipients */}
        <div className="rounded-2xl p-4" style={{ background: 'var(--color-bg-card)' }}>
          <label className="text-xs font-medium mb-2 block" style={{ color: 'var(--color-text-muted)' }}>
            通知副本（匯款完成時會一併通知）
          </label>

          {/* Selected CC */}
          {ccList.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {ccList.map(name => (
                <span
                  key={name}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs"
                  style={{ background: 'var(--color-accent)', color: '#fff' }}
                >
                  {name}
                  <button
                    type="button"
                    onClick={() => toggleCc(name)}
                    className="ml-1 opacity-70 hover:opacity-100"
                  >
                    ✕
                  </button>
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
            {showCcPicker ? '收起' : '+ 選擇通知人員'}
          </button>

          {/* Staff Picker */}
          {showCcPicker && staffList.length > 0 && (
            <div className="mt-3 p-3 rounded-lg max-h-48 overflow-y-auto" style={{ background: 'var(--color-bg-card-alt)' }}>
              <div className="space-y-2">
                {staffList.map(staff => (
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

          {showCcPicker && staffList.length === 0 && (
            <p className="mt-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
              沒有已綁定 Telegram 的員工
            </p>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-2xl text-base font-semibold transition-opacity disabled:opacity-50"
          style={{ background: 'var(--color-accent)', color: '#fff' }}
        >
          {loading ? '建立中...' : '建立匯款需求'}
        </button>

        {/* View List Link */}
        <button
          type="button"
          onClick={() => router.push('/remittance')}
          className="w-full py-3 rounded-2xl text-base font-medium transition-opacity"
          style={{ background: 'var(--color-bg-card)', color: 'var(--color-text-primary)' }}
        >
          查看匯款列表
        </button>
      </form>

      <BottomNav active="reports" />
    </div>
  );
}
