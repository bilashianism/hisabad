const axios = require('axios');
require('dotenv').config();

const BKASH_BASE_URL = process.env.BKASH_BASE_URL || 'https://tokenized.sandbox.bka.sh/v1.2.0-beta/tokenized/checkout';

/**
 * Generate bKash API authentication headers
 */
async function getHeaders() {
    const idToken = await grantToken();
    return {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': idToken,
        'X-APP-Key': process.env.BKASH_APP_KEY
    };
}

/**
 * Request Grant Token (JWT Session ID) from bKash API
 */
async function grantToken() {
    // If credentials are empty, bypass to prevent crashes during sandbox tests
    if (!process.env.BKASH_APP_KEY || !process.env.BKASH_APP_SECRET) {
        console.log('⚠️ BKash sandbox credentials missing in .env. Mock token returned.');
        return 'mock_bkash_id_token';
    }
    
    try {
        const response = await axios.post(`${BKASH_BASE_URL}/token/grant`, {
            app_key: process.env.BKASH_APP_KEY,
            app_secret: process.env.BKASH_APP_SECRET
        }, {
            headers: {
                'username': process.env.BKASH_USERNAME,
                'password': process.env.BKASH_PASSWORD
            }
        });
        return response.data.id_token;
    } catch (err) {
        console.error('❌ bKash grantToken API failure:', err.message);
        throw new Error('bKash Authentication failed.');
    }
}

/**
 * Initialize Tokenized checkout transaction
 */
async function createPayment(amount, payerReference, callbackURL) {
    if (!process.env.BKASH_APP_KEY) {
        // Mock Redirect path if credentials aren't set
        const mockPaymentId = 'MOCK_TRX_' + Math.random().toString(36).substring(7).toUpperCase();
        return {
            paymentID: mockPaymentId,
            bkashURL: `/api/payments/bkash/mock-portal?paymentID=${mockPaymentId}&amount=${amount}&ref=${payerReference}&callback=${encodeURIComponent(callbackURL)}`
        };
    }

    try {
        const headers = await getHeaders();
        const response = await axios.post(`${BKASH_BASE_URL}/create`, {
            mode: '0011', // Instant checkout
            payerReference,
            callbackURL,
            amount: amount.toString(),
            currency: 'BDT',
            intent: 'sale',
            merchantInvoiceNumber: 'INV_' + Date.now()
        }, { headers });
        
        return response.data;
    } catch (err) {
        console.error('❌ bKash createPayment API failure:', err.message);
        throw err;
    }
}

/**
 * Finalize and capture the bKash transaction
 */
async function executePayment(paymentID) {
    if (paymentID.startsWith('MOCK_')) {
        return {
            transactionStatus: 'Completed',
            trxID: 'BKASH' + Math.floor(100000 + Math.random() * 900000) + 'XF',
            amount: '990'
        };
    }

    try {
        const headers = await getHeaders();
        const response = await axios.post(`${BKASH_BASE_URL}/execute`, {
            paymentID
        }, { headers });
        
        return response.data;
    } catch (err) {
        console.error('❌ bKash executePayment API failure:', err.message);
        throw err;
    }
}

module.exports = {
    createPayment,
    executePayment
};
