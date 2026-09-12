import { Head, Link, router } from '@inertiajs/react';
import {
    Route as RouteIcon,
    Search,
    Download,
    Shield,
    ShieldCheck,
    Filter,
    RefreshCw,
    ExternalLink,
    Clock,
    FileText,
    CheckCircle2,
    ArrowRight,
    RotateCcw,
    Printer,
    Eye,
    ChevronLeft,
    ChevronRight,
    Building2,
    X,
    QrCode,
} from 'lucide-react';
import { useState, useMemo } from 'react';
import TrackngoLayout from '@/layouts/trackngo/TrackngoLayout';
import { cn } from '@/lib/utils';
import { RoutingSlipModal } from '@/components/trackngo/RoutingSlipModal';
import TablePagination from '@/components/trackngo/TablePagination';

export type RoutingSlipItem = {
    slip_id: number;
    formatted_slip_id: string;
    tracking_number: string;
    document_id: number;
    document_ref: string;
    document_title: string;
    document_status: string;
    document_classification: string;
    from_name: string;
    from_department: string;
    from_role: string;
    to_name: string;
    to_department: string;
    action: 'Forward' | 'Endorse' | 'Return' | 'Approve' | string;
    instruction: string;
    status: 'Active' | 'Completed' | 'Returned' | string;
    date: string;
    formatted_date: string;
    formatted_datetime: string;
    stop_number: string;
    qr_data: string;
};

type DepartmentOption = {
    department_id: number;
    department_name: string;
    code?: string;
};

type Props = {
    routingSlips?: RoutingSlipItem[];
    departments?: DepartmentOption[];
    isFullAccess?: boolean;
    currentRole?: string;
    userRoleName?: string;
    userName?: string;
};

