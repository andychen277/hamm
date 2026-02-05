/**
 * ERP Service for Hamm
 * 處理 ERP 寫入操作（建單、維修、會員查詢）
 */

const ERP_BASE_URL = process.env.ERP_BASE_URL || 'http://60.249.213.248:8026/277';
const ERP_USERNAME = process.env.ERP_USERNAME || '';
const ERP_PASSWORD = process.env.ERP_PASSWORD || '';

let cookies = '';
let lastLoginTime = 0;
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

// Store codes mapping
export const STORE_CODES: Record<string, string> = {
  '台南': '001',
  '崇明': '008',
  '高雄': '002',
  '美術': '007',
  '台中': '005',
  '台北': '006',
};

export const STORE_NAMES: Record<string, string> = {
  '001': '台南',
  '008': '崇明',
  '002': '高雄',
  '007': '美術',
  '005': '台中',
  '006': '台北',
};

async function login(): Promise<boolean> {
  try {
    console.log('[ERP] 登入中...');

    const response = await fetch(`${ERP_BASE_URL}/actionlogin.php`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `scno=${ERP_USERNAME.toUpperCase()}&pass=${ERP_PASSWORD}&submit=Login`,
      redirect: 'manual',
    });

    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
      cookies = setCookie.split(',').map(c => c.split(';')[0]).join('; ');
      lastLoginTime = Date.now();
      console.log('[ERP] 登入成功');
      return true;
    }

    if (response.status === 302 || response.status === 301) {
      lastLoginTime = Date.now();
      console.log('[ERP] 登入成功（redirect）');
      return true;
    }

    console.error('[ERP] 登入失敗：無法取得 session');
    return false;
  } catch (error) {
    console.error('[ERP] 登入錯誤:', error);
    throw new Error('無法連接 ERP 系統');
  }
}

function isSessionValid(): boolean {
  if (!cookies || !lastLoginTime) return false;
  return (Date.now() - lastLoginTime) < SESSION_TIMEOUT;
}

async function ensureLogin(): Promise<void> {
  if (!isSessionValid()) {
    await login();
  }
}

/**
 * 生成單號: 門市碼 + YYYYMMDDHHMMSS
 */
function generateOrderNumber(storeCode: string): string {
  const now = new Date();
  // 轉換為台灣時間
  const tw = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const ts = tw.getFullYear().toString() +
    String(tw.getMonth() + 1).padStart(2, '0') +
    String(tw.getDate()).padStart(2, '0') +
    String(tw.getHours()).padStart(2, '0') +
    String(tw.getMinutes()).padStart(2, '0') +
    String(tw.getSeconds()).padStart(2, '0');
  return storeCode + ts;
}

/**
 * 計算預計交期
 */
