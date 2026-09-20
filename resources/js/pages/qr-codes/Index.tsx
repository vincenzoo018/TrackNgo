import { Head, Link, router } from '@inertiajs/react';
import {
    QrCode,
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
    RotateCcw,
    Printer,
    Eye,
    ChevronLeft,
    ChevronRight,
    Building2,
    X,
    LayoutGrid,
    List,
    Route,
    Copy,
    Check,
} from 'lucide-react';
import { useState, useMemo } from 'react';
import TrackngoLayout from '@/layouts/trackngo/TrackngoLayout';
import { cn } from '@/lib/utils';
import { StatCard } from '@/components/trackngo/StatCard';
import TabNavigation, { TabItem } from '@/components/trackngo/TabNavigation';
import { QrDetailModal, type QrCodeItem } from '@/components/trackngo/QrDetailModal';
import { RoutingSlipModal, type RoutingSlipModalData } from '@/components/trackngo/RoutingSlipModal';

type DepartmentOption = {
    department_id: number;
    department_name: string;
    code?: string;
};

type DocumentTypeOption = {
    type_id: number;
    type_name: string;
};

type Props = {
    qrCodes?: QrCodeItem[];
    departments?: DepartmentOption[];
    documentTypes?: DocumentTypeOption[];
    isFullAccess?: boolean;
    currentRole?: string;
    userRoleName?: string;
    userName?: string;
};

