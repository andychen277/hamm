const FORBIDDEN_KEYWORDS = [
  'INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'TRUNCATE',
  'CREATE', 'GRANT', 'REVOKE', 'EXECUTE', 'EXEC',
  'INTO', 'SET', 'REPLACE',
  'pg_', 'information_schema',
];

const MAX_LIMIT = 1000;

export interface SqlValidationResult {
  valid: boolean;
  sql: string;
  error?: string;
}

export function validateAndSanitizeSql(sql: string): SqlValidationResult {
  const trimmed = sql.trim().replace(/;+$/, '').trim();

  // Must start with SELECT or WITH
  const upper = trimmed.toUpperCase();
  if (!upper.startsWith('SELECT') && !upper.startsWith('WITH')) {
    return { valid: false, sql: trimmed, error: '只允許 SELECT 查詢' };
  }

  // Check for forbidden keywords (as whole words)
  for (const keyword of FORBIDDEN_KEYWORDS) {
    const regex = new RegExp(`\\b${keyword}\\b`, 'i');
    if (regex.test(trimmed)) {
      // Allow "INTO" only inside "CAST(... INTO ...)" — actually let's just block it
      // Exception: "information_schema" and "pg_" are always blocked
      // Exception: "INSERT INTO" etc are blocked but "INTO" inside subquery alias is ok
      // For safety, keep strict blocking
      return { valid: false, sql: trimmed, error: `禁止使用 ${keyword}` };
    }
  }

  // Check for multiple statements (semicolon injection)
  if (trimmed.includes(';')) {
    return { valid: false, sql: trimmed, error: '禁止多語句查詢' };
  }

  // Check for comments that could hide injection
  if (trimmed.includes('--') || trimmed.includes('/*')) {
    return { valid: false, sql: trimmed, error: '禁止 SQL 註解' };
  }

  // Replace EXTRACT(MONTH/YEAR FROM ...) with proper date range patterns
  // EXTRACT causes cross-year issues (e.g., all Januaries from 2020-2026)
  let finalSql = trimmed;
  finalSql = finalSql.replace(
    /EXTRACT\s*\(\s*MONTH\s+FROM\s+transaction_date\s*\)\s*=\s*(\d{1,2})/gi,
    (_match, month: string) => {
      const m = month.padStart(2, '0');
      const year = new Date().getFullYear();
      const nextMonth = parseInt(m) === 12 ? `${year + 1}-01` : `${year}-${(parseInt(m) + 1).toString().padStart(2, '0')}`;
      return `transaction_date >= '${year}-${m}-01' AND transaction_date < '${nextMonth}-01'`;
    }
  );

  // Fix LLM-generated transaction_type filters for member_transactions
  if (/\bmember_transactions\b/i.test(finalSql)) {
    // Replace wrong filters → transaction_type = '收銀'
    finalSql = finalSql.replace(
      /transaction_type\s*=\s*'銷貨'/g,
      "transaction_type = '收銀'"
    );
    finalSql = finalSql.replace(
      /transaction_type\s*!=\s*'銷退'/g,
      "transaction_type = '收銀'"
    );
    // If no 收銀 filter exists at all, auto-inject one
    if (!/收銀/i.test(finalSql) && /\bWHERE\b/i.test(finalSql)) {
      finalSql = finalSql.replace(
        /\bWHERE\b/i,
        "WHERE transaction_type = '收銀' AND"
      );
    }
  }

  // Add LIMIT if not present
  const upperFinal = finalSql.toUpperCase();
  if (!upperFinal.includes('LIMIT')) {
    finalSql += ` LIMIT ${MAX_LIMIT}`;
  } else {
    // Ensure LIMIT is not too high
    const limitMatch = upperFinal.match(/LIMIT\s+(\d+)/);
    if (limitMatch && parseInt(limitMatch[1]) > MAX_LIMIT) {
      finalSql = finalSql.replace(/LIMIT\s+\d+/i, `LIMIT ${MAX_LIMIT}`);
    }
  }

  return { valid: true, sql: finalSql };
}
