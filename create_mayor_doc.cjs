const fs = require('fs');
const deptHeadCreateFile = 'c:\\laragon\\www\\TrackNgo\\resources\\js\\Pages\\department-head\\documents\\Create.tsx';
const mayorCreateFile = 'c:\\laragon\\www\\TrackNgo\\resources\\js\\Pages\\mayor\\documents\\Create.tsx';

let content = fs.readFileSync(deptHeadCreateFile, 'utf8');

// Replace department-head specifics with mayor
content = content.replace(/DepartmentHeadCreateDocument/g, 'MayorCreateDocument');
content = content.replace(/\/department-head\/documents/g, '/mayor/documents');
content = content.replace(/<TrackngoLayout/g, '<TrackngoLayout role="mayor"');

// Replace breadcrumbs
content = content.replace(/breadcrumbs=\{\[[\s\S]*?\]\}/m, `breadcrumbs={[
                { title: 'Dashboard', href: '/mayor' },
                { title: 'Final Approvals', href: '/mayor/documents' },
                { title: 'New Document', href: '#' },
            ]}`);

fs.writeFileSync(mayorCreateFile, content);
console.log('Successfully created Mayor Create.tsx');
