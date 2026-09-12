import { useState, useMemo } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import TrackngoLayout from '@/layouts/trackngo/TrackngoLayout';
import TablePagination from '@/components/trackngo/TablePagination';
import {
    BaseModal,
    ModalSection,
    ModalField,
    ModalPrimaryButton,
    ModalSecondaryButton,
} from '@/components/trackngo/BaseModal';
import {
    ShieldAlert,
    AlertTriangle,
    Clock,
    CheckCircle2,
    Search,
    ChevronDown,
    Building2,
    FileText,
    ExternalLink,
    X,
    RotateCcw,
    ShieldCheck,
    Check,
    Calendar,
    ArrowUpRight,
    UserCheck,
    User,
} from 'lucide-react';

export interface EscalationItem {
    id: number;
    tracking_number: string;
    reference_number: string;
    title: string;
    department_id: number;
    originating_department: string;
    originating_department_code: string;
    current_holder_office: string;
    current_holder_office_code: string;
    current_holder_user: string;
    current_holder_role: string;
    type_id: number;
    type_name: string;
    severity: 'Overdue' | 'Critical' | 'Warning' | 'Resolved';
    days_elapsed: number;
    sla_threshold: number;
    variance: number;
    notified_user: string;
    notified_role: string;
    escalated_at: string;
    status: string;
    resolved: boolean;
    resolved_at?: string | null;
}

export interface KpiData {
    total: number;
    overdue: number;
    warnings: number;
    resolved: number;
}

export interface DepartmentOption {
    id: number;
    name: string;
    code: string;
}

export interface DocumentTypeOption {
    id: number;
    name: string;
    days: number;
}

export interface UnifiedEscalationsProps {
    escalations?: EscalationItem[];
    kpis?: KpiData;
    departments?: DepartmentOption[];
    documentTypes?: DocumentTypeOption[];
    filters?: {
        severity: string;
        department: string;
        type: string;
        range: string;
        search: string;
    };
    isFullAccess?: boolean;
    userRoleName?: string;
    userDepartment?: string;
}

