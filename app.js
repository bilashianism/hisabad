/* ==========================================================================
   HisabAd - Production Client-Side Application Script
   ========================================================================== */

const API_BASE = window.location.protocol === 'file:' ? 'http://localhost:3000' : '';

// Safe Session Storage Helper with In-Memory fallback (incognito mode support)
const SafeSession = {
    _memoryStore: {},
    setItem(key, value) {
        try {
            sessionStorage.setItem(key, value);
        } catch (e) {
            this._memoryStore[key] = value;
        }
    },
    getItem(key) {
        try {
            return sessionStorage.getItem(key);
        } catch (e) {
            return this._memoryStore[key] || null;
        }
    },
    removeItem(key) {
        try {
            sessionStorage.removeItem(key);
        } catch (e) {
            delete this._memoryStore[key];
        }
    }
};

// Translations Dictionaries
const translations = {
    en: {
        winning: "Winning",
        tweakNeeded: "Tweak Needed",
        losing: "Losing",
        winDesc: "Your campaigns are performing exceptionally well. High ROAS and low CPA indicate high efficiency.",
        tweakDesc: "Your ROAS is borderline. CTR is low, which suggests users see the ad but don't click. Refresh your creative/images.",
        lossDesc: "High spend with extremely low return. You are losing money. Pause these campaigns immediately to prevent loss.",
        winAction: "Increase budget to scale sales.",
        tweakAction: "Update ad creative, hooks, or images.",
        lossAction: "Pause campaign immediately.",
        proTier: "Pro Tier",
        freeTier: "Free Tier",
        cpaGood: "🟢 Good (Target BDT 250)",
        cpaBorder: "🟡 High (Target BDT 250)",
        cpaBad: "🔴 Critical (Target BDT 250)",
        roasGood: "🟢 Profitable",
        roasBorder: "🟡 Borderline",
        roasBad: "🔴 Unprofitable",
        copyToast: "Copied to clipboard!",
        upgradeSuccess: "Upgrade successful! Welcome to HisabAd Pro.",
        otpSent: "OTP sent to WhatsApp!",
        smsTemplate: `Hello Team,

Please grant View-Only (Analyst) access to our Meta Ad Account (ID: {AD_ACCOUNT_ID}) for the HisabAd Audit tool. 

You can assign the role to: audit@hisabad.com. Let us know once completed.

Thank you!`
    },
    bn: {
        winning: "উইনিং (লাভজনক)",
        tweakNeeded: "টিউনিং প্রয়োজন",
        losing: "লুজিং (লোকসান)",
        winDesc: "আপনার ক্যাম্পেইন অসাধারণ পারফর্ম করছে। উচ্চ ROAS এবং কম CPA ভালো বিজ্ঞাপন কার্যকারিতা নির্দেশ করে।",
        tweakDesc: "বিজ্ঞাপন থেকে কোনোমতে খরচ উঠছে। তবে CTR কম, যা নির্দেশ করে ক্রেতারা ছবি বা লেখা পছন্দ করছেন না। ক্রিয়েটিভ আপডেট করুন।",
        lossDesc: "খরচের তুলনায় রিটার্ন খুবই কম। বিজ্ঞাপনটি লোকসান দিচ্ছে। বাজেট বাঁচাতে এখনই বন্ধ করুন।",
        winAction: "বিক্রি বাড়াতে বাজেট বৃদ্ধি করুন।",
        tweakAction: "বিজ্ঞপ্তির ছবি, ভিডিও বা ক্যাপশন পরিবর্তন করুন।",
        lossAction: "ক্যাম্পেইনটি অবিলম্বে বন্ধ (Pause) করুন।",
        proTier: "প্রো টায়ার",
        freeTier: "ফ্রি টায়ার",
        cpaGood: "🟢 ভালো (টার্গেট ২৫০ টাকা)",
        cpaBorder: "🟡 সাধারণ (টার্গেট ২৫০ টাকা)",
        cpaBad: "🔴 আশঙ্কাজনক (টার্গেট ২৫০ টাকা)",
        roasGood: "🟢 লাভজনক",
        roasBorder: "🟡 ঝুঁকিপূর্ণ",
        roasBad: "🔴 লোকসান",
        copyToast: "ক্লিপবোর্ডে কপি করা হয়েছে!",
        upgradeSuccess: "সফলভাবে প্রো টায়ার আপগ্রেড হয়েছে! হিসাবঅ্যাড প্রো-তে স্বাগতম।",
        otpSent: "হোয়াটসঅ্যাপে ওটিপি পাঠানো হয়েছে!",
        smsTemplate: `হ্যালো টিম,

দয়া করে আমাদের মেটা অ্যাড অ্যাকাউন্টে (ID: {AD_ACCOUNT_ID}) HisabAd অডিট টুলের জন্য ভিউ-অনলি (অ্যানালিস্ট) অ্যাক্সেস প্রদান করুন।

এই ইমেইলে অ্যাক্সেস দিন: audit@hisabad.com। সম্পূর্ণ হলে দয়া করে জানান।

ধন্যবাদ!`
    }
};

