const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const axios = require('axios');

// Load environment variables
dotenv.config();

// Ensure core environment variables are defined in production
const REQUIRED_ENV = ['DATABASE_URL', 'META_APP_ID', 'META_APP_SECRET', 'JWT_SECRET'];
REQUIRED_ENV.forEach(name => {
    if (!process.env[name]) {
        console.warn(`⚠️ WARNING: Environment variable ${name} is not set.`);
    }
});

const db = require('./db');
const metaApi = require('./utils/metaApi');
const pdfGenerator = require('./utils/pdfGenerator');

// Smart Environment Variable Resolution Helpers
const getMetaAppId = () => process.env.META_APP_ID || process.env.mock_meta_app_id || 'mock_app_id';
const getMetaAppSecret = () => process.env.META_APP_SECRET || process.env.mock_meta_app_secret || 'mock_app_secret';
const bkash = require('./utils/bkash');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS and body parsers
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Disable caching to prevent browser caching of index.html and app.js
app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    next();
});

// Serve static frontend files directly from root
app.use(express.static(path.join(__dirname, '.')));

/* ==========================================================================
   1. Facebook/Meta OAuth Login Endpoints
   ========================================================================== */

// Debug Environment Variables
app.get('/api/debug-env', (req, res) => {
    res.json({
        keys: Object.keys(process.env).filter(k => !k.includes('KEY') && !k.includes('SECRET') && !k.includes('PASS') && !k.includes('TOKEN') && !k.includes('URL') && !k.includes('CONN')),
        META_APP_ID_EXISTS: !!getMetaAppId() && getMetaAppId() !== 'mock_app_id',
        META_APP_ID_TYPE: typeof getMetaAppId(),
        META_APP_ID_VALUE: getMetaAppId()
    });
});

// OAuth Redirect URL construction
app.get('/api/auth/facebook', (req, res) => {
    const redirectUri = `http://localhost:${PORT}/api/auth/facebook/callback`;
    const appId = getMetaAppId();
    
    // Official Facebook Login redirect
    const authUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=ads_read,email`;
    
    if (appId === 'mock_app_id' || appId.startsWith('mock_')) {
        // If developer sandbox mode, redirect to mock Facebook login page
        return res.json({ url: `/mock-facebook-login.html` });
    }
    
    res.json({ url: authUrl });
});

// OAuth Callback Webhook
app.get('/api/auth/facebook/callback', async (req, res) => {
    const code = req.query.code;
    
    if (!code) {
        return res.redirect(`/?auth=error&reason=no_code`);
    }

    // Default mock user profile if using mock sandbox
    let fbUser = {
        facebook_id: "123456789",
        email: "merchant@example.com",
        name: "Mock Merchant BD",
        access_token: "mock_access_token_" + Math.random().toString(36).substring(7)
    };

    try {
        // Exchange code for Access Token if using real App IDs
        if (getMetaAppId() && !getMetaAppId().startsWith('mock_')) {
            const redirectUri = `http://localhost:${PORT}/api/auth/facebook/callback`;
            const tokenUrl = `https://graph.facebook.com/v19.0/oauth/access_token`;
            
            const tokenRes = await axios.get(tokenUrl, {
                params: {
                    client_id: getMetaAppId(),
                    client_secret: getMetaAppSecret(),
                    redirect_uri: redirectUri,
                    code: code
                }
            });
            
            const accessToken = tokenRes.data.access_token;
            
            // Get user details
            const userUrl = `https://graph.facebook.com/me`;
            const userRes = await axios.get(userUrl, {
                params: {
                    fields: 'id,name,email',
                    access_token: accessToken
                }
            });
            
            fbUser = {
                facebook_id: userRes.data.id,
                email: userRes.data.email || '',
                name: userRes.data.name,
                access_token: accessToken
            };
        }

        // Query database to see if user exists, else insert
        const existing = await db.query('SELECT * FROM users WHERE facebook_id = $1', [fbUser.facebook_id]);
        let userTier = 'free';
        
        if (existing.rows.length === 0) {
            await db.query(
                'INSERT INTO users (facebook_id, email, name, access_token, tier) VALUES ($1, $2, $3, $4, $5)',
                [fbUser.facebook_id, fbUser.email, fbUser.name, fbUser.access_token, 'free']
            );
        } else {
            await db.query(
                'UPDATE users SET access_token = $1 WHERE facebook_id = $2',
                [fbUser.access_token, fbUser.facebook_id]
            );
            userTier = existing.rows[0].tier;
        }
        
        // Redirect back to dashboard passing tier parameters
        res.redirect(`/?auth=success&facebook_id=${fbUser.facebook_id}&name=${encodeURIComponent(fbUser.name)}&tier=${userTier}`);
    } catch (err) {
        console.error('❌ Meta OAuth exchange failure:', err.message);
        res.redirect(`/?auth=error`);
    }
});

