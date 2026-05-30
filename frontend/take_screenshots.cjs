const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const screenshotDir = 'C:\\Projects\\NLP-Chatbot\\report\\screenshots';

    const pages = [
        { name: 'fig6_1_chat_interface', url: 'http://localhost:3000/' },
        { name: 'fig6_2_analytics_dashboard', url: 'http://localhost:3000/analytics' },
        { name: 'fig6_3_admin_panel', url: 'http://localhost:3000/admin' },
        { name: 'fig6_4_agent_console', url: 'http://localhost:3000/agent' },
        { name: 'fig6_5_conversation_list', url: 'http://localhost:3000/analytics' },
    ];

    for (const p of pages) {
        try {
            await page.goto(p.url, { waitUntil: 'domcontentloaded', timeout: 15000 });
            await page.waitForTimeout(3000);
            await page.screenshot({ path: `${screenshotDir}/${p.name}.png`, fullPage: false });
            console.log(`OK: ${p.name}`);
        } catch (e) {
            console.log(`FAIL: ${p.name} - ${e.message}`);
        }
    }

    await browser.close();
    console.log('Done');
})();