function calculateDeliveryDate(orderType?: string): string {
  const now = new Date();
  const daysMap: Record<string, number> = { '現貨': 3, '組裝': 7, '客訂': 21 };
  now.setDate(now.getDate() + (daysMap[orderType || '客訂'] || 14));
  return `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;
}

function encodeFormData(obj: Record<string, string | number>): string {
  return Object.entries(obj)
    .map(([k, v]) => `${k}=${encodeURIComponent(v ?? '')}`)
    .join('&');
}

/**
 * 用電話號碼查詢 ERP 會員
 */
export async function lookupMember(phone: string, storeCode = '001'): Promise<{
  name: string;
  phone: string;
  id: string;
} | null> {
  await ensureLogin();

  try {
    const response = await fetch(`${ERP_BASE_URL}/orderprodvipnewget.php`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': cookies,
      },
      body: `smobile=${encodeURIComponent(phone)}&sston=${storeCode}&sscnm=&submit=%E6%9F%A5%E8%A9%A2`,
    });

    const html = await response.text();
    return parseMemberLookupHTML(html);
  } catch (error) {
    console.error('[ERP] 會員查詢失敗:', error);
    return null;
  }
}

function parseMemberLookupHTML(html: string): { name: string; phone: string; id: string } | null {
  try {
    const countMatch = html.match(/查詢共(\d+)筆會員/);
    if (!countMatch || parseInt(countMatch[1]) === 0) {
      return null;
    }

    const nameMatch = html.match(/name='scnm'\s+value=\s*'([^']*)'/);
    const phoneMatch = html.match(/name='mobile'\s+value=\s*'([^']*)'/);
    const idMatch = html.match(/name='scno'\s+value=\s*'([^']*)'/);

    if (!nameMatch) return null;

    return {
      name: nameMatch[1].trim(),
      phone: phoneMatch ? phoneMatch[1].trim() : '',
      id: idMatch ? idMatch[1].trim() : '',
    };
  } catch (error) {
    console.error('[ERP] 會員 HTML 解析失敗:', error);
    return null;
  }
}

export interface OrderData {
  phone: string;
  memberName: string;
  memberId?: string;
  productDesc: string;
  price: number;
  orderType?: string;
  deliveryDate?: string;
  prepay_cash?: number;
  prepay_card?: number;
  prepay_transfer?: number;
  prepay_remit?: number;
}

export interface StaffInfo {
  store_code: string;
  employee_name: string;
  employee_id?: string;
}

/**
 * 建立客訂單 → 寫入 ERP
 */
export async function createOrder(
  orderData: OrderData,
  staff: StaffInfo
): Promise<{ success: boolean; orderNumber: string; error?: string }> {
  await ensureLogin();

  const fnoa = generateOrderNumber(staff.store_code);
  const arman = staff.employee_name || staff.employee_id || 'Hamm';

  const payload = {
    ston: staff.store_code,
    arman: arman,
    mobile: orderData.phone,
    scnm: orderData.memberName,
    scno: orderData.memberId || '',
    memo1: orderData.productDesc,
    pamt01: String(orderData.price),
    urdate: orderData.deliveryDate || calculateDeliveryDate(orderData.orderType),
    pamt02: String(orderData.prepay_cash || 0),
    pamt03: String(orderData.prepay_card || 0),
    pamt04: String(orderData.prepay_transfer || 0),
    pamt05: String(orderData.prepay_remit || 0),
    fnoa: fnoa,
  };

  console.log(`[ERP] 建立客訂: ${fnoa}, 客戶: ${orderData.memberName}, 商品: ${orderData.productDesc}`);

  try {
    const response = await fetch(`${ERP_BASE_URL}/orderprodvipnew_finish.php`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': cookies,
      },
      body: encodeFormData(payload),
    });

    console.log(`[ERP] 客訂寫入回應: HTTP ${response.status}`);
    return { success: true, orderNumber: fnoa };
  } catch (error) {
    console.error('[ERP] 客訂寫入失敗:', error);
    return { success: false, orderNumber: '', error: String(error) };
  }
}

export interface RepairData {
  phone: string;
  memberName: string;
  memberId?: string;
  repairDesc: string;
  estimate?: number;
  prepayment?: number;
  technician?: string;
}

/**
 * 建立維修工單 → 寫入 ERP
 */
export async function createRepair(
  repairData: RepairData,
  staff: StaffInfo
): Promise<{ success: boolean; repairNumber: string; error?: string }> {
  await ensureLogin();

  const fnoa = generateOrderNumber(staff.store_code);
  const arman = staff.employee_name || staff.employee_id || 'Hamm';

  const payload = {
    ston: staff.store_code,
    mobile: repairData.phone,
    scnm: repairData.memberName,
    scno: repairData.memberId || '',
    arman: arman,
    memo1: repairData.repairDesc,
    pamt01: String(repairData.estimate || 0),
    pamt02: String(repairData.prepayment || 0),
    memo4: repairData.technician || arman,
    fnoa: fnoa,
  };

  console.log(`[ERP] 建立維修單: ${fnoa}, 客戶: ${repairData.memberName}, 項目: ${repairData.repairDesc}`);

  try {
    const response = await fetch(`${ERP_BASE_URL}/ccp_finish.php`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': cookies,
      },
      body: encodeFormData(payload),
    });

    console.log(`[ERP] 維修單寫入回應: HTTP ${response.status}`);
    return { success: true, repairNumber: fnoa };
  } catch (error) {
    console.error('[ERP] 維修單寫入失敗:', error);
    return { success: false, repairNumber: '', error: String(error) };
  }
}
