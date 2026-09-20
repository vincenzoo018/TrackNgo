import { Head } from '@inertiajs/react';
import { CalendarDays, Search, Filter, CheckCircle, XCircle, Clock } from 'lucide-react';
import TrackngoLayout from '@/layouts/trackngo/TrackngoLayout';
import { useState, useMemo } from 'react';
import TabNavigation, { TabItem } from '@/components/trackngo/TabNavigation';
import TablePagination from '@/components/trackngo/TablePagination';
import TableActionButtons from '@/components/trackngo/TableActionButtons';
import { StatCard } from '@/components/trackngo/StatCard';

const mockLeaveRequests = [
    { id: 1, employee: 'Ana Garcia', type: 'Vacation Leave', start: '2026-07-25', end: '2026-07-30', days: 4, status: 'pending', reason: 'Family vacation' },
    { id: 2, employee: 'Juan Dela Cruz', type: 'Sick Leave', start: '2026-07-20', end: '2026-07-21', days: 2, status: 'approved', reason: 'Medical appointment' },
    { id: 3, employee: 'Maria Santos', type: 'Vacation Leave', start: '2026-08-01', end: '2026-08-05', days: 5, status: 'pending', reason: 'Personal trip' },
    { id: 4, employee: 'Pedro Reyes', type: 'Special Leave', start: '2026-07-28', end: '2026-07-28', days: 1, status: 'pending', reason: 'Government exam' },
    { id: 5, employee: 'Carmen Lopez', type: 'Maternity Leave', start: '2026-08-10', end: '2026-10-10', days: 60, status: 'approved', reason: 'Maternity' },
    { id: 6, employee: 'Jose Mendoza', type: 'Vacation Leave', start: '2026-07-15', end: '2026-07-16', days: 2, status: 'rejected', reason: 'Conflict with project deadline' },
];