// Application State Variables
let currentLang = 'en';
let currentTier = 'free'; // 'free', 'pro', or 'agency'
let loggedInUser = null; // Stores { facebook_id, name, tier } when authenticated

// Core Dashboard variables (fetched live from APIs)
let currentDataState = {
    score: 0,
    status: 'tweak',
    spend: 0,
    purchases: 0,
    roas: 0,
    ctr: 0
};

// DOM Screens
const screenOnboarding = document.getElementById('screen-onboarding');
const screenDashboard = document.getElementById('screen-dashboard');
const modalAgency = document.getElementById('modal-agency-template');
const modalBkash = document.getElementById('modal-bkash-checkout');
const modalAuditSelect = document.getElementById('modal-audit-select');

// Scoreboard labels
const lblScoreNum = document.getElementById('lbl-score-num');
const scoreRingProgress = document.getElementById('score-ring-progress');
const lblStatusBadge = document.getElementById('lbl-status-badge');
const lblStatusText = document.getElementById('lbl-status-text');
const lblAssessmentTitle = document.getElementById('lbl-assessment-title');
const lblAssessmentDesc = document.getElementById('lbl-assessment-desc');
const lblActionText = document.getElementById('lbl-action-text');

// Quick Stats Card Labels
const cardMetricSpend = document.getElementById('card-metric-spend');
const cardMetricCpa = document.getElementById('card-metric-cpa');
const cardMetricCpaStatus = document.getElementById('card-metric-cpa-status');
const cardMetricRoas = document.getElementById('card-metric-roas');
const cardMetricRoasStatus = document.getElementById('card-metric-roas-status');

// Campaign Table body
const campaignTableBody = document.getElementById('campaign-table-body');
const activeCampaignCount = document.getElementById('active-campaign-count');

// WhatsApp elements
const inputWhatsappNumber = document.getElementById('whatsapp-number');
const btnSendWhatsapp = document.getElementById('btn-send-whatsapp');
const btnDownloadPdf = document.getElementById('btn-download-pdf');

// Subscription Card Tiers
const tierFreeCard = document.getElementById('tier-free-card');
const tierProCard = document.getElementById('tier-pro-card');
const tierAgencyCard = document.getElementById('tier-agency-card');

// Upgrade Trigger buttons
const btnHeaderUpgrade = document.getElementById('btn-header-upgrade');
const btnProUpgrade = document.getElementById('btn-pro-upgrade');
const tierText = document.getElementById('tier-text');
const appToast = document.getElementById('app-toast');

/* ==========================================================================
   2. Audit Selector & Meta Login OAuth
   ========================================================================== */

// Start Audit button opens selector modal
document.getElementById('btn-start-audit').addEventListener('click', () => {
    openModal('select');
});

document.getElementById('btn-close-select-modal').addEventListener('click', () => {
    closeModal('select');
});

// Click Connect Ad Account -> Meta Redirect
document.getElementById('select-card-sync').addEventListener('click', () => {
    closeModal('select');
    showToast(currentLang === 'en' ? "Connecting Meta API..." : "মেটা এপিআই যুক্ত হচ্ছে...");
    
    // Call OAuth redirect API
    fetch(API_BASE + '/api/auth/facebook')
        .then(res => res.json())
        .then(data => {
            if (data.url) {
                window.location.href = data.url.startsWith('http') ? data.url : API_BASE + data.url;
            }
        })
        .catch(err => {
            console.error('Meta Login redirect failed:', err);
            showToast("Connection failed. Try again.");
        });
});

