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

  // Add LIMIT if not present
  let finalSql = trimmed;
  if (!upper.includes('LIMIT')) {
    finalSql += ` LIMIT ${MAX_LIMIT}`;
  } else {
    // Ensure LIMIT is not too high
    const limitMatch = upper.match(/LIMIT\s+(\d+)/);
    if (limitMatch && parseInt(limitMatch[1]) > MAX_LIMIT) {
      finalSql = trimmed.replace(/LIMIT\s+\d+/i, `LIMIT ${MAX_LIMIT}`);
    }
  }

  return { valid: true, sql: finalSql };
}
