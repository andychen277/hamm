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
      messages,
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

## 規則
1. 只能產生 SELECT 語句，禁止任何寫入操作
2. 必須加上 LIMIT（預設 100，除非使用者明確要全部）
3. 金額相關查詢使用 SUM / AVG 搭配 GROUP BY
4. 時間範圍預設為近 30 天，除非使用者指定
5. 回傳的 SQL 要包含有意義的欄位別名（中文）
6. 如果問題模糊，優先回傳總覽型的摘要查詢
7. member_transactions 的金額欄位是 "total"，門市欄位是 "store"
8. 銷售查詢要過濾 transaction_type = '銷貨'（排除銷退和收銀）
9. 門市值只有：台南, 高雄, 台中, 台北, 美術（不含"店"字）
10. 不要使用 INTO 關鍵字

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
      content: `你是 Hamm，277 Bicycle 的經營顧問。基於查詢結果，提供 2-3 條精簡的經營洞察。

要求：
1. 每條洞察不超過 50 字
2. 必須包含具體數字
3. 至少一條要有可行動的建議
4. 語氣：專業但口語化，像是對老闆的簡報
5. 如果發現異常值或趨勢，優先指出

回傳格式：每條洞察獨立一行，用數字編號。不要其他格式。`,
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

function generateSummaryAnswer(_question: string, results: Record<string, unknown>[]): string {
  if (results.length === 0) return '查詢沒有找到符合條件的資料。';
  if (results.length === 1 && Object.keys(results[0]).length <= 2) {
    const values = Object.values(results[0]);
    const keys = Object.keys(results[0]);
    return `${keys[0]}：${values[0]}${keys[1] ? `，${keys[1]}：${values[1]}` : ''}`;
  }
  return `查詢到 ${results.length} 筆結果。`;
}

export async function askQuestion(question: string, context?: string[]): Promise<AskResult> {
  const startTime = Date.now();

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