// Click Audit Agency Campaigns -> Open Agency Template Modal
document.getElementById('select-card-agency').addEventListener('click', () => {
    closeModal('select');
    openModal('agency');
});

// Check if URL search parameters contain success login codes from callback
function checkUrlSession() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('auth') === 'success') {
        const userSession = {
            facebook_id: params.get('facebook_id'),
            name: params.get('name'),
            tier: params.get('tier') || 'free'
        };
        
        SafeSession.setItem('hisabad_user', JSON.stringify(userSession));
        
        // Clean URL params
        window.history.replaceState({}, document.title, window.location.pathname);
    }
    
    loadStoredSession();
}

function loadStoredSession() {
    const stored = SafeSession.getItem('hisabad_user');
    if (stored) {
        loggedInUser = JSON.parse(stored);
        currentTier = loggedInUser.tier;
        
        // Populate profile name in sidebar
        const profileName = document.getElementById('profile-name');
        const profileTierText = document.getElementById('profile-tier-text');
        const profileAvatar = document.getElementById('profile-avatar');
        
        if (profileName) profileName.textContent = loggedInUser.name;
        if (profileTierText) profileTierText.textContent = currentLang === 'en' ? (currentTier === 'free' ? 'Free Tier' : 'Pro Tier') : (currentTier === 'free' ? 'ফ্রি টায়ার' : 'প্রো টায়ার');
        if (profileAvatar) profileAvatar.textContent = loggedInUser.name.charAt(0).toUpperCase();

        // Transition to Live Dashboard
        switchScreen('dashboard');
        
        // Show Connected Notification
        showToast(currentLang === 'en' ? `Connected: ${loggedInUser.name}` : `কানেক্টেড: ${loggedInUser.name}`);
        
        // Load Live campaigns from Express Backend API
        fetchCampaignsFromBackend();
    } else {
        // Enforce Login redirection
        switchScreen('onboarding');
    }
    
    updateTierUI();
}

// Fetch campaigns from Backend API
function fetchCampaignsFromBackend() {
    if (!loggedInUser) return;
    
    fetch(API_BASE + `/api/campaigns?facebook_id=${loggedInUser.facebook_id}`)
        .then(res => res.json())
        .then(data => {
            // Update local state variables
            currentDataState = {
                score: data.score,
                status: data.status,
                spend: data.spend,
                purchases: data.purchases,
                roas: data.roas,
                ctr: data.ctr
            };
            
            // Update gauge scoreboard and campaigns lists
            renderDashboardUi(data.campaigns);
        })
        .catch(err => {
            console.error('Error fetching backend campaigns:', err);
            showToast("Failed to fetch campaign insights. Please reconnect Meta.");
            switchScreen('onboarding');
        });
}

// Disconnect/Logout handler
document.getElementById('btn-logout').addEventListener('click', () => {
    SafeSession.removeItem('hisabad_user');
    loggedInUser = null;
    currentTier = 'free';
    switchScreen('onboarding');
    updateTierUI();
    showToast(currentLang === 'en' ? "Disconnected successfully." : "সফলভাবে ডিসকানেক্ট করা হয়েছে।");
});

// Sidebar links navigation clicks
document.getElementById('nav-dash').addEventListener('click', () => {
    showToast(currentLang === 'en' ? "Refreshing Dashboard..." : "ড্যাশবোর্ড রিফ্রেশ করা হচ্ছে...");
    fetchCampaignsFromBackend();
});

document.getElementById('nav-campaigns-link').addEventListener('click', () => {
    const el = document.querySelector('.campaign-list-card');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
});

document.getElementById('nav-billing-link').addEventListener('click', () => {
    openModal('bkash');
});

/* ==========================================================================
   3. Screen Switching & Modals Handlers
   ========================================================================== */

function switchScreen(screenName) {
    if (screenName === 'onboarding') {
        screenOnboarding.classList.add('active');
        screenDashboard.classList.remove('active');
    } else {
        screenOnboarding.classList.remove('active');
        screenDashboard.classList.add('active');
    }
}

