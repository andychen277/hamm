#!/usr/bin/env node
/**
 * Test Specialized B2B Sync
 * 测试每个店铺的数据同步情况
 *
 * Usage:
 *   SPEC_B2B_USERNAME=xxx SPEC_B2B_PASSWORD=xxx node scripts/test-spec-sync.js
 */

// SAML and OCC endpoints
const SAML_API = 'https://api-sp.todaysplan.com.au/rest/saml/login';
const SAML_API_KEY = '721e9uug6v54ildlrv90oqe8d0';
const OCC_BASE = 'https://b2b.specialized.com';
const OCC_LOGIN = `${OCC_BASE}/ccstore/v1/login`;
const OCC_SHIPMENTS = `${OCC_BASE}/ccstorex/custom/v1/RecentShipment`;
const OCC_ORDERS = `${OCC_BASE}/ccstore/v1/orders`;

// Store Organization IDs
const STORE_ORGS = {
  '台南': '4200039',
  '台北': '4100300',
  '台中': '4200284',
  '高雄': '4200283',
};

async function getSamlResponse(username, password) {
  console.log('🔐 Step 1: Getting SAML Response...');
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
  console.log('   ✅ SAML Response obtained');
  return match[1];
}

async function getOccToken(samlResponse) {
  console.log('🔑 Step 2: Getting OCC Access Token...');
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
  console.log('   ✅ Access Token obtained');
  console.log(`   ⏰ Expires in: ${data.expires_in}s`);
  return data.access_token;
}

async function fetchShipments(token, orgId, storeName) {
  console.log(`\n📦 Fetching shipments for ${storeName} (${orgId})...`);
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
    console.error(`   ❌ Failed: ${res.status} - ${text}`);
    return { success: false, error: `${res.status}: ${text}` };
  }

  const data = await res.json();
  const shipments = data.shipments || [];
  console.log(`   ✅ Success: ${shipments.length} shipments`);

  if (shipments.length > 0) {
    console.log('   📋 Sample:');
    shipments.slice(0, 3).forEach(s => {
      console.log(`      - ${s.shipmentNumber || s.shipmentId}: ${s.shipTo || 'N/A'} (${s.shippedQty || 0} items)`);
    });
  }

  return { success: true, count: shipments.length, data: shipments };
}

async function fetchOrders(token, orgId, storeName) {
  console.log(`\n📋 Fetching orders for ${storeName} (${orgId})...`);
  const res = await fetch(`${OCC_ORDERS}?limit=10&offset=0`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'X-CCProfileType': 'storefrontUI',
      'X-CCOrganization': orgId,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`   ❌ Failed: ${res.status} - ${text}`);
    return { success: false, error: `${res.status}: ${text}` };
  }

  const data = await res.json();
  const orders = data.items || [];
  const total = data.total || orders.length;
  console.log(`   ✅ Success: ${total} total orders (showing ${orders.length})`);

  if (orders.length > 0) {
    console.log('   📋 Sample:');
    orders.slice(0, 3).forEach(o => {
      const date = o.creationTime ? new Date(o.creationTime).toISOString().split('T')[0] : 'N/A';
      console.log(`      - ${o.orderId}: ${o.state} (${date})`);
    });
  }

  return { success: true, count: total, data: orders };
}

async function main() {
  console.log('\n🚴 Specialized B2B Sync Test\n');
  console.log('='.repeat(50));

  const username = process.env.SPEC_B2B_USERNAME;
  const password = process.env.SPEC_B2B_PASSWORD;

  if (!username || !password) {
    console.error('❌ Error: SPEC_B2B_USERNAME and SPEC_B2B_PASSWORD must be set in .env');
    process.exit(1);
  }

  console.log(`📧 Username: ${username}`);
  console.log('='.repeat(50));

  try {
    // Authenticate
    const samlResponse = await getSamlResponse(username, password);
    const token = await getOccToken(samlResponse);

    console.log('\n' + '='.repeat(50));
    console.log('📊 Testing Each Store');
    console.log('='.repeat(50));

    const results = {
      shipments: {},
      orders: {},
    };

    // Test each store
    for (const [storeName, orgId] of Object.entries(STORE_ORGS)) {
      console.log(`\n${'▼'.repeat(25)}`);
      console.log(`🏪 ${storeName} (Org ID: ${orgId})`);
      console.log('▼'.repeat(25));

      // Fetch shipments
      const shipmentResult = await fetchShipments(token, orgId, storeName);
      results.shipments[storeName] = shipmentResult;

      // Small delay
      await new Promise(r => setTimeout(r, 500));

      // Fetch orders
      const orderResult = await fetchOrders(token, orgId, storeName);
      results.orders[storeName] = orderResult;

      // Small delay between stores
      await new Promise(r => setTimeout(r, 500));
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 SUMMARY');
    console.log('='.repeat(50));

    console.log('\n📦 Shipments:');
    for (const [storeName, result] of Object.entries(results.shipments)) {
      const status = result.success ? '✅' : '❌';
      const count = result.success ? result.count : 0;
      const error = result.error || '';
      console.log(`   ${status} ${storeName}: ${count} shipments ${error ? `(${error})` : ''}`);
    }

    console.log('\n📋 Orders:');
    for (const [storeName, result] of Object.entries(results.orders)) {
      const status = result.success ? '✅' : '❌';
      const count = result.success ? result.count : 0;
      const error = result.error || '';
      console.log(`   ${status} ${storeName}: ${count} orders ${error ? `(${error})` : ''}`);
    }

    console.log('\n' + '='.repeat(50));
    console.log('✅ Test completed!');
    console.log('='.repeat(50) + '\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

main();
