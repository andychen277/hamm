'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

// 五店地址資訊
const STORE_INFO: Record<string, { name: string; fullName: string; address: string; phone: string; contact: string }> = {
  '台南': {
    name: '台南店',
    fullName: '277 Bicycle 台南店',
    address: '台南市中西區民族路二段277號',
    phone: '06-222-7277',
    contact: '台南店',
  },
  '高雄': {
    name: '高雄店',
    fullName: '277 Bicycle 高雄店',
    address: '高雄市前鎮區中華五路277號',
    phone: '07-537-7277',
    contact: '高雄店',
  },
  '美術': {
    name: '美術店',
    fullName: '277 Bicycle 美術店',
    address: '高雄市鼓山區美術東二路277號',
    phone: '07-555-7277',
    contact: '美術店',
  },
  '台中': {
    name: '台中店',
    fullName: '277 Bicycle 台中店',
    address: '台中市西屯區台灣大道三段277號',
    phone: '04-2358-7277',
    contact: '台中店',
  },
  '台北': {
    name: '台北店',
    fullName: '277 Bicycle 台北店',
    address: '台北市信義區松仁路277號',
    phone: '02-8780-7277',
    contact: '台北店',
  },
};

interface TransferDetail {
  id: number;
  order_no: string;
  staff_name: string;
  from_store: string;
  to_store: string;
  logistics: string;
  tracking_no: string;
  total_items: number;
  total_qty: number;
  note: string;
  created_at: string;
  items: { product_name: string; quantity: number }[];
}

