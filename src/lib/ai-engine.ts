import { DB_SCHEMA } from './schema';
import { validateAndSanitizeSql } from './sql-safety';
import { query } from './db';

const CHART_TYPES = ['horizontal_bar', 'line', 'pie', 'grouped_bar', 'table'] as const;
type ChartType = typeof CHART_TYPES[number];

const STORE_COLORS: Record<string, string> = {
  '台南': '#FF6B35', '台南店': '#FF6B35',
  '高雄': '#F7C948', '高雄店': '#F7C948',
  '台中': '#2EC4B6', '台中店': '#2EC4B6',
  '台北': '#E71D73', '台北店': '#E71D73',
  '美術': '#9B5DE5', '美術店': '#9B5DE5',
};

export interface AskResult {
  answer: string;
  chart_type: ChartType | null;
  chart_data: Record<string, unknown>[] | null;
  insights: string[];
  sql: string;
  query_time_ms: number;
  error?: string;
}

const LLM_MODEL = process.env.LLM_MODEL || 'google/gemini-2.0-flash-001';

async function chatCompletion(messages: { role: string; content: string }[]): Promise<string> {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) throw new Error('LLM_API_KEY not configured');

  // Filter out messages with empty/whitespace-only content to avoid API validation errors
  const sanitized = messages.filter(m => m.content && m.content.trim().length > 0);
  if (sanitized.length === 0) throw new Error('No valid messages to send');

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'X-Title': 'Hamm - 277 BI',
    },
    body: JSON.stringify({
      model: LLM_MODEL,
      messages: sanitized,
      temperature: 0.1,
      max_tokens: 2000,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenRouter API error: ${res.status} ${err}`);
  }

  const data = await res.json();
  if (!data.choices?.length || !data.choices[0].message?.content) {
    throw new Error('LLM returned empty response');
  }
  return data.choices[0].message.content.trim();
}

async function textToSql(question: string, context?: string[]): Promise<string> {
  const contextStr = context?.length
    ? `\n\n先前對話脈絡:\n${context.join('\n')}`
    : '';

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const today = now.toISOString().split('T')[0];
  const thisMonthStart = `${year}-${String(month).padStart(2, '0')}-01`;
  const nextMonthStart = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const lastMonthStart = month === 1 ? `${year - 1}-12-01` : `${year}-${String(month - 1).padStart(2, '0')}-01`;

  const text = await chatCompletion([
    {
      role: 'system',
      content: `你是 277 Bicycle 的 SQL 查詢引擎。將中文問題精準轉為 PostgreSQL SELECT 語句。
今天是 ${today}，本月 = ${thisMonthStart}，上月 = ${lastMonthStart}。

${DB_SCHEMA}

## 規則
1. 只產生 SELECT（可用 WITH CTE），禁止寫入操作，禁止 INTO 關鍵字
2. 必須加 LIMIT（預設 100，除非使用者指定數量）
3. 欄位別名用中文
4. 門市值只有：台南, 高雄, 台中, 台北, 美術（不含"店"字）
5. 問題模糊時，優先回傳總覽型摘要查詢

## 兩張營收表（嚴禁混用！）
| 用途 | 表 | 日期欄位 | 金額欄位 | 注意 |
|------|-----|---------|---------|------|
| 總營收（含非會員） | store_revenue_daily | revenue_date | revenue | 營收查詢優先用這張 |
| 會員消費明細 | member_transactions | transaction_date | total | 必須加 transaction_type = '收銀' |
- 每次查詢只用一張表，絕不 JOIN / UNION / UNION ALL 兩表金額
- store_revenue_daily 已包含 member_transactions 的收銀數據
- 分析單一門市時用 store_revenue_daily，需要會員維度才用 member_transactions
- ❌ 錯誤：SELECT ... FROM store_revenue_daily UNION ALL SELECT ... FROM member_transactions
- ✅ 正確：只從一張表查，一次回答一個維度

## 日期處理
- 禁止 date() 函數、EXTRACT(MONTH/YEAR FROM ...)、BETWEEN
- 日期用字串格式，月份範圍用 >= 和 <
- 相對時間用 CURRENT_DATE - INTERVAL '3 months'
- 「20260103」解讀為 '2026-01-03'

## 正確範例（嚴格參考這些模式）

問：上個月各門市營收
SELECT store AS 門市, SUM(revenue) AS 營收
FROM store_revenue_daily
WHERE revenue_date >= '${lastMonthStart}' AND revenue_date < '${thisMonthStart}'
GROUP BY store ORDER BY 營收 DESC LIMIT 100

問：最近 30 天最暢銷前 10 名商品
SELECT product_name AS 商品, SUM(quantity) AS 銷量, SUM(total) AS 金額
FROM member_transactions
WHERE transaction_type = '收銀' AND transaction_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY product_name ORDER BY 銷量 DESC LIMIT 10

問：本月新增會員數
SELECT COUNT(DISTINCT member_phone) AS 新增會員數
FROM (
  SELECT member_phone, MIN(transaction_date) AS first_date
  FROM member_transactions
  WHERE member_phone IS NOT NULL AND member_phone != ''
  GROUP BY member_phone
) sub
WHERE first_date >= '${thisMonthStart}' AND first_date < '${nextMonthStart}' LIMIT 100

問：VIP 會員有哪些
SELECT name AS 姓名, phone AS 手機, total_spent AS 總消費
FROM unified_members WHERE member_level = 'vip'
ORDER BY total_spent DESC LIMIT 100

問：高雄上週每天營收
SELECT revenue_date AS 日期, revenue AS 營收
FROM store_revenue_daily
WHERE store = '高雄' AND revenue_date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY revenue_date LIMIT 100

問：哪些會員超過半年沒消費
SELECT m.name AS 姓名, m.phone AS 手機, m.total_spent AS 歷史消費, MAX(t.transaction_date) AS 最後消費日
FROM unified_members m
JOIN member_transactions t ON t.member_phone = m.phone
WHERE t.transaction_type = '收銀'
GROUP BY m.name, m.phone, m.total_spent
HAVING MAX(t.transaction_date) < CURRENT_DATE - INTERVAL '6 months'
ORDER BY 歷史消費 DESC LIMIT 100

問：各門市本月 vs 上月營收比較
WITH this_month AS (
  SELECT store, SUM(revenue) AS 本月營收
  FROM store_revenue_daily
  WHERE revenue_date >= '${thisMonthStart}' AND revenue_date < '${nextMonthStart}'
  GROUP BY store
), last_month AS (
  SELECT store, SUM(revenue) AS 上月營收
  FROM store_revenue_daily
  WHERE revenue_date >= '${lastMonthStart}' AND revenue_date < '${thisMonthStart}'
  GROUP BY store
)
SELECT COALESCE(t.store, l.store) AS 門市,
  COALESCE(本月營收, 0) AS 本月營收, COALESCE(上月營收, 0) AS 上月營收,
  ROUND(CASE WHEN 上月營收 > 0 THEN (本月營收 - 上月營收) / 上月營收 * 100 ELSE 0 END, 1) AS 成長率百分比
FROM this_month t FULL JOIN last_month l ON t.store = l.store
ORDER BY 本月營收 DESC LIMIT 100

問：各消費等級的會員數
SELECT member_level AS 等級, COUNT(*) AS 人數
FROM unified_members
WHERE member_level IS NOT NULL
GROUP BY member_level ORDER BY 人數 DESC LIMIT 100

問：LINE 綁定率各門市比較
SELECT store AS 門市,
  COUNT(*) AS 總會員,
  COUNT(line_user_id) AS 已綁定,
  ROUND(COUNT(line_user_id)::numeric / COUNT(*) * 100, 1) AS 綁定率
FROM unified_members
WHERE store IS NOT NULL
GROUP BY store ORDER BY 綁定率 DESC LIMIT 100

只回傳純 SQL，不要任何解釋、markdown 或反引號。`,
    },
    {
      role: 'user',
      content: question + contextStr,
    },
  ]);

  // Clean up any markdown formatting the model might add
  return text
    .replace(/^```sql\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

async function generateInsights(question: string, results: Record<string, unknown>[]): Promise<string[]> {
  const text = await chatCompletion([
    {
      role: 'system',
      content: `你是 277 Bicycle 的數據分析師。根據查詢結果產出 2-3 條實用洞察。

## 277 門市
台南（旗艦店）｜高雄（南部第二店）｜台中（家庭客群）｜台北（高端都會）｜美術（精品小店）

## 每條洞察必須包含
1. 從數據「算出」的新數字（佔比、倍數差距、平均值、成長率）—— 不要只複述原始數字
2. 一個具體可執行的行動建議（例如：查排班、調品項、啟動促銷）
3. 控制在 30-60 字

## 禁止使用的空話
亮眼、值得關注、建議加強、需要檢討、持續關注、進一步分析、表現不錯、表現突出、值得肯定

## 範例
資料：[{門市:台南, 營收:5000000}, {門市:高雄, 營收:2000000}, {門市:美術, 營收:600000}]
1. 台南佔總營收 42% 是高雄 2.5 倍，高雄應檢查是否人力不足或熱銷品項缺貨
2. 美術營收 60 萬僅佔 5%，若月租金超過 15 萬已接近損益平衡，可考慮縮減營業日
3. 前兩店合計佔 72%，行銷預算應集中投放台南和高雄

每條一行，數字編號，不要其他格式。`,
    },
    {
      role: 'user',
      content: `問題：${question}\n資料：${JSON.stringify(results.slice(0, 50))}`,
    },
  ]);

  return text
    .split('\n')
    .map(line => line.replace(/^\d+[\.\)、]\s*/, '').trim())
    .filter(line => line.length > 0)
    .slice(0, 3);
}

function detectChartType(question: string, results: Record<string, unknown>[]): ChartType | null {
  if (results.length === 0) return null;
  if (results.length === 1) return 'table';

  const q = question.toLowerCase();
  const keys = Object.keys(results[0]);

  // Trend / time-based
  if (q.includes('趨勢') || q.includes('走勢') || q.includes('每月') || q.includes('每週') || q.includes('每天') ||
      keys.some(k => k.includes('月') || k.includes('日期') || k.includes('period') || k.includes('date'))) {
    return 'line';
  }

  // Comparison / ranking
  if (q.includes('排名') || q.includes('比較') || q.includes('各門市') || q.includes('各店') ||
      q.includes('前') || q.includes('TOP') || q.includes('top')) {
    return 'horizontal_bar';
  }

  // Proportion
  if (q.includes('佔比') || q.includes('比例') || q.includes('分佈') || q.includes('佔') || q.includes('比率')) {
    return 'pie';
  }

  // Grouped comparison
  if (q.includes('vs') || q.includes('對比')) {
    return 'grouped_bar';
  }

  // Default based on data shape
  if (results.length <= 10 && keys.length <= 3) return 'horizontal_bar';
  return 'table';
}

function addStoreColors(data: Record<string, unknown>[]): Record<string, unknown>[] {
  return data.map(row => {
    const values = Object.values(row);
    const nameField = values.find(v => typeof v === 'string' && STORE_COLORS[v as string]);
    if (nameField) {
      return { ...row, color: STORE_COLORS[nameField as string] };
    }
    return row;
  });
}

function fmt$(n: number): string {
  if (n >= 100000000) return (n / 100000000).toFixed(2) + '億';
  if (n >= 10000) return (n / 10000).toFixed(1) + '萬';
  return n.toLocaleString();
}

function generateSummaryAnswer(_question: string, results: Record<string, unknown>[]): string {
  if (results.length === 0) return '查詢沒有找到符合條件的資料。';

  // Single aggregate result
  if (results.length === 1 && Object.keys(results[0]).length <= 3) {
    const entries = Object.entries(results[0]);
    return entries.map(([k, v]) => {
      const num = Number(v);
      if (!isNaN(num) && num > 1000) return `${k}：${fmt$(num)}`;
      return `${k}：${v}`;
    }).join('，');
  }

  // Multi-row: try to summarize with total if there's a numeric column
  const numericKeys = Object.keys(results[0]).filter(k =>
    results.every(r => !isNaN(Number(r[k])) && r[k] !== null)
  );
  const labelKeys = Object.keys(results[0]).filter(k => !numericKeys.includes(k));

  if (numericKeys.length > 0 && labelKeys.length > 0) {
    const mainNumKey = numericKeys[0];
    const mainLabelKey = labelKeys[0];

    // For small result sets (≤ 3 rows), list each row individually
    // to avoid misleading totals from UNION ALL queries with mixed metrics
    if (results.length <= 3) {
      const parts = results.map(r => {
        const label = String(r[mainLabelKey]);
        const val = Number(r[mainNumKey]);
        return `${label}：${fmt$(val)}`;
      });
      return parts.join('｜');
    }

    // For larger result sets, show total + top item
    const total = results.reduce((sum, r) => sum + Number(r[mainNumKey]), 0);
    const topRow = results[0];
    const topLabel = String(topRow[mainLabelKey]);
    const topVal = Number(topRow[mainNumKey]);
    return `共 ${results.length} 筆，${mainNumKey}合計 ${fmt$(total)}。最高：${topLabel}（${fmt$(topVal)}，佔 ${((topVal / total) * 100).toFixed(1)}%）`;
  }

  return `查詢到 ${results.length} 筆結果。`;
}

export async function askQuestion(question: string, context?: string[]): Promise<AskResult> {
  const startTime = Date.now();

  // 檢測非資料查詢的元問題（meta-questions）
  const metaPatterns = [
    /為什麼.*不出來/,
    /為什麼.*看不到/,
    /為什麼.*沒有/,
    /為什麼.*失敗/,
    /為什麼.*錯/,
    /為什麼.*不能/,
    /為什麼.*無法/,
    /為何.*不/,
    /怎麼.*錯/,
    /怎麼.*不/,
    /什麼意思/,
    /解釋.*一下/,
    /你.*可以/,
    /你.*會/,
    /你是誰/,
    /幫我.*什麼/,
    /哪裡.*問題/,
    /出.*什麼.*問題/,
  ];

  if (metaPatterns.some(p => p.test(question))) {
    return {
      answer: '這個問題無法轉換為資料查詢。請嘗試詢問具體的營收、會員或商品相關問題，例如：「上個月各門市營收」或「本月新增會員數」。',
      chart_type: null,
      chart_data: null,
      insights: [],
      sql: '',
      query_time_ms: Date.now() - startTime,
    };
  }

  try {
    // 1. Generate SQL
    const rawSql = await textToSql(question, context);

    // 2. Validate SQL
    const validation = validateAndSanitizeSql(rawSql);
    if (!validation.valid) {
      return {
        answer: `SQL 安全檢查未通過：${validation.error}`,
        chart_type: null,
        chart_data: null,
        insights: [],
        sql: rawSql,
        query_time_ms: Date.now() - startTime,
        error: validation.error,
      };
    }

    // 3. Execute query
    const result = await query(validation.sql);
    const rows = result.rows as Record<string, unknown>[];

    // 4. Detect chart type
    const chartType = detectChartType(question, rows);

    // 5. Add store colors if applicable
    const chartData = addStoreColors(rows);

    // 6. Generate answer summary
    const answer = generateSummaryAnswer(question, rows);

    // 7. Generate AI insights (non-blocking if fails)
    let insights: string[] = [];
    try {
      if (rows.length > 0) {
        insights = await generateInsights(question, rows);
      }
    } catch {
      insights = ['洞察生成暫時不可用'];
    }

    return {
      answer,
      chart_type: chartType,
      chart_data: chartData,
      insights,
      sql: validation.sql,
      query_time_ms: Date.now() - startTime,
    };
  } catch (error) {
    return {
      answer: '查詢失敗：' + (error instanceof Error ? error.message : '未知錯誤'),
      chart_type: null,
      chart_data: null,
      insights: [],
      sql: '',
      query_time_ms: Date.now() - startTime,
      error: error instanceof Error ? error.message : '未知錯誤',
    };
  }
}