export default function QrCodesIndex({
    qrCodes = [],
    departments = [],
    documentTypes = [],
    isFullAccess = false,
    currentRole = 'receiving',
    userRoleName = 'Staff',
    userName = 'User',
}: Props) {
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [typeFilter, setTypeFilter] = useState('all');
    const [deptFilter, setDeptFilter] = useState('all');
    const [dateRangeFilter, setDateRangeFilter] = useState<'all' | 'today' | '7days' | '30days'>('all');
    const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Modals
    const [selectedQr, setSelectedQr] = useState<QrCodeItem | null>(null);
    const [selectedSlip, setSelectedSlip] = useState<RoutingSlipModalData | null>(null);

    // KPI Metrics calculation
    const metrics = useMemo(() => {
        let activeCount = 0;
        let completedCount = 0;
        let archivedCount = 0;

        qrCodes.forEach((qr) => {
            const s = (qr.status || '').toLowerCase();
            if (s === 'active') activeCount++;
            else if (s === 'completed') completedCount++;
            else if (s === 'archived') archivedCount++;
        });

        return {
            total: qrCodes.length,
            active: activeCount,
            completed: completedCount,
            archived: archivedCount,
        };
    }, [qrCodes]);

    // Filtering logic
    const filteredQrCodes = useMemo(() => {
        return qrCodes.filter((qr) => {
            // Search query filter
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const matchQrId = (qr.qr_id || '').toLowerCase().includes(q);
                const matchRef = (qr.document_ref || '').toLowerCase().includes(q);
                const matchSlip = (qr.routing_slip_id || '').toLowerCase().includes(q);
                const matchTitle = (qr.document_title || '').toLowerCase().includes(q);
                const matchDept = (qr.department || '').toLowerCase().includes(q);
                const matchType = (qr.document_type || '').toLowerCase().includes(q);

                if (!matchQrId && !matchRef && !matchSlip && !matchTitle && !matchDept && !matchType) {
                    return false;
                }
            }

            // Status filter: Active, Completed, Archived
            if (statusFilter !== 'all' && qr.status.toLowerCase() !== statusFilter.toLowerCase()) {
                return false;
            }

            // Document type filter
            if (typeFilter !== 'all' && (qr.document_type || '').toLowerCase() !== typeFilter.toLowerCase()) {
                return false;
            }

            // Department filter
            if (deptFilter !== 'all' && (qr.department || '').toLowerCase() !== deptFilter.toLowerCase()) {
                return false;
            }

            // Date range filter
            if (dateRangeFilter !== 'all' && qr.date_iso) {
                const qrTime = new Date(qr.date_iso).getTime();
                const now = Date.now();
                const diffHours = (now - qrTime) / (1000 * 60 * 60);

                if (dateRangeFilter === 'today' && diffHours > 24) return false;
                if (dateRangeFilter === '7days' && diffHours > 24 * 7) return false;
                if (dateRangeFilter === '30days' && diffHours > 24 * 30) return false;
            }

            return true;
        });
    }, [qrCodes, searchQuery, statusFilter, typeFilter, deptFilter, dateRangeFilter]);

    // Pagination
    const totalPages = Math.ceil(filteredQrCodes.length / pageSize) || 1;
    const paginatedQrCodes = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredQrCodes.slice(start, start + pageSize);
    }, [filteredQrCodes, currentPage, pageSize]);

    const handleRefresh = () => {
        setIsRefreshing(true);
        router.reload({
            onFinish: () => setIsRefreshing(false),
        });
    };

    // Quick download individual QR Code
    const handleDownloadSingleQr = (qr: QrCodeItem) => {
        const link = document.createElement('a');
        link.href = qr.qr_image_url;
        link.target = '_blank';
        link.download = `${qr.qr_id}_${qr.document_ref}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Export CSV
    const handleExportCsv = () => {
        if (filteredQrCodes.length === 0) return;

        const headers = [
            'QR Code ID',
            'Document Reference',
            'Document Title',
            'Document Type',
            'Routing Slip ID',
            'Department',
            'Status',
            'Date Generated',
            'Payload',
        ];

        const rows = filteredQrCodes.map((qr) => [
            `"${qr.qr_id}"`,
            `"${qr.document_ref}"`,
            `"${(qr.document_title || '').replace(/"/g, '""')}"`,
            `"${(qr.document_type || '').replace(/"/g, '""')}"`,
            `"${qr.routing_slip_id}"`,
            `"${(qr.department || '').replace(/"/g, '""')}"`,
            `"${qr.status}"`,
            `"${qr.date_generated}"`,
            `"${(qr.qr_data || '').replace(/"/g, '""')}"`,
        ]);

        const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `trackngo_qr_codes_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Status Badge Helper
    const getStatusBadge = (status: string) => {
        const s = (status || '').toLowerCase();
        if (s === 'completed') {
            return 'bg-indigo-50 text-indigo-700 border-indigo-200';
        }
        if (s === 'archived') {
            return 'bg-purple-50 text-purple-700 border-purple-200';
        }
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    };

    return (
        <TrackngoLayout>
            <Head title="QR Codes" />

            <div className="space-y-6 pb-12">
                {/* ── Header ────────────────────────────────────────────────── */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-[var(--tng-slate-200)] pb-5">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-sm">
                            <QrCode className="h-6 w-6" />
                        </div>
                        <div>
                            <h1 className="text-[20px] font-bold tracking-tight text-[var(--tng-slate-900)]">
                                QR Codes Module
                            </h1>
                            <p className="text-sm text-[var(--tng-slate-500)] mt-0.5">
                                Unique machine-readable tokens linking documents, routing slips, and transit verifications
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2.5 flex-wrap">
                        {/* View Switcher Toggle */}
                        <div className="inline-flex items-center p-1 bg-[var(--tng-slate-100)] rounded-lg border border-[var(--tng-slate-200)]">
                            <button
                                type="button"
                                onClick={() => setViewMode('table')}
                                className={cn(
                                    'flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold transition-all',
                                    viewMode === 'table'
                                        ? 'bg-white text-[var(--tng-blue-600)] shadow-xs'
                                        : 'text-[var(--tng-slate-600)] hover:text-[var(--tng-slate-900)]'
                                )}
                            >
                                <List className="h-3.5 w-3.5" />
                                <span>Table View</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewMode('grid')}
                                className={cn(
                                    'flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold transition-all',
                                    viewMode === 'grid'
                                        ? 'bg-white text-[var(--tng-blue-600)] shadow-xs'
                                        : 'text-[var(--tng-slate-600)] hover:text-[var(--tng-slate-900)]'
                                )}
                            >
                                <LayoutGrid className="h-3.5 w-3.5" />
                                <span>Grid View</span>
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
                            disabled={filteredQrCodes.length === 0}
                            className="inline-flex items-center gap-2 px-4 py-2 text-[14px] font-medium text-white bg-[#0066cc] hover:bg-[#005bb5] rounded-lg transition-all shadow-xs hover:shadow-sm disabled:opacity-50"
                        >
                            <Download className="h-4 w-4 text-white shrink-0" />
                            Export CSV ({filteredQrCodes.length})
                        </button>
                    </div>
                </div>


                {/* ── KPI Metric Cards (Standardized System Blue) ─────────────── */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
                    <StatCard
                        title="Total QR Codes"
                        value={metrics.total}
                        sublabel="All recorded QR codes"
                        icon={QrCode}
                        active={statusFilter === 'all'}
                        onClick={() => {
                            setStatusFilter('all');
                            setCurrentPage(1);
                        }}
                    />

                    <StatCard
                        title="Active QR Codes"
                        value={metrics.active}
                        sublabel="Currently in transit"
                        icon={Clock}
                        active={statusFilter === 'active'}
                        onClick={() => {
                            setStatusFilter('active');
                            setCurrentPage(1);
                        }}
                    />

                    <StatCard
                        title="Completed"
                        value={metrics.completed}
                        sublabel="Finalized & archived"
                        icon={CheckCircle2}
                        active={statusFilter === 'completed'}
                        onClick={() => {
                            setStatusFilter('completed');
                            setCurrentPage(1);
                        }}
                    />

                    <StatCard
                        title="Archived"
                        value={metrics.archived}
                        sublabel="Repository records"
                        icon={ShieldCheck}
                        active={statusFilter === 'archived'}
                        onClick={() => {
                            setStatusFilter('archived');
                            setCurrentPage(1);
                        }}
                    />
                </div>

                {/* ── Tabbed Navigation ─────────────────────────────────────── */}
                <TabNavigation
                    tabs={[
                        { id: 'all', label: 'All QR Codes', count: metrics.total },
                        { id: 'active', label: 'Active', count: metrics.active },
                        { id: 'completed', label: 'Completed', count: metrics.completed },
                        { id: 'archived', label: 'Archived', count: metrics.archived },
                    ]}
                    activeTab={statusFilter}
                    onChange={(tabId) => {
                        setStatusFilter(tabId);
                        setCurrentPage(1);
                    }}
                />

                {/* ── Filters Toolbar ───────────────────────────────────────── */}
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
                                placeholder="Search by reference number, tracking number, type, or name..."
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

                        {/* Dropdown Filters */}
                        <div className="flex items-center gap-2 flex-wrap">
                            {/* Status Filter: Active, Completed, Archived */}
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
                                    <option value="archived">Archived</option>
                                </select>
                            </div>

                            {/* Document Type Filter */}
                            <select
                                value={typeFilter}
                                onChange={(e) => {
                                    setTypeFilter(e.target.value);
                                    setCurrentPage(1);
                                }}
                                className="bg-white border border-[var(--tng-slate-200)] rounded-lg text-xs font-medium text-[var(--tng-slate-700)] py-2 px-3 focus:border-[var(--tng-blue-600)] focus:ring-1 focus:ring-[var(--tng-blue-600)] outline-none max-w-[170px] truncate"
                            >
                                <option value="all">All Document Types</option>
                                {documentTypes.map((dt) => (
                                    <option key={dt.type_id} value={dt.type_name}>
                                        {dt.type_name}
                                    </option>
                                ))}
                            </select>

                            {/* Department Filter */}
                            <select
                                value={deptFilter}
                                onChange={(e) => {
                                    setDeptFilter(e.target.value);
                                    setCurrentPage(1);
                                }}
                                className="bg-white border border-[var(--tng-slate-200)] rounded-lg text-xs font-medium text-[var(--tng-slate-700)] py-2 px-3 focus:border-[var(--tng-blue-600)] focus:ring-1 focus:ring-[var(--tng-blue-600)] outline-none max-w-[190px] truncate"
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

                    {/* Active Filter Summary Strip */}
                    {(searchQuery || statusFilter !== 'all' || typeFilter !== 'all' || deptFilter !== 'all' || dateRangeFilter !== 'all') && (
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
                            {typeFilter !== 'all' && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded bg-[var(--tng-slate-100)] text-[var(--tng-slate-700)]">
                                    Type: {typeFilter}
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
                                    setTypeFilter('all');
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

                {/* ── View Presentation: Table vs Grid ────────────────────────── */}
                {viewMode === 'table' ? (
                    <div className="w-full bg-white rounded-xl border border-[var(--tng-slate-200)] shadow-xs overflow-hidden">
                        <div className="overflow-x-auto w-full">
                            <table className="w-full text-left border-collapse text-[13px] text-slate-700">
                                <thead className="bg-[var(--tng-slate-50)] border-b border-[var(--tng-slate-200)]">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-[14px] font-normal text-slate-600">QR Code ID</th>
                                        <th className="px-4 py-3 text-left text-[14px] font-normal text-slate-600">Document Reference</th>
                                        <th className="px-4 py-3 text-left text-[14px] font-normal text-slate-600">Routing Slip ID</th>
                                        <th className="px-4 py-3 text-left text-[14px] font-normal text-slate-600">Department</th>
                                        <th className="px-4 py-3 text-left text-[14px] font-normal text-slate-600">Type</th>
                                        <th className="px-4 py-3 text-center text-[14px] font-normal text-slate-600">Status</th>
                                        <th className="px-4 py-3 text-left text-[14px] font-normal text-slate-600">Date Generated</th>
                                        <th className="px-4 py-3 text-right text-[14px] font-normal text-slate-600">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--tng-slate-100)]">
                                    {paginatedQrCodes.length > 0 ? (
                                        paginatedQrCodes.map((qr) => (
                                            <tr
                                                key={qr.qr_id}
                                                className="transition-colors odd:bg-white even:bg-slate-50/75 hover:bg-blue-50/40 group"
                                            >
                                                {/* 1. QR Code ID with visual thumbnail */}
                                                <td className="px-4 py-3 text-[13px] font-normal text-slate-700">
                                                    <div className="flex items-center gap-2.5">
                                                        <img
                                                            src={qr.qr_image_url}
                                                            alt={qr.qr_id}
                                                            onClick={() => setSelectedQr(qr)}
                                                            className="w-8 h-8 rounded border border-slate-200 bg-white p-0.5 cursor-pointer hover:scale-110 transition-transform shrink-0"
                                                            title="Click to inspect QR code"
                                                        />
                                                        <div className="min-w-0">
                                                            <div className="font-mono text-[13px] font-normal text-slate-900 truncate">
                                                                {qr.qr_id}
                                                            </div>
                                                            <span className="text-[12px] text-slate-400 font-sans font-normal block">
                                                                {qr.stop_number}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* 2. Document Reference & Title */}
                                                <td className="px-4 py-3 text-[13px] font-normal text-slate-700">
                                                    <Link
                                                        href={`/${currentRole}/documents/${qr.document_id}`}
                                                        className="group block"
                                                        title={`${qr.document_ref} - ${qr.document_title}`}
                                                    >
                                                        <span className="font-mono font-normal text-[13px] text-[#0066cc] group-hover:underline flex items-center gap-1">
                                                            {qr.document_ref}
                                                            <ExternalLink className="h-3.5 w-3.5 opacity-60 shrink-0" />
                                                        </span>
                                                        <span className="text-[12px] text-slate-500 font-normal truncate block mt-0.5">
                                                            {qr.document_title}
                                                        </span>
                                                    </Link>
                                                </td>

                                                {/* 3. Routing Slip ID */}
                                                <td className="px-4 py-3 text-[13px] font-normal text-slate-700">
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedSlip({
                                                            slip_id: qr.numeric_slip_id,
                                                            tracking_number: qr.routing_slip_id,
                                                            document_id: qr.document_id,
                                                            document_ref: qr.document_ref,
                                                            document_title: qr.document_title,
                                                            from_name: qr.from_name,
                                                            from_department: qr.department,
                                                            to_name: qr.to_name,
                                                            to_department: qr.to_department,
                                                            action: qr.action,
                                                            instruction: qr.instruction,
                                                            status: qr.status,
                                                            formatted_date: qr.formatted_date,
                                                            stop_number: qr.stop_number,
                                                            qr_data: qr.qr_data,
                                                        })}
                                                        className="font-mono text-[12px] font-normal text-[#0066cc] bg-blue-50 px-2 py-0.5 rounded border border-blue-200 hover:bg-blue-100 transition-colors inline-flex items-center gap-1 truncate max-w-full"
                                                        title="View linked official routing slip"
                                                    >
                                                        <Route className="h-3.5 w-3.5 shrink-0" />
                                                        <span>{qr.routing_slip_id}</span>
                                                    </button>
                                                </td>

                                                {/* 4. Department */}
                                                <td className="px-4 py-3 text-[13px] font-normal text-slate-700">
                                                    <div className="font-normal text-[13px] text-slate-900 truncate" title={qr.department}>
                                                        {qr.department}
                                                    </div>
                                                    <div className="text-[12px] text-slate-400 font-normal truncate mt-0.5">
                                                        Office Code: {qr.department_code}
                                                    </div>
                                                </td>

                                                {/* 5. Document Type */}
                                                <td className="px-4 py-3 text-[13px] font-normal text-slate-700">
                                                    <span className="text-[12px] text-slate-700 font-normal bg-slate-50 px-2 py-0.5 rounded border border-slate-200 truncate block" title={qr.document_type}>
                                                        {qr.document_type}
                                                    </span>
                                                </td>

                                                {/* 6. Status */}
                                                <td className="px-4 py-3 text-center">
                                                    <span
                                                        className={cn(
                                                            'inline-block px-2.5 py-0.5 rounded-full text-[12px] font-medium border',
                                                            getStatusBadge(qr.status)
                                                        )}
                                                    >
                                                        {qr.status}
                                                    </span>
                                                </td>

                                                {/* 7. Date Generated */}
                                                <td className="px-4 py-3 text-[13px] font-normal text-slate-700">
                                                    <div className="text-[13px] text-slate-800 font-normal">
                                                        {qr.formatted_date}
                                                    </div>
                                                    <div className="text-[12px] text-slate-400 font-normal">
                                                        {qr.date_generated.slice(-8)}
                                                    </div>
                                                </td>

                                                {/* 8. Actions: View Modal & Download (Icons only) */}
                                                <td className="px-4 py-3 text-right whitespace-nowrap">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => setSelectedQr(qr)}
                                                            className="rounded-lg p-2 text-[var(--tng-slate-400)] transition-all hover:bg-blue-50 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400/50"
                                                            title="Inspect full QR code details and traceability"
                                                            aria-label="Inspect full QR code"
                                                        >
                                                            <Eye className="h-[18px] w-[18px]" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDownloadSingleQr(qr)}
                                                            className="rounded-lg p-2 text-[var(--tng-slate-400)] transition-all hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400/50"
                                                            title="Download high-resolution QR PNG"
                                                            aria-label="Download QR"
                                                        >
                                                            <Download className="h-[18px] w-[18px]" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={8} className="px-6 py-12 text-center text-[14px]">
                                                <div className="flex flex-col items-center justify-center space-y-2">
                                                    <div className="p-3 rounded-full bg-[var(--tng-slate-100)] text-[var(--tng-slate-400)]">
                                                        <QrCode className="h-6 w-6" />
                                                    </div>
                                                    <div className="text-[14px] font-semibold text-[var(--tng-slate-700)]">
                                                        No QR codes found
                                                    </div>
                                                <p className="text-xs text-[var(--tng-slate-400)] max-w-sm">
                                                    {searchQuery || statusFilter !== 'all' || typeFilter !== 'all' || deptFilter !== 'all'
                                                        ? 'Try clearing your filters or search query to view all available QR codes.'
                                                        : 'No QR codes have been recorded for your current role scope.'}
                                                </p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                /* ── Grid View ─────────────────────────────────────────── */
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {paginatedQrCodes.length > 0 ? (
                            paginatedQrCodes.map((qr) => (
                                <div
                                    key={qr.qr_id}
                                    className="bg-white rounded-2xl border border-[var(--tng-slate-200)] p-4 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
                                >
                                    <div>
                                        {/* Card Top Strip */}
                                        <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
                                            <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                                {qr.qr_id}
                                            </span>
                                            <span
                                                className={cn(
                                                    'px-2 py-0.5 rounded-full text-[11px] font-semibold border',
                                                    getStatusBadge(qr.status)
                                                )}
                                            >
                                                {qr.status}
                                            </span>
                                        </div>

                                        {/* Visual QR Image */}
                                        <div
                                            onClick={() => setSelectedQr(qr)}
                                            className="my-4 flex flex-col items-center justify-center cursor-pointer p-3 bg-slate-50/70 group-hover:bg-blue-50/40 rounded-xl border border-dashed border-slate-200 group-hover:border-blue-300 transition-colors"
                                        >
                                            <img
                                                src={qr.qr_image_url}
                                                alt={qr.qr_id}
                                                className="w-32 h-32 object-contain mix-blend-multiply group-hover:scale-105 transition-transform"
                                            />
                                            <span className="text-[10px] text-slate-400 font-mono mt-1.5">
                                                Click to enlarge & inspect
                                            </span>
                                        </div>

                                        {/* Document Reference & Title */}
                                        <div className="space-y-1">
                                            <Link
                                                href={`/${currentRole}/documents/${qr.document_id}`}
                                                className="font-mono text-xs font-bold text-[var(--tng-blue-600)] hover:underline flex items-center gap-1 truncate"
                                            >
                                                <span>{qr.document_ref}</span>
                                                <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
                                            </Link>
                                            <h4 className="text-xs font-semibold text-slate-900 line-clamp-2 leading-snug" title={qr.document_title}>
                                                {qr.document_title}
                                            </h4>
                                        </div>

                                        {/* Metadata Attributes */}
                                        <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5 text-[11px] text-slate-500">
                                            <div className="flex items-center justify-between">
                                                <span>Routing Slip:</span>
                                                <span className="font-mono font-bold text-slate-800">
                                                    {qr.routing_slip_id}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span>Department:</span>
                                                <span className="font-medium text-slate-800 truncate max-w-[130px]" title={qr.department}>
                                                    {qr.department}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span>Date:</span>
                                                <span className="text-slate-700">
                                                    {qr.formatted_date}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Card Footer Actions */}
                                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setSelectedQr(qr)}
                                            className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-white bg-[#0066cc] hover:bg-[#005bb5] rounded-lg transition-colors shadow-2xs"
                                        >
                                            <Eye className="h-3.5 w-3.5" />
                                            <span>Inspect</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleDownloadSingleQr(qr)}
                                            className="p-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors shadow-2xs"
                                            title="Download QR code PNG"
                                        >
                                            <Download className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="col-span-full py-12 text-center bg-white rounded-2xl border border-slate-200">
                                <div className="p-3 rounded-full bg-slate-100 text-slate-400 inline-block mb-2">
                                    <QrCode className="h-6 w-6" />
                                </div>
                                <div className="text-sm font-semibold text-slate-700">
                                    No QR codes found
                                </div>
                                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                                    Try clearing your search query or adjusting your filters.
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {/* ── Pagination Footer ─────────────────────────────────────── */}
                <div className="px-4 py-3 bg-[var(--tng-slate-50)] rounded-xl border border-[var(--tng-slate-200)] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[var(--tng-slate-500)]">
                    <div>
                        Showing{' '}
                        <span className="font-semibold text-[var(--tng-slate-900)]">
                            {filteredQrCodes.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
                        </span>{' '}
                        to{' '}
                        <span className="font-semibold text-[var(--tng-slate-900)]">
                            {Math.min(currentPage * pageSize, filteredQrCodes.length)}
                        </span>{' '}
                        of{' '}
                        <span className="font-semibold text-[var(--tng-slate-900)]">
                            {filteredQrCodes.length}
                        </span>{' '}
                        QR codes
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[var(--tng-slate-300)] bg-white text-xs font-medium text-[var(--tng-slate-700)] hover:bg-[var(--tng-slate-50)] disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
                        >
                            <ChevronLeft className="h-3.5 w-3.5" />
                            Previous
                        </button>

                        <span className="px-2 text-xs font-medium text-[var(--tng-slate-600)]">
                            Page {currentPage} of {totalPages}
                        </span>

                        <button
                            type="button"
                            disabled={currentPage >= totalPages}
                            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[var(--tng-slate-300)] bg-white text-xs font-medium text-[var(--tng-slate-700)] hover:bg-[var(--tng-slate-50)] disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
                        >
                            Next
                            <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                    </div>
                </div>
            </div>

            {/* ── QR Detail & Verification Modal ───────────────────────────── */}
            <QrDetailModal
                isOpen={!!selectedQr}
                onClose={() => setSelectedQr(null)}
                qrItem={selectedQr}
                currentRole={currentRole}
            />

            {/* ── Official Routing Slip Modal ──────────────────────────────── */}
            <RoutingSlipModal
                isOpen={!!selectedSlip}
                onClose={() => setSelectedSlip(null)}
                slip={selectedSlip}
                currentRole={currentRole}
            />
        </TrackngoLayout>
    );
}