export default function RoutingSlipsIndex({
    routingSlips = [],
    departments = [],
    isFullAccess = false,
    currentRole = 'receiving',
    userRoleName = 'Staff',
    userName = 'User',
}: Props) {
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [actionFilter, setActionFilter] = useState('all');
    const [deptFilter, setDeptFilter] = useState('all');
    const [dateRangeFilter, setDateRangeFilter] = useState<'all' | 'today' | '7days' | '30days'>('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [selectedSlip, setSelectedSlip] = useState<RoutingSlipItem | null>(null);

    // KPI Metrics calculation
    const metrics = useMemo(() => {
        let activeCount = 0;
        let completedCount = 0;
        let returnedCount = 0;

        routingSlips.forEach((slip) => {
            const s = (slip.status || '').toLowerCase();
            if (s === 'active') activeCount++;
            else if (s === 'completed') completedCount++;
            else if (s === 'returned') returnedCount++;
        });

        return {
            total: routingSlips.length,
            active: activeCount,
            completed: completedCount,
            returned: returnedCount,
        };
    }, [routingSlips]);

    // Filtering logic
    const filteredSlips = useMemo(() => {
        return routingSlips.filter((slip) => {
            // Search query filter
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const matchTracking = (slip.tracking_number || '').toLowerCase().includes(q);
                const matchRef = (slip.document_ref || '').toLowerCase().includes(q);
                const matchTitle = (slip.document_title || '').toLowerCase().includes(q);
                const matchFrom = (slip.from_name || '').toLowerCase().includes(q);
                const matchFromDept = (slip.from_department || '').toLowerCase().includes(q);
                const matchTo = (slip.to_name || '').toLowerCase().includes(q);
                const matchToDept = (slip.to_department || '').toLowerCase().includes(q);
                const matchInstruction = (slip.instruction || '').toLowerCase().includes(q);
                const matchAction = (slip.action || '').toLowerCase().includes(q);

                if (
                    !matchTracking &&
                    !matchRef &&
                    !matchTitle &&
                    !matchFrom &&
                    !matchFromDept &&
                    !matchTo &&
                    !matchToDept &&
                    !matchInstruction &&
                    !matchAction
                ) {
                    return false;
                }
            }

            // Status filter: Active, Completed, Returned
            if (statusFilter !== 'all' && slip.status.toLowerCase() !== statusFilter.toLowerCase()) {
                return false;
            }

            // Action type filter: Forward, Endorse, Return, Approve
            if (actionFilter !== 'all' && slip.action.toLowerCase() !== actionFilter.toLowerCase()) {
                return false;
            }

            // Department filter
            if (deptFilter !== 'all') {
                const matchFrom = (slip.from_department || '').toLowerCase() === deptFilter.toLowerCase();
                const matchTo = (slip.to_department || '').toLowerCase() === deptFilter.toLowerCase();
                if (!matchFrom && !matchTo) return false;
            }

            // Date range filter
            if (dateRangeFilter !== 'all' && slip.date) {
                const slipTime = new Date(slip.date).getTime();
                const now = Date.now();
                const diffHours = (now - slipTime) / (1000 * 60 * 60);

                if (dateRangeFilter === 'today' && diffHours > 24) return false;
                if (dateRangeFilter === '7days' && diffHours > 24 * 7) return false;
                if (dateRangeFilter === '30days' && diffHours > 24 * 30) return false;
            }

            return true;
        });
    }, [routingSlips, searchQuery, statusFilter, actionFilter, deptFilter, dateRangeFilter]);

    // Pagination
    const totalPages = Math.ceil(filteredSlips.length / pageSize) || 1;
    const paginatedSlips = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredSlips.slice(start, start + pageSize);
    }, [filteredSlips, currentPage, pageSize]);

    const handleRefresh = () => {
        setIsRefreshing(true);
        router.reload({
            onFinish: () => setIsRefreshing(false),
        });
    };

    // Export CSV
    const handleExportCsv = () => {
        if (filteredSlips.length === 0) return;

        const headers = [
            'Slip ID',
            'Tracking Number',
            'Document Reference',
            'Document Title',
            'From',
            'From Department',
            'To',
            'To Department',
            'Action',
            'Instruction',
            'Status',
            'Date',
        ];

        const rows = filteredSlips.map((s) => [
            `"${s.slip_id}"`,
            `"${s.tracking_number}"`,
            `"${s.document_ref}"`,
            `"${(s.document_title || '').replace(/"/g, '""')}"`,
            `"${(s.from_name || '').replace(/"/g, '""')}"`,
            `"${(s.from_department || '').replace(/"/g, '""')}"`,
            `"${(s.to_name || '').replace(/"/g, '""')}"`,
            `"${(s.to_department || '').replace(/"/g, '""')}"`,
            `"${s.action}"`,
            `"${(s.instruction || '').replace(/"/g, '""')}"`,
            `"${s.status}"`,
            `"${s.formatted_datetime || s.date}"`,
        ]);

        const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `trackngo_routing_slips_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Action Badge Helper
    const getActionBadge = (action: string) => {
        const a = (action || '').toLowerCase();
        if (a === 'approve' || a === 'approved') {
            return {
                bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                icon: ShieldCheck,
                label: 'Approve',
            };
        }
        if (a === 'endorse' || a === 'endorsed') {
            return {
                bg: 'bg-purple-50 text-purple-700 border-purple-200',
                icon: CheckCircle2,
                label: 'Endorse',
            };
        }
        if (a === 'return' || a === 'returned') {
            return {
                bg: 'bg-amber-50 text-amber-700 border-amber-200',
                icon: RotateCcw,
                label: 'Return',
            };
        }
        return {
            bg: 'bg-blue-50 text-blue-700 border-blue-200',
            icon: ArrowRight,
            label: 'Forward',
        };
    };

    // Status Badge Helper
    const getStatusBadge = (status: string) => {
        const s = (status || '').toLowerCase();
        if (s === 'completed') {
            return 'bg-indigo-50 text-indigo-700 border-indigo-200';
        }
        if (s === 'returned') {
            return 'bg-amber-50 text-amber-700 border-amber-200';
        }
        return 'bg-emerald-50 text-emerald-700 border-emerald-200'; // Active / Pending
    };

    const handlePrintModal = () => {
        window.print();
    };

    return (
        <TrackngoLayout>
            <Head title="Routing Slips" />

            <div className="space-y-6 pb-12">
                {/* ── Header ────────────────────────────────────────────────── */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-[var(--tng-slate-200)] pb-5">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-sm">
                            <RouteIcon className="h-6 w-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight text-[var(--tng-slate-900)]">
                                Routing Slips
                            </h1>
                            <p className="text-sm text-[var(--tng-slate-500)] mt-0.5">
                                Live document routing histories, transit logs, and official printable routing slips
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2.5 flex-wrap">
                        <button
                            type="button"
                            onClick={handleRefresh}
                            disabled={isRefreshing}
                            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-[var(--tng-slate-700)] bg-white border border-[var(--tng-slate-300)] rounded-lg hover:bg-[var(--tng-slate-50)] transition-colors shadow-sm disabled:opacity-50"
                        >
                            <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
                            Refresh
                        </button>
                        <button
                            type="button"
                            onClick={handleExportCsv}
                            disabled={filteredSlips.length === 0}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold text-white bg-[var(--tng-blue-600)] hover:bg-[var(--tng-blue-700)] rounded-lg transition-colors shadow-sm disabled:opacity-50"
                        >
                            <Download className="h-4 w-4" />
                            Export CSV ({filteredSlips.length})
                        </button>
                    </div>
                </div>

                {/* ── Scope Visibility Banner ───────────────────────────────── */}
                <div
                    className={cn(
                        'flex items-center justify-between gap-4 p-4 rounded-xl border text-sm',
                        isFullAccess
                            ? 'bg-purple-50/70 border-purple-200 text-purple-900'
                            : 'bg-blue-50/70 border-blue-200 text-blue-900'
                    )}
                >
                    <div className="flex items-center gap-3">
                        {isFullAccess ? (
                            <div className="p-2 rounded-lg bg-purple-100 text-purple-700">
                                <ShieldCheck className="h-5 w-5" />
                            </div>
                        ) : (
                            <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
                                <Shield className="h-5 w-5" />
                            </div>
                        )}
                        <div>
                            <span className="font-semibold">
                                {isFullAccess
                                    ? 'Global Routing Oversight'
                                    : 'Role-Scoped Traceability'}
                            </span>
                            <p className="text-xs opacity-90 mt-0.5">
                                {isFullAccess
                                    ? `As ${userRoleName}, you can view all routing slips across all departments, users, and workflows.`
                                    : `Displaying routing slips relevant to ${userName} (${userRoleName}) and your department's incoming/outgoing documents.`}
                            </p>
                        </div>
                    </div>
                    <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-white/80 border border-current/20 shadow-2xs">
                        {isFullAccess ? 'Full System View' : 'Personal & Departmental'}
                    </span>
                </div>

                {/* ── KPI Metric Cards ──────────────────────────────────────── */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white p-4 rounded-xl border border-[var(--tng-slate-200)] shadow-xs">
                        <div className="text-xs font-medium text-[var(--tng-slate-500)] uppercase tracking-wider">
                            Total Routing Slips
                        </div>
                        <div className="mt-2 flex items-baseline justify-between">
                            <span className="text-2xl font-bold text-[var(--tng-slate-900)]">
                                {metrics.total}
                            </span>
                            <span className="text-xs text-[var(--tng-slate-400)] font-medium">All recorded</span>
                        </div>
                    </div>

                    <div className="bg-white p-4 rounded-xl border border-[var(--tng-slate-200)] shadow-xs">
                        <div className="text-xs font-medium text-[var(--tng-slate-500)] uppercase tracking-wider">
                            Active / In Transit
                        </div>
                        <div className="mt-2 flex items-baseline justify-between">
                            <span className="text-2xl font-bold text-emerald-600">
                                {metrics.active}
                            </span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold">
                                Pending action
                            </span>
                        </div>
                    </div>

                    <div className="bg-white p-4 rounded-xl border border-[var(--tng-slate-200)] shadow-xs">
                        <div className="text-xs font-medium text-[var(--tng-slate-500)] uppercase tracking-wider">
                            Completed
                        </div>
                        <div className="mt-2 flex items-baseline justify-between">
                            <span className="text-2xl font-bold text-indigo-600">
                                {metrics.completed}
                            </span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-semibold">
                                Processed
                            </span>
                        </div>
                    </div>

                    <div className="bg-white p-4 rounded-xl border border-[var(--tng-slate-200)] shadow-xs">
                        <div className="text-xs font-medium text-[var(--tng-slate-500)] uppercase tracking-wider">
                            Returned
                        </div>
                        <div className="mt-2 flex items-baseline justify-between">
                            <span className="text-2xl font-bold text-amber-600">
                                {metrics.returned}
                            </span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-semibold">
                                For revision
                            </span>
                        </div>
                    </div>
                </div>

                {/* ── Toolbar & Filters ─────────────────────────────────────── */}
                <div className="bg-white rounded-xl border border-[var(--tng-slate-200)] p-4 shadow-xs space-y-3">
                    <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
                        {/* Search Input */}
                        <div className="relative flex-1">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--tng-slate-400)]" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    setCurrentPage(1);
                                }}
                                placeholder="Search by tracking #, document ref, title, sender, recipient, or instruction..."
                                className="w-full pl-10 pr-4 py-2 bg-[var(--tng-slate-50)] border border-[var(--tng-slate-200)] rounded-lg text-sm text-[var(--tng-slate-900)] placeholder-[var(--tng-slate-400)] focus:bg-white focus:border-[var(--tng-blue-600)] focus:ring-1 focus:ring-[var(--tng-blue-600)] transition-all outline-none"
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--tng-slate-400)] hover:text-[var(--tng-slate-600)]"
                                >
                                    Clear
                                </button>
                            )}
                        </div>

                        {/* Filter Dropdowns */}
                        <div className="flex items-center gap-2 flex-wrap">
                            {/* Status Filter: Active, Completed, Returned */}
                            <div className="flex items-center gap-1.5">
                                <Filter className="h-3.5 w-3.5 text-[var(--tng-slate-400)]" />
                                <select
                                    value={statusFilter}
                                    onChange={(e) => {
                                        setStatusFilter(e.target.value);
                                        setCurrentPage(1);
                                    }}
                                    className="bg-white border border-[var(--tng-slate-200)] rounded-lg text-xs font-medium text-[var(--tng-slate-700)] py-2 px-3 focus:border-[var(--tng-blue-600)] focus:ring-1 focus:ring-[var(--tng-blue-600)] outline-none"
                                >
                                    <option value="all">All Statuses</option>
                                    <option value="active">Active</option>
                                    <option value="completed">Completed</option>
                                    <option value="returned">Returned</option>
                                </select>
                            </div>

                            {/* Action Type Filter: Forward, Endorse, Return, Approve */}
                            <select
                                value={actionFilter}
                                onChange={(e) => {
                                    setActionFilter(e.target.value);
                                    setCurrentPage(1);
                                }}
                                className="bg-white border border-[var(--tng-slate-200)] rounded-lg text-xs font-medium text-[var(--tng-slate-700)] py-2 px-3 focus:border-[var(--tng-blue-600)] focus:ring-1 focus:ring-[var(--tng-blue-600)] outline-none"
                            >
                                <option value="all">All Actions</option>
                                <option value="forward">Forward</option>
                                <option value="endorse">Endorse</option>
                                <option value="return">Return</option>
                                <option value="approve">Approve</option>
                            </select>

                            {/* Department Filter */}
                            <select
                                value={deptFilter}
                                onChange={(e) => {
                                    setDeptFilter(e.target.value);
                                    setCurrentPage(1);
                                }}
                                className="bg-white border border-[var(--tng-slate-200)] rounded-lg text-xs font-medium text-[var(--tng-slate-700)] py-2 px-3 focus:border-[var(--tng-blue-600)] focus:ring-1 focus:ring-[var(--tng-blue-600)] outline-none max-w-[200px] truncate"
                            >
                                <option value="all">All Departments</option>
                                {departments.map((dept) => (
                                    <option key={dept.department_id} value={dept.department_name}>
                                        {dept.code ? `[${dept.code}] ` : ''}
                                        {dept.department_name}
                                    </option>
                                ))}
                            </select>

                            {/* Date Range Filter */}
                            <select
                                value={dateRangeFilter}
                                onChange={(e) => {
                                    setDateRangeFilter(e.target.value as any);
                                    setCurrentPage(1);
                                }}
                                className="bg-white border border-[var(--tng-slate-200)] rounded-lg text-xs font-medium text-[var(--tng-slate-700)] py-2 px-3 focus:border-[var(--tng-blue-600)] focus:ring-1 focus:ring-[var(--tng-blue-600)] outline-none"
                            >
                                <option value="all">All Time</option>
                                <option value="today">Past 24 Hours</option>
                                <option value="7days">Past 7 Days</option>
                                <option value="30days">Past 30 Days</option>
                            </select>
                        </div>
                    </div>

                    {/* Filter Summary Tags */}
                    {(searchQuery || statusFilter !== 'all' || actionFilter !== 'all' || deptFilter !== 'all' || dateRangeFilter !== 'all') && (
                        <div className="flex items-center gap-2 pt-2 border-t border-[var(--tng-slate-100)] text-xs text-[var(--tng-slate-500)] flex-wrap">
                            <span>Active Filters:</span>
                            {searchQuery && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded bg-[var(--tng-slate-100)] text-[var(--tng-slate-700)]">
                                    Keyword: "{searchQuery}"
                                </span>
                            )}
                            {statusFilter !== 'all' && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded bg-[var(--tng-slate-100)] text-[var(--tng-slate-700)] capitalize">
                                    Status: {statusFilter}
                                </span>
                            )}
                            {actionFilter !== 'all' && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded bg-[var(--tng-slate-100)] text-[var(--tng-slate-700)] capitalize">
                                    Action: {actionFilter}
                                </span>
                            )}
                            {deptFilter !== 'all' && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded bg-[var(--tng-slate-100)] text-[var(--tng-slate-700)] truncate max-w-xs">
                                    Dept: {deptFilter}
                                </span>
                            )}
                            {dateRangeFilter !== 'all' && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded bg-[var(--tng-slate-100)] text-[var(--tng-slate-700)]">
                                    Range: {dateRangeFilter}
                                </span>
                            )}
                            <button
                                type="button"
                                onClick={() => {
                                    setSearchQuery('');
                                    setStatusFilter('all');
                                    setActionFilter('all');
                                    setDeptFilter('all');
                                    setDateRangeFilter('all');
                                }}
                                className="text-[var(--tng-blue-600)] hover:underline ml-1 font-medium"
                            >
                                Reset all
                            </button>
                        </div>
                    )}
                </div>

                {/* ── Table Section ─────────────────────────────────────────── */}
                <div className="bg-white rounded-xl border border-[var(--tng-slate-200)] shadow-xs overflow-hidden">
                    <div className="overflow-x-auto w-full">
                        <table className="w-full text-left text-xs text-[var(--tng-slate-600)]">
                            <thead className="bg-[var(--tng-slate-50)] text-[var(--tng-slate-500)] border-b border-[var(--tng-slate-200)] uppercase tracking-wider font-semibold text-[11px]">
                                <tr>
                                    <th className="px-3.5 py-3">Slip ID</th>
                                    <th className="px-3.5 py-3">Document Reference</th>
                                    <th className="px-3.5 py-3">From</th>
                                    <th className="px-3.5 py-3">To</th>
                                    <th className="px-3.5 py-3 text-center">Action</th>
                                    <th className="px-3.5 py-3">Instruction</th>
                                    <th className="px-3.5 py-3 text-center">Status</th>
                                    <th className="px-3.5 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--tng-slate-200)]">
                                {paginatedSlips.length > 0 ? (
                                    paginatedSlips.map((slip) => {
                                        const actionBadge = getActionBadge(slip.action);
                                        const ActionIcon = actionBadge.icon;
                                        const docUrl = `/${currentRole}/documents/${slip.document_id}`;

                                        return (
                                            <tr
                                                key={slip.slip_id}
                                                className="transition-colors odd:bg-white even:bg-slate-50/70 hover:bg-blue-50/40"
                                            >
                                            {/* 1. Slip ID */}
                                            <td className="px-3.5 py-3">
                                                <div className="font-mono text-xs font-bold text-[var(--tng-blue-700)] bg-[var(--tng-blue-50)] px-2 py-0.5 rounded border border-[var(--tng-blue-200)] inline-block truncate max-w-full">
                                                    {slip.tracking_number}
                                                </div>
                                                <div className="text-[10px] text-[var(--tng-slate-400)] mt-0.5 font-sans">
                                                    {slip.formatted_date}
                                                </div>
                                            </td>

                                            {/* 2. Document Reference */}
                                            <td className="px-3.5 py-3">
                                                <Link
                                                    href={docUrl}
                                                    className="group block"
                                                    title={`${slip.document_ref} - ${slip.document_title}`}
                                                >
                                                    <span className="font-mono font-bold text-xs text-[var(--tng-blue-600)] group-hover:text-[var(--tng-blue-800)] group-hover:underline flex items-center gap-1">
                                                        {slip.document_ref}
                                                        <ExternalLink className="h-3 w-3 opacity-60 shrink-0" />
                                                    </span>
                                                    <span className="text-[11px] text-[var(--tng-slate-500)] group-hover:text-[var(--tng-slate-700)] truncate block mt-0.5">
                                                        {slip.document_title}
                                                    </span>
                                                </Link>
                                            </td>

                                            {/* 3. From */}
                                            <td className="px-3.5 py-3">
                                                <div className="font-semibold text-xs text-[var(--tng-slate-900)] truncate" title={slip.from_name}>
                                                    {slip.from_name}
                                                </div>
                                                <div className="text-[11px] text-[var(--tng-slate-500)] truncate mt-0.5" title={slip.from_department}>
                                                    {slip.from_department}
                                                </div>
                                            </td>

                                            {/* 4. To */}
                                            <td className="px-3.5 py-3">
                                                <div className="font-semibold text-xs text-[var(--tng-slate-900)] truncate" title={slip.to_department}>
                                                    {slip.to_department}
                                                </div>
                                                <div className="text-[11px] text-[var(--tng-slate-500)] truncate mt-0.5" title={slip.to_name}>
                                                    {slip.to_name}
                                                </div>
                                            </td>

                                            {/* 5. Action */}
                                            <td className="px-3.5 py-3 text-center">
                                                <span
                                                    className={cn(
                                                        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border',
                                                        actionBadge.bg
                                                    )}
                                                >
                                                    <ActionIcon className="h-3 w-3 shrink-0" />
                                                    {slip.action}
                                                </span>
                                            </td>

                                            {/* 6. Instruction */}
                                            <td className="px-3.5 py-3">
                                                <p
                                                    className="line-clamp-2 text-[11px] text-[var(--tng-slate-700)] bg-[var(--tng-slate-50)] p-1.5 rounded border border-[var(--tng-slate-100)] leading-snug"
                                                    title={slip.instruction}
                                                >
                                                    {slip.instruction || 'No specific instruction provided.'}
                                                </p>
                                            </td>

                                            {/* 7. Status */}
                                            <td className="px-3.5 py-3 text-center">
                                                <span
                                                    className={cn(
                                                        'inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold border',
                                                        getStatusBadge(slip.status)
                                                    )}
                                                >
                                                    {slip.status}
                                                </span>
                                            </td>

                                            {/* 8. Actions: View Routing Slip */}
                                            <td className="px-3 py-3 text-right">
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedSlip(slip)}
                                                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-white bg-[var(--tng-blue-600)] hover:bg-[var(--tng-blue-700)] rounded-lg transition-all shadow-2xs hover:shadow-xs active:scale-98 whitespace-nowrap"
                                                    title="View detailed official routing slip"
                                                    aria-label="View Routing Slip"
                                                >
                                                    <Eye className="h-3.5 w-3.5 shrink-0" />
                                                    <span>View <span className="hidden xl:inline">Routing </span>Slip</span>
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={8} className="px-6 py-12 text-center">
                                        <div className="flex flex-col items-center justify-center space-y-2">
                                            <div className="p-3 rounded-full bg-[var(--tng-slate-100)] text-[var(--tng-slate-400)]">
                                                <RouteIcon className="h-6 w-6" />
                                            </div>
                                            <div className="text-sm font-semibold text-[var(--tng-slate-700)]">
                                                No routing slips found
                                            </div>
                                            <p className="text-xs text-[var(--tng-slate-400)] max-w-sm">
                                                {searchQuery || statusFilter !== 'all' || actionFilter !== 'all' || deptFilter !== 'all'
                                                    ? 'Try clearing your filters or search query to view all available routing slips.'
                                                    : 'No routing slips have been recorded for your current role scope.'}
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                        </table>
                    </div>

                    {/* Pagination Footer */}
                    <TablePagination
                        currentPage={currentPage}
                        pageSize={pageSize}
                        totalItems={filteredSlips.length}
                        onPageChange={setCurrentPage}
                        onPageSizeChange={setPageSize}
                        itemLabel="routing slips"
                    />
                </div>
            </div>

            {/* ── Standardized Official Routing Slip Modal ─────────────────── */}
            <RoutingSlipModal
                isOpen={!!selectedSlip}
                onClose={() => setSelectedSlip(null)}
                slip={selectedSlip}
                currentRole={currentRole}
            />
        </TrackngoLayout>
    );
}
