-- 進貨單表
CREATE TABLE IF NOT EXISTS receiving_orders (
  id SERIAL PRIMARY KEY,
  order_no VARCHAR(50) UNIQUE NOT NULL,
  staff_id INTEGER,
  staff_name VARCHAR(100),
  store VARCHAR(50) NOT NULL,
  supplier VARCHAR(100),
  total_items INTEGER DEFAULT 0,
  total_qty INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'submitted',
  note TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  submitted_at TIMESTAMP DEFAULT NOW()
);

-- 進貨單明細
CREATE TABLE IF NOT EXISTS receiving_items (
  id SERIAL PRIMARY KEY,
  receiving_order_id INTEGER NOT NULL REFERENCES receiving_orders(id) ON DELETE CASCADE,
  product_id VARCHAR(50),
  product_name VARCHAR(200),
  barcode VARCHAR(100),
  price NUMERIC(12,2) DEFAULT 0,
  quantity INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_receiving_orders_store ON receiving_orders(store);
CREATE INDEX IF NOT EXISTS idx_receiving_orders_created ON receiving_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_receiving_items_order ON receiving_items(receiving_order_id);

-- 調貨單表
CREATE TABLE IF NOT EXISTS transfer_orders (
  id SERIAL PRIMARY KEY,
  order_no VARCHAR(50) UNIQUE NOT NULL,
  staff_id INTEGER,
  staff_name VARCHAR(100),
  from_store VARCHAR(50) NOT NULL,
  to_store VARCHAR(50) NOT NULL,
  logistics VARCHAR(50),
  tracking_no VARCHAR(100),
  total_items INTEGER DEFAULT 0,
  total_qty INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'submitted',
  note TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  submitted_at TIMESTAMP DEFAULT NOW()
);

-- 調貨單明細
CREATE TABLE IF NOT EXISTS transfer_items (
  id SERIAL PRIMARY KEY,
  transfer_order_id INTEGER NOT NULL REFERENCES transfer_orders(id) ON DELETE CASCADE,
  product_id VARCHAR(50),
  product_name VARCHAR(200),
  barcode VARCHAR(100),
  price NUMERIC(12,2) DEFAULT 0,
  quantity INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transfer_orders_from ON transfer_orders(from_store);
CREATE INDEX IF NOT EXISTS idx_transfer_orders_to ON transfer_orders(to_store);
CREATE INDEX IF NOT EXISTS idx_transfer_orders_created ON transfer_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transfer_items_order ON transfer_items(transfer_order_id);
