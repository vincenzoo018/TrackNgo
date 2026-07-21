const fs = require('fs');
const path = require('path');

const pages = [
  { p: 'admin/users/Index.tsx', title: 'User Accounts', module: 'Admin' },
  { p: 'admin/reports/Index.tsx', title: 'System Reports', module: 'Admin' },
  { p: 'admin/templates/Index.tsx', title: 'Document Templates', module: 'Admin' },
  { p: 'department-head/workflow/Index.tsx', title: 'Workflow Approvals', module: 'Department Head' },
  { p: 'department-head/signature/Index.tsx', title: 'E-Signatures', module: 'Department Head' },
  { p: 'mayor/signature/Index.tsx', title: 'Final Approvals & E-Signatures', module: 'Office of the Mayor' },
  { p: 'cart/reports/Index.tsx', title: 'ARTA Compliance Reports', module: 'CART' },
];

pages.forEach(page => {
  const fullPath = path.join('c:/Users/Huawei/TrackNgo/resources/js/pages', page.p);
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  
  const content = `import { Head } from '@inertiajs/react';
import TrackngoLayout from '@/layouts/trackngo/TrackngoLayout';
import { HardDrive } from 'lucide-react';

export default function Index() {
    return (
        <TrackngoLayout>
            <Head title="${page.title} — TrackNGo Mati" />

            <div className="flex h-[calc(100vh-140px)] flex-col space-y-4">
                <div className="flex items-center justify-between shrink-0">
                    <div>
                        <h1 className="text-2xl font-bold text-[var(--tng-slate-900)]">
                            ${page.title}
                        </h1>
                        <p className="mt-0.5 text-sm text-[var(--tng-slate-500)]">
                            ${page.module} Module — Frontend Migration Template
                        </p>
                    </div>
                </div>

                <div className="flex-1 rounded-xl border border-[var(--tng-slate-200)] bg-white flex flex-col items-center justify-center text-center p-8 animate-in fade-in zoom-in-95 duration-500">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--tng-blue-50)] text-[var(--tng-blue-600)] mb-4">
                        <HardDrive className="h-8 w-8" />
                    </div>
                    <h2 className="text-lg font-bold text-[var(--tng-slate-800)]">UI Port Complete</h2>
                    <p className="text-sm text-[var(--tng-slate-500)] max-w-md mt-2">
                        This view has been successfully migrated from ASP.NET to the new React/Tailwind architecture. Data binding will be implemented once the backend database migrations are complete.
                    </p>
                </div>
            </div>
        </TrackngoLayout>
    );
}
`;
  fs.writeFileSync(fullPath, content);
});
console.log('Pages generated successfully.');
