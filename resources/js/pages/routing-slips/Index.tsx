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
    AlertTriangle,
    LayoutList,
    GitCommit,
    Layers,
    ChevronDown,
    ChevronUp,
} from 'lucide-react';
import { useState, useMemo } from 'react';
import TrackngoLayout from '@/layouts/trackngo/TrackngoLayout';
import { cn } from '@/lib/utils';
import { RoutingSlipModal } from '@/components/trackngo/RoutingSlipModal';
import TablePagination from '@/components/trackngo/TablePagination';
import TabNavigation, { TabItem } from '@/components/trackngo/TabNavigation';
import TableActionButtons from '@/components/trackngo/TableActionButtons';
import { StatCard } from '@/components/trackngo/StatCard';

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

export type RoutingHop = {
    slip_id: number;
    tracking_number: string;
    from_name: string;
    from_department: string;
    to_name: string;
    target_department: string;
    action: string;
    instruction: string;
    status: string;
    date_received: string;
    formatted_date: string;
    time_spent_days: number;
    time_spent_formatted: string;
    sla_days: number;
    is_bottleneck: boolean;
    bottleneck_message: string;
    receiver_name: string;
    sender_name: string;
    document_id: number;
    document_ref: string;
    document_title: string;
    document_classification: string;
    qr_data: string;
};

export type DocumentTimelineGroup = {
    document_id: number;
    tracking_number: string;
    reference_number: string;
    document_title: string;
    document_status: string;
    classification: string;
    hops_count: number;
    has_bottlenecks: boolean;
    bottlenecks_count: number;
    sla_days: number;
    hops: RoutingHop[];
};

type DepartmentOption = {
    department_id: number;
    department_name: string;
    code?: string;
};

type Props = {
    routingSlips?: RoutingSlipItem[];
    timelineGroups?: DocumentTimelineGroup[];
    departments?: DepartmentOption[];
    isFullAccess?: boolean;
    currentRole?: string;
    userRoleName?: string;
    userName?: string;
    metrics?: {
        total: number;
        active: number;
        completed: number;
        returned: number;
        bottlenecks?: number;
    };
};

