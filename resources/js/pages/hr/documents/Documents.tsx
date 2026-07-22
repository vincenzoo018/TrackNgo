import { Head } from '@inertiajs/react';
import { FileText, Search, Filter, Plus } from 'lucide-react';
import TrackngoLayout from '@/layouts/trackngo/TrackngoLayout';

const mockDocuments = [
    { id: 1, ref: 'HR-DOC-2026-001', title: 'Employee Handbook v2.0', type: 'Policy', status: 'approved', date: '2026-07-15' },
    { id: 2, ref: 'HR-DOC-2026-002', title: 'Leave Policy Amendment', type: 'Policy', status: 'submitted', date: '2026-07-18' },
    { id: 3, ref: 'HR-DOC-2026-003', title: 'Performance Review Template', type: 'Template', status: 'endorsed', date: '2026-07-19' },
    { id: 4, ref: 'HR-DOC-2026-004', title: 'Salary Adjustment Memo - Q3', type: 'Memo', status: 'submitted', date: '2026-07-20' },
    { id: 5, ref: 'HR-DOC-2026-005', title: 'New Hire Orientation Checklist', type: 'Checklist', status: 'approved', date: '2026-07-21' },
];

const statusStyles: Record<string, string> = {
    submitted: 'bg-blue-100 text-blue-700',
    endorsed: 'bg-amber-100 text-amber-700',
    approved: 'bg-emerald-100 text-emerald-700',
    returned: 'bg-red-100 text-red-700',
};

export default function HrDocuments() {
    return (
        <TrackngoLayout>
            <Head title="HR Documents — TrackNGo Mati" />

            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-[var(--tng-slate-900)]">HR Documents</h1>
                        <p className="mt-0.5 text-sm text-[var(--tng-slate-500)]">
                            Manage human resources policies, memos, and templates
                        </p>
                    </div>
                    <button className="flex items-center gap-2 rounded-lg bg-[var(--tng-blue-600)] px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-600/25 transition-all hover:bg-[var(--tng-blue-700)]">
                        <Plus className="h-4 w-4" />
                        New Document
                    </button>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative flex-1 min-w-[250px] max-w-md">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--tng-slate-400)]" />
                        <input
                            type="text"
                            placeholder="Search documents..."
                            className="h-10 w-full rounded-lg border border-[var(--tng-slate-200)] bg-white pl-9 pr-4 text-sm text-[var(--tng-slate-700)] placeholder:text-[var(--tng-slate-400)] focus:border-[var(--tng-blue-500)] focus:outline-none focus:ring-2 focus:ring-[var(--tng-blue-500)]/20"
                        />
                    </div>
                    <button className="flex items-center gap-2 rounded-lg border border-[var(--tng-slate-200)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--tng-slate-600)] hover:bg-[var(--tng-slate-50)]">
                        <Filter className="h-4 w-4" />
                        Filters
                    </button>
                </div>

                {/* Documents Table */}
                <div className="rounded-2xl border border-[var(--tng-slate-200)] bg-white shadow-sm overflow-hidden">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-[var(--tng-slate-200)] bg-[var(--tng-slate-50)]">
                                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--tng-slate-500)]">Reference</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--tng-slate-500)]">Title</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--tng-slate-500)]">Type</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--tng-slate-500)]">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--tng-slate-500)]">Date</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--tng-slate-100)]">
                            {mockDocuments.map((doc) => (
                                <tr key={doc.id} className="transition-colors hover:bg-[var(--tng-slate-50)] cursor-pointer">
                                    <td className="px-6 py-4 text-sm font-semibold text-[var(--tng-blue-600)]">{doc.ref}</td>
                                    <td className="px-6 py-4 text-sm font-medium text-[var(--tng-slate-800)]">{doc.title}</td>
                                    <td className="px-6 py-4 text-sm text-[var(--tng-slate-600)]">{doc.type}</td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${statusStyles[doc.status] ?? 'bg-gray-100 text-gray-700'}`}>
                                            {doc.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-[var(--tng-slate-500)]">{doc.date}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </TrackngoLayout>
    );
}
