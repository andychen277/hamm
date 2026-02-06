import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query(`ALTER TABLE remittances ADD COLUMN IF NOT EXISTS photo_data TEXT`);
    console.log('✅ photo_data 欄位已新增到 remittances 表');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