function openModal(type) {
    if (type === 'agency') {
        modalAgency.classList.add('active');
        updateAgencyTemplate();
    } else if (type === 'bkash') {
        if (!loggedInUser) {
            showToast(currentLang === 'en' ? "Please connect your Meta account first." : "অনুগ্রহ করে প্রথমে মেটা কানেক্ট করুন।");
            return;
        }
        modalBkash.classList.add('active');
        initBkashFlow();
    } else if (type === 'select') {
        modalAuditSelect.classList.add('active');
    }
}

function closeModal(type) {
    if (type === 'agency') {
        modalAgency.classList.remove('active');
    } else if (type === 'bkash') {
        modalBkash.classList.remove('active');
    } else if (type === 'select') {
        modalAuditSelect.classList.remove('active');
    }
}

document.getElementById('btn-close-agency-modal').addEventListener('click', () => closeModal('agency'));
modalAgency.addEventListener('click', (e) => {
    if (e.target === modalAgency) closeModal('agency');
});

modalAuditSelect.addEventListener('click', (e) => {
    if (e.target === modalAuditSelect) closeModal('select');
});

// Agency template Copy click
document.getElementById('btn-copy-template').addEventListener('click', () => {
    const textarea = document.getElementById('agency-template-text');
    textarea.select();
    navigator.clipboard.writeText(textarea.value).then(() => {
        showToast(translations[currentLang].copyToast);
    });
});

// Flow B simulate access approved
document.getElementById('btn-sim-access-granted').addEventListener('click', () => {
    closeModal('agency');
    
    // Set mock user profile in session
    const mockUserSession = {
        facebook_id: "123456789",
        name: "Agency Account (Audit Client)",
        tier: "free"
    };
    SafeSession.setItem('hisabad_user', JSON.stringify(mockUserSession));
    loadStoredSession();
});

function showToast(message) {
    appToast.textContent = message;
    appToast.classList.add('active');
    setTimeout(() => {
        appToast.classList.remove('active');
    }, 2500);
}

/* ==========================================================================
   4. Language Toggle logic
   ========================================================================== */

document.getElementById('lang-en').addEventListener('click', () => toggleLanguage('en'));
document.getElementById('lang-bn').addEventListener('click', () => toggleLanguage('bn'));

function toggleLanguage(lang) {
    currentLang = lang;
    
    document.getElementById('lang-en').classList.toggle('active', lang === 'en');
    document.getElementById('lang-bn').classList.toggle('active', lang === 'bn');
    
    // Translate data attributes tags
    document.querySelectorAll('[data-en]').forEach(el => {
        const text = el.getAttribute(`data-${lang}`);
        if (text) {
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                el.placeholder = text;
            } else {
                el.innerHTML = text;
            }
        }
    });

    // Update state text changes
    if (loggedInUser) {
        fetchCampaignsFromBackend();
    }
    updateAgencyTemplate();
    updateTierUI();
}

function updateTierUI() {
    tierText.innerHTML = translations[currentLang][currentTier === 'free' ? 'freeTier' : 'proTier'];
    btnHeaderUpgrade.classList.toggle('hidden', currentTier !== 'free');
}

// English and Bangla template toggles in Flow B modal
document.getElementById('btn-tpl-en').addEventListener('click', () => {
    document.getElementById('btn-tpl-en').classList.add('active');
    document.getElementById('btn-tpl-bn').classList.remove('active');
    updateAgencyTemplate('en');
});

document.getElementById('btn-tpl-bn').addEventListener('click', () => {
    document.getElementById('btn-tpl-en').classList.remove('active');
    document.getElementById('btn-tpl-bn').classList.add('active');
    updateAgencyTemplate('bn');
});

function updateAgencyTemplate(lang = currentLang) {
    const mockId = "ACT_" + Math.floor(100000000 + Math.random() * 900000000);
    let template = translations[lang].smsTemplate.replace('{AD_ACCOUNT_ID}', mockId);
    document.getElementById('agency-template-text').value = template;
}

/* ==========================================================================
   5. Production Dashboard Rendering (Clean Table Layout)
   ========================================================================== */

