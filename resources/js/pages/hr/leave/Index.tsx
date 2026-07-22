import { Head } from '@inertiajs/react';
import { CalendarDays, Search, Filter, CheckCircle, XCircle, Clock } from 'lucide-react';
import TrackngoLayout from '@/layouts/trackngo/TrackngoLayout';

const mockLeaveRequests = [
    { id: 1, employee: 'Ana Garcia', type: 'Vacation Leave', start: '2026-07-25', end: '2026-07-30', days: 4, status: 'pending', reason: 'Family vacation' },
    { id: 2, employee: 'Juan Dela Cruz', type: 'Sick Leave', start: '2026-07-20', end: '2026-07-21', days: 2, status: 'approved', reason: 'Medical appointment' },
    { id: 3, employee: 'Maria Santos', type: 'Vacation Leave', start: '2026-08-01', end: '2026-08-05', days: 5, status: 'pending', reason: 'Personal trip' },
    { id: 4, employee: 'Pedro Reyes', type: 'Special Leave', start: '2026-07-28', end: '2026-07-28', days: 1, status: 'pending', reason: 'Government exam' },
    { id: 5, employee: 'Carmen Lopez', type: 'Maternity Leave', start: '2026-08-10', end: '2026-10-10', days: 60, status: 'approved', reason: 'Maternity' },
    { id: 6, employee: 'Jose Mendoza', type: 'Vacation Leave', start: '2026-07-15', end: '2026-07-16', days: 2, status: 'rejected', reason: 'Conflict with project deadline' },
];

const statusConfig: Record<string, { icon: typeof Clock; bg: string; text: string; label: string }> = {
    pending: { icon: Clock, bg: 'bg-amber-100', text: 'text-amber-700', label: 'Pending' },
    approved: { icon: CheckCircle, bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Approved' },
    rejected: { icon: XCircle, bg: 'bg-red-100', text: 'text-red-700', label: 'Rejected' },
};

export default function LeaveIndex() {
    return (
        <TrackngoLayout>
            <Head title="Leave Management — TrackNGo Mati" />

            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--tng-slate-900)]">Leave Management</h1>
                    <p className="mt-0.5 text-sm text-[var(--tng-slate-500)]">
                        Review and manage employee leave requests
                    </p>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div className="flex items-center gap-4 rounded-2xl border border-[var(--tng-slate-200)] bg-white p-5 shadow-sm">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100">
                            <Clock className="h-6 w-6 text-amber-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-[var(--tng-slate-900)]">{mockLeaveRequests.filter(r => r.status === 'pending').length}</p>
                            <p className="text-xs text-[var(--tng-slate-500)]">Pending Requests</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 rounded-2xl border border-[var(--tng-slate-200)] bg-white p-5 shadow-sm">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100">
                            <CheckCircle className="h-6 w-6 text-emerald-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-[var(--tng-slate-900)]">{mockLeaveRequests.filter(r => r.status === 'approved').length}</p>
                            <p className="text-xs text-[var(--tng-slate-500)]">Approved This Month</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 rounded-2xl border border-[var(--tng-slate-200)] bg-white p-5 shadow-sm">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-100">
                            <XCircle className="h-6 w-6 text-red-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-[var(--tng-slate-900)]">{mockLeaveRequests.filter(r => r.status === 'rejected').length}</p>
                            <p className="text-xs text-[var(--tng-slate-500)]">Rejected</p>
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative flex-1 min-w-[250px] max-w-md">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--tng-slate-400)]" />
                        <input
                            type="text"
                            placeholder="Search by employee name..."
                            className="h-10 w-full rounded-lg border border-[var(--tng-slate-200)] bg-white pl-9 pr-4 text-sm text-[var(--tng-slate-700)] placeholder:text-[var(--tng-slate-400)] focus:border-[var(--tng-blue-500)] focus:outline-none focus:ring-2 focus:ring-[var(--tng-blue-500)]/20"
                        />
                    </div>
                    {['All', 'Pending', 'Approved', 'Rejected'].map((filter) => (
                        <button
                            key={filter}
                            className={`rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                                filter === 'All'
                                    ? 'bg-[var(--tng-blue-600)] text-white shadow-md shadow-blue-600/25'
                                    : 'border border-[var(--tng-slate-200)] bg-white text-[var(--tng-slate-600)] hover:bg-[var(--tng-slate-50)]'
                            }`}
                        >
                            {filter}
                        </button>
                    ))}
                </div>

                {/* Leave Requests Table */}
                <div className="rounded-2xl border border-[var(--tng-slate-200)] bg-white shadow-sm overflow-hidden">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-[var(--tng-slate-200)] bg-[var(--tng-slate-50)]">
                                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--tng-slate-500)]">Employee</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--tng-slate-500)]">Leave Type</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--tng-slate-500)]">Duration</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--tng-slate-500)]">Days</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--tng-slate-500)]">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--tng-slate-500)]">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--tng-slate-100)]">
                            {mockLeaveRequests.map((req) => {
                                const config = statusConfig[req.status] ?? statusConfig.pending;
                                return (
                                    <tr key={req.id} className="transition-colors hover:bg-[var(--tng-slate-50)]">
                                        <td className="px-6 py-4">
                                            <p className="text-sm font-medium text-[var(--tng-slate-800)]">{req.employee}</p>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-[var(--tng-slate-600)]">{req.type}</td>
                                        <td className="px-6 py-4 text-sm text-[var(--tng-slate-600)]">
                                            {req.start} — {req.end}
                                        </td>
                                        <td className="px-6 py-4 text-sm font-semibold text-[var(--tng-slate-800)]">{req.days}</td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${config.bg} ${config.text}`}>
                                                {config.label}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            {req.status === 'pending' && (
                                                <div className="flex items-center gap-2">
                                                    <button className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100">
                                                        Approve
                                                    </button>
                                                    <button className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100">
                                                        Reject
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </TrackngoLayout>
    );
}