export default function RoutingSlipsIndex({
    routingSlips = [],
    timelineGroups = [],
    departments = [],
    isFullAccess = false,
    currentRole = 'receiving',
    userRoleName = 'Staff',
    userName = 'User',
    metrics: initialMetrics,
}: Props) {
    const [viewMode, setViewMode] = useState<'timeline' | 'table'>('timeline');
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [actionFilter, setActionFilter] = useState('all');
    const [deptFilter, setDeptFilter] = useState('all');
    const [dateRangeFilter, setDateRangeFilter] = useState<'all' | 'today' | '7days' | '30days'>('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [selectedSlip, setSelectedSlip] = useState<any | null>(null);
    const [collapsedDocs, setCollapsedDocs] = useState<Record<number, boolean>>({});

    // Toggle collapse state for a document group in timeline view
    const toggleCollapse = (docId: number) => {
        setCollapsedDocs((prev) => ({ ...prev, [docId]: !prev[docId] }));
    };

    // KPI Metrics calculation (with fallback to backend-calculated metrics)
    const metrics = useMemo(() => {
        if (initialMetrics) {
            return initialMetrics;
        }

        let activeCount = 0;
        let completedCount = 0;
        let returnedCount = 0;

        routingSlips.forEach((slip) => {
            const s = (slip.status || '').toLowerCase();
            if (s === 'active') activeCount++;
            else if (s === 'completed') completedCount++;
            else if (s === 'returned') returnedCount++;
        });

        let bottlenecksCount = 0;
        timelineGroups.forEach((tg) => {
            if (tg.has_bottlenecks) bottlenecksCount += (tg.bottlenecks_count || 1);
        });

        return {
            total: routingSlips.length,
            active: activeCount,
            completed: completedCount,
            returned: returnedCount,
            bottlenecks: bottlenecksCount,
        };
    }, [routingSlips, timelineGroups, initialMetrics]);

    // Tabular Filtering logic
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

    // Timeline Groups Filtering logic
    const filteredTimelineGroups = useMemo(() => {
        return timelineGroups.filter((group) => {
            // Search query filter
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const matchRef = (group.reference_number || '').toLowerCase().includes(q);
                const matchTracking = (group.tracking_number || '').toLowerCase().includes(q);
                const matchTitle = (group.document_title || '').toLowerCase().includes(q);

                const matchHops = group.hops.some((h) =>
                    (h.from_name || '').toLowerCase().includes(q) ||
                    (h.to_name || '').toLowerCase().includes(q) ||
                    (h.target_department || '').toLowerCase().includes(q) ||
                    (h.tracking_number || '').toLowerCase().includes(q)
                );

                if (!matchRef && !matchTracking && !matchTitle && !matchHops) {
                    return false;
                }
            }

            // Status filter
            if (statusFilter !== 'all') {
                const hasMatchingHop = group.hops.some(
                    (h) => (h.status || '').toLowerCase() === statusFilter.toLowerCase()
                );
                if (!hasMatchingHop && (group.document_status || '').toLowerCase() !== statusFilter.toLowerCase()) {
                    return false;
                }
            }

            // Action type filter
            if (actionFilter !== 'all') {
                const hasMatchingAction = group.hops.some(
                    (h) => (h.action || '').toLowerCase() === actionFilter.toLowerCase()
                );
                if (!hasMatchingAction) return false;
            }

            // Department filter
            if (deptFilter !== 'all') {
                const hasMatchingDept = group.hops.some(
                    (h) =>
                        (h.target_department || '').toLowerCase() === deptFilter.toLowerCase() ||
                        (h.from_department || '').toLowerCase() === deptFilter.toLowerCase()
                );
                if (!hasMatchingDept) return false;
            }

            return true;
        });
    }, [timelineGroups, searchQuery, statusFilter, actionFilter, deptFilter]);

    // Pagination for Table view
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
                            <div className="flex items-center gap-2">
                                <h1 className="text-[20px] font-bold tracking-tight text-[var(--tng-slate-900)]">
                                    Routing Slips
                                </h1>
                            </div>
                            <p className="text-sm text-[var(--tng-slate-500)] mt-0.5">
                                Track the entire path a document takes with estimated vs. actual time per hop, SLA bottlenecks, and official printable slips
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2.5 flex-wrap">
                        {/* View Switcher Segmented Control */}
                        <div className="inline-flex items-center p-1 bg-[var(--tng-slate-100)] rounded-lg border border-[var(--tng-slate-200)] shadow-2xs">
                            <button
                                type="button"
                                onClick={() => setViewMode('timeline')}
                                className={cn(
                                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all',
                                    viewMode === 'timeline'
                                        ? 'bg-white text-[var(--tng-blue-600)] shadow-xs'
                                        : 'text-[var(--tng-slate-600)] hover:text-[var(--tng-slate-900)]'
                                )}
                            >
                                <GitCommit className="h-3.5 w-3.5" />
                                Timeline View
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewMode('table')}
                                className={cn(
                                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all',
                                    viewMode === 'table'
                                        ? 'bg-white text-[var(--tng-blue-600)] shadow-xs'
                                        : 'text-[var(--tng-slate-600)] hover:text-[var(--tng-slate-900)]'
                                )}
                            >
                                <LayoutList className="h-3.5 w-3.5" />
                                Table View
                            </button>
                        </div>

                        <button
                            type="button"
                            onClick={handleRefresh}
                            disabled={isRefreshing}
                            className="inline-flex items-center gap-1.5 px-3 py-2 text-[14px] font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors shadow-xs disabled:opacity-50"
                        >
                            <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
                            Refresh
                        </button>
                        <button
                            type="button"
                            onClick={handleExportCsv}
                            disabled={filteredSlips.length === 0}
                            className="inline-flex items-center gap-2 px-4 py-2 text-[14px] font-medium text-white bg-[#0066cc] hover:bg-[#005bb5] rounded-lg transition-all shadow-xs hover:shadow-sm disabled:opacity-50"
                        >
                            <Download className="h-4 w-4 text-white shrink-0" />
                            Export CSV ({filteredSlips.length})
                        </button>
                    </div>
                </div>


                {/* ── KPI Metric Cards (Standardized System Blue) ─────────────── */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
                    <StatCard
                        title="Total Routing Slips"
                        value={metrics.total}
                        sublabel="All recorded transactions"
                        icon={RouteIcon}
                        active={statusFilter === 'all'}
                        onClick={() => {
                            setStatusFilter('all');
                            setCurrentPage(1);
                        }}
                    />

                    <StatCard
                        title="Active / In Transit"
                        value={metrics.active}
                        sublabel="Pending routing actions"
                        icon={Clock}
                        active={statusFilter === 'active'}
                        onClick={() => {
                            setStatusFilter('active');
                            setCurrentPage(1);
                        }}
                    />

                    <StatCard
                        title="Completed Hops"
                        value={metrics.completed}
                        sublabel="Processed & dispatched"
                        icon={CheckCircle2}
                        active={statusFilter === 'completed'}
                        onClick={() => {
                            setStatusFilter('completed');
                            setCurrentPage(1);
                        }}
                    />

                    <StatCard
                        title="SLA Bottlenecks"
                        value={metrics.bottlenecks ?? 0}
                        sublabel="Exceeded statutory SLA"
                        icon={AlertTriangle}
                        active={statusFilter === 'returned'}
                        onClick={() => {
                            setStatusFilter('returned');
                            setCurrentPage(1);
                        }}
                    />
                </div>

                {/* ── Standardized Tabbed Navigation (Routing Slips: All, Active, Completed, Returned) ── */}
                <TabNavigation
                    tabs={[
                        { id: 'all', label: 'All Routing Slips', icon: <RouteIcon className="h-4 w-4" />, count: metrics.total },
                        { id: 'active', label: 'Active', icon: <Clock className="h-4 w-4 text-emerald-600" />, count: metrics.active },
                        { id: 'completed', label: 'Completed', icon: <CheckCircle2 className="h-4 w-4 text-indigo-600" />, count: metrics.completed },
                        { id: 'returned', label: 'Returned', icon: <RotateCcw className="h-4 w-4 text-amber-600" />, count: metrics.returned },
                    ]}
                    activeTab={statusFilter}
                    onChange={(tabId) => {
                        setStatusFilter(tabId);
                        setCurrentPage(1);
                    }}
                />

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
                                placeholder="Search by document reference, tracking number, department, or personnel..."
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

                {/* ── View Presentation: Timeline View or Table View ────────── */}
                {viewMode === 'timeline' ? (
                    /* ── TIMELINE VIEW (Document Hop Paths & SLA Tracking) ── */
                    <div className="space-y-6">
                        {filteredTimelineGroups.length > 0 ? (
                            filteredTimelineGroups.map((group) => {
                                const isCollapsed = !!collapsedDocs[group.document_id];
                                const docUrl = `/${currentRole}/documents/${group.document_id}`;

                                return (
                                    <div
                                        key={group.document_id}
                                        className="bg-white rounded-xl border border-[var(--tng-slate-200)] shadow-xs overflow-hidden transition-all"
                                    >
                                        {/* Document Header Card */}
                                        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-50/80 via-white to-slate-50/40 border-b border-[var(--tng-slate-200)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                            <div className="flex items-start gap-3">
                                                <button
                                                    type="button"
                                                    onClick={() => toggleCollapse(group.document_id)}
                                                    className="mt-0.5 p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 transition-colors"
                                                    title={isCollapsed ? 'Expand timeline' : 'Collapse timeline'}
                                                >
                                                    {isCollapsed ? (
                                                        <ChevronRight className="h-5 w-5" />
                                                    ) : (
                                                        <ChevronDown className="h-5 w-5" />
                                                    )}
                                                </button>
                                                <div>
                                                    <div className="flex items-center gap-2.5 flex-wrap">
                                                        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                                                            Document
                                                        </span>
                                                        <Link
                                                            href={docUrl}
                                                            className="font-mono text-base font-bold text-[var(--tng-blue-700)] hover:underline flex items-center gap-1"
                                                        >
                                                            {group.reference_number}
                                                            <ExternalLink className="h-3.5 w-3.5 opacity-70 shrink-0" />
                                                        </Link>
                                                        <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                                            Track: {group.tracking_number}
                                                        </span>
                                                        <span className={cn('text-xs px-2 py-0.5 rounded-full font-bold border', getStatusBadge(group.document_status))}>
                                                            {group.document_status}
                                                        </span>
                                                    </div>
                                                    <h3 className="text-sm font-semibold text-slate-800 mt-1">
                                                        {group.document_title}
                                                    </h3>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 self-start sm:self-center pl-8 sm:pl-0">
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                                    <RouteIcon className="h-3.5 w-3.5" />
                                                    {group.hops_count} {group.hops_count === 1 ? 'Hop' : 'Hops'} Recorded
                                                </span>
                                                {group.has_bottlenecks ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200 animate-pulse">
                                                        <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
                                                        {group.bottlenecks_count} Bottleneck
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                                        SLA Compliant
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Document Timeline Hops Body */}
                                        {!isCollapsed && (
                                            <div className="p-5 sm:p-6">
                                                <div className="relative pl-6 ml-3 sm:ml-4 border-l-2 border-[var(--tng-slate-200)] space-y-6">
                                                    {group.hops.map((hop, index) => {
                                                        const actionBadge = getActionBadge(hop.action);
                                                        const ActionIcon = actionBadge.icon;

                                                        return (
                                                            <div key={hop.slip_id} className="relative group">
                                                                {/* Timeline Circle Marker */}
                                                                <div
                                                                    className={cn(
                                                                        'absolute -left-[31px] top-1.5 w-4 h-4 rounded-full border-2 border-white shadow-xs transition-transform group-hover:scale-125',
                                                                        hop.is_bottleneck
                                                                            ? 'bg-red-500 ring-4 ring-red-100'
                                                                            : 'bg-[var(--tng-blue-600)] ring-4 ring-blue-100'
                                                                    )}
                                                                />

                                                                {/* Hop Details Container */}
                                                                <div
                                                                    className={cn(
                                                                        'rounded-xl border p-4 transition-all shadow-2xs hover:shadow-xs',
                                                                        hop.is_bottleneck
                                                                            ? 'bg-red-50/20 border-red-200 hover:border-red-300'
                                                                            : 'bg-slate-50/50 border-slate-200 hover:border-slate-300'
                                                                    )}
                                                                >
                                                                    {/* Top Header of Hop */}
                                                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                                                        <div>
                                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                                <span className="font-bold text-sm text-slate-900">
                                                                                    Transferred to {hop.target_department}
                                                                                </span>
                                                                                <span
                                                                                    className={cn(
                                                                                        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border',
                                                                                        actionBadge.bg
                                                                                    )}
                                                                                >
                                                                                    <ActionIcon className="h-3 w-3 shrink-0" />
                                                                                    {hop.action}
                                                                                </span>
                                                                                <span
                                                                                    className={cn(
                                                                                        'inline-block px-2 py-0.5 rounded-full text-[11px] font-bold border',
                                                                                        getStatusBadge(hop.status)
                                                                                    )}
                                                                                >
                                                                                    {hop.status}
                                                                                </span>
                                                                            </div>
                                                                            <div className="text-xs text-slate-500 mt-1">
                                                                                <span>Received by: <strong className="text-slate-700">{hop.receiver_name}</strong></span>
                                                                                <span className="mx-2">•</span>
                                                                                <span>Sent by: <strong className="text-slate-700">{hop.sender_name}</strong> ({hop.from_department})</span>
                                                                            </div>
                                                                        </div>

                                                                        <div className="text-left sm:text-right">
                                                                            <span className="text-xs font-mono text-slate-500 block">
                                                                                {hop.formatted_date}
                                                                            </span>
                                                                            <span className="text-[11px] text-slate-400">
                                                                                Hop #{index + 1} of {group.hops.length}
                                                                            </span>
                                                                        </div>
                                                                    </div>

                                                                    {/* Instruction text if available */}
                                                                    {hop.instruction && (
                                                                        <div className="mt-3 text-xs text-slate-600 bg-white/80 p-2.5 rounded-lg border border-slate-200/80 leading-relaxed italic">
                                                                            "{hop.instruction}"
                                                                        </div>
                                                                    )}

                                                                    {/* Bottom SLA and Action Ribbon */}
                                                                    <div className="mt-3 pt-3 border-t border-slate-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                                                                        <div className="flex items-center gap-3 flex-wrap">
                                                                            {hop.is_bottleneck ? (
                                                                                <span className="inline-flex items-center gap-1.5 text-red-700 font-bold bg-red-100/70 px-2.5 py-1 rounded-md">
                                                                                    <AlertTriangle className="h-3.5 w-3.5 text-red-600 shrink-0" />
                                                                                    {hop.bottleneck_message}
                                                                                </span>
                                                                            ) : (
                                                                                <span className="inline-flex items-center gap-1.5 text-emerald-700 font-bold bg-emerald-100/70 px-2.5 py-1 rounded-md">
                                                                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                                                                                    {hop.bottleneck_message} (SLA: {hop.sla_days} days)
                                                                                </span>
                                                                            )}

                                                                            <span className="inline-flex items-center gap-1 font-mono text-slate-500">
                                                                                <FileText className="h-3.5 w-3.5 text-slate-400" />
                                                                                Slip: {hop.tracking_number}
                                                                            </span>
                                                                        </div>

                                                                        <button
                                                                            type="button"
                                                                            onClick={() => setSelectedSlip(hop)}
                                                                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors border border-blue-200 shadow-2xs self-start sm:self-auto"
                                                                        >
                                                                            <Eye className="h-3.5 w-3.5" />
                                                                            Official Routing Slip
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        ) : (
                            <div className="bg-white rounded-xl border border-[var(--tng-slate-200)] p-12 text-center shadow-xs">
                                <div className="flex flex-col items-center justify-center space-y-2">
                                    <div className="p-3 rounded-full bg-[var(--tng-slate-100)] text-[var(--tng-slate-400)]">
                                        <GitCommit className="h-6 w-6" />
                                    </div>
                                    <div className="text-[14px] font-semibold text-[var(--tng-slate-700)]">
                                        No routing timelines found
                                    </div>
                                    <p className="text-xs text-[var(--tng-slate-400)] max-w-sm">
                                        {searchQuery || statusFilter !== 'all' || actionFilter !== 'all' || deptFilter !== 'all'
                                            ? 'Try clearing your active filters to view all recorded document hops.'
                                            : 'No routing slips have been recorded yet in the system.'}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    /* ── TABLE VIEW (Tabular Records & CSV Export) ────────── */
                    <div className="w-full bg-white rounded-xl border border-[var(--tng-slate-200)] shadow-xs overflow-hidden">
                        <div className="overflow-x-auto w-full">
                            <table className="w-full text-left border-collapse text-[13px] text-slate-700">
                                <thead className="bg-[var(--tng-slate-50)] border-b border-[var(--tng-slate-200)]">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-[14px] font-normal text-slate-600">Slip ID</th>
                                        <th className="px-4 py-3 text-left text-[14px] font-normal text-slate-600">Document Reference</th>
                                        <th className="px-4 py-3 text-left text-[14px] font-normal text-slate-600">From</th>
                                        <th className="px-4 py-3 text-left text-[14px] font-normal text-slate-600">To</th>
                                        <th className="px-4 py-3 text-center text-[14px] font-normal text-slate-600">Action</th>
                                        <th className="px-4 py-3 text-left text-[14px] font-normal text-slate-600">Instruction</th>
                                        <th className="px-4 py-3 text-center text-[14px] font-normal text-slate-600">Status</th>
                                        <th className="px-4 py-3 text-right text-[14px] font-normal text-slate-600">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--tng-slate-100)]">
                                    {paginatedSlips.length > 0 ? (
                                        paginatedSlips.map((slip) => {
                                            const actionBadge = getActionBadge(slip.action);
                                            const ActionIcon = actionBadge.icon;
                                            const docUrl = `/${currentRole}/documents/${slip.document_id}`;

                                            return (
                                                <tr
                                                    key={slip.slip_id}
                                                    className="transition-colors odd:bg-white even:bg-slate-50/75 hover:bg-blue-50/40 group"
                                                >
                                                    {/* 1. Slip ID */}
                                                    <td className="px-4 py-3 text-[13px] font-normal text-slate-700">
                                                        <div className="font-mono text-[13px] font-normal text-[#0066cc] bg-blue-50 px-2 py-0.5 rounded border border-blue-200 inline-block truncate max-w-full">
                                                            {slip.tracking_number}
                                                        </div>
                                                        <div className="text-[12px] text-slate-400 mt-0.5 font-sans font-normal">
                                                            {slip.formatted_date}
                                                        </div>
                                                    </td>

                                                    {/* 2. Document Reference */}
                                                    <td className="px-4 py-3 text-[13px] font-normal text-slate-700">
                                                        <Link
                                                            href={docUrl}
                                                            className="group block"
                                                            title={`${slip.document_ref} - ${slip.document_title}`}
                                                        >
                                                            <span className="font-mono font-normal text-[13px] text-[#0066cc] group-hover:underline flex items-center gap-1">
                                                                {slip.document_ref}
                                                                <ExternalLink className="h-3.5 w-3.5 opacity-60 shrink-0" />
                                                            </span>
                                                            <span className="text-[12px] text-slate-500 font-normal truncate block mt-0.5">
                                                                {slip.document_title}
                                                            </span>
                                                        </Link>
                                                    </td>

                                                    {/* 3. From */}
                                                    <td className="px-4 py-3 text-[13px] font-normal text-slate-700">
                                                        <div className="font-normal text-[13px] text-slate-900 truncate" title={slip.from_name}>
                                                            {slip.from_name}
                                                        </div>
                                                        <div className="text-[12px] text-slate-500 font-normal truncate mt-0.5" title={slip.from_department}>
                                                            {slip.from_department}
                                                        </div>
                                                    </td>

                                                    {/* 4. To */}
                                                    <td className="px-4 py-3 text-[13px] font-normal text-slate-700">
                                                        <div className="font-normal text-[13px] text-slate-900 truncate" title={slip.to_department}>
                                                            {slip.to_department}
                                                        </div>
                                                        <div className="text-[12px] text-slate-500 font-normal truncate mt-0.5" title={slip.to_name}>
                                                            {slip.to_name}
                                                        </div>
                                                    </td>

                                                    {/* 5. Action */}
                                                    <td className="px-4 py-3 text-center">
                                                        <span
                                                            className={cn(
                                                                'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[12px] font-medium border',
                                                                actionBadge.bg
                                                            )}
                                                        >
                                                            <ActionIcon className="h-3.5 w-3.5 shrink-0" />
                                                            {slip.action}
                                                        </span>
                                                    </td>

                                                    {/* 6. Instruction */}
                                                    <td className="px-4 py-3 text-[13px] font-normal text-slate-700">
                                                        <p
                                                            className="line-clamp-2 text-[12px] text-slate-700 font-normal bg-slate-50 p-1.5 rounded border border-slate-100 leading-snug"
                                                            title={slip.instruction}
                                                        >
                                                            {slip.instruction || 'No specific instruction provided.'}
                                                        </p>
                                                    </td>

                                                    {/* 7. Status */}
                                                    <td className="px-4 py-3 text-center">
                                                        <span
                                                            className={cn(
                                                                'inline-block px-2.5 py-0.5 rounded-full text-[12px] font-medium border',
                                                                getStatusBadge(slip.status)
                                                            )}
                                                        >
                                                            {slip.status}
                                                        </span>
                                                    </td>

                                                    {/* 8. Actions: View Routing Slip */}
                                                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                                                        <TableActionButtons
                                                            onEdit={() => setSelectedSlip(slip)}
                                                            editTitle="Edit Record"
                                                            onDelete={() => {
                                                                if (confirm(`Are you sure you want to delete routing slip ${slip.tracking_number}?`)) {
                                                                    router.reload();
                                                                }
                                                            }}
                                                            deleteTitle="Delete Record"
                                                            extraActions={
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setSelectedSlip(slip)}
                                                                    title="View Routing Slip"
                                                                    aria-label="View Routing Slip"
                                                                    className="p-1 text-slate-400 hover:text-[#0066cc] transition-colors rounded hover:bg-slate-100/70 focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 active:scale-95 cursor-pointer"
                                                                >
                                                                    <Eye className="h-[18px] w-[18px]" />
                                                                </button>
                                                            }
                                                        />
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    ) : (
                                        <tr>
                                            <td colSpan={8} className="px-6 py-12 text-center text-[14px]">
                                                <div className="flex flex-col items-center justify-center space-y-2">
                                                    <div className="p-3 rounded-full bg-[var(--tng-slate-100)] text-[var(--tng-slate-400)]">
                                                        <RouteIcon className="h-6 w-6" />
                                                    </div>
                                                    <div className="text-[14px] font-semibold text-[var(--tng-slate-700)]">
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
                )}
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
