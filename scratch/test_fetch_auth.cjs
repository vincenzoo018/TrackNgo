async function testAuth() {
    // 1. GET /login
    const res1 = await fetch('http://127.0.0.1:8000/login');
    const cookies1 = res1.headers.getSetCookie();
    let xsrfToken = '';
    for (const c of cookies1) {
        if (c.startsWith('XSRF-TOKEN=')) {
            xsrfToken = decodeURIComponent(c.split(';')[0].slice('XSRF-TOKEN='.length));
        }
    }
    const cookieHeader1 = cookies1.map(c => c.split(';')[0]).join('; ');
    
    // 2. POST /login with X-XSRF-TOKEN
    const res2 = await fetch('http://127.0.0.1:8000/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Cookie': cookieHeader1,
            'X-XSRF-TOKEN': xsrfToken,
            'Accept': 'text/html, application/xhtml+xml',
            'X-Inertia': 'true',
            'X-Inertia-Version': '00c62c9b923cb4adc5728e9a66052d20'
        },
        body: JSON.stringify({
            email: 'receivingclerk@mati.com',
            password: 'password123'
        }),
        redirect: 'manual'
    });

    console.log('Login status:', res2.status, 'Location:', res2.headers.get('location') || res2.headers.get('x-inertia-location'));
    const cookies2 = res2.headers.getSetCookie();
    const authedCookies = [...cookies1, ...cookies2].map(c => c.split(';')[0]).join('; ');

    // 3. GET /receiving/archived (regular browser request)
    const res3 = await fetch('http://127.0.0.1:8000/receiving/archived', {
        headers: {
            'Cookie': authedCookies,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        redirect: 'manual'
    });

    console.log('/receiving/archived status:', res3.status, 'Location:', res3.headers.get('location'));
    const body = await res3.text();
    console.log('Response body length:', body.length);
    console.log('Includes <div id="app"?:', body.includes('id="app"'));
    console.log('Includes app.css?:', body.includes('app.css'));
    console.log('Includes assets/Index-?:', body.includes('assets/Index-'));
    
    // Extract script tags
    const scripts = [...body.matchAll(/<script[^>]*src="([^"]+)"/g)].map(m => m[1]);
    console.log('Scripts in page:', scripts);
    
    // Check if each script is reachable (status 200)
    for (const s of scripts) {
        const fullUrl = s.startsWith('http') ? s : 'http://127.0.0.1:8000' + s;
        try {
            const sRes = await fetch(fullUrl);
            console.log(`Script ${s}: ${sRes.status} (length: ${(await sRes.text()).length})`);
        } catch(e) {
            console.error(`Script ${s} ERROR:`, e.message);
        }
    }
}

testAuth().catch(console.error);
