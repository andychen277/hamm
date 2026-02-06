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
  console.log(`[ERP] Payload:`, JSON.stringify(payload, null, 2));

  try {
    const response = await fetch(`${ERP_BASE_URL}/orderprodvipnew_finish.php`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': cookies,
      },
      body: encodeFormData(payload),
    });

    const responseText = await response.text();
    console.log(`[ERP] 客訂寫入回應: HTTP ${response.status}`);
    console.log(`[ERP] 回應內容 (前500字):`, responseText.substring(0, 500));

    // 檢查是否需要重新登入
    if (responseText.includes('login') || responseText.includes('登入') || response.status === 401) {
      console.error('[ERP] Session 可能已過期，需重新登入');
      cookies = '';
      lastLoginTime = 0;
      return { success: false, orderNumber: '', error: 'ERP Session 過期，請重試' };
    }

    // 檢查是否有明確錯誤訊息
    if (responseText.includes('錯誤') || responseText.includes('失敗')) {
      console.error('[ERP] 客訂寫入可能失敗，回應包含錯誤訊息');
      return { success: false, orderNumber: fnoa, error: '寫入 ERP 回應異常，請查看 log' };
    }

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

// ============================================================
// 即時營收查詢
// ============================================================

const REVENUE_STORES = [
  { code: '001', name: '台南' },
  { code: '002', name: '高雄' },
  { code: '005', name: '台中' },
  { code: '006', name: '台北' },
  { code: '007', name: '美術' },
];

// 快取：5 分鐘內重複查詢用快取
let revenueCache: { data: StoreRevenue[]; timestamp: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export interface StoreRevenue {
  store: string;
  revenue: number;
  productCount: number;
}

/**
 * 從 ERP 查詢單一門市的營收
 */
async function fetchStoreRevenue(storeCode: string, date: string): Promise<{ revenue: number; productCount: number }> {
  const response = await fetch(`${ERP_BASE_URL}/saleprodquery.php`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': cookies,
    },
    body: `ssdate=${date}&esdate=${date}&ston=${storeCode}&scdoc=&mobile=&scno=&pplunm=&submit=%E6%9F%A5%E8%A9%A2`,
  });

  const html = await response.text();
  const tbodyStart = html.indexOf('<tbody>');
  if (tbodyStart === -1) return { revenue: 0, productCount: 0 };

  let tbodyEnd = html.indexOf('</tbody>');
  if (tbodyEnd === -1) tbodyEnd = html.length;
  const content = html.substring(tbodyStart + 7, tbodyEnd);

  let totalRevenue = 0;
  let productCount = 0;
  let pos = 0;

  while (true) {
    const trStart = content.indexOf('<tr>', pos);
    if (trStart === -1) break;
    const trEnd = content.indexOf('</tr>', trStart);
    if (trEnd === -1) break;
    const row = content.substring(trStart, trEnd + 5);
    pos = trEnd + 5;

    const cells = row.match(/<td[^>]*>([\s\S]*?)<\/td>/g) || [];
    if (cells.length < 7) continue;

    const getValue = (cell: string) => cell.replace(/<td[^>]*>|<\/td>/g, '').replace(/<[^>]*>/g, '').trim();
    const amount = parseFloat(getValue(cells[6]).replace(/,/g, '')) || 0;

    totalRevenue += amount;
    productCount++;
  }

  return { revenue: totalRevenue, productCount };
}

/**
 * 查詢今日各門市即時營收
 */
export async function getLiveRevenue(forceRefresh = false): Promise<{
  success: boolean;
  data?: StoreRevenue[];
  date?: string;
  cachedAt?: string;
  error?: string;
}> {
  // 檢查快取
  if (!forceRefresh && revenueCache && (Date.now() - revenueCache.timestamp) < CACHE_TTL) {
    console.log('[ERP] 使用快取的營收資料');
    return {
      success: true,
      data: revenueCache.data,
      date: getTodayDate(),
      cachedAt: new Date(revenueCache.timestamp).toISOString(),
    };
  }

  try {
    await ensureLogin();

    const today = getTodayDate();
    const erpDate = today.replace(/-/g, '/');
    console.log(`[ERP] 查詢即時營收: ${erpDate}`);

    const results: StoreRevenue[] = [];

    for (const store of REVENUE_STORES) {
      try {
        const { revenue, productCount } = await fetchStoreRevenue(store.code, erpDate);
        results.push({
          store: store.name,
          revenue,
          productCount,
        });
      } catch (err) {
        console.error(`[ERP] ${store.name} 查詢失敗:`, err);
        results.push({
          store: store.name,
          revenue: 0,
          productCount: 0,
        });
      }
    }

    // 更新快取
    revenueCache = {
      data: results,
      timestamp: Date.now(),
    };

    return {
      success: true,
      data: results,
      date: today,
    };
  } catch (error) {
    console.error('[ERP] 即時營收查詢失敗:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '查詢失敗',
    };
  }
}

function getTodayDate(): string {
  const now = new Date();
  // 轉換為台灣時間
  const tw = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return tw.toISOString().split('T')[0];
}

// ============================================================
// 匯款需求
// ============================================================

export interface RemittanceData {
  store: string;           // 匯款門市
  creator: string;         // 建檔人員
  supplierName: string;    // 廠商簡稱
  amount: number;          // 需匯金額
  requestDate: string;     // 需求日期 (YYYY/MM/DD)
  arrivalStore: string;    // 到貨門市
  description: string;     // 商品說明
}

