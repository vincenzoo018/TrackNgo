const { spawn } = require('child_process');
const http = require('http');

async function run() {
    // 1. Get auth cookie
    const r1 = await fetch('http://127.0.0.1:8000/login');
    const c1 = r1.headers.getSetCookie();
    const xsrf = decodeURIComponent(c1.find(c => c.startsWith('XSRF-TOKEN')).split(';')[0].slice(11));
    const r2 = await fetch('http://127.0.0.1:8000/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Cookie': c1.map(c => c.split(';')[0]).join('; '),
            'X-XSRF-TOKEN': xsrf,
            'Accept': 'application/json'
        },
        body: JSON.stringify({ email: 'receivingclerk@mati.com', password: 'password123' })
    });
    const c2 = r2.headers.getSetCookie();
    const allCookies = [...c1, ...c2];
    
    // Parse cookies for CDP
    const cookieObjects = [];
    for (const cookieStr of allCookies) {
        const parts = cookieStr.split(';')[0].split('=');
        const name = parts[0].trim();
        const value = parts.slice(1).join('=').trim();
        if (name && value) {
            cookieObjects.push({
                name,
                value,
                domain: '127.0.0.1',
                path: '/'
            });
        }
    }

    // 2. Launch Chrome with remote debugging
    const port = 9222;
    const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
        '--headless=new',
        `--remote-debugging-port=${port}`,
        '--disable-gpu',
        '--no-sandbox',
        '--disable-dev-shm-usage',
        'about:blank'
    ]);

    await new Promise(r => setTimeout(r, 1500));

    // 3. Connect to CDP
    const versionRes = await fetch(`http://127.0.0.1:${port}/json/version`);
    const version = await versionRes.json();
    const ws = new WebSocket(version.webSocketDebuggerUrl);

    await new Promise((resolve, reject) => {
        ws.onopen = resolve;
        ws.onerror = reject;
    });

    let msgId = 1;
    function send(method, params = {}) {
        return new Promise((resolve) => {
            const id = msgId++;
            const handler = (event) => {
                const data = JSON.parse(event.data);
                if (data.id === id) {
                    ws.removeEventListener('message', handler);
                    resolve(data.result);
                }
            };
            ws.addEventListener('message', handler);
            ws.send(JSON.stringify({ id, method, params }));
        });
    }

    // Listen to console and exceptions
    ws.addEventListener('message', (event) => {
        const data = JSON.parse(event.data);
        if (data.method === 'Runtime.consoleAPICalled') {
            console.log(`[BROWSER CONSOLE ${data.params.type.toUpperCase()}]`, ...data.params.args.map(a => a.value || a.description));
        } else if (data.method === 'Runtime.exceptionThrown') {
            console.error('[BROWSER EXCEPTION]', data.params.exceptionDetails.text, data.params.exceptionDetails.exception?.description);
        }
    });

    // Create target page
    const target = await send('Target.createTarget', { url: 'about:blank' });
    const pageWs = new WebSocket(`ws://127.0.0.1:${port}/devtools/page/${target.targetId}`);
    
    await new Promise((resolve, reject) => {
        pageWs.onopen = resolve;
        pageWs.onerror = reject;
    });

    let pageMsgId = 1;
    function sendPage(method, params = {}) {
        return new Promise((resolve) => {
            const id = pageMsgId++;
            const handler = (event) => {
                const data = JSON.parse(event.data);
                if (data.id === id) {
                    pageWs.removeEventListener('message', handler);
                    resolve(data.result);
                }
            };
            pageWs.addEventListener('message', handler);
            pageWs.send(JSON.stringify({ id, method, params }));
        });
    }

    pageWs.addEventListener('message', (event) => {
        const data = JSON.parse(event.data);
        if (data.method === 'Runtime.consoleAPICalled') {
            console.log(`[PAGE CONSOLE ${data.params.type.toUpperCase()}]`, ...data.params.args.map(a => a.value || a.description));
        } else if (data.method === 'Runtime.exceptionThrown') {
            console.error('[PAGE EXCEPTION]', data.params.exceptionDetails.text, data.params.exceptionDetails.exception?.description);
        }
    });

    await sendPage('Page.enable');
    await sendPage('Runtime.enable');
    await sendPage('Network.enable');

    // Set cookies
    for (const c of cookieObjects) {
        await sendPage('Network.setCookie', c);
    }

    console.log('Navigating to http://127.0.0.1:8000/receiving/archived ...');
    await sendPage('Page.navigate', { url: 'http://127.0.0.1:8000/receiving/archived' });

    // Wait 2 seconds for page load
    await new Promise(r => setTimeout(r, 2000));

    console.log('Clicking Quick Overview Eye Icon...');
    const clickRes = await sendPage('Runtime.evaluate', {
        expression: `
            const btn = document.querySelector('button[aria-label="Quick Overview"]');
            if (btn) {
                btn.click();
                "clicked";
            } else {
                "button not found";
            }
        `,
        returnByValue: true
    });
    console.log('CLICK RESULT:', clickRes.result?.value);

    // Wait 1 second to observe if React throws an exception
    await new Promise(r => setTimeout(r, 1500));

    // Test closing the modal
    console.log('Closing modal...');
    await sendPage('Runtime.evaluate', {
        expression: 'document.querySelector("button[aria-label=\'Close modal\']")?.click()',
        returnByValue: true
    });
    await new Promise(r => setTimeout(r, 500));

    // Test clicking Approved tab
    console.log('Clicking Approved Tab...');
    const approvedRes = await sendPage('Runtime.evaluate', {
        expression: `
            const tabs = Array.from(document.querySelectorAll('nav[aria-label="Navigation Tabs"] button'));
            const approvedBtn = tabs.find(b => b.innerText.includes('Approved'));
            if (approvedBtn) {
                approvedBtn.click();
                "clicked approved";
            } else {
                "approved tab not found";
            }
        `,
        returnByValue: true
    });
    console.log('APPROVED TAB CLICK:', approvedRes.result?.value);
    await new Promise(r => setTimeout(r, 500));

    // Test clicking Completed tab
    console.log('Clicking Completed Tab...');
    const completedRes = await sendPage('Runtime.evaluate', {
        expression: `
            const tabs = Array.from(document.querySelectorAll('nav[aria-label="Navigation Tabs"] button'));
            const completedBtn = tabs.find(b => b.innerText.includes('Completed'));
            if (completedBtn) {
                completedBtn.click();
                "clicked completed";
            } else {
                "completed tab not found";
            }
        `,
        returnByValue: true
    });
    console.log('COMPLETED TAB CLICK:', completedRes.result?.value);
    await new Promise(r => setTimeout(r, 500));

    // Test Export CSV button
    console.log('Clicking Export CSV button...');
    const exportRes = await sendPage('Runtime.evaluate', {
        expression: `
            const btns = Array.from(document.querySelectorAll('button'));
            const exportBtn = btns.find(b => b.innerText.includes('Export CSV'));
            if (exportBtn) {
                exportBtn.click();
                "clicked export";
            } else {
                "export button not found";
            }
        `,
        returnByValue: true
    });
    console.log('EXPORT BTN CLICK:', exportRes.result?.value);
    await new Promise(r => setTimeout(r, 800));

    const exportModalCheck = await sendPage('Runtime.evaluate', {
        expression: '({ passwordInputExists: !!document.querySelector("input[type=\'password\']"), appHtmlLength: document.getElementById("app")?.innerHTML?.length })',
        returnByValue: true
    });
    console.log('EXPORT MODAL RESULT:', exportModalCheck.result?.value);



    chrome.kill();
    process.exit(0);
}

run().catch(e => {
    console.error('SCRIPT ERROR:', e);
    process.exit(1);
});
