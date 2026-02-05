import { query } from './db';

const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const LINE_API_URL = 'https://api.line.me/v2/bot/message/push';

interface PushMessageResponse {
  success: boolean;
  error?: string;
}

export async function pushMessage(
  lineUserId: string,
  messages: object[]
): Promise<PushMessageResponse> {
  if (!LINE_CHANNEL_ACCESS_TOKEN) {
    return { success: false, error: 'LINE_CHANNEL_ACCESS_TOKEN not configured' };
  }

  try {
    const response = await fetch(LINE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        to: lineUserId,
        messages,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('LINE push error:', errorText);
      return { success: false, error: `LINE API error: ${response.status}` };
    }

    return { success: true };
  } catch (error) {
    console.error('LINE push exception:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Push failed' };
  }
}

// Find LINE user ID by phone number
export async function findLineUserByPhone(phone: string): Promise<string | null> {
  // Try line_bindings first (verified bindings)
  const bindingResult = await query<{ line_user_id: string }>(
    `SELECT line_user_id FROM line_bindings
     WHERE phone = $1 AND bind_status = 'verified'
     LIMIT 1`,
    [phone]
  );

  if (bindingResult.rows.length > 0) {
    return bindingResult.rows[0].line_user_id;
  }

  // Fallback to unified_members
  const memberResult = await query<{ line_user_id: string }>(
    `SELECT line_user_id FROM unified_members
     WHERE phone = $1 AND line_user_id IS NOT NULL
     LIMIT 1`,
    [phone]
  );

  if (memberResult.rows.length > 0) {
    return memberResult.rows[0].line_user_id;
  }

  return null;
}

// Build Flex Message for order arrival notification
export function buildOrderArrivalFlex(
  orderInfo: {
    order_id: string;
    store: string;
    product_info: string;
    total_amount: number;
    deposit_paid: number;
    balance: number;
  },
  customMessage?: string
) {
  const defaultMessage = `您好！您的客訂商品已到貨，歡迎來店取貨。`;
  const message = customMessage || defaultMessage;

  return {
    type: 'flex',
    altText: '客訂到貨通知',
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '客訂到貨通知',
            weight: 'bold',
            size: 'lg',
            color: '#1DB446',
          },
        ],
        backgroundColor: '#F0FDF4',
        paddingAll: '15px',
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: message,
            wrap: true,
            size: 'sm',
            color: '#333333',
          },
          {
            type: 'separator',
            margin: 'lg',
          },
          {
            type: 'box',
            layout: 'vertical',
            margin: 'lg',
            spacing: 'sm',
            contents: [
              {
                type: 'box',
                layout: 'horizontal',
                contents: [
                  { type: 'text', text: '門市', size: 'sm', color: '#888888', flex: 2 },
                  { type: 'text', text: orderInfo.store, size: 'sm', color: '#333333', flex: 5, wrap: true },
                ],
              },
              {
                type: 'box',
                layout: 'horizontal',
                contents: [
                  { type: 'text', text: '商品', size: 'sm', color: '#888888', flex: 2 },
                  { type: 'text', text: orderInfo.product_info || '(商品資訊)', size: 'sm', color: '#333333', flex: 5, wrap: true },
                ],
              },
              {
                type: 'box',
                layout: 'horizontal',
                contents: [
                  { type: 'text', text: '總金額', size: 'sm', color: '#888888', flex: 2 },
                  { type: 'text', text: `$${orderInfo.total_amount.toLocaleString()}`, size: 'sm', color: '#333333', flex: 5 },
                ],
              },
              ...(orderInfo.balance > 0 ? [{
                type: 'box' as const,
                layout: 'horizontal' as const,
                contents: [
                  { type: 'text' as const, text: '尾款', size: 'sm' as const, color: '#888888', flex: 2 },
                  { type: 'text' as const, text: `$${orderInfo.balance.toLocaleString()}`, size: 'sm' as const, color: '#E74C3C', weight: 'bold' as const, flex: 5 },
                ],
              }] : []),
            ],
          },
        ],
        paddingAll: '15px',
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '277 自轉車',
            size: 'xs',
            color: '#888888',
            align: 'center',
          },
        ],
        paddingAll: '10px',
      },
    },
  };
}

// Build Flex Message for repair completion notification
export function buildRepairCompleteFlex(
  repairInfo: {
    repair_id: string;
    store: string;
    repair_desc: string;
    deposit?: number;
    vendor_quote?: number;
  },
  customMessage?: string
) {
  const defaultMessage = `您好！您的維修已完成，歡迎來店取車。`;
  const message = customMessage || defaultMessage;

  return {
    type: 'flex',
    altText: '維修完成通知',
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '維修完成通知',
            weight: 'bold',
            size: 'lg',
            color: '#3B82F6',
          },
        ],
        backgroundColor: '#EFF6FF',
        paddingAll: '15px',
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: message,
            wrap: true,
            size: 'sm',
            color: '#333333',
          },
          {
            type: 'separator',
            margin: 'lg',
          },
          {
            type: 'box',
            layout: 'vertical',
            margin: 'lg',
            spacing: 'sm',
            contents: [
              {
                type: 'box',
                layout: 'horizontal',
                contents: [
                  { type: 'text', text: '門市', size: 'sm', color: '#888888', flex: 2 },
                  { type: 'text', text: repairInfo.store, size: 'sm', color: '#333333', flex: 5, wrap: true },
                ],
              },
              {
                type: 'box',
                layout: 'horizontal',
                contents: [
                  { type: 'text', text: '維修項目', size: 'sm', color: '#888888', flex: 2 },
                  { type: 'text', text: repairInfo.repair_desc || '(維修內容)', size: 'sm', color: '#333333', flex: 5, wrap: true },
                ],
              },
              ...(repairInfo.deposit && repairInfo.deposit > 0 ? [{
                type: 'box' as const,
                layout: 'horizontal' as const,
                contents: [
                  { type: 'text' as const, text: '已付訂金', size: 'sm' as const, color: '#888888', flex: 2 },
                  { type: 'text' as const, text: `$${repairInfo.deposit.toLocaleString()}`, size: 'sm' as const, color: '#10B981', flex: 5 },
                ],
              }] : []),
            ],
          },
        ],
        paddingAll: '15px',
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '277 自轉車',
            size: 'xs',
            color: '#888888',
            align: 'center',
          },
        ],
        paddingAll: '10px',
      },
    },
  };
}
