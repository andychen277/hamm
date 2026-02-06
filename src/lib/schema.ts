// Complete database schema reference for Hamm AI Query Engine
// Confirmed from production PostgreSQL on 2026-02-04

export const DB_SCHEMA = `
## PostgreSQL Database Schema (277 Bicycle)

### unified_members (會員主表, ~11,728 rows)
- id: integer (PK, auto-increment)
- phone: varchar(20) (UNIQUE, NOT NULL)
- name: varchar(100)
- email: varchar(255)
- line_user_id: varchar(50)
- total_spent: numeric(12,2) (default 0)
- tainan_spent: numeric(12,2) (default 0) — 台南店消費
- chongming_spent: numeric(12,2) (default 0) — 崇明店消費
- kaohsiung_spent: numeric(12,2) (default 0) — 高雄店消費
- meishu_spent: numeric(12,2) (default 0) — 美術店消費
- taichung_spent: numeric(12,2) (default 0) — 台中店消費
- taipei_spent: numeric(12,2) (default 0) — 台北店消費
- member_level: varchar(20) (default 'normal') — values: normal, silver, gold, vip
- erp_member_id: varchar(50)
- created_at: timestamp
- updated_at: timestamp
- last_synced_at: timestamp

### member_transactions (消費紀錄, ~79,279 rows)
- id: integer (PK, auto-increment)
- member_phone: varchar(20) (NOT NULL) — 關聯會員手機
- store: varchar(50) — values: 台南, 高雄, 台中, 台北, 美術
- transaction_type: varchar(20) — values: 銷貨, 銷退, 收銀
- member_name: varchar(100)
- transaction_date: date
- product_id: varchar(50)
- product_name: varchar(200)
- price: numeric(12,2)
- quantity: integer (default 1)
- total: numeric(12,2)
- order_number: varchar(50)
- erp_member_id: varchar(50)
- created_at: timestamp
- updated_at: timestamp
- UNIQUE(order_number, product_id)

### line_bindings (LINE 綁定記錄)
- id: integer (PK)
- line_user_id: varchar(50) (UNIQUE, NOT NULL)
- member_id: integer (FK → unified_members.id)
- phone: varchar(20)
- bind_status: varchar(20) (default 'pending')
- verification_code: varchar(10)
- code_expires_at: timestamp
- created_at: timestamp
- verified_at: timestamp

### order_status_log (客訂狀態追蹤)
- id: integer (PK)
- order_id: varchar(50) (UNIQUE, NOT NULL)
- line_user_id: varchar(50) (NOT NULL)
- last_known_status: varchar(20) (NOT NULL)
- product_name: text
- store_name: varchar(20)
- balance: integer (default 0)
- updated_at: timestamp

### repair_status_log (維修狀態追蹤)
- id: integer (PK)
- repair_id: varchar(50) (UNIQUE, NOT NULL)
- line_user_id: varchar(50) (NOT NULL)
- last_known_status: varchar(20) (NOT NULL)
- repair_desc: text
- store_name: varchar(20)
- updated_at: timestamp

### watchlist (到貨關注清單)
- id: integer (PK)
- line_user_id: varchar(50) (NOT NULL)
- product_id: varchar(50) (NOT NULL)
- product_name: varchar(200) (NOT NULL)
- product_price: integer
- watch_store: varchar(20) (default 'all')
- created_at: timestamp
- notified: boolean (default false)
- UNIQUE(line_user_id, product_id)

### scan_log (QR 掃碼行為追蹤)
- id: integer (PK)
- line_user_id: text
- scan_type: text (NOT NULL)
- reference_id: text (NOT NULL)
- product_name: text
- scan_source: text (default 'qr')
- created_at: timestamp

### qr_codes (QR Code 圖片儲存)
- id: integer (PK)
- qr_type: text (NOT NULL)
- reference_id: text (NOT NULL)
- image_data: bytea (NOT NULL)
- created_at: timestamp
- UNIQUE(qr_type, reference_id)

### staff_bindings (員工綁定)
- id: integer (PK)
- line_user_id: varchar(50) (UNIQUE, NOT NULL)
- employee_id: varchar(20) (NOT NULL)
- employee_name: varchar(100)
- store_code: varchar(10)
- store_name: varchar(20)
- role: varchar(20) (default '店員')
- is_active: boolean (default true)
- bound_at: timestamp
- updated_at: timestamp

### buzz_sessions (多步驟對話 Session)
- id: integer (PK)
- line_user_id: varchar(50) (UNIQUE, NOT NULL)
- flow_type: varchar(30) (NOT NULL)
- current_step: varchar(30) (NOT NULL)
- state: jsonb (default '{}')
- created_at: timestamp
- updated_at: timestamp
- expires_at: timestamp (NOT NULL)

### buzz_operation_log (操作日誌)
- id: integer (PK)
- line_user_id: varchar(50) (NOT NULL)
- employee_id: varchar(20) (NOT NULL)
- employee_name: varchar(100)
- store_code: varchar(10)
- operation_type: varchar(30) (NOT NULL)
- operation_data: jsonb
- erp_response: text
- result_status: varchar(20)
- result_message: text
- created_at: timestamp

### inventory (商品庫存, ~40,000 rows)
- id: integer (PK)
- product_id: varchar(50) (NOT NULL)
- product_name: varchar(200)
- store: varchar(50) — values: 台南, 高雄, 台中, 台北, 美術
- price: numeric(12,2)
- quantity: integer
- vendor_code: varchar(50)
- updated_at: timestamp
- UNIQUE(product_id, store)

### purchase_summary (進貨彙總)
- id: integer (PK)
- product_id: varchar(50) (NOT NULL)
- product_name: varchar(200)
- supplier: varchar(100) — 供應商名稱
- unit_cost: numeric(12,2) — 單位成本
- total_qty: integer — 進貨數量
- total_cost: numeric(12,2) — 總進貨成本
- period_start: date
- period_end: date
- updated_at: timestamp

### repairs (維修記錄, ~350 rows)
- id: integer (PK)
- repair_id: varchar(50) (UNIQUE)
- customer_name: varchar(100)
- customer_phone: varchar(20)
- store: varchar(50)
- repair_date: date
- repair_desc: text
- status: varchar(20) — 維修中, 已完修, 已通知, 已取件
- balance: numeric(12,2)
- updated_at: timestamp

### customer_orders (客訂記錄, ~400 rows)
- id: integer (PK)
- order_id: varchar(50) (UNIQUE)
- customer_name: varchar(100)
- customer_phone: varchar(20)
- store: varchar(50)
- order_date: date
- product_name: text
- status: varchar(20) — 未到, 已到, 已通知, 已取件
- balance: numeric(12,2)
- prepay_type: varchar(20)
- updated_at: timestamp

### store_revenue_daily (門市每日營收, 含非會員)
- id: integer (PK)
- store: varchar(50) — values: 台南, 高雄, 台中, 台北, 美術
- revenue_date: date
- revenue: numeric(12,2) — 該日該門市的 ERP 完整營收（含非會員）
- product_count: integer
- updated_at: timestamp
- UNIQUE(store, revenue_date)
- 注意：此表從 ERP saleprodquery.php 同步，數字對齊 ERP 報表
- 營收查詢優先使用此表（比 member_transactions 更準確）

### sync_logs (同步日誌)
- id: integer (PK)
- sync_type: varchar(50)
- status: varchar(20)
- records_synced: integer (default 0)
- error_message: text
- started_at: timestamp
- completed_at: timestamp

### purchase_history (消費歷史, legacy)
- id: integer (PK)
- member_id: integer (FK → unified_members.id)
- store: varchar(10) (NOT NULL)
- store_name: varchar(20)
- product_id: varchar(50)
- product_name: varchar(200)
- price: numeric(10,2)
- quantity: integer
- total: numeric(10,2)
- transaction_date: date
- order_number: varchar(50)
- synced_at: timestamp

## Store Name Mapping
- 台南 = Tainan (tainan_spent)
- 崇明 = Chongming (chongming_spent) — 已關閉或合併
- 高雄 = Kaohsiung (kaohsiung_spent)
- 美術 = Meishu/Art (meishu_spent)
- 台中 = Taichung (taichung_spent)
- 台北 = Taipei (taipei_spent)

## Store Colors
- 台南: #FF6B35 (橙色)
- 高雄: #F7C948 (金色)
- 台中: #2EC4B6 (青色)
- 台北: #E71D73 (桃紅)
- 美術: #9B5DE5 (紫色)

## Member Levels
- vip: >= $500,000
- gold: >= $200,000
- silver: >= $50,000
- normal: < $50,000

## New Members Query (重要！)
- unified_members.created_at 是「資料庫同步時間」，不是「會員實際加入日期」
- 查詢「本月新會員數」必須用 member_transactions 的首次交易日期：
  SELECT COUNT(DISTINCT member_phone) as 新增會員數
  FROM (
    SELECT member_phone, MIN(transaction_date) as first_date
    FROM member_transactions
    WHERE member_phone IS NOT NULL AND member_phone != ''
    GROUP BY member_phone
  ) sub
  WHERE first_date >= '2026-02-01' AND first_date < '2026-03-01'
- 禁止使用 unified_members.created_at 來計算新會員！

## Transaction Types
- 收銀: POS 收銀結帳（營收主要來源，報表唯一計算的類型）
- 銷貨: 特殊出貨/調撥（不計入營收報表）
- 銷退: 退貨退款（不計入營收報表）
- 重要：營收查詢必須使用 transaction_type = '收銀'
`;
