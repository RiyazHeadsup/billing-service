// Quick test to verify Paytm credentials
require('dotenv').config();
const PaytmChecksum = require('paytmchecksum');

const mid = process.env.PAYTM_MID;
const key = process.env.PAYTM_MERCHANT_KEY;
const website = process.env.PAYTM_WEBSITE;
const baseUrl = process.env.PAYTM_BASE_URL;
const callbackUrl = process.env.PAYTM_CALLBACK_URL;

console.log('=== Paytm Config ===');
console.log('MID:', mid);
console.log('Key:', key);
console.log('Key length:', key?.length);
console.log('Website:', website);
console.log('Base URL:', baseUrl);
console.log('Callback URL:', callbackUrl);
console.log('');

async function test() {
  const orderId = 'TEST_' + Date.now();

  const body = {
    requestType: 'Payment',
    mid: mid,
    websiteName: website,
    orderId: orderId,
    txnAmount: { value: '1.00', currency: 'INR' },
    userInfo: { custId: 'TEST_CUST_001' },
    callbackUrl: callbackUrl,
  };

  const signature = await PaytmChecksum.generateSignature(JSON.stringify(body), key);
  console.log('Signature generated:', signature.substring(0, 20) + '...');

  const url = `${baseUrl}/theia/api/v1/initiateTransaction?mid=${mid}&orderId=${orderId}`;
  console.log('Request URL:', url);
  console.log('Request Body:', JSON.stringify(body, null, 2));
  console.log('');

  // Test with current website value
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body, head: { signature } }),
  });
  const result = await res.json();
  console.log(`=== Response (website="${website}") ===`);
  console.log(JSON.stringify(result, null, 2));

  // If failed, try the other website value
  const altWebsite = website === 'WEBSTAGING' ? 'DEFAULT' : 'WEBSTAGING';
  const body2 = { ...body, websiteName: altWebsite, orderId: orderId + '_2' };
  const sig2 = await PaytmChecksum.generateSignature(JSON.stringify(body2), key);
  const url2 = `${baseUrl}/theia/api/v1/initiateTransaction?mid=${mid}&orderId=${orderId}_2`;

  const res2 = await fetch(url2, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body: body2, head: { signature: sig2 } }),
  });
  const result2 = await res2.json();
  console.log(`\n=== Response (website="${altWebsite}") ===`);
  console.log(JSON.stringify(result2, null, 2));
}

test().catch(console.error);