function renderDashboardUi(campaigns = []) {
    const { score, status, spend, purchases, roas, ctr } = currentDataState;
    const cpa = purchases > 0 ? Math.round(spend / purchases) : spend;

    lblScoreNum.textContent = score;

    // Update gauge radial svg
    const circumference = 314.159;
    const offset = circumference - (score / 100) * circumference;
    scoreRingProgress.style.strokeDashoffset = offset;

    // Set colors according to status
    if (status === 'win') {
        scoreRingProgress.style.stroke = "var(--status-win)";
        scoreRingProgress.style.filter = "drop-shadow(0 0 8px rgba(16,185,129,0.5))";
        
        lblStatusBadge.className = "status-badge status-win-class";
        lblStatusText.innerHTML = translations[currentLang].winning;
        
        lblAssessmentTitle.innerHTML = currentLang === 'en' ? "Excellent Campaign Health!" : "চমৎকার ক্যাম্পেইন পারফরম্যান্স!";
        lblAssessmentDesc.innerHTML = translations[currentLang].winDesc;
        lblActionText.innerHTML = translations[currentLang].winAction;
    } else if (status === 'loss') {
        scoreRingProgress.style.stroke = "var(--status-loss)";
        scoreRingProgress.style.filter = "drop-shadow(0 0 8px rgba(239,68,68,0.5))";
        
        lblStatusBadge.className = "status-badge status-loss-class";
        lblStatusText.innerHTML = translations[currentLang].losing;
        
        lblAssessmentTitle.innerHTML = currentLang === 'en' ? "Critical Optimization Required" : "জরুরি অপ্টিমাইজেশন প্রয়োজন!";
        lblAssessmentDesc.innerHTML = translations[currentLang].lossDesc;
        lblActionText.innerHTML = translations[currentLang].lossAction;
    } else {
        scoreRingProgress.style.stroke = "var(--status-tweak)";
        scoreRingProgress.style.filter = "drop-shadow(0 0 8px rgba(245,158,11,0.5))";
        
        lblStatusBadge.className = "status-badge status-tweak-class";
        lblStatusText.innerHTML = translations[currentLang].tweakNeeded;
        
        lblAssessmentTitle.innerHTML = currentLang === 'en' ? "Average Campaign Performance" : "সাধারণ বিজ্ঞাপন পারফরম্যান্স";
        lblAssessmentDesc.innerHTML = translations[currentLang].tweakDesc;
        lblActionText.innerHTML = translations[currentLang].tweakAction;
    }

    // Set cards metrics BDT formatted
    cardMetricSpend.textContent = "৳" + spend.toLocaleString('bn-BD');
    cardMetricRoas.textContent = roas.toFixed(1) + "x";

    if (roas >= 3.0) {
        cardMetricRoasStatus.className = "metric-meta text-green";
        cardMetricRoasStatus.innerHTML = translations[currentLang].roasGood;
    } else if (roas <= 1.2) {
        cardMetricRoasStatus.className = "metric-meta text-red";
        cardMetricRoasStatus.innerHTML = translations[currentLang].roasBad;
    } else {
        cardMetricRoasStatus.className = "metric-meta text-yellow";
        cardMetricRoasStatus.innerHTML = translations[currentLang].roasBorder;
    }

    cardMetricCpa.textContent = "৳" + cpa.toLocaleString('bn-BD');
    if (cpa <= 220) {
        cardMetricCpaStatus.className = "metric-meta text-green";
        cardMetricCpaStatus.innerHTML = translations[currentLang].cpaGood;
    } else if (cpa >= 400) {
        cardMetricCpaStatus.className = "metric-meta text-red";
        cardMetricCpaStatus.innerHTML = translations[currentLang].cpaBad;
    } else {
        cardMetricCpaStatus.className = "metric-meta text-yellow";
        cardMetricCpaStatus.innerHTML = translations[currentLang].cpaBorder;
    }

    if (!document.getElementById('metric-colors-style')) {
        const style = document.createElement('style');
        style.id = 'metric-colors-style';
        style.innerHTML = `
            .text-green { color: var(--status-win) !important; }
            .text-yellow { color: var(--status-tweak) !important; }
            .text-red { color: var(--status-loss) !important; }
        `;
        document.head.appendChild(style);
    }

    // Update campaigns table rows
    populateCampaignTable(campaigns);
}