export interface RemittanceRecord {
  remittanceNo: string;    // 匯款單號
  supplierName: string;    // 廠商名稱
  amount: number;          // 需匯金額
  store: string;           // 匯款門市
  creator: string;         // 建檔人員
  requestDate: string;     // 需求日期
  arrivalStore: string;    // 到貨門市
  description: string;     // 商品備註
  status: string;          // 單據狀態 (開單/已匯)
  paidDate?: string;       // 匯款日期
  paidAmount?: number;     // 匯款金額
  paidBy?: string;         // 匯款人員
  paidNote?: string;       // 匯款備註
}

/**
 * 建立匯款需求 → 寫入 ERP
 */
export async function createRemittance(
  data: RemittanceData,
  storeCode: string
): Promise<{ success: boolean; remittanceNo: string; error?: string }> {
  await ensureLogin();

  const fnoa = generateOrderNumber(storeCode);
  const arrivalStoreCode = STORE_CODES[data.arrivalStore] || storeCode;

  // 日期格式轉換 YYYY-MM-DD → YYYY/MM/DD
  const requestDate = data.requestDate.replace(/-/g, '/');

  const payload = {
    ston: storeCode,                    // 匯款門市
    arman: data.creator,                // 建檔人員
    scnm: data.supplierName,            // 廠商簡稱
    pamt01: String(data.amount),        // 需匯金額
    urdate: requestDate,                // 需求日期
    ston2: arrivalStoreCode,            // 到貨門市
    memo1: data.description,            // 商品說明
    fnoa: fnoa,                         // 單號
  };

  console.log(`[ERP] 建立匯款需求: ${fnoa}, 廠商: ${data.supplierName}, 金額: ${data.amount}`);

  try {
    const response = await fetch(`${ERP_BASE_URL}/moneytrn_finish.php`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': cookies,
      },
      body: encodeFormData(payload),
    });

    console.log(`[ERP] 匯款需求寫入回應: HTTP ${response.status}`);
    return { success: true, remittanceNo: fnoa };
  } catch (error) {
    console.error('[ERP] 匯款需求寫入失敗:', error);
    return { success: false, remittanceNo: '', error: String(error) };
  }
}

/**
 * 查詢匯款列表
 */
export async function queryRemittances(
  startDate: string,
  endDate: string,
  store?: string,
  status?: string
): Promise<{ success: boolean; data?: RemittanceRecord[]; error?: string }> {
  await ensureLogin();

  const erpStartDate = startDate.replace(/-/g, '/');
  const erpEndDate = endDate.replace(/-/g, '/');
  const storeCode = store ? (STORE_CODES[store] || 'ALL') : 'ALL';

  const payload = {
    ssdate: erpStartDate,
    esdate: erpEndDate,
    ston: storeCode,
    cstate: status || 'ALL',
    submit: '查詢',
  };

  console.log(`[ERP] 查詢匯款列表: ${erpStartDate} ~ ${erpEndDate}, 門市: ${storeCode}`);

  try {
    const response = await fetch(`${ERP_BASE_URL}/moneytrnquery1.php`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': cookies,
      },
      body: encodeFormData(payload),
    });

    const html = await response.text();
    const records = parseRemittanceHTML(html);

    console.log(`[ERP] 匯款查詢結果: ${records.length} 筆`);
    return { success: true, data: records };
  } catch (error) {
    console.error('[ERP] 匯款查詢失敗:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * 解析匯款查詢 HTML
 */
function parseRemittanceHTML(html: string): RemittanceRecord[] {
  const records: RemittanceRecord[] = [];

  try {
    // 找到表格內容
    const tbodyStart = html.indexOf('<tbody>');
    if (tbodyStart === -1) return records;

    let tbodyEnd = html.indexOf('</tbody>');
    if (tbodyEnd === -1) tbodyEnd = html.length;
    const content = html.substring(tbodyStart + 7, tbodyEnd);

    let pos = 0;
    while (true) {
      const trStart = content.indexOf('<tr>', pos);
      if (trStart === -1) break;
      const trEnd = content.indexOf('</tr>', trStart);
      if (trEnd === -1) break;
      const row = content.substring(trStart, trEnd + 5);
      pos = trEnd + 5;

      const cells = row.match(/<td[^>]*>([\s\S]*?)<\/td>/g) || [];
      if (cells.length < 10) continue;

      const getValue = (cell: string | undefined) =>
        cell ? cell.replace(/<td[^>]*>|<\/td>/g, '').replace(/<[^>]*>/g, '').trim() : '';

      // 根據截圖的表格順序解析
      // 廠商名稱(0), 需匯金額(1), 匯款門市(2), 建檔人員(3), 需求日期(4),
      // 到貨門市(5), 商品備註(6), 匯款日期(7), 匯款金額(8), 匯款備註(9),
      // 匯款單號(10), 匯款人員(11), 單據狀態(12)
      records.push({
        supplierName: getValue(cells[0]),
        amount: parseFloat(getValue(cells[1]).replace(/,/g, '')) || 0,
        store: getValue(cells[2]),
        creator: getValue(cells[3]),
        requestDate: getValue(cells[4]),
        arrivalStore: getValue(cells[5]),
        description: getValue(cells[6]),
        paidDate: getValue(cells[7]) || undefined,
        paidAmount: parseFloat(getValue(cells[8]).replace(/,/g, '')) || undefined,
        paidNote: getValue(cells[9]) || undefined,
        remittanceNo: getValue(cells[10]),
        paidBy: getValue(cells[11]) || undefined,
        status: getValue(cells[12]) || '開單',
      });
    }
  } catch (error) {
    console.error('[ERP] 匯款 HTML 解析失敗:', error);
  }

  return records;
}
