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

## Transaction Types
- 銷貨: regular sale
- 銷退: return/refund
- 收銀: cash register / payment
`;
