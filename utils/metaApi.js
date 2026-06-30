const axios = require('axios');

/**
 * Fetch campaign insights directly from the live Meta Graph API
 * @param {string} accessToken User's long-lived Facebook page/ad access token
 * @param {string} adAccountId Ad Account ID (e.g. act_123456789)
 */
async function getAdCampaigns(accessToken, adAccountId) {
    if (!accessToken) {
        throw new Error('Meta access token is required.');
    }
    if (!adAccountId) {
        throw new Error('Meta Ad Account ID is required.');
    }

    // Live Meta Graph API query path
    const url = `https://graph.facebook.com/v19.0/${adAccountId}/campaigns`;
    
    const response = await axios.get(url, {
        params: {
            fields: 'id,name,status,insights{spend,clicks,impressions,actions}',
            access_token: accessToken,
            limit: 50 // Limit to top 50 active campaigns
        }
    });
    
    return formatMetaResponse(response.data.data);
}

/**
 * Parses and maps raw Meta Graph response data
 */
function formatMetaResponse(campaignsData) {
    if (!campaignsData || !Array.isArray(campaignsData)) {
        return [];
    }
    
    return campaignsData.map(c => {
        const insights = c.insights && c.insights.data ? c.insights.data[0] : null;
        const spend = insights ? parseFloat(insights.spend || 0) : 0;
        const clicks = insights ? parseInt(insights.clicks || 0) : 0;
        const impressions = insights ? parseInt(insights.impressions || 0) : 0;
        
        let purchases = 0;
        if (insights && insights.actions) {
            // Locate Meta pixel standard purchase event (offsite_conversion.fb_pixel_purchase)
            const purchaseAction = insights.actions.find(a => 
                a.action_type === 'offsite_conversion.fb_pixel_purchase' || 
                a.action_type === 'purchase'
            );
            if (purchaseAction) {
                purchases = parseInt(purchaseAction.value || 0);
            }
        }

        const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
        const cpa = purchases > 0 ? spend / purchases : spend;
        
        // Assume standard item value of 1000 BDT to formulate ROAS return if purchase value is missing
        const estimatedRevenue = purchases * 1000;
        const roas = spend > 0 ? estimatedRevenue / spend : 0;

        return {
            id: c.id,
            name: c.name,
            status: c.status || 'ACTIVE',
            spend: Math.round(spend),
            purchases: purchases,
            ctr: parseFloat(ctr.toFixed(2)),
            roas: parseFloat(roas.toFixed(2)),
            cpa: Math.round(cpa)
        };
    });
}

module.exports = {
    getAdCampaigns
};
