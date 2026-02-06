'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import BottomNav from '@/components/BottomNav';

interface Staff {
  id: number;
  name: string;
  store: string | null;
  role: string;
  telegram_user_id: string | null;
  telegram_username: string | null;
  telegram_bound: boolean;
  is_active: boolean;
}

const STORES = ['台南', '高雄', '台中', '台北', '美術'];
const ROLES = ['admin', 'manager', 'staff'];

export default function SettingsPage() {
  const router = useRouter();
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formStore, setFormStore] = useState('');
  const [formRole, setFormRole] = useState('staff');
  const [formTelegramId, setFormTelegramId] = useState('');
  const [formTelegramUsername, setFormTelegramUsername] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchStaff = useCallback(async () => {
    try {
      const res = await fetch('/api/staff?active=false');
      const json = await res.json();
      if (json.success) {
        setStaffList(json.data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  const resetForm = () => {
    setFormName('');
    setFormStore('');
    setFormRole('staff');
    setFormTelegramId('');
    setFormTelegramUsername('');
    setShowAddForm(false);
    setEditingStaff(null);
  };

  const openEditForm = (staff: Staff) => {
    setEditingStaff(staff);
    setFormName(staff.name);
    setFormStore(staff.store || '');
    setFormRole(staff.role);
    setFormTelegramId(staff.telegram_user_id || '');
    setFormTelegramUsername(staff.telegram_username || '');
    setShowAddForm(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      alert('請輸入姓名');
      return;
    }

    setSaving(true);
    try {
      const body = {
        name: formName.trim(),
        store: formStore || null,
        role: formRole,
        telegram_user_id: formTelegramId.trim() || null,
        telegram_username: formTelegramUsername.trim() || null,
      };

      let res;
      if (editingStaff) {
        res = await fetch(`/api/staff/${editingStaff.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch('/api/staff', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }

      const json = await res.json();
      if (json.success) {
        resetForm();
        fetchStaff();
      } else {
        alert(json.error || '儲存失敗');
      }
    } catch {
      alert('網路錯誤');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (staff: Staff) => {
    const action = staff.is_active ? '停用' : '啟用';
    if (!confirm(`確定要${action} ${staff.name} 嗎？`)) return;

    try {
      const res = await fetch(`/api/staff/${staff.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !staff.is_active }),
      });
      const json = await res.json();
      if (json.success) {
        fetchStaff();
      }
    } catch {
      // ignore
    }
  };

  return (
    <div className="pb-20 min-h-screen">
      {/* Header */}
      <div className="px-5 pt-12 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="text-xl">←</button>
          <h1 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
            ⚙️ 設定
          </h1>
        </div>
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="text-sm px-3 py-1.5 rounded-lg"
            style={{ background: 'var(--color-accent)', color: '#fff' }}
          >
            + 新增員工
          </button>
        )}
      </div>

      <div className="px-5">
        {/* Add/Edit Form */}
        {showAddForm && (
          <div className="rounded-2xl p-4 mb-4" style={{ background: 'var(--color-bg-card)' }}>
            <h3 className="text-[13px] font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
              {editingStaff ? `✏️ 編輯 ${editingStaff.name}` : '➕ 新增員工'}
            </h3>

            <div className="space-y-3">
              {/* Name */}
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>
                  姓名 *
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="員工姓名"
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background: 'var(--color-bg-card-alt)', color: 'var(--color-text-primary)' }}
                />
              </div>

              {/* Store */}
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>
                  門市
                </label>
                <select
                  value={formStore}
                  onChange={(e) => setFormStore(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background: 'var(--color-bg-card-alt)', color: 'var(--color-text-primary)' }}
                >
                  <option value="">全部門市</option>
                  {STORES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {/* Role */}
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>
                  角色
                </label>
                <select
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background: 'var(--color-bg-card-alt)', color: 'var(--color-text-primary)' }}
                >
                  {ROLES.map(r => (
                    <option key={r} value={r}>
                      {r === 'admin' ? '管理員' : r === 'manager' ? '店長' : '店員'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Telegram User ID */}
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>
                  Telegram User ID（登入用）
                </label>
                <input
                  type="text"
                  value={formTelegramId}
                  onChange={(e) => setFormTelegramId(e.target.value)}
                  placeholder="例：123456789"
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none font-mono"
                  style={{ background: 'var(--color-bg-card-alt)', color: 'var(--color-text-primary)' }}
                />
                <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                  員工傳訊息給 @userinfobot 可取得 ID
                </p>
              </div>

              {/* Telegram Username */}
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>
                  Telegram Username（選填）
                </label>
                <input
                  type="text"
                  value={formTelegramUsername}
                  onChange={(e) => setFormTelegramUsername(e.target.value)}
                  placeholder="例：@username"
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background: 'var(--color-bg-card-alt)', color: 'var(--color-text-primary)' }}
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50"
                  style={{ background: 'var(--color-accent)', color: '#fff' }}
                >
                  {saving ? '儲存中...' : '儲存'}
                </button>
                <button
                  onClick={resetForm}
                  className="px-4 py-2.5 rounded-lg text-sm"
                  style={{ background: 'var(--color-bg-card-alt)', color: 'var(--color-text-secondary)' }}
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Staff List */}
        <div className="rounded-2xl p-4 mb-4" style={{ background: 'var(--color-bg-card)' }}>
          <h3 className="text-[13px] font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>
            👥 員工列表
          </h3>

          <p className="text-xs mb-4" style={{ color: 'var(--color-text-muted)' }}>
            員工需有 Telegram User ID 才能登入 Hamm 系統
          </p>

          {loading ? (
            <div className="flex items-center justify-center h-20">
              <div className="w-6 h-6 border-2 rounded-full animate-spin"
                style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }} />
            </div>
          ) : staffList.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                尚無員工資料
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {staffList.map((staff) => (
                <div
                  key={staff.id}
                  className="p-3 rounded-xl"
                  style={{
                    background: 'var(--color-bg-card-alt)',
                    opacity: staff.is_active ? 1 : 0.5,
                  }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                        {staff.name}
                      </span>
                      <span className="text-xs px-1.5 py-0.5 rounded"
                        style={{ background: 'var(--color-bg-card)', color: 'var(--color-text-muted)' }}>
                        {staff.role === 'admin' ? '管理員' : staff.role === 'manager' ? '店長' : '店員'}
                      </span>
                      {staff.store && (
                        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                          {staff.store}
                        </span>
                      )}
                      {!staff.is_active && (
                        <span className="text-xs px-1.5 py-0.5 rounded"
                          style={{ background: 'var(--color-negative)', color: '#fff' }}>
                          已停用
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditForm(staff)}
                        className="text-xs px-2 py-1 rounded"
                        style={{ color: 'var(--color-accent)' }}
                      >
                        編輯
                      </button>
                      <button
                        onClick={() => handleToggleActive(staff)}
                        className="text-xs px-2 py-1 rounded"
                        style={{ color: staff.is_active ? 'var(--color-negative)' : 'var(--color-positive)' }}
                      >
                        {staff.is_active ? '停用' : '啟用'}
                      </button>
                    </div>
                  </div>

                  {/* Telegram Info */}
                  <div className="flex items-center gap-2 mt-1">
                    {staff.telegram_user_id ? (
                      <>
                        <span className="text-xs px-2 py-0.5 rounded-full"
                          style={{ background: 'var(--color-positive)', color: '#fff' }}>
                          ✓ 可登入
                        </span>
                        <span className="text-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>
                          ID: {staff.telegram_user_id}
                        </span>
                        {staff.telegram_username && (
                          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                            ({staff.telegram_username})
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        尚未設定 Telegram ID（無法登入）
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Help Section */}
        <div className="rounded-2xl p-4 mb-4" style={{ background: 'var(--color-bg-card)' }}>
          <h3 className="text-[13px] font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>
            💡 如何取得 Telegram User ID
          </h3>
          <ol className="text-xs space-y-1" style={{ color: 'var(--color-text-secondary)' }}>
            <li>1. 開啟 Telegram App</li>
            <li>2. 搜尋 <b>@userinfobot</b></li>
            <li>3. 傳送任意訊息給它</li>
            <li>4. 它會回覆你的 User ID（純數字）</li>
          </ol>
        </div>

        {/* Logout */}
        <a
          href="/api/auth/logout"
          className="block w-full py-3 rounded-2xl text-center text-sm font-medium"
          style={{ background: 'var(--color-bg-card)', color: 'var(--color-negative)' }}
        >
          登出
        </a>
      </div>

      <BottomNav active="reports" />
    </div>
  );
}
