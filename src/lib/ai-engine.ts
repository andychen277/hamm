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
  return data.choices[0].message.content.trim();
}

async function textToSql(question: string, context?: string[]): Promise<string> {
  const contextStr = context?.length
    ? `\n\n先前對話脈絡:\n${context.join('\n')}`
    : '';

  const text = await chatCompletion([
    {
      role: 'system',
      content: `你是 Hamm，277 Bicycle 的資料分析助手。將使用者的中文問題轉換為 PostgreSQL SQL 查詢。

${DB_SCHEMA}

今天是 ${new Date().toISOString().split('T')[0]}。

## 規則
1. 只能產生 SELECT 語句，禁止任何寫入操作
2. 必須加上 LIMIT（預設 100，除非使用者明確要全部）
3. 金額相關查詢使用 SUM / AVG 搭配 GROUP BY
4. 回傳的 SQL 要包含有意義的欄位別名（中文）
5. 如果問題模糊，優先回傳總覽型的摘要查詢
6. member_transactions 的金額欄位是 "total"，門市欄位是 "store"
7. 營收查詢優先使用 store_revenue_daily 表（數據最準確，含非會員、二手車等）
8. 如果查詢需要會員明細（商品、手機、客單價等），才用 member_transactions 並過濾 transaction_type = '收銀'
9. 門市值只有：台南, 高雄, 台中, 台北, 美術（不含"店"字）
10. 不要使用 INTO 關鍵字
11. 嚴禁將 store_revenue_daily 和 member_transactions 的金額相加！它們有重疊數據。store_revenue_daily 已包含 member_transactions 的收銀數據。營收總額只看 store_revenue_daily。如需對比，用兩個獨立子查詢分別算，標示為「全部營收」和「會員營收」
12. store_revenue_daily 的日期欄位是 revenue_date，金額欄位是 revenue
13. 查營收時只用一張表：store_revenue_daily（總營收）或 member_transactions（會員明細），絕不要 JOIN 或 UNION 兩表的金額

## 日期規則（非常重要）
- 禁止使用 EXTRACT(MONTH FROM ...) 或 EXTRACT(YEAR FROM ...)，這會跨越多年
- 月份查詢必須用日期範圍：transaction_date >= '2026-01-01' AND transaction_date < '2026-02-01'
- 使用者說「一月」「上個月」等，預設為今年（${new Date().getFullYear()}年）
- 預設時間範圍為近 30 天，除非使用者指定具體月份或時段
- 一律使用 transaction_date >= 和 < 來限定範圍，不要用 BETWEEN

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
      content: `你是 277 Bicycle（自行車連鎖店）的經營分析師。基於查詢結果，提供 2-3 條洞察。

五間門市：台南（旗艦店最大）、台北、台中、高雄、美術（最小店）。

## 嚴格規則
1. 每條 30-50 字，直接講重點
2. 必須從數據中計算出新資訊（佔比、倍數、差距、排名變化），不要只複述查詢結果裡已有的數字
3. 禁止使用的詞：「亮眼」「值得關注」「建議加強」「需要檢討」「持續關注」「進一步分析」
4. 每條必須有一個具體行動或判斷，例如：「應檢查是否為人員異動」「可測試將X策略導入Y店」
5. 語氣：簡潔、直接、像看數字說話的分析師

## 範例
好：「台中客單價 $12.3萬 = 台南 2.1 倍，高單價車款集中，台南可引進同款測試」
好：「美術月營收 70 萬佔總營收 8%，若月租+人事超過 20 萬則虧損」
好：「高雄連續兩月衰退（-15%→-23%），非季節因素，查人員或周邊施工」
壞：「台南店營收最高，表現亮眼」
壞：「建議各門市加強行銷以提升業績」

每條洞察一行，數字編號，不要其他格式。`,
    },
    {
      role: 'user',
      content: `查詢問題：${question}\n查詢結果：${JSON.stringify(results.slice(0, 50))}`,
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
    const total = results.reduce((sum, r) => sum + Number(r[mainNumKey]), 0);
    const topRow = results[0];
    const topLabel = String(topRow[labelKeys[0]]);
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
    /為什麼.*失敗/,
    /為什麼.*錯/,
    /為何.*不/,
    /怎麼.*錯/,
    /什麼意思/,
    /解釋.*一下/,
    /你.*可以/,
    /你.*會/,
    /你是誰/,
    /幫我.*什麼/,
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
