/**
 * Telegram Bot API 服務
 * 用於發送任務通知給員工
 */

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

interface SendMessageOptions {
  chatId: string;
  text: string;
  parseMode?: 'HTML' | 'Markdown';
  disableNotification?: boolean;
}

interface TelegramResponse {
  ok: boolean;
  result?: unknown;
  description?: string;
}

/**
 * 發送 Telegram 訊息
 */
export async function sendTelegramMessage(options: SendMessageOptions): Promise<TelegramResponse> {
  if (!TELEGRAM_BOT_TOKEN) {
    console.warn('TELEGRAM_BOT_TOKEN not configured');
    return { ok: false, description: 'Bot token not configured' };
  }

  try {
    const response = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: options.chatId,
        text: options.text,
        parse_mode: options.parseMode || 'HTML',
        disable_notification: options.disableNotification || false,
      }),
    });

    const result = await response.json();
    return result as TelegramResponse;
  } catch (error) {
    console.error('Telegram send error:', error);
    return { ok: false, description: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * 發送任務通知
 */
export async function sendTaskNotification(params: {
  chatId: string;
  taskType: string;
  creator: string;
  store: string;
  assignee?: string;
  relatedName?: string;
  description?: string;
  taskId?: number;
}): Promise<TelegramResponse> {
  const typeEmoji: Record<string, string> = {
    order: '📦',
    stock: '📋',
    repair: '🔧',
    general: '📝',
  };

  const typeLabel: Record<string, string> = {
    order: '客訂',
    stock: '預貨',
    repair: '維修',
    general: '一般',
  };

  const emoji = typeEmoji[params.taskType] || '📋';
  const label = typeLabel[params.taskType] || '任務';

  let message = `${emoji} <b>新${label}任務</b>\n\n`;
  message += `🏪 門市：${params.store}\n`;
  message += `👤 建檔：${params.creator}\n`;

  if (params.assignee) {
    message += `📌 指派：${params.assignee}\n`;
  }

  if (params.relatedName) {
    message += `📦 關聯：${params.relatedName}\n`;
  }

  if (params.description) {
    message += `\n💬 ${params.description}\n`;
  }

  message += `\n⏰ ${new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}`;

  return sendTelegramMessage({
    chatId: params.chatId,
    text: message,
  });
}

/**
 * 發送任務狀態更新通知
 */
export async function sendTaskStatusNotification(params: {
  chatId: string;
  taskId: number;
  oldStatus: string;
  newStatus: string;
  updatedBy: string;
  relatedName?: string;
}): Promise<TelegramResponse> {
  const statusEmoji: Record<string, string> = {
    pending: '⏳',
    in_progress: '🔄',
    completed: '✅',
  };

  const statusLabel: Record<string, string> = {
    pending: '待處理',
    in_progress: '進行中',
    completed: '已完成',
  };

  const emoji = statusEmoji[params.newStatus] || '📋';
  const label = statusLabel[params.newStatus] || params.newStatus;

  let message = `${emoji} <b>任務狀態更新</b>\n\n`;
  message += `狀態：${label}\n`;
  message += `更新人：${params.updatedBy}\n`;

  if (params.relatedName) {
    message += `關聯：${params.relatedName}\n`;
  }

  message += `\n⏰ ${new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}`;

  return sendTelegramMessage({
    chatId: params.chatId,
    text: message,
  });
}

/**
 * 產生綁定驗證碼
 */
export function generateBindCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}
