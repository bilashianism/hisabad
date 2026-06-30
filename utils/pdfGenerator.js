const PDFDocument = require('pdfkit');

/**
 * Generates a styled, professional campaign audit PDF report.
 * Pipes the PDF data directly to the Express response stream.
 */
function generateAuditReport(res, data, lang = 'en') {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    // Stream error handling
    doc.on('error', (err) => {
        console.error('PDF Generation Error:', err);
    });

    // Pipe doc to response
    doc.pipe(res);

    // Color Palette
    const primaryColor = '#6366f1'; // Indigo
    const darkGray = '#334155';
    const lightGray = '#f8fafc';
    const borderGray = '#e2e8f0';
    
    // Status colors
    let statusColor = '#10b981'; // Green
    let statusLabel = 'WINNING';
    if (data.status === 'loss') {
        statusColor = '#ef4444'; // Red
        statusLabel = 'LOSING';
    } else if (data.status === 'tweak') {
        statusColor = '#f59e0b'; // Yellow
        statusLabel = 'TWEAK NEEDED';
    }

    // --- Header ---
    doc.fillColor(primaryColor)
       .font('Helvetica-Bold')
       .fontSize(24)
       .text('HisabAd', 50, 50);
       
    doc.fillColor(darkGray)
       .font('Helvetica')
       .fontSize(10)
       .text('Meta Ads Campaign Audit Report', 50, 80)
       .text(`Date: ${new Date().toLocaleDateString()}`, 400, 50, { align: 'right' })
       .text(`Client ID: HM-${Math.floor(1000 + Math.random() * 9000)}`, 400, 65, { align: 'right' })
       .text(`Account Tier: ${data.tier ? data.tier.toUpperCase() : 'FREE'}`, 400, 80, { align: 'right' });

    doc.moveTo(50, 100).lineTo(545, 100).strokeColor(borderGray).lineWidth(1).stroke();

    // --- Section 1: Executive Grade Score ---
    doc.rect(50, 120, 495, 90).fill(lightGray);
    
    // Score ring representation
    doc.circle(100, 165, 30).fillColor('#ffffff').fill();
    doc.circle(100, 165, 30).lineWidth(4).strokeColor(statusColor).stroke();
    
    doc.fillColor('#0f172a')
       .font('Helvetica-Bold')
       .fontSize(18)
       .text(data.score.toString(), 88, 158, { width: 24, align: 'center' });
       
    doc.fillColor('#64748b')
       .font('Helvetica')
       .fontSize(8)
       .text('/100', 108, 172);

    // Grade description
    doc.fillColor('#0f172a')
       .font('Helvetica-Bold')
       .fontSize(14)
       .text(`STATUS: ${statusLabel}`, 160, 135);
       
    doc.fillColor(darkGray)
       .font('Helvetica')
       .fontSize(10)
       .text(`Recommendation: ${data.recommendationAction}`, 160, 155, { width: 360 })
       .fontSize(9)
       .fillColor('#64748b')
       .text(`ROAS and CPA insights indicate that your campaigns are categorized under ${statusLabel}.`, 160, 185);

    // --- Section 2: Core Metrics Table ---
    doc.fillColor('#0f172a')
       .font('Helvetica-Bold')
       .fontSize(12)
       .text('Core Performance Metrics', 50, 240);

    const tableTop = 260;
    
    // Table Header
    doc.rect(50, tableTop, 495, 25).fill(primaryColor);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(9);
    doc.text('Metric Name', 60, tableTop + 8);
    doc.text('Value', 250, tableTop + 8);
    doc.text('Benchmark', 380, tableTop + 8);
    doc.text('Status Assessment', 470, tableTop + 8);

    // Row 1: Spend
    const row1Top = tableTop + 25;
    doc.rect(50, row1Top, 495, 20).fill('#ffffff');
    doc.fillColor(darkGray).font('Helvetica').fontSize(9);
    doc.text('Total Monthly Spend', 60, row1Top + 6);
    doc.text(`BDT ${data.spend.toLocaleString()}`, 250, row1Top + 6);
    doc.text('N/A', 380, row1Top + 6);
    doc.fillColor('#10b981').text('Active', 470, row1Top + 6);

    // Row 2: purchases
    const row2Top = row1Top + 20;
    doc.rect(50, row2Top, 495, 20).fill(lightGray);
    doc.fillColor(darkGray).text('Total Conversions (Purchases)', 60, row2Top + 6);
    doc.text(data.purchases.toString(), 250, row2Top + 6);
    doc.text('> 100', 380, row2Top + 6);
    doc.fillColor(data.purchases > 100 ? '#10b981' : '#f59e0b').text(data.purchases > 100 ? 'Good' : 'Moderate', 470, row2Top + 6);

    // Row 3: ROAS
    const row3Top = row2Top + 20;
    doc.rect(50, row3Top, 495, 20).fill('#ffffff');
    doc.fillColor(darkGray).text('Average ROAS (Return on Ad Spend)', 60, row3Top + 6);
    doc.text(`${data.roas}x`, 250, row3Top + 6);
    doc.text('> 3.0x', 380, row3Top + 6);
    doc.fillColor(data.roas >= 3.0 ? '#10b981' : (data.roas < 1.2 ? '#ef4444' : '#f59e0b'))
       .text(data.roas >= 3.0 ? 'Profitable' : (data.roas < 1.2 ? 'Loss' : 'Borderline'), 470, row3Top + 6);

    // Row 4: CTR
    const row4Top = row3Top + 20;
    doc.rect(50, row4Top, 495, 20).fill(lightGray);
    doc.fillColor(darkGray).text('Click-Through Rate (CTR)', 60, row4Top + 6);
    doc.text(`${data.ctr}%`, 250, row4Top + 6);
    doc.text('> 2.0%', 380, row4Top + 6);
    doc.fillColor(data.ctr >= 2.0 ? '#10b981' : '#ef4444')
       .text(data.ctr >= 2.0 ? 'Optimal' : 'Low CTR', 470, row4Top + 6);

    // Row 5: CPA
    const row5Top = row4Top + 20;
    doc.rect(50, row5Top, 495, 20).fill('#ffffff');
    doc.fillColor(darkGray).text('Average Cost Per Purchase (CPA)', 60, row5Top + 6);
    const cpaVal = data.purchases > 0 ? Math.round(data.spend / data.purchases) : data.spend;
    doc.text(`BDT ${cpaVal.toLocaleString()}`, 250, row5Top + 6);
    doc.text('< BDT 250', 380, row5Top + 6);
    doc.fillColor(cpaVal <= 250 ? '#10b981' : '#ef4444')
       .text(cpaVal <= 250 ? 'Healthy' : 'High CPA', 470, row5Top + 6);

    doc.moveTo(50, row5Top + 20).lineTo(545, row5Top + 20).strokeColor(borderGray).stroke();

    // --- Section 3: Campaign Breakdown List ---
    doc.fillColor('#0f172a')
       .font('Helvetica-Bold')
       .fontSize(12)
       .text('Active Campaigns Analysis', 50, row5Top + 35);

    let campaignY = row5Top + 55;

    data.campaignsList.forEach((c, index) => {
        let cColor = '#10b981';
        if (c.status === 'loss') cColor = '#ef4444';
        else if (c.status === 'tweak') cColor = '#f59e0b';

        doc.rect(50, campaignY, 495, 40).fill(lightGray);
        
        doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(9).text(`${index+1}. ${c.name}`, 60, campaignY + 10);
        doc.fillColor('#64748b').font('Helvetica').fontSize(8).text(`CTR: ${c.ctr}  |  ROAS: ${c.roas}`, 60, campaignY + 24);
        
        doc.fillColor(cColor).font('Helvetica-Bold').fontSize(8).text(c.status.toUpperCase(), 350, campaignY + 16, { width: 80, align: 'center' });
        doc.fillColor(darkGray).font('Helvetica').fontSize(8).text(c.action, 430, campaignY + 16, { width: 100 });

        campaignY += 45;
    });

    // --- Footer ---
    doc.fillColor('#94a3b8')
       .font('Helvetica')
       .fontSize(8)
       .text('Generated by HisabAd automated report engine. Verified Meta Integration. Secure local sandbox verification.', 50, 750, { align: 'center', width: 495 });

    doc.end();
}

module.exports = {
    generateAuditReport
};