/* ==========================================================================
   2. Campaign Analytics and Validation
   ========================================================================== */

app.get('/api/campaigns', async (req, res) => {
    const facebookId = req.query.facebook_id;
    if (!facebookId) {
        return res.status(400).json({ error: "Missing facebookId parameter." });
    }
    
    try {
        const userResult = await db.query('SELECT * FROM users WHERE facebook_id = $1', [facebookId]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: "User not connected. Connect Meta Account first." });
        }
        
        const user = userResult.rows[0];
        
        // Fetch raw campaigns insights from live Meta API wrapper
        const rawCampaigns = await metaApi.getAdCampaigns(user.access_token, "act_mock_account");
        
        // Run validation algorithm on live campaigns to calculate overall metrics
        let totalSpend = 0;
        let totalPurchases = 0;
        let totalCtrSum = 0;
        let totalRoasSum = 0;

        rawCampaigns.forEach(c => {
            totalSpend += c.spend;
            totalPurchases += c.purchases;
            totalCtrSum += c.ctr;
            totalRoasSum += c.roas;
        });

        const avgCtr = rawCampaigns.length > 0 ? parseFloat((totalCtrSum / rawCampaigns.length).toFixed(2)) : 0;
        const avgRoas = rawCampaigns.length > 0 ? parseFloat((totalRoasSum / rawCampaigns.length).toFixed(2)) : 0;
        const cpa = totalPurchases > 0 ? Math.round(totalSpend / totalPurchases) : totalSpend;

        // Calculate score out of 100
        let roasScore = avgRoas >= 3.0 ? 100 : (avgRoas <= 1.0 ? 0 : ((avgRoas - 1.0) / 2.0) * 100);
        let ctrScore = avgCtr >= 2.5 ? 100 : (avgCtr <= 0.2 ? 0 : ((avgCtr - 0.2) / 2.3) * 100);
        let cpaScore = cpa <= 200 ? 100 : (cpa >= 500 ? 0 : ((500 - cpa) / 300) * 100);
        
        let score = Math.max(0, Math.min(100, Math.round((roasScore * 0.50) + (ctrScore * 0.25) + (cpaScore * 0.25))));

        let status = 'tweak';
        if (score >= 70) status = 'win';
        else if (score < 40) status = 'loss';

        res.json({
            user: { name: user.name, tier: user.tier },
            score,
            status,
            spend: totalSpend,
            purchases: totalPurchases,
            roas: avgRoas,
            ctr: avgCtr,
            cpa,
            campaigns: rawCampaigns
        });
    } catch (err) {
        console.error('❌ Error executing API campaign query:', err.message);
        res.status(500).json({ error: "Failed to load Meta ad campaigns" });
    }
});

/* ==========================================================================
   3. PDF Report Generation Endpoint
   ========================================================================== */