export default function CartEscalatedDocsIndex({
    escalations = [],
    kpis = { total: 0, overdue: 0, warnings: 0, resolved: 0 },
    departments = [],
    documentTypes = [],
    filters = { severity: 'all', department: 'all', type: 'all', range: 'all', search: '' },
    isFullAccess = true,
    userRoleName = 'CART Officer',
    userDepartment = 'CART Office',
}: UnifiedEscalationsProps) {
    const [selectedSeverity, setSelectedSeverity] = useState(filters.severity || 'all');
    const [selectedDept, setSelectedDept] = useState(filters.department || 'all');
    const [selectedType, setSelectedType] = useState(filters.type || 'all');
    const [selectedRange, setSelectedRange] = useState(filters.range || 'all');
    const [searchQuery, setSearchQuery] = useState(filters.search || '');

    // Pagination state (default: 10 per page, expandable to 20, 50, 100)
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    // Resolve Modal State
    const [resolvingItem, setResolvingItem] = useState<EscalationItem | null>(null);
    const [resolveRemarks, setResolveRemarks] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Sliced records for paginated view
    const paginatedEscalations = useMemo(() => {
        const startIndex = (currentPage - 1) * pageSize;
        return escalations.slice(startIndex, startIndex + pageSize);
    }, [escalations, currentPage, pageSize]);

    // Apply filters
    const applyFilters = (newFilters: {
        severity?: string;
        department?: string;
        type?: string;
        range?: string;
        search?: string;
    }) => {
        const severity = newFilters.severity ?? selectedSeverity;
        const department = newFilters.department ?? selectedDept;
        const type = newFilters.type ?? selectedType;
        const range = newFilters.range ?? selectedRange;
        const search = newFilters.search ?? searchQuery;

        setSelectedSeverity(severity);
        setSelectedDept(department);
        setSelectedType(type);
        setSelectedRange(range);
        setSearchQuery(search);
        setCurrentPage(1);

        router.get(
            window.location.pathname,
            { severity, department, type, range, search },
            { preserveState: true, preserveScroll: true }
        );
    };

    // Quick filter from KPI Card
    const handleKpiClick = (severityTarget: string) => {
        const next = selectedSeverity === severityTarget ? 'all' : severityTarget;
        applyFilters({ severity: next });
    };

    // Reset all filters
    const handleResetFilters = () => {
        setSelectedSeverity('all');
        setSelectedDept('all');
        setSelectedType('all');
        setSelectedRange('all');
        setSearchQuery('');
        router.get(window.location.pathname, {}, { preserveState: true, preserveScroll: true });
    };

    // Handle Resolve submission
    const handleConfirmResolve = () => {
        if (!resolvingItem) return;
        setIsSubmitting(true);

        router.post(
            `/cart/escalations/${resolvingItem.id}/resolve`,
            { remarks: resolveRemarks },
            {
                onSuccess: () => {
                    setResolvingItem(null);
                    setResolveRemarks('');
                    setIsSubmitting(false);
                },
                onError: () => {
                    setIsSubmitting(false);
                },
            }
        );
    };

    return (
        <TrackngoLayout>
            <Head title="Escalated Docs & ARTA Monitoring — TrackNGo Mati" />

            <div className="flex h-[calc(100vh-140px)] flex-col space-y-6 overflow-y-auto tng-scrollbar pb-12 pr-1">
                {/* ── HEADER BANNER ─────────────────────────────────────────── */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between shrink-0 gap-4">
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold text-[var(--tng-slate-900)] flex items-center gap-2">
                                <ShieldAlert className="h-6 w-6 text-red-600" />
                                Escalated Docs (Unified ARTA Monitoring)
                            </h1>

                            {/* Role-based Visibility Badge */}
                            {isFullAccess ? (
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 border border-indigo-200">
                                    <ShieldCheck className="h-3.5 w-3.5" />
                                    System-Wide Live Oversight
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
                                    <UserCheck className="h-3.5 w-3.5" />
                                    Role-Scoped ({userRoleName})
                                </span>
                            )}
                        </div>
                        <p className="mt-1 text-sm text-[var(--tng-slate-500)]">
                            Mandated under ARTA Memorandum Circular No. 2020-07 and Republic Act 11032. Centralized monitoring of active SLA thresholds, overdue delays, and corrective escalations.
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 border border-rose-200">
                            ARTA MC No. 2020-07
                        </span>
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold shadow-2xs">
                            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                            Live Sync
                        </div>
                    </div>
                </div>

                {/* ── CLICKABLE KPI CARDS (4-COLUMN GRID) ──────────────────── */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
                    {/* 1. Total Escalations */}
                    <div
                        onClick={() => handleKpiClick('all')}
                        className={`group cursor-pointer rounded-xl border p-4 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${
                            selectedSeverity === 'all'
                                ? 'border-blue-500 bg-blue-50/90 ring-2 ring-blue-500/20 shadow-xs'
                                : 'border-blue-200 bg-blue-50/50 hover:border-blue-400'
                        }`}
                    >
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-3xl font-bold tabular-nums tracking-tight text-blue-600">
                                    {kpis.total}
                                </p>
                                <p className="mt-0.5 text-sm font-semibold text-blue-700 flex items-center gap-1">
                                    Total Escalations
                                    <ArrowUpRight className="h-3.5 w-3.5 text-blue-500 opacity-70 group-hover:opacity-100" />
                                </p>
                                <p className="mt-0.5 text-xs text-[var(--tng-slate-500)]">
                                    Click to view all records
                                </p>
                            </div>
                            <div className="rounded-lg bg-blue-100 p-2 text-blue-600 group-hover:scale-110 transition-transform">
                                <FileText className="h-5 w-5" />
                            </div>
                        </div>
                    </div>

                    {/* 2. Overdue */}
                    <div
                        onClick={() => handleKpiClick('overdue')}
                        className={`group cursor-pointer rounded-xl border p-4 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${
                            selectedSeverity === 'overdue'
                                ? 'border-red-500 bg-red-50/90 ring-2 ring-red-500/20 shadow-xs'
                                : 'border-red-200 bg-red-50/50 hover:border-red-400'
                        }`}
                    >
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-3xl font-bold tabular-nums tracking-tight text-red-600">
                                    {kpis.overdue}
                                </p>
                                <p className="mt-0.5 text-sm font-semibold text-red-700 flex items-center gap-1">
                                    Overdue
                                    <ArrowUpRight className="h-3.5 w-3.5 text-red-500 opacity-70 group-hover:opacity-100" />
                                </p>
                                <p className="mt-0.5 text-xs text-[var(--tng-slate-500)]">
                                    Exceeded statutory SLA target
                                </p>
                            </div>
                            <div className="rounded-lg bg-red-100 p-2 text-red-600 group-hover:scale-110 transition-transform">
                                <AlertTriangle className="h-5 w-5" />
                            </div>
                        </div>
                    </div>

                    {/* 3. Warnings */}
                    <div
                        onClick={() => handleKpiClick('warning')}
                        className={`group cursor-pointer rounded-xl border p-4 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${
                            selectedSeverity === 'warning'
                                ? 'border-amber-500 bg-amber-50/90 ring-2 ring-amber-500/20 shadow-xs'
                                : 'border-amber-200 bg-amber-50/50 hover:border-amber-400'
                        }`}
                    >
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-3xl font-bold tabular-nums tracking-tight text-amber-600">
                                    {kpis.warnings}
                                </p>
                                <p className="mt-0.5 text-sm font-semibold text-amber-700 flex items-center gap-1">
                                    Warnings
                                    <ArrowUpRight className="h-3.5 w-3.5 text-amber-500 opacity-70 group-hover:opacity-100" />
                                </p>
                                <p className="mt-0.5 text-xs text-[var(--tng-slate-500)]">
                                    Approaching statutory deadline
                                </p>
                            </div>
                            <div className="rounded-lg bg-amber-100 p-2 text-amber-600 group-hover:scale-110 transition-transform">
                                <Clock className="h-5 w-5" />
                            </div>
                        </div>
                    </div>

                    {/* 4. Resolved */}
                    <div
                        onClick={() => handleKpiClick('resolved')}
                        className={`group cursor-pointer rounded-xl border p-4 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${
                            selectedSeverity === 'resolved'
                                ? 'border-emerald-500 bg-emerald-50/90 ring-2 ring-emerald-500/20 shadow-xs'
                                : 'border-emerald-200 bg-emerald-50/50 hover:border-emerald-400'
                        }`}
                    >
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-3xl font-bold tabular-nums tracking-tight text-emerald-600">
                                    {kpis.resolved}
                                </p>
                                <p className="mt-0.5 text-sm font-semibold text-emerald-700 flex items-center gap-1">
                                    Resolved
                                    <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500 opacity-70 group-hover:opacity-100" />
                                </p>
                                <p className="mt-0.5 text-xs text-[var(--tng-slate-500)]">
                                    Corrective actions completed
                                </p>
                            </div>
                            <div className="rounded-lg bg-emerald-100 p-2 text-emerald-600 group-hover:scale-110 transition-transform">
                                <CheckCircle2 className="h-5 w-5" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── FILTERS AT THE TOP ────────────────────────────────────── */}
                <div className="rounded-2xl border border-[var(--tng-slate-200)] bg-white p-4 shadow-xs space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        {/* Search Input */}
                        <div className="relative flex-1 min-w-[260px]">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--tng-slate-400)]" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => applyFilters({ search: e.target.value })}
                                placeholder="Search by tracking #, doc title, originating dept, holder, or user..."
                                className="h-10 w-full rounded-xl border border-[var(--tng-slate-200)] bg-[var(--tng-slate-50)]/50 pl-10 pr-4 text-xs font-medium text-[var(--tng-slate-700)] placeholder:text-[var(--tng-slate-400)] focus:border-[var(--tng-blue-500)] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[var(--tng-blue-500)] transition-all"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => applyFilters({ search: '' })}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                                >
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            )}
                        </div>

                        {/* Severity Dropdown */}
                        <div className="relative inline-flex items-center">
                            <ShieldAlert className="absolute left-3 h-3.5 w-3.5 text-[var(--tng-slate-400)] pointer-events-none" />
                            <select
                                value={selectedSeverity}
                                onChange={(e) => applyFilters({ severity: e.target.value })}
                                className="h-10 rounded-xl border border-[var(--tng-slate-200)] bg-white pl-9 pr-8 text-xs font-medium text-[var(--tng-slate-700)] hover:border-[var(--tng-slate-300)] focus:border-[var(--tng-blue-500)] focus:ring-1 focus:ring-[var(--tng-blue-500)] transition-colors cursor-pointer appearance-none shadow-2xs"
                            >
                                <option value="all">All Severities</option>
                                <option value="overdue">Overdue</option>
                                <option value="critical">Critical</option>
                                <option value="warning">Warning</option>
                                <option value="resolved">Resolved</option>
                            </select>
                            <ChevronDown className="absolute right-2.5 h-3.5 w-3.5 text-[var(--tng-slate-400)] pointer-events-none" />
                        </div>

                        {/* Department Dropdown */}
                        <div className="relative inline-flex items-center">
                            <Building2 className="absolute left-3 h-3.5 w-3.5 text-[var(--tng-slate-400)] pointer-events-none" />
                            <select
                                value={selectedDept}
                                onChange={(e) => applyFilters({ department: e.target.value })}
                                className="h-10 max-w-[210px] rounded-xl border border-[var(--tng-slate-200)] bg-white pl-9 pr-8 text-xs font-medium text-[var(--tng-slate-700)] hover:border-[var(--tng-slate-300)] focus:border-[var(--tng-blue-500)] focus:ring-1 focus:ring-[var(--tng-blue-500)] transition-colors cursor-pointer appearance-none truncate shadow-2xs"
                            >
                                <option value="all">All Departments</option>
                                {departments.map((d) => (
                                    <option key={d.id} value={d.id}>
                                        {d.name}
                                    </option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-2.5 h-3.5 w-3.5 text-[var(--tng-slate-400)] pointer-events-none" />
                        </div>

                        {/* Document Type Dropdown */}
                        <div className="relative inline-flex items-center">
                            <FileText className="absolute left-3 h-3.5 w-3.5 text-[var(--tng-slate-400)] pointer-events-none" />
                            <select
                                value={selectedType}
                                onChange={(e) => applyFilters({ type: e.target.value })}
                                className="h-10 max-w-[190px] rounded-xl border border-[var(--tng-slate-200)] bg-white pl-9 pr-8 text-xs font-medium text-[var(--tng-slate-700)] hover:border-[var(--tng-slate-300)] focus:border-[var(--tng-blue-500)] focus:ring-1 focus:ring-[var(--tng-blue-500)] transition-colors cursor-pointer appearance-none truncate shadow-2xs"
                            >
                                <option value="all">All Types</option>
                                {documentTypes.map((t) => (
                                    <option key={t.id} value={t.id}>
                                        {t.name} ({t.days}d SLA)
                                    </option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-2.5 h-3.5 w-3.5 text-[var(--tng-slate-400)] pointer-events-none" />
                        </div>

                        {/* Date Range Dropdown */}
                        <div className="relative inline-flex items-center">
                            <Calendar className="absolute left-3 h-3.5 w-3.5 text-[var(--tng-slate-400)] pointer-events-none" />
                            <select
                                value={selectedRange}
                                onChange={(e) => applyFilters({ range: e.target.value })}
                                className="h-10 rounded-xl border border-[var(--tng-slate-200)] bg-white pl-9 pr-8 text-xs font-medium text-[var(--tng-slate-700)] hover:border-[var(--tng-slate-300)] focus:border-[var(--tng-blue-500)] focus:ring-1 focus:ring-[var(--tng-blue-500)] transition-colors cursor-pointer appearance-none shadow-2xs"
                            >
                                <option value="all">All Time</option>
                                <option value="today">Today</option>
                                <option value="7days">Past 7 Days</option>
                                <option value="30days">Past 30 Days</option>
                                <option value="this_month">This Month</option>
                            </select>
                            <ChevronDown className="absolute right-2.5 h-3.5 w-3.5 text-[var(--tng-slate-400)] pointer-events-none" />
                        </div>

                        {/* Reset Filters Button */}
                        {(selectedSeverity !== 'all' ||
                            selectedDept !== 'all' ||
                            selectedType !== 'all' ||
                            selectedRange !== 'all' ||
                            searchQuery !== '') && (
                            <button
                                onClick={handleResetFilters}
                                className="h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-600 text-xs font-medium hover:bg-slate-100 transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
                            >
                                <RotateCcw className="h-3.5 w-3.5" />
                                Reset
                            </button>
                        )}
                    </div>
                </div>

                {/* ── STRUCTURED & CLEAN ESCALATED DOCUMENTS TABLE ──────────── */}
                <div className="rounded-2xl border border-[var(--tng-slate-200)] bg-white shadow-xs overflow-hidden">
                    <div className="px-6 py-4 border-b border-[var(--tng-slate-100)] flex items-center justify-between">
                        <div>
                            <h2 className="text-base font-bold text-[var(--tng-slate-900)]">
                                ARTA Escalation Records ({escalations.length})
                            </h2>
                            <p className="text-xs text-[var(--tng-slate-500)] mt-0.5">
                                Consolidated view of specific document escalations, elapsed timelines, controlling offices, and resolution status
                            </p>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs text-[var(--tng-slate-600)]">
                            <thead className="bg-[var(--tng-slate-50)] text-[var(--tng-slate-500)] uppercase tracking-wider font-bold border-b border-[var(--tng-slate-200)] text-[10px]">
                                <tr>
                                    <th className="px-4 py-3.5">Tracking #</th>
                                    <th className="px-4 py-3.5">Document Title</th>
                                    <th className="px-4 py-3.5">Severity</th>
                                    <th className="px-4 py-3.5">Days Elapsed vs SLA</th>
                                    <th className="px-4 py-3.5">Originating Dept</th>
                                    <th className="px-4 py-3.5">Current Holder / Office</th>
                                    <th className="px-4 py-3.5">Notified User</th>
                                    <th className="px-4 py-3.5">Escalated At</th>
                                    <th className="px-4 py-3.5 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--tng-slate-100)]">
                                {paginatedEscalations.length > 0 ? (
                                    paginatedEscalations.map((item) => {
                                        return (
                                            <tr
                                                key={item.id}
                                                className="transition-colors odd:bg-white even:bg-slate-50/70 hover:bg-blue-50/40 group"
                                            >
                                                {/* 1. Tracking # */}
                                                <td className="px-4 py-4 whitespace-nowrap">
                                                    <Link
                                                        href={`/cart/documents/${item.id}`}
                                                        className="font-mono font-bold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1.5"
                                                    >
                                                        {item.tracking_number}
                                                        <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400" />
                                                    </Link>
                                                    <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                                                        Ref: {item.reference_number}
                                                    </span>
                                                </td>

                                                {/* 2. Document Title */}
                                                <td className="px-4 py-4 max-w-xs">
                                                    <Link
                                                        href={`/cart/documents/${item.id}`}
                                                        className="font-semibold text-slate-900 hover:text-blue-600 transition-colors line-clamp-1 block"
                                                    >
                                                        {item.title}
                                                    </Link>
                                                    <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded font-medium inline-block mt-1">
                                                        {item.type_name}
                                                    </span>
                                                </td>

                                                {/* 3. Severity (Warning, Critical, Overdue) */}
                                                <td className="px-4 py-4 whitespace-nowrap">
                                                    {item.severity === 'Resolved' && (
                                                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
                                                            <CheckCircle2 className="h-3.5 w-3.5" />
                                                            Resolved
                                                        </span>
                                                    )}
                                                    {item.severity === 'Critical' && (
                                                        <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 border border-rose-200">
                                                            <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
                                                            Critical
                                                        </span>
                                                    )}
                                                    {item.severity === 'Overdue' && (
                                                        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 border border-red-200">
                                                            <AlertTriangle className="h-3.5 w-3.5" />
                                                            Overdue
                                                        </span>
                                                    )}
                                                    {item.severity === 'Warning' && (
                                                        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 border border-amber-200">
                                                            <Clock className="h-3.5 w-3.5" />
                                                            Warning
                                                        </span>
                                                    )}
                                                </td>

                                                {/* 4. Days Elapsed vs SLA Threshold */}
                                                <td className="px-4 py-4 whitespace-nowrap">
                                                    <div className="flex items-center gap-1.5">
                                                        <span
                                                            className={`font-bold tabular-nums text-sm ${
                                                                item.days_elapsed > item.sla_threshold
                                                                    ? 'text-red-600'
                                                                    : 'text-slate-800'
                                                            }`}
                                                        >
                                                            {item.days_elapsed}
                                                        </span>
                                                        <span className="text-slate-400 font-medium">/</span>
                                                        <span className="text-slate-600 font-semibold tabular-nums text-xs">
                                                            {item.sla_threshold}d SLA
                                                        </span>
                                                    </div>
                                                    <div className="mt-0.5">
                                                        {item.variance > 0 ? (
                                                            <span className="text-[10px] font-semibold text-red-600">
                                                                +{item.variance}d breach
                                                            </span>
                                                        ) : (
                                                            <span className="text-[10px] font-semibold text-emerald-600">
                                                                On-Time ({Math.abs(item.variance)}d left)
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* 5. Originating Department */}
                                                <td className="px-4 py-4 whitespace-nowrap">
                                                    <div className="flex items-center gap-1.5">
                                                        <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                                        <div>
                                                            <p className="font-semibold text-slate-800">
                                                                {item.originating_department}
                                                            </p>
                                                            <span className="text-[10px] text-slate-400 font-mono">
                                                                Code: {item.originating_department_code}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* 6. Current Holder / Office */}
                                                <td className="px-4 py-4 whitespace-nowrap">
                                                    <div className="space-y-0.5">
                                                        <p className="font-semibold text-slate-800 flex items-center gap-1">
                                                            <User className="h-3 w-3 text-slate-400" />
                                                            {item.current_holder_user}
                                                        </p>
                                                        <p className="text-[10px] text-slate-500 font-medium">
                                                            {item.current_holder_office}
                                                        </p>
                                                    </div>
                                                </td>

                                                {/* 7. Notified User */}
                                                <td className="px-4 py-4 whitespace-nowrap">
                                                    <p className="font-semibold text-slate-800">{item.notified_user}</p>
                                                    <p className="text-[10px] text-slate-400 font-medium">
                                                        {item.notified_role}
                                                    </p>
                                                </td>

                                                {/* 8. Escalated At (Date/Time) */}
                                                <td className="px-4 py-4 whitespace-nowrap text-slate-500 font-medium">
                                                    <p className="text-xs text-slate-700">{item.escalated_at}</p>
                                                    {item.resolved_at && (
                                                        <span className="text-[10px] text-emerald-600 block mt-0.5 font-medium">
                                                            Resolved: {item.resolved_at}
                                                        </span>
                                                    )}
                                                </td>

                                                {/* 9. Action (Resolve button) */}
                                                <td className="px-4 py-4 whitespace-nowrap text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <Link
                                                            href={`/cart/documents/${item.id}`}
                                                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-2xs"
                                                        >
                                                            Inspect
                                                        </Link>

                                                        {item.resolved ? (
                                                            <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 border border-emerald-200">
                                                                <Check className="h-3.5 w-3.5" />
                                                                Resolved
                                                            </span>
                                                        ) : (
                                                            <button
                                                                onClick={() => setResolvingItem(item)}
                                                                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1 text-xs font-bold text-white hover:bg-blue-700 transition-colors shadow-2xs cursor-pointer"
                                                            >
                                                                <CheckCircle2 className="h-3.5 w-3.5" />
                                                                Resolve
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan={9} className="px-6 py-12 text-center text-slate-400">
                                            <div className="flex flex-col items-center justify-center gap-2">
                                                <ShieldCheck className="h-8 w-8 text-slate-300" />
                                                <p className="text-sm font-semibold text-slate-600">
                                                    No ARTA escalations found
                                                </p>
                                                <p className="text-xs text-slate-400">
                                                    No transactions match your current search and severity filter parameters.
                                                </p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination Controls at Bottom */}
                    <TablePagination
                        currentPage={currentPage}
                        pageSize={pageSize}
                        totalItems={escalations.length}
                        onPageChange={setCurrentPage}
                        onPageSizeChange={setPageSize}
                        itemLabel="ARTA escalations"
                    />
                </div>

                {/* ── RESOLUTION MODAL (Standardized) ──────────────────────── */}
                {resolvingItem && (
                    <BaseModal
                        isOpen={Boolean(resolvingItem)}
                        onClose={() => setResolvingItem(null)}
                        title="Resolve ARTA Escalation"
                        identifier={resolvingItem.tracking_number}
                        description="Document corrective actions taken pursuant to ARTA Memorandum Circular No. 2020-07."
                        icon={<CheckCircle2 className="h-5 w-5" />}
                        iconContainerClassName="bg-emerald-100 text-emerald-700"
                        maxWidth="max-w-lg"
                        footer={
                            <>
                                <ModalSecondaryButton
                                    onClick={() => setResolvingItem(null)}
                                    disabled={isSubmitting}
                                >
                                    Cancel
                                </ModalSecondaryButton>
                                <ModalPrimaryButton
                                    onClick={handleConfirmResolve}
                                    isLoading={isSubmitting}
                                    loadingText="Resolving..."
                                    className="bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20"
                                >
                                    <Check className="h-4 w-4" />
                                    Confirm Resolution
                                </ModalPrimaryButton>
                            </>
                        }
                    >
                        <div className="space-y-5">
                            {/* Section 1: Escalation & Document Status */}
                            <ModalSection title="Document & Escalation Status">
                                <div className="space-y-3 rounded-xl bg-slate-50 p-4 border border-slate-200 text-xs">
                                    <div>
                                        <span className="font-semibold text-slate-500">Document Title:</span>
                                        <p className="font-bold text-slate-900 text-sm mt-0.5">
                                            {resolvingItem.title}
                                        </p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200/80">
                                        <div>
                                            <span className="font-semibold text-slate-500">Originating Dept:</span>
                                            <p className="font-semibold text-slate-800 mt-0.5">
                                                {resolvingItem.originating_department} ({resolvingItem.originating_department_code})
                                            </p>
                                        </div>
                                        <div>
                                            <span className="font-semibold text-slate-500">Current Holder:</span>
                                            <p className="font-semibold text-slate-800 mt-0.5">
                                                {resolvingItem.current_holder_user} ({resolvingItem.current_holder_office})
                                            </p>
                                        </div>
                                    </div>
                                    <div className="pt-2 border-t border-slate-200/80">
                                        <span className="font-semibold text-slate-500">Days Elapsed vs SLA Target:</span>
                                        <p className="font-semibold text-red-600 mt-0.5">
                                            {resolvingItem.days_elapsed} days elapsed (Statutory SLA target: {resolvingItem.sla_threshold} days)
                                        </p>
                                    </div>
                                </div>
                            </ModalSection>

                            {/* Section 2: Corrective Actions & Resolution */}
                            <ModalSection title="Resolution Remarks & Corrective Actions">
                                <ModalField
                                    label="Corrective Actions Taken"
                                    required
                                    description="Detail the interventions implemented to expedite this transaction."
                                >
                                    <textarea
                                        rows={3}
                                        value={resolveRemarks}
                                        onChange={(e) => setResolveRemarks(e.target.value)}
                                        placeholder="e.g., CART intervened with the controlling office; transaction expedited and routed for immediate signature."
                                        className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                                    />
                                </ModalField>
                            </ModalSection>
                        </div>
                    </BaseModal>
                )}
            </div>
        </TrackngoLayout>
    );
}
