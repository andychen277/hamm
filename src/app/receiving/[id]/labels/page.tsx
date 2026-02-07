'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import JsBarcode from 'jsbarcode';

interface LabelItem {
  product_id: string;
  product_name: string;
  barcode: string;
  price: number;
  quantity: number;
}

interface OrderData {
  id: number;
  order_no: string;
  store: string;
  staff_name: string;
  items: LabelItem[];
}

export default function LabelsPage() {
  const params = useParams();
  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copies, setCopies] = useState<'match' | 'one'>('match'); // match=按數量, one=每品一張
  const barcodeRefs = useRef<Map<string, SVGSVGElement>>(new Map());

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/receiving/${params.id}`);
        const json = await res.json();
        if (json.success) {
          setOrder(json.data);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [params.id]);

  const barcodeRefCallback = useCallback((node: SVGSVGElement | null, barcode: string) => {
    if (node) {
      barcodeRefs.current.set(barcode, node);
      try {
        // Try EAN-13 first, fallback to CODE128
        JsBarcode(node, barcode, {
          format: barcode.length === 13 ? 'EAN13' : barcode.length === 12 ? 'UPC' : 'CODE128',
          width: 1.5,
          height: 30,
          fontSize: 10,
          margin: 2,
          displayValue: true,
        });
      } catch {
        // If barcode format fails, use CODE128
        try {
          JsBarcode(node, barcode, {
            format: 'CODE128',
            width: 1.5,
            height: 30,
            fontSize: 10,
            margin: 2,
            displayValue: true,
          });
        } catch {
          // ignore
        }
      }
    }
  }, []);

  const handlePrint = () => {
    window.print();
  };

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
        <p style={{ color: 'var(--color-text-muted)' }}>找不到進貨單</p>
        <Link href="/receiving/history" className="mt-4 text-sm" style={{ color: 'var(--color-accent)' }}>
          返回進貨紀錄
        </Link>
      </div>
    );
  }

  // Build label list based on copies mode
  const labels: LabelItem[] = [];
  for (const item of order.items) {
    const count = copies === 'match' ? item.quantity : 1;
    for (let i = 0; i < count; i++) {
      labels.push(item);
    }
  }

  return (
    <>
      {/* Print styles */}
      <style jsx global>{`
        @media print {
          /* Hide everything except labels */
          body * { visibility: hidden !important; }
          .print-area, .print-area * { visibility: visible !important; }
          .print-area {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
          }
          .no-print { display: none !important; }

          /* Thermal label page size: 40mm x 30mm */
          @page {
            size: 40mm 30mm;
            margin: 0;
          }

          .label-card {
            width: 40mm !important;
            height: 30mm !important;
            padding: 1.5mm !important;
            margin: 0 !important;
            border: none !important;
            border-radius: 0 !important;
            background: white !important;
            page-break-after: always;
            box-sizing: border-box;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: space-between !important;
          }

          .label-name {
            font-size: 7pt !important;
            line-height: 1.2 !important;
            max-height: 9mm !important;
            overflow: hidden !important;
            text-align: center !important;
            width: 100% !important;
            color: black !important;
          }

          .label-barcode svg {
            width: 34mm !important;
            height: auto !important;
            max-height: 14mm !important;
          }

          .label-price {
            font-size: 10pt !important;
            font-weight: bold !important;
            color: black !important;
          }
        }
      `}</style>

      {/* Screen UI (hidden when printing) */}
      <div className="no-print min-h-screen" style={{ background: 'var(--color-bg-primary)' }}>
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3"
          style={{ background: 'var(--color-bg-card)', borderBottom: '1px solid var(--color-border)' }}>
          <Link href={`/receiving/history`} className="text-sm" style={{ color: 'var(--color-accent)' }}>
            &#8592; 返回
          </Link>
          <h1 className="text-base font-bold" style={{ color: 'var(--color-text-primary)' }}>
            列印商品標籤
          </h1>
        </div>

        {/* Options */}
        <div className="px-4 py-4 space-y-4">
          <div className="rounded-xl p-4" style={{ background: 'var(--color-bg-card)' }}>
            <p className="text-sm font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>
              {order.order_no} - {order.store}
            </p>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {order.items.length} 種商品
            </p>
          </div>

          {/* Copies toggle */}
          <div className="rounded-xl p-4" style={{ background: 'var(--color-bg-card)' }}>
            <p className="text-xs mb-3" style={{ color: 'var(--color-text-secondary)' }}>列印數量</p>
            <div className="flex gap-2">
              <button
                onClick={() => setCopies('match')}
                className="flex-1 py-2 rounded-lg text-sm font-medium"
                style={{
                  background: copies === 'match' ? 'var(--color-accent)' : 'var(--color-bg-card-alt)',
                  color: copies === 'match' ? '#fff' : 'var(--color-text-secondary)',
                }}
              >
                按進貨數量（{labels.length} 張）
              </button>
              <button
                onClick={() => setCopies('one')}
                className="flex-1 py-2 rounded-lg text-sm font-medium"
                style={{
                  background: copies === 'one' ? 'var(--color-accent)' : 'var(--color-bg-card-alt)',
                  color: copies === 'one' ? '#fff' : 'var(--color-text-secondary)',
                }}
              >
                每品一張（{order.items.length} 張）
              </button>
            </div>
          </div>

          {/* Preview */}
          <div className="rounded-xl p-4" style={{ background: 'var(--color-bg-card)' }}>
            <p className="text-xs mb-3" style={{ color: 'var(--color-text-secondary)' }}>
              預覽（共 {labels.length} 張標籤）
            </p>
            <div className="grid grid-cols-2 gap-2">
              {order.items.map((item, i) => (
                <div key={i} className="border rounded-lg p-2 flex flex-col items-center"
                  style={{ borderColor: 'var(--color-border)' }}>
                  <p className="text-[10px] text-center truncate w-full" style={{ color: 'var(--color-text-primary)' }}>
                    {item.product_name}
                  </p>
                  <svg
                    ref={(el) => barcodeRefCallback(el, item.barcode || item.product_id)}
                    className="my-1"
                  />
                  <p className="text-xs font-bold" style={{ color: 'var(--color-text-primary)' }}>
                    ${item.price.toLocaleString()}
                  </p>
                  <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                    x{copies === 'match' ? item.quantity : 1}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Print button */}
          <button
            onClick={handlePrint}
            className="w-full py-4 rounded-2xl text-base font-semibold"
            style={{ background: 'var(--color-accent)', color: '#fff' }}
          >
            列印 {labels.length} 張標籤
          </button>
        </div>
      </div>

      {/* Print area (only visible when printing) */}
      <div className="print-area" style={{ display: 'none' }}>
        {labels.map((item, i) => (
          <div key={i} className="label-card">
            <div className="label-name">
              {item.product_name}
            </div>
            <div className="label-barcode">
              <svg
                ref={(el) => {
                  if (el) {
                    try {
                      const code = item.barcode || item.product_id;
                      JsBarcode(el, code, {
                        format: code.length === 13 ? 'EAN13' : code.length === 12 ? 'UPC' : 'CODE128',
                        width: 1.5,
                        height: 30,
                        fontSize: 10,
                        margin: 2,
                        displayValue: true,
                      });
                    } catch {
                      try {
                        JsBarcode(el, item.barcode || item.product_id, {
                          format: 'CODE128',
                          width: 1.5,
                          height: 30,
                          fontSize: 10,
                          margin: 2,
                          displayValue: true,
                        });
                      } catch { /* ignore */ }
                    }
                  }
                }}
              />
            </div>
            <div className="label-price">
              ${item.price.toLocaleString()}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
