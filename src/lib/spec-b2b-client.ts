/**
 * Specialized B2B Portal Client
 * Authenticates via SAML -> OCC login, fetches shipment/order data for all 4 stores
 */

const SAML_API = 'https://api-sp.todaysplan.com.au/rest/saml/login';
const SAML_API_KEY = '721e9uug6v54ildlrv90oqe8d0';
const OCC_BASE = 'https://b2b.specialized.com';
const OCC_LOGIN = `${OCC_BASE}/ccstore/v1/login`;
const OCC_SHIPMENTS = `${OCC_BASE}/ccstorex/custom/v1/RecentShipment`;
const OCC_ORDERS = `${OCC_BASE}/ccstore/v1/orders`;

// Organization IDs for the 4 stores
export const STORE_ORGS: Record<string, string> = {
  '台南': '4200039',
  '台北': '4100300',
  '台中': '4200284',
  '高雄': '4200283',
};

interface OccToken {
  access_token: string;
  token_type: string;
  expires_in: number;
  obtained_at: number;
}

let cachedToken: OccToken | null = null;

/**
 * Step 1: Get SAML Response from Today's Plan API
 */
async function getSamlResponse(username: string, password: string): Promise<string> {
  const res = await fetch(SAML_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Api-Key': SAML_API_KEY,
    },
    body: JSON.stringify({ username, password }),
  });

  if (!res.ok) {
    throw new Error(`SAML login failed: ${res.status}`);
  }

  const html = await res.text();
  const match = html.match(/value="([^"]+)"/);
  if (!match) {
    throw new Error('Failed to extract SAML response');
  }
  return match[1];
}

/**
 * Step 2: Exchange SAML Response for OCC access token
 */
async function getOccToken(samlResponse: string): Promise<OccToken> {
  const body = new URLSearchParams({
    grant_type: 'saml_credentials',
    saml_response: samlResponse,
  });

  const res = await fetch(OCC_LOGIN, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OCC login failed: ${res.status} - ${text}`);
  }

  const data = await res.json();
  return {
    access_token: data.access_token,
    token_type: data.token_type,
    expires_in: data.expires_in,
    obtained_at: Date.now(),
  };
}

/**
 * Get authenticated OCC token (with caching)
 */
export async function authenticate(): Promise<string> {
  // Return cached token if still valid (with 5-minute buffer)
  if (cachedToken) {
    const elapsed = (Date.now() - cachedToken.obtained_at) / 1000;
    if (elapsed < cachedToken.expires_in - 300) {
      return cachedToken.access_token;
    }
  }

  const username = process.env.SPEC_B2B_USERNAME;
  const password = process.env.SPEC_B2B_PASSWORD;

  if (!username || !password) {
    throw new Error('SPEC_B2B_USERNAME and SPEC_B2B_PASSWORD must be set');
  }

  const samlResponse = await getSamlResponse(username, password);
  cachedToken = await getOccToken(samlResponse);
  return cachedToken.access_token;
}

export interface B2bShipment {
  shipmentId: number;
  shipmentNumber: string;
  custPONumber: string;
  shipTo: string;
  orderType: string;
  dateShipped: string;
  shippedTotal: number;
  shippedQty: number;
  trackingUrl: string;
  currencyCode: string;
}

export interface B2bOrder {
  orderId: string;
  state: string;
  creationTime: number;
  dynamicProperties?: Array<{ id: string; value: unknown }>;
}

export interface B2bOrderItem {
  productId: string;
  catRefId: string;
  displayName: string;
  quantity: number;
  rawTotalPrice: number;
  unitPrice: number;
  catalogRefId?: string;
}

export interface B2bOrderDetail {
  orderId: string;
  state: string;
  commerceItems: B2bOrderItem[];
}

/**
 * Fetch recent shipments for a specific store organization
 */
export async function fetchShipments(token: string, orgId: string): Promise<B2bShipment[]> {
  const res = await fetch(OCC_SHIPMENTS, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-CCProfileType': 'storefrontUI',
      'X-CCOrganization': orgId,
    },
    body: JSON.stringify({}),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Fetch shipments failed for org ${orgId}: ${res.status} - ${text}`);
  }

  const data = await res.json();
  return data.shipments || [];
}

/**
 * Fetch orders for a specific store organization
 */
export async function fetchOrders(token: string, orgId: string): Promise<B2bOrder[]> {
  const allOrders: B2bOrder[] = [];
  let offset = 0;
  const limit = 25;

  // Paginate through all orders
  while (true) {
    const res = await fetch(`${OCC_ORDERS}?limit=${limit}&offset=${offset}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-CCProfileType': 'storefrontUI',
        'X-CCOrganization': orgId,
      },
    });

    if (!res.ok) break;

    const data = await res.json();
    const items = data.items || [];
    allOrders.push(...items);

    if (items.length < limit || allOrders.length >= data.total) break;
    offset += limit;

    // Rate limiting: small delay between pages
    await new Promise(r => setTimeout(r, 200));
  }

  return allOrders;
}

/**
 * Fetch order detail with line items for a specific order
 */
export async function fetchOrderDetail(token: string, orderId: string, orgId: string): Promise<B2bOrderDetail | null> {
  const res = await fetch(`${OCC_ORDERS}/${orderId}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'X-CCProfileType': 'storefrontUI',
      'X-CCOrganization': orgId,
    },
  });

  if (!res.ok) {
    console.error(`Fetch order detail failed for ${orderId}: ${res.status}`);
    return null;
  }

  const data = await res.json();
  const items: B2bOrderItem[] = (data.commerceItems || []).map((ci: Record<string, unknown>) => ({
    productId: ci.productId || '',
    catRefId: ci.catRefId || ci.catalogRefId || '',
    displayName: ci.displayName || ci.productDisplayName || '',
    quantity: Number(ci.quantity) || 1,
    rawTotalPrice: Number(ci.rawTotalPrice) || Number(ci.amount) || 0,
    unitPrice: Number(ci.unitPrice) || Number(ci.listPrice) || 0,
  }));

  return {
    orderId: data.orderId || orderId,
    state: data.state || '',
    commerceItems: items,
  };
}

/**
 * Fetch all data for all 4 stores
 */
export async function fetchAllStoresData() {
  const token = await authenticate();

  const results: {
    shipments: Array<B2bShipment & { store: string; orgId: string }>;
    orders: Array<B2bOrder & { store: string; orgId: string }>;
  } = {
    shipments: [],
    orders: [],
  };

  for (const [store, orgId] of Object.entries(STORE_ORGS)) {
    try {
      const shipments = await fetchShipments(token, orgId);
      for (const s of shipments) {
        results.shipments.push({ ...s, store, orgId });
      }
    } catch (err) {
      console.error(`Failed to fetch shipments for ${store}:`, err);
    }

    try {
      const orders = await fetchOrders(token, orgId);
      for (const o of orders) {
        results.orders.push({ ...o, store, orgId });
      }
    } catch (err) {
      console.error(`Failed to fetch orders for ${store}:`, err);
    }

    // Small delay between stores to avoid rate limiting
    await new Promise(r => setTimeout(r, 500));
  }

  return results;
}
