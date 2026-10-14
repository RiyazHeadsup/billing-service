const crypto = require('crypto');

// Cashfree Payment Gateway (PG API 2023-08-01), called over HTTPS directly.
// Ported from the old backend's billing-service, without the cashfree-pg SDK.
//
// Env: CASHFREE_APP_ID, CASHFREE_SECRET_KEY, CASHFREE_ENVIRONMENT
// (SANDBOX | PRODUCTION, default SANDBOX), CASHFREE_NOTIFY_URL.

const API_VERSION = '2023-08-01';

class CashfreeService {
  constructor() {
    this.appId = process.env.CASHFREE_APP_ID;
    this.secretKey = process.env.CASHFREE_SECRET_KEY;
    this.environment = (process.env.CASHFREE_ENVIRONMENT || 'SANDBOX').toUpperCase() === 'PRODUCTION' ? 'PRODUCTION' : 'SANDBOX';
    this.baseUrl = this.environment === 'PRODUCTION' ? 'https://api.cashfree.com/pg' : 'https://sandbox.cashfree.com/pg';
    this.notifyUrl = process.env.CASHFREE_NOTIFY_URL || 'https://app-api.elevatelifestyle.in/billingservice/cashfreeWebhook';

    if (!this.isConfigured()) {
      console.warn('[Cashfree] CASHFREE_APP_ID / CASHFREE_SECRET_KEY not set — Cashfree payments disabled');
    }
  }

  isConfigured() {
    return !!(this.appId && this.secretKey);
  }

  generateOrderId(prefix = 'ORD') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  }

  async request(method, path, body) {
    if (!this.isConfigured()) throw new Error('Cashfree not configured');
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-api-version': API_VERSION,
        'x-client-id': this.appId,
        'x-client-secret': this.secretKey
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20000)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const error = new Error(data?.message || `Cashfree ${res.status}`);
      error.status = res.status;
      error.data = data;
      throw error;
    }
    return data;
  }

  // → { order_id, payment_session_id, order_status, ... }
  createOrder({ orderId, amount, customerId, customerPhone, customerEmail, customerName, orderNote }) {
    return this.request('POST', '/orders', {
      order_id: orderId,
      order_amount: Number(Number(amount).toFixed(2)),
      order_currency: 'INR',
      customer_details: {
        customer_id: String(customerId),
        customer_phone: String(customerPhone || '9999999999'),
        ...(customerEmail && { customer_email: customerEmail }),
        ...(customerName && { customer_name: customerName })
      },
      order_meta: { notify_url: this.notifyUrl },
      ...(orderNote && { order_note: String(orderNote).slice(0, 200) })
    });
  }

  // → { order_id, order_amount, order_status: ACTIVE | PAID | EXPIRED | TERMINATED | ... }
  fetchOrder(orderId) {
    return this.request('GET', `/orders/${encodeURIComponent(orderId)}`);
  }

  // → [{ cf_payment_id, payment_status, payment_group, ... }]
  async fetchPayments(orderId) {
    try {
      return await this.request('GET', `/orders/${encodeURIComponent(orderId)}/payments`);
    } catch (error) {
      console.log('[Cashfree] fetchPayments:', error.message);
      return [];
    }
  }

  verifyWebhookSignature(rawBody, timestamp, signature) {
    if (!this.secretKey || !rawBody || !timestamp || !signature) return false;
    const expected = crypto.createHmac('sha256', this.secretKey).update(timestamp + rawBody).digest('base64');
    const a = Buffer.from(expected);
    const b = Buffer.from(String(signature));
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }
}

module.exports = new CashfreeService();