function populateCampaignTable(campaignsData = []) {
    campaignTableBody.innerHTML = "";
    
    if (activeCampaignCount) {
        activeCampaignCount.innerHTML = currentLang === 'en' 
            ? `${campaignsData.length} Campaigns Running` 
            : `${campaignsData.length}টি বিজ্ঞাপন সচল রয়েছে`;
    }

    if (Array.isArray(campaignsData) && campaignsData.length > 0) {
        campaignsData.forEach(c => {
            let statusBadgeClass = "table-status-pill tweak";
            let statusLabel = translations[currentLang].tweakNeeded;
            let actionStyle = "text-yellow";
            
            // local campaign status checks
            let score = c.roas >= 3.0 ? 100 : (c.roas <= 1.0 ? 0 : 50);
            let cStatus = 'tweak';
            if (score === 100) cStatus = 'win';
            else if (score === 0) cStatus = 'loss';

            if (cStatus === 'win') {
                statusBadgeClass = "table-status-pill win";
                statusLabel = translations[currentLang].winning;
                actionStyle = "text-green";
            } else if (cStatus === 'loss') {
                statusBadgeClass = "table-status-pill loss";
                statusLabel = translations[currentLang].losing;
                actionStyle = "text-red bold";
            }

            const cAction = cStatus === 'win' 
                ? (currentLang === 'en' ? "Scale budget +15%" : "বাজেট ১৫% বৃদ্ধি করুন")
                : (cStatus === 'loss' ? (currentLang === 'en' ? "Stop immediately" : "অবিলম্বে বন্ধ করুন") : (currentLang === 'en' ? "Tweak creatives" : "ছবি/লেখা পরিবর্তন করুন"));

            const row = `
                <tr>
                    <td class="campaign-name-cell">${c.name}</td>
                    <td><span class="${statusBadgeClass}">${statusLabel}</span></td>
                    <td>${c.ctr}%</td>
                    <td>${c.roas}x</td>
                    <td class="${actionStyle}">${cAction}</td>
                </tr>
            `;
            campaignTableBody.innerHTML += row;
        });
    } else {
        campaignTableBody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; color: var(--text-dim);" data-en="No active campaigns found." data-bn="কোনো সক্রিয় ক্যাম্পেইন পাওয়া যায়নি।">
                    No active campaigns found.
                </td>
            </tr>
        `;
    }
}

/* ==========================================================================
   6. Delivery Integration (WhatsApp & Direct PDF Download API)
   ========================================================================== */

btnSendWhatsapp.addEventListener('click', () => {
    const num = inputWhatsappNumber.value.trim();
    if (!num) {
        showToast(currentLang === 'en' ? "Please enter a valid phone number" : "দয়া করে একটি সঠিক ফোন নাম্বার দিন");
        return;
    }
    
    showToast(translations[currentLang].otpSent);
    
    // Call WhatsApp send API on server
    fetch(API_BASE + '/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            phone: num,
            score: currentDataState.score,
            status: currentDataState.status
        })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            setTimeout(() => {
                showToast(currentLang === 'en' ? "PDF report successfully delivered to WhatsApp!" : "পিডিএফ রিপোর্টটি হোয়াটসঅ্যাপে পাঠানো হয়েছে!");
            }, 1000);
        }
    })
    .catch(err => {
        console.error('Error sending WhatsApp report:', err);
    });
});

// Direct PDF Report download via backend stream
btnDownloadPdf.addEventListener('click', () => {
    const { spend, purchases, roas, ctr, score, status } = currentDataState;
    
    // Build query URL
    const queryUrl = API_BASE + `/api/campaigns/pdf?spend=${spend}&purchases=${purchases}&roas=${roas}&ctr=${ctr}&score=${score}&status=${status}&tier=${currentTier}&lang=${currentLang}`;
    
    // Trigger download
    window.location.href = queryUrl;
    
    showToast(currentLang === 'en' ? "Compiling PDF Report..." : "পিডিএফ রিপোর্ট তৈরি হচ্ছে...");
});

/* ==========================================================================
   7. bKash payment portal integration
   ========================================================================== */

btnHeaderUpgrade.addEventListener('click', () => openModal('bkash'));
btnProUpgrade.addEventListener('click', () => openModal('bkash'));

// Plan Card Switch
tierFreeCard.addEventListener('click', () => selectPlan('free'));
tierProCard.addEventListener('click', () => selectPlan('pro'));
tierAgencyCard.addEventListener('click', () => selectPlan('agency'));

function selectPlan(plan) {
    tierFreeCard.classList.toggle('active', plan === 'free');
    tierProCard.classList.toggle('active', plan === 'pro');
    tierAgencyCard.classList.toggle('active', plan === 'agency');

    if (plan === 'free') {
        btnProUpgrade.setAttribute('data-en', 'Downgrade to Free');
        btnProUpgrade.setAttribute('data-bn', 'ফ্রি টায়ারে ফিরে যান');
    } else {
        btnProUpgrade.setAttribute('data-en', 'Upgrade Subscription');
        btnProUpgrade.setAttribute('data-bn', 'সাবস্ক্রিপশন আপগ্রেড করুন');
    }
    toggleLanguage(currentLang);
}

let bkashTimer = null;

function initBkashFlow() {
    document.getElementById('bkash-step-1').classList.remove('hidden');
    document.getElementById('bkash-step-2').classList.add('hidden');
    document.getElementById('bkash-step-3').classList.add('hidden');
    document.getElementById('bkash-step-success').classList.add('hidden');
    
    document.getElementById('bkash-otp').value = "";
    document.getElementById('bkash-pin').value = "";
    
    let price = "BDT 990.00";
    let plan = 'pro';
    if (tierAgencyCard.classList.contains('active')) {
        price = "BDT 2,990.00";
        plan = 'agency';
    } else if (tierFreeCard.classList.contains('active')) {
        price = "BDT 0.00";
        plan = 'free';
    }
    document.getElementById('bkash-amount').textContent = price;
    
    // Call server to initialize transaction
    fetch(API_BASE + '/api/payments/bkash/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            amount: price,
            plan: plan,
            facebook_id: loggedInUser ? loggedInUser.facebook_id : "123456789"
        })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success && data.bkashURL) {
            window.mockCheckoutUrl = data.bkashURL.startsWith('http') ? data.bkashURL : API_BASE + data.bkashURL;
        }
    });
}

['bkash-close-1', 'bkash-close-2', 'bkash-close-3'].forEach(id => {
    document.getElementById(id).addEventListener('click', () => closeModal('bkash'));
});

// Step 1: Wallet proceeds
document.getElementById('bkash-to-otp').addEventListener('click', () => {
    const phone = document.getElementById('bkash-phone').value;
    if (phone.length < 10) {
        alert("Enter valid bKash number");
        return;
    }
    document.getElementById('bkash-phone-display').textContent = "+880 " + phone;
    document.getElementById('bkash-step-1').classList.add('hidden');
    document.getElementById('bkash-step-2').classList.remove('hidden');
    
    let time = 30;
    const timerText = document.getElementById('otp-timer');
    if (bkashTimer) clearInterval(bkashTimer);
    
    bkashTimer = setInterval(() => {
        time--;
        timerText.textContent = time + "s";
        if (time <= 0) {
            clearInterval(bkashTimer);
            timerText.textContent = "Resend OTP";
        }
    }, 1000);
});

// Step 2: OTP proceeds
document.getElementById('bkash-to-pin').addEventListener('click', () => {
    const otp = document.getElementById('bkash-otp').value;
    if (otp.length < 4) {
        alert("Enter OTP received on SMS");
        return;
    }
    document.getElementById('bkash-step-2').classList.add('hidden');
    document.getElementById('bkash-step-3').classList.remove('hidden');
});

// Step 3: PIN confirm -> Trigger backend bKash execute loop
document.getElementById('bkash-confirm').addEventListener('click', () => {
    const pin = document.getElementById('bkash-pin').value;
    if (pin.length < 4) {
        alert("Enter your bKash Pin");
        return;
    }
    
    if (window.mockCheckoutUrl) {
        // Redirect browser to trigger the callback redirects verification on server
        window.location.href = window.mockCheckoutUrl;
    } else {
        closeModal('bkash');
        showToast("Payment Gateway offline.");
    }
});

// Back to Dashboard resets
document.getElementById('bkash-done').addEventListener('click', () => {
    closeModal('bkash');
    loadStoredSession();
});

/* ==========================================================================
   8. Initializer
   ========================================================================== */
if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', () => {
        checkUrlSession();
    });
} else {
    checkUrlSession();
}
