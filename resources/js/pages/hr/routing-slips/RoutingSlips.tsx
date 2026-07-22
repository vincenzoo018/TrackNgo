import { Head } from '@inertiajs/react';
import { Route, Search, Filter } from 'lucide-react';
import TrackngoLayout from '@/layouts/trackngo/TrackngoLayout';

const mockSlips = [
    { id: 1, tracking: 'RS-HR-2026-001', document: 'HR-DOC-2026-001', from: 'HR Office', to: 'City Mayor Office', action: 'forward', status: 'active', date: '2026-07-20' },
    { id: 2, tracking: 'RS-HR-2026-002', document: 'HR-DOC-2026-002', from: 'HR Office', to: 'Admin Office', action: 'forward', status: 'completed', date: '2026-07-18' },
    { id: 3, tracking: 'RS-HR-2026-003', document: 'HR-DOC-2026-003', from: 'Admin Office', to: 'HR Office', action: 'return', status: 'active', date: '2026-07-19' },
    { id: 4, tracking: 'RS-HR-2026-004', document: 'HR-DOC-2026-004', from: 'HR Office', to: 'Finance Office', action: 'endorse', status: 'active', date: '2026-07-21' },
];

const statusStyles: Record<string, string> = {
    active: 'bg-blue-100 text-blue-700',
    completed: 'bg-emerald-100 text-emerald-700',
    returned: 'bg-amber-100 text-amber-700',
};

const actionStyles: Record<string, string> = {
    forward: 'bg-blue-50 text-blue-600',
    return: 'bg-amber-50 text-amber-600',
    endorse: 'bg-emerald-50 text-emerald-600',
    reject: 'bg-red-50 text-red-600',
};

export default function HrRoutingSlips() {
    return (
        <TrackngoLayout>
            <Head title="HR Routing Slips — TrackNGo Mati" />

            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--tng-slate-900)]">Routing Slips</h1>
                    <p className="mt-0.5 text-sm text-[var(--tng-slate-500)]">
                        Track document routing between departments for HR documents
                    </p>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative flex-1 min-w-[250px] max-w-md">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--tng-slate-400)]" />
                        <input
                            type="text"
                            placeholder="Search routing slips..."
                            className="h-10 w-full rounded-lg border border-[var(--tng-slate-200)] bg-white pl-9 pr-4 text-sm text-[var(--tng-slate-700)] placeholder:text-[var(--tng-slate-400)] focus:border-[var(--tng-blue-500)] focus:outline-none focus:ring-2 focus:ring-[var(--tng-blue-500)]/20"
                        />
                    </div>
                    <button className="flex items-center gap-2 rounded-lg border border-[var(--tng-slate-200)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--tng-slate-600)] hover:bg-[var(--tng-slate-50)]">
                        <Filter className="h-4 w-4" />
                        Filters
                    </button>
                </div>

                {/* Table */}
                <div className="rounded-2xl border border-[var(--tng-slate-200)] bg-white shadow-sm overflow-hidden">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-[var(--tng-slate-200)] bg-[var(--tng-slate-50)]">
                                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--tng-slate-500)]">Tracking #</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--tng-slate-500)]">Document</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--tng-slate-500)]">From</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--tng-slate-500)]">To</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--tng-slate-500)]">Action</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--tng-slate-500)]">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--tng-slate-500)]">Date</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--tng-slate-100)]">
                            {mockSlips.map((slip) => (
                                <tr key={slip.id} className="transition-colors hover:bg-[var(--tng-slate-50)] cursor-pointer">
                                    <td className="px-6 py-4 text-sm font-semibold text-[var(--tng-blue-600)]">{slip.tracking}</td>
                                    <td className="px-6 py-4 text-sm font-medium text-[var(--tng-slate-700)]">{slip.document}</td>
                                    <td className="px-6 py-4 text-sm text-[var(--tng-slate-600)]">{slip.from}</td>
                                    <td className="px-6 py-4 text-sm text-[var(--tng-slate-600)]">{slip.to}</td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${actionStyles[slip.action] ?? ''}`}>
                                            {slip.action}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${statusStyles[slip.status] ?? ''}`}>
                                            {slip.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-[var(--tng-slate-500)]">{slip.date}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </TrackngoLayout>
    );
}
