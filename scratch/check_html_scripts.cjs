async function run() {
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
    const authCookie = c2.map(c => c.split(';')[0]).join('; ');
    const r3 = await fetch('http://127.0.0.1:8000/receiving/archived', {
        headers: { 'Cookie': authCookie, 'Accept': 'text/html' }
    });
    const html = await r3.text();
    const scripts = [...html.matchAll(/src="([^"]+)"/g)].map(m => m[1]);
    console.log('Scripts:', scripts);
    const links = [...html.matchAll(/href="([^"]+\.css[^"]*)"/g)].map(m => m[1]);
    console.log('CSS:', links);

    for (const s of scripts) {
        const url = s.startsWith('http') ? s : 'http://127.0.0.1:8000' + s;
        const res = await fetch(url);
        console.log(`Script ${s}: status ${res.status}`);
    }
}
run().catch(console.error);