export default function ShippingLabelPage() {
  const params = useParams();
  const [order, setOrder] = useState<TransferDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/transfer/${params.id}`);
        const json = await res.json();
        if (json.success) setOrder(json.data);
      } catch { /* ignore */ }
      finally { setLoading(false); }
    }
    load();
  }, [params.id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-bg-primary)' }}>
        <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: 'var(--color-bg-primary)' }}>
        <p style={{ color: 'var(--color-text-muted)' }}>找不到調貨單</p>
        <Link href="/transfer/history" className="mt-4 text-sm" style={{ color: 'var(--color-accent)' }}>返回調貨紀錄</Link>
      </div>
    );
  }

  const fromInfo = STORE_INFO[order.from_store] || STORE_INFO['台南'];
  const toInfo = STORE_INFO[order.to_store] || STORE_INFO['高雄'];
  const itemsSummary = order.items.map(i => `${i.product_name} x${i.quantity}`).join('、');
  const shortSummary = itemsSummary.length > 60 ? itemsSummary.substring(0, 57) + '...' : itemsSummary;

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
  };

  return (
    <>
      <style jsx global>{`
        @media print {
          body * { visibility: hidden !important; }
          .shipping-print, .shipping-print * { visibility: visible !important; }
          .shipping-print {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
          }
          .no-print { display: none !important; }
          @page {
            size: A4;
            margin: 10mm;
          }
        }
      `}</style>

      {/* Screen UI */}
      <div className="no-print min-h-screen" style={{ background: 'var(--color-bg-primary)' }}>
        <div className="flex items-center gap-3 px-4 py-3"
          style={{ background: 'var(--color-bg-card)', borderBottom: '1px solid var(--color-border)' }}>
          <Link href="/transfer/history" className="text-sm" style={{ color: 'var(--color-accent)' }}>
            &#8592; 返回
          </Link>
          <h1 className="text-base font-bold" style={{ color: 'var(--color-text-primary)' }}>寄貨單預覽</h1>
        </div>

        <div className="px-4 py-4 space-y-4">
          {/* Preview card */}
          <div className="rounded-xl p-4" style={{ background: 'var(--color-bg-card)' }}>
            <p className="text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>
              {order.logistics || '新竹貨運'} 託運單
            </p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>寄件</p>
                <p className="font-medium" style={{ color: 'var(--color-text-primary)' }}>{fromInfo.fullName}</p>
                <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{fromInfo.phone}</p>
              </div>
              <div>
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>收件</p>
                <p className="font-medium" style={{ color: 'var(--color-text-primary)' }}>{toInfo.fullName}</p>
                <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{toInfo.phone}</p>
              </div>
            </div>
            <div className="mt-3 pt-3 text-xs" style={{ borderTop: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
              <p>{order.total_items} 項 / {order.total_qty} 件 — {shortSummary}</p>
            </div>
          </div>

          <button
            onClick={() => window.print()}
            className="w-full py-4 rounded-2xl text-base font-semibold"
            style={{ background: 'var(--color-accent)', color: '#fff' }}
          >
            列印寄貨單
          </button>
        </div>
      </div>

      {/* Print area */}
      <div className="shipping-print" style={{ display: 'none', fontFamily: 'serif' }}>
        <div style={{ border: '2px solid #000', padding: '20px', maxWidth: '700px', margin: '0 auto' }}>
          {/* Title */}
          <div style={{ textAlign: 'center', borderBottom: '2px solid #000', paddingBottom: '10px', marginBottom: '15px' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>
              {order.logistics || '新竹貨運'} 託運單
            </h1>
            <p style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
              調貨單號：{order.order_no} | 日期：{formatDate(order.created_at)}
            </p>
          </div>

          {/* Sender / Receiver */}
          <div style={{ display: 'flex', gap: '20px', marginBottom: '15px' }}>
            <div style={{ flex: 1, border: '1px solid #000', padding: '12px' }}>
              <p style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '8px', borderBottom: '1px solid #ccc', paddingBottom: '4px' }}>
                寄件人
              </p>
              <p style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '4px' }}>{fromInfo.fullName}</p>
              <p style={{ fontSize: '13px', marginBottom: '2px' }}>{fromInfo.address}</p>
              <p style={{ fontSize: '13px' }}>TEL: {fromInfo.phone}</p>
              <p style={{ fontSize: '13px' }}>經辦：{order.staff_name}</p>
            </div>
            <div style={{ flex: 1, border: '1px solid #000', padding: '12px' }}>
              <p style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '8px', borderBottom: '1px solid #ccc', paddingBottom: '4px' }}>
                收件人
              </p>
              <p style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '4px' }}>{toInfo.fullName}</p>
              <p style={{ fontSize: '13px', marginBottom: '2px' }}>{toInfo.address}</p>
              <p style={{ fontSize: '13px' }}>TEL: {toInfo.phone}</p>
            </div>
          </div>

          {/* Items table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '15px' }}>
            <thead>
              <tr>
                <th style={{ border: '1px solid #000', padding: '6px', fontSize: '13px', textAlign: 'left' }}>品名</th>
                <th style={{ border: '1px solid #000', padding: '6px', fontSize: '13px', textAlign: 'center', width: '60px' }}>數量</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item, i) => (
                <tr key={i}>
                  <td style={{ border: '1px solid #000', padding: '5px', fontSize: '12px' }}>{item.product_name}</td>
                  <td style={{ border: '1px solid #000', padding: '5px', fontSize: '12px', textAlign: 'center' }}>{item.quantity}</td>
                </tr>
              ))}
              <tr>
                <td style={{ border: '1px solid #000', padding: '5px', fontSize: '13px', fontWeight: 'bold' }}>合計</td>
                <td style={{ border: '1px solid #000', padding: '5px', fontSize: '13px', fontWeight: 'bold', textAlign: 'center' }}>
                  {order.total_qty}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Footer */}
          <div style={{ display: 'flex', gap: '20px', fontSize: '12px' }}>
            <div style={{ flex: 1, border: '1px solid #000', padding: '8px' }}>
              <p style={{ fontWeight: 'bold', marginBottom: '4px' }}>物流資訊</p>
              <p>物流商：{order.logistics || '—'}</p>
              <p>追蹤單號：{order.tracking_no || '________________'}</p>
            </div>
            <div style={{ flex: 1, border: '1px solid #000', padding: '8px' }}>
              <p style={{ fontWeight: 'bold', marginBottom: '4px' }}>備註</p>
              <p>{order.note || '—'}</p>
            </div>
          </div>

          {/* Signature area */}
          <div style={{ display: 'flex', gap: '20px', marginTop: '20px', fontSize: '12px' }}>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <p style={{ borderTop: '1px solid #000', paddingTop: '4px', marginTop: '40px' }}>寄件人簽章</p>
            </div>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <p style={{ borderTop: '1px solid #000', paddingTop: '4px', marginTop: '40px' }}>收件人簽章</p>
            </div>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <p style={{ borderTop: '1px solid #000', paddingTop: '4px', marginTop: '40px' }}>司機簽章</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
