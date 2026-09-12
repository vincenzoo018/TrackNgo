import React from 'react';
import { renderToString } from 'react-dom/server';
import { App } from '@inertiajs/react';
import { execSync } from 'child_process';

global.window = {
    addEventListener: () => {},
    removeEventListener: () => {},
    matchMedia: () => ({ matches: false }),
    location: { href: 'http://127.0.0.1:8000/receiving/archived', pathname: '/receiving/archived' },
    navigator: { userAgent: 'Mozilla/5.0' },
    history: { scrollRestoration: 'auto', pushState: () => {}, replaceState: () => {}, state: {} },
};
global.document = {
    body: { style: {} },
    createElement: () => ({ setAttribute: () => {}, appendChild: () => {}, click: () => {} }),
    querySelector: () => null,
    addEventListener: () => {},
    removeEventListener: () => {},
};

async function test() {
    try {
        const phpOutput = execSync('php scratch/test_receiving_archived.php', { maxBuffer: 10 * 1024 * 1024 }).toString();
        const pageData = JSON.parse(phpOutput.trim());
        console.log('Page component:', pageData.component);
        console.log('Page props keys:', Object.keys(pageData.props));
        console.log('Documents length:', pageData.props.dbDocuments?.length);

        const pageModule = await import('../public/build/assets/Index-DWkFwsph.js');
        const Component = pageModule.default;

        console.log('Mounting App with Component...');
        const html = renderToString(
            React.createElement(App, {
                initialPage: pageData,
                resolveComponent: () => Component,
            })
        );
        console.log('Render successful! Output length:', html.length);
        console.log('Preview:', html.slice(0, 400));
    } catch (err) {
        console.error('CATCH ERROR DURING RENDER:', err);
    }
}
test();