app.get('/api/campaigns/pdf', (req, res) => {
    const spend = parseInt(req.query.spend || 50000);
    const purchases = parseInt(req.query.purchases || 250);
    const roas = parseFloat(req.query.roas || 2.2);
    const ctr = parseFloat(req.query.ctr || 1.5);
    const score = parseInt(req.query.score || 65);
    const status = req.query.status || 'tweak';
    const tier = req.query.tier || 'free';
    const lang = req.query.lang || 'en';

    const campaignsList = [
        {
            name: lang === 'en' ? "Eid Clearance Sale - Video" : "ঈদ ক্লিয়ারেন্স সেল - ভিডিও",
            ctr: (ctr * 1.3).toFixed(2) + "%",
            roas: (roas * 1.25).toFixed(1) + "x",
            status: status === 'loss' ? 'tweak' : 'win',
            action: lang === 'en' ? "Scale budget +15%" : "বাজেট ১৫% বৃদ্ধি করুন"
        },
        {
            name: lang === 'en' ? "Saree Collection Carousel" : "শাড়ি কালেকশন ক্যারোসেল",
            ctr: (ctr * 0.9).toFixed(2) + "%",
            roas: (roas * 0.95).toFixed(1) + "x",
            status: status === 'win' ? 'win' : (status === 'loss' ? 'loss' : 'tweak'),
            action: lang === 'en' ? "Monitor performance" : "পারফরম্যান্স মনিটর করুন"
        },
        {
            name: lang === 'en' ? "Message Campaign (Inbox)" : "মেসেজ ক্যাম্পেইন (ইনবক্স)",
            ctr: (ctr * 0.6).toFixed(2) + "%",
            roas: (roas * 0.4).toFixed(1) + "x",
            status: 'loss',
            action: lang === 'en' ? "Stop immediately" : "অবিলম্বে বন্ধ করুন"
        }
    ];

    const recommendationAction = status === 'win' 
        ? (lang === 'en' ? 'Increase budget to scale sales.' : 'বিক্রি বাড়াতে বাজেট বৃদ্ধি করুন।')
        : (status === 'loss' 
            ? (lang === 'en' ? 'Pause campaign immediately.' : 'ক্যাম্পেইনটি অবিলম্বে বন্ধ (Pause) করুন।')
            : (lang === 'en' ? 'Update ad creative, hooks, or images.' : 'বিজ্ঞপ্তির ছবি, ভিডিও বা ক্যাপশন পরিবর্তন করুন।'));

    const data = {
        spend,
        purchases,
        roas,
        ctr,
        score,
        status,
        tier,
        campaignsList,
        recommendationAction
    };

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=HisabAd_Audit_Report_${lang}.pdf`);

    pdfGenerator.generateAuditReport(res, data, lang);
});

/* ==========================================================================
   4. Mock WhatsApp PDF Delivery
   ========================================================================== */

app.post('/api/whatsapp/send', async (req, res) => {
    const { phone, score, status } = req.body;
    
    if (!phone) {
        return res.status(400).json({ error: "Phone number required" });
    }

    console.log(`💬 [MOCK WHATSAPP API] Sending PDF Report to +880${phone}. Grade Score: ${score}, status: ${status}`);
    
    setTimeout(() => {
        res.json({ success: true, message: `Report PDF sent to WhatsApp +880${phone} successfully.` });
    }, 1000);
});

/* ==========================================================================
   5. Tokenized bKash Checkout Integration Webhooks
   ========================================================================== */

// Create payment transaction
app.post('/api/payments/bkash/create', async (req, res) => {
    const { amount, plan, facebook_id } = req.body;
    const fbId = facebook_id || "123456789";
    const paymentAmount = plan === 'agency' ? 2990 : 990;

    // Define callback URL referencing this server callback webhook
    const callbackURL = `http://localhost:${PORT}/api/payments/bkash/callback?facebook_id=${fbId}&plan=${plan}`;

    try {
        const paymentResult = await bkash.createPayment(paymentAmount, fbId, callbackURL);
        
        res.json({
            success: true,
            paymentID: paymentResult.paymentID,
            bkashURL: paymentResult.bkashURL
        });
    } catch (err) {
        console.error('❌ Error creating bKash payment session:', err.message);
        res.status(500).json({ error: "Failed to initialize payment gateway" });
    }
});

// Mock portal redirect loop wrapper (when credentials are empty)
app.get('/api/payments/bkash/mock-portal', (req, res) => {
    const { paymentID, callback } = req.query;
    // Redirect browser directly to callback passing status success
    res.redirect(`${callback}&status=success&paymentID=${paymentID}`);
});

// Callback verification webhook (Redirected from bKash gateway)
app.get('/api/payments/bkash/callback', async (req, res) => {
    const { paymentID, status, facebook_id, plan } = req.query;
    
    if (status !== 'success') {
        return res.redirect(`/?payment=cancel`);
    }

    try {
        // Capture/Execute payment on bKash API servers
        const executeResult = await bkash.executePayment(paymentID);
        
        if (executeResult.transactionStatus === 'Completed') {
            // Update PostgreSQL database record
            await db.query('UPDATE users SET tier = $1 WHERE facebook_id = $2', [plan, facebook_id]);
            
            // Get user name
            const userResult = await db.query('SELECT name FROM users WHERE facebook_id = $1', [facebook_id]);
            const name = userResult.rows.length > 0 ? userResult.rows[0].name : "Merchant";
            
            // Redirect user back to frontend passing success states
            res.redirect(`/?auth=success&facebook_id=${facebook_id}&name=${encodeURIComponent(name)}&tier=${plan}&payment=success`);
        } else {
            res.redirect(`/?payment=fail`);
        }
    } catch (err) {
        console.error('❌ Error executing bKash payment callback verification:', err.message);
        res.redirect(`/?payment=fail`);
    }
});

// Serves the client SPA by default
app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start Server
app.listen(PORT, () => {
    console.log(`🚀 HisabAd SaaS backend server running at http://localhost:${PORT}`);
});
