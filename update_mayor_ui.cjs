const fs = require('fs');
const deptHeadFile = 'c:\\laragon\\www\\TrackNgo\\resources\\js\\Pages\\department-head\\documents\\ReviewAndActions.tsx';
const mayorFile = 'c:\\laragon\\www\\TrackNgo\\resources\\js\\Pages\\mayor\\documents\\Show.tsx';

let content = fs.readFileSync(deptHeadFile, 'utf8');

content = content.replace(/DepartmentHeadReviewAndActions/g, 'MayorDocumentShow');
content = content.replace(/\/department-head\/documents/g, '/mayor/documents');
content = content.replace(/<TrackngoLayout/g, '<TrackngoLayout role="mayor"');

content = content.replace(/breadcrumbs=\{\[[\s\S]*?\]\}/m, `breadcrumbs={[
                { title: 'Dashboard', href: '/mayor' },
                { title: 'Final Approvals', href: '/mayor/documents' },
                { title: doc.reference_number, href: '#' },
            ]}`);

fs.writeFileSync(mayorFile, content);
console.log('Done!');