const statusConfig: Record<string, { icon: typeof Clock; bg: string; text: string; border: string; label: string }> = {
    pending: { icon: Clock, bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', label: 'Pending' },
    approved: { icon: CheckCircle, bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', label: 'Approved' },
    rejected: { icon: XCircle, bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', label: 'Rejected' },
};

export default function LeaveIndex() {
    const [requestsList, setRequestsList] = useState(mockLeaveRequests);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);

    const counts = useMemo(() => {
        return {
            all: requestsList.length,
            pending: requestsList.filter((r) => r.status === 'pending').length,
            approved: requestsList.filter((r) => r.status === 'approved').length,
            rejected: requestsList.filter((r) => r.status === 'rejected').length,
        };
    }, [requestsList]);

    const tabs: TabItem[] = [
        { id: 'all', label: 'All Requests', count: counts.all },
        { id: 'pending', label: 'Pending', count: counts.pending },
        { id: 'approved', label: 'Approved', count: counts.approved },
        { id: 'rejected', label: 'Rejected', count: counts.rejected },
    ];

    const filteredRequests = useMemo(() => {
        return requestsList.filter((req) => {
            if (activeTab !== 'all' && req.status !== activeTab) return false;
            if (!searchQuery.trim()) return true;
            const q = searchQuery.toLowerCase();
            return (
                req.employee.toLowerCase().includes(q) ||
                req.type.toLowerCase().includes(q) ||
                req.reason.toLowerCase().includes(q)
            );
        });
    }, [requestsList, activeTab, searchQuery]);

    const handleDelete = (id: number) => {
        if (confirm('Are you sure you want to delete this leave request?')) {
            setRequestsList(prev => prev.filter(r => r.id !== id));
        }
    };

    const handleEdit = (req: any) => {
        const newStatus = prompt(`Update status for ${req.employee}'s leave (pending, approved, rejected):`, req.status);
        if (newStatus && ['pending', 'approved', 'rejected'].includes(newStatus.toLowerCase())) {
            setRequestsList(prev => prev.map(r => r.id === req.id ? { ...r, status: newStatus.toLowerCase() as any } : r));
        }
    };

    const paginatedRequests = useMemo(() => {
        return filteredRequests.slice(
            (currentPage - 1) * pageSize,
            currentPage * pageSize
        );
    }, [filteredRequests, currentPage, pageSize]);

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

                {/* ── Summary Metric Cards (Standardized System Blue) ────────── */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
                    <StatCard
                        title="Total Requests"
                        value={counts.all}
                        sublabel="All submitted applications"
                        icon={CalendarDays}
                        active={activeTab === 'all'}
                        onClick={() => {
                            setActiveTab('all');
                            setCurrentPage(1);
                        }}
                    />

                    <StatCard
                        title="Pending"
                        value={counts.pending}
                        sublabel="Awaiting HR review"
                        icon={Clock}
                        active={activeTab === 'pending'}
                        onClick={() => {
                            setActiveTab('pending');
                            setCurrentPage(1);
                        }}
                    />

                    <StatCard
                        title="Approved"
                        value={counts.approved}
                        sublabel="Authorized leave"
                        icon={CheckCircle}
                        active={activeTab === 'approved'}
                        onClick={() => {
                            setActiveTab('approved');
                            setCurrentPage(1);
                        }}
                    />

                    <StatCard
                        title="Rejected"
                        value={counts.rejected}
                        sublabel="Disapproved requests"
                        icon={XCircle}
                        active={activeTab === 'rejected'}
                        onClick={() => {
                            setActiveTab('rejected');
                            setCurrentPage(1);
                        }}
                    />
                </div>

                {/* ── Tabbed Navigation ─────────────────────────────────────── */}
                <TabNavigation
                    tabs={tabs}
                    activeTab={activeTab}
                    onChange={(tabId) => {
                        setActiveTab(tabId as any);
                        setCurrentPage(1);
                    }}
                />

                {/* ── Filters Toolbar ───────────────────────────────────────── */}
                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative flex-1 min-w-[250px] max-w-md">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--tng-slate-400)]" />
                        <input
                            type="text"
                            placeholder="Search by reference number, tracking number, type, or name..."
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="h-10 w-full rounded-lg border border-[var(--tng-slate-200)] bg-white pl-9 pr-4 text-sm text-[var(--tng-slate-700)] placeholder:text-[var(--tng-slate-400)] focus:border-[var(--tng-blue-500)] focus:outline-none focus:ring-2 focus:ring-[var(--tng-blue-500)]/20"
                        />
                    </div>
                </div>

                {/* Leave Requests Table */}
                <div className="w-full rounded-xl border border-[var(--tng-slate-200)] bg-white shadow-xs overflow-hidden">
                    <div className="overflow-x-auto w-full">
                        <table className="w-full text-left border-collapse text-[13px] text-slate-700">
                            <thead className="bg-[var(--tng-slate-50)] border-b border-[var(--tng-slate-200)]">
                                <tr>
                                    <th className="px-4 py-3 text-left text-[14px] font-normal text-slate-600">Employee</th>
                                    <th className="px-4 py-3 text-left text-[14px] font-normal text-slate-600">Leave Type</th>
                                    <th className="px-4 py-3 text-left text-[14px] font-normal text-slate-600">Duration</th>
                                    <th className="px-4 py-3 text-center text-[14px] font-normal text-slate-600">Days</th>
                                    <th className="px-4 py-3 text-left text-[14px] font-normal text-slate-600">Status</th>
                                    <th className="px-4 py-3 text-right text-[14px] font-normal text-slate-600">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--tng-slate-100)]">
                                {paginatedRequests.length > 0 ? (
                                    paginatedRequests.map((req) => {
                                        const config = statusConfig[req.status] ?? statusConfig.pending;
                                        return (
                                            <tr key={req.id} className="transition-colors odd:bg-white even:bg-slate-50/75 hover:bg-blue-50/40 group">
                                                <td className="px-4 py-3 whitespace-nowrap text-[13px] font-normal text-slate-900">
                                                    {req.employee}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-[13px] font-normal text-slate-700">
                                                    {req.type}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-[13px] font-normal text-slate-700">
                                                    {req.start} — {req.end}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-[13px] font-normal text-slate-900 text-center">
                                                    {req.days}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12px] font-medium border ${config.bg} ${config.text} ${config.border}`}>
                                                        <config.icon className="h-3.5 w-3.5" />
                                                        {config.label}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-right">
                                                    <TableActionButtons
                                                        onEdit={() => handleEdit(req)}
                                                        editTitle="Edit Record"
                                                        onDelete={() => handleDelete(req.id)}
                                                        deleteTitle="Delete Record"
                                                    />
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-8 text-center text-[13px] text-slate-400">
                                            No leave requests found for this filter.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <TablePagination
                        currentPage={currentPage}
                        pageSize={pageSize}
                        totalItems={filteredRequests.length}
                        onPageChange={setCurrentPage}
                        onPageSizeChange={(newSize) => {
                            setPageSize(newSize);
                            setCurrentPage(1);
                        }}
                        pageSizeOptions={[20, 50, 100]}
                        itemLabel="leave requests"
                    />
                </div>
            </div>
        </TrackngoLayout>
    );
}
