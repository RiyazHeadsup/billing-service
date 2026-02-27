const PaytmChecksum = require('paytmchecksum');

class PaytmService {
  constructor() {
    this.mid = process.env.PAYTM_MID;
    this.merchantKey = process.env.PAYTM_MERCHANT_KEY;
    this.website = process.env.PAYTM_WEBSITE || 'DEFAULT';
    this.baseUrl = process.env.PAYTM_BASE_URL || 'https://secure.paytmpayments.com';
    this.callbackUrl = process.env.PAYTM_CALLBACK_URL;
  }

  async generateSignature(body) {
    return await PaytmChecksum.generateSignature(JSON.stringify(body), this.merchantKey);
  }

  async verifySignature(body, receivedSignature) {
    return PaytmChecksum.verifySignature(JSON.stringify(body), this.merchantKey, receivedSignature);
  }

  async initiateTransaction(orderId, amount, custId) {
    const body = {
      requestType: 'Payment',
      mid: this.mid,
      websiteName: this.website,
      orderId: orderId,
      txnAmount: {
        value: String(Number(amount).toFixed(2)),
        currency: 'INR'
      },
      userInfo: {
        custId: String(custId)
      },
      callbackUrl: this.callbackUrl
    };

    const signature = await this.generateSignature(body);

    const url = `${this.baseUrl}/theia/api/v1/initiateTransaction?mid=${this.mid}&orderId=${orderId}`;

    console.log('--- Paytm initiateTransaction ---');
    console.log('URL:', url);
    console.log('MID:', this.mid);
    console.log('Key (first 4 chars):', this.merchantKey?.substring(0, 4));
    console.log('Body:', JSON.stringify(body, null, 2));
    console.log('Callback URL:', this.callbackUrl);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        body: body,
        head: { signature: signature }
      })
    });

    const result = await response.json();
    console.log('Paytm Response:', JSON.stringify(result, null, 2));
    return result;
  }

  async getTransactionStatus(orderId) {
    const body = {
      mid: this.mid,
      orderId: orderId
    };

    const signature = await this.generateSignature(body);

    const url = `${this.baseUrl}/v3/order/status`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        body: body,
        head: { signature: signature }
      })
    });

    const result = await response.json();
    return result;
  }

  async initiateRefund(orderId, refundId, txnId, refundAmount) {
    const body = {
      mid: this.mid,
      txnType: 'REFUND',
      orderId: orderId,
      txnId: txnId,
      refId: refundId,
      refundAmount: String(Number(refundAmount).toFixed(2))
    };

    const signature = await this.generateSignature(body);

    const url = `${this.baseUrl}/refund/apply`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        body: body,
        head: { signature: signature }
      })
    });

    const result = await response.json();
    return result;
  }

  generateOrderId(prefix = 'ORD') {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `${prefix}_${timestamp}_${random}`;
  }
}

module.exports = new PaytmService();
