import { useState, useMemo } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import TrackngoLayout from '@/layouts/trackngo/TrackngoLayout';
import TablePagination from '@/components/trackngo/TablePagination';
import TabNavigation, { TabItem } from '@/components/trackngo/TabNavigation';
import TableActionButtons from '@/components/trackngo/TableActionButtons';
import { StatCard } from '@/components/trackngo/StatCard';
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
    Inbox,
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
    Eye,
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
    received?: number;
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
    kpis = { total: 0, received: 0, overdue: 0, warnings: 0, resolved: 0 },
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

    // Pagination state (default: 20 per page, expandable to 50, 100)
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);

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

    type CartTab = 'all' | 'escalated' | 'resolved' | 'pending';
    const activeTab: CartTab =
        selectedSeverity === 'all'
            ? 'all'
            : selectedSeverity === 'overdue' || selectedSeverity === 'critical'
            ? 'escalated'
            : selectedSeverity === 'resolved'
            ? 'resolved'
            : 'pending';

    const handleTabChange = (tab: CartTab) => {
        if (tab === 'all') applyFilters({ severity: 'all' });
        else if (tab === 'escalated') applyFilters({ severity: 'overdue' });
        else if (tab === 'resolved') applyFilters({ severity: 'resolved' });
        else if (tab === 'pending') applyFilters({ severity: 'warning' });
    };

    const cartTabs: TabItem<CartTab>[] = [
        { id: 'all', label: 'All Records', icon: <FileText className="h-4 w-4" />, count: kpis.total },
        { id: 'escalated', label: 'Escalated', icon: <ShieldAlert className="h-4 w-4 text-red-600" />, count: kpis.overdue },
        { id: 'resolved', label: 'Resolved', icon: <CheckCircle2 className="h-4 w-4 text-emerald-600" />, count: kpis.resolved },
        { id: 'pending', label: 'Pending', icon: <Clock className="h-4 w-4 text-amber-600" />, count: kpis.warnings },
    ];

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

            <div className="space-y-4 pb-12">
                {/* ── HEADER BANNER ─────────────────────────────────────────── */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between shrink-0 gap-3">
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-[20px] font-bold text-[var(--tng-slate-900)] flex items-center gap-2">
                                <ShieldAlert className="h-6 w-6 text-red-600" />
                                Escalated Docs (Unified ARTA Monitoring)
                            </h1>


                        </div>
                        <p className="mt-0.5 text-xs sm:text-sm text-[var(--tng-slate-500)]">
                            Mandated under ARTA Memorandum Circular No. 2020-07 and Republic Act 11032. Centralized monitoring of active SLA thresholds, overdue delays, and corrective escalations.
                        </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 border border-rose-200">
                            ARTA MC No. 2020-07
                        </span>
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold shadow-2xs">
                            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                            Live Sync
                        </div>
                    </div>
                </div>

                {/* ── CLICKABLE KPI CARDS (Standardized System Blue) ─────────── */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 lg:gap-5 shrink-0">
                    <StatCard
                        title="Total Cases"
                        value={kpis.total}
                        sublabel="All flagged records"
                        icon={FileText}
                        active={selectedSeverity === 'all'}
                        onClick={() => handleKpiClick('all')}
                    />

                    <StatCard
                        title="Received"
                        value={kpis.received ?? 0}
                        sublabel="Logged into CART"
                        icon={Inbox}
                        active={selectedSeverity === 'received'}
                        onClick={() => handleKpiClick('received')}
                    />

                    <StatCard
                        title="Overdue"
                        value={kpis.overdue}
                        sublabel="Exceeded SLA limits"
                        icon={AlertTriangle}
                        active={selectedSeverity === 'overdue'}
                        onClick={() => handleKpiClick('overdue')}
                    />

                    <StatCard
                        title="Warnings"
                        value={kpis.warnings}
                        sublabel="Approaching deadline"
                        icon={Clock}
                        active={selectedSeverity === 'warning'}
                        onClick={() => handleKpiClick('warning')}
                    />

                    <StatCard
                        title="Resolved"
                        value={kpis.resolved}
                        sublabel="Corrective actions completed"
                        icon={CheckCircle2}
                        active={selectedSeverity === 'resolved'}
                        onClick={() => handleKpiClick('resolved')}
                    />
                </div>

                {/* ── Standardized Tabbed Navigation (CART: All, Escalated, Resolved, Pending) ── */}
                <TabNavigation
                    tabs={cartTabs}
                    activeTab={activeTab}
                    onChange={handleTabChange}
                />

                {/* ── FILTERS AT THE TOP ────────────────────────────────────── */}
                <div className="rounded-xl border border-[var(--tng-slate-200)] bg-white p-3.5 shadow-xs space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        {/* Search Input */}
                        <div className="relative flex-1 min-w-[260px]">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--tng-slate-400)]" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => applyFilters({ search: e.target.value })}
                                placeholder="Search by reference number, tracking number, type, or name..."
                                className="h-9 w-full rounded-xl border border-[var(--tng-slate-200)] bg-[var(--tng-slate-50)]/50 pl-10 pr-4 text-xs font-medium text-[var(--tng-slate-700)] placeholder:text-[var(--tng-slate-400)] focus:border-[var(--tng-blue-500)] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[var(--tng-blue-500)] transition-all"
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
                                className="h-9 rounded-xl border border-[var(--tng-slate-200)] bg-white pl-9 pr-8 text-xs font-medium text-[var(--tng-slate-700)] hover:border-[var(--tng-slate-300)] focus:border-[var(--tng-blue-500)] focus:ring-1 focus:ring-[var(--tng-blue-500)] transition-colors cursor-pointer appearance-none shadow-2xs"
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
                                className="h-9 max-w-[210px] rounded-xl border border-[var(--tng-slate-200)] bg-white pl-9 pr-8 text-xs font-medium text-[var(--tng-slate-700)] hover:border-[var(--tng-slate-300)] focus:border-[var(--tng-blue-500)] focus:ring-1 focus:ring-[var(--tng-blue-500)] transition-colors cursor-pointer appearance-none truncate shadow-2xs"
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
                                className="h-9 max-w-[190px] rounded-xl border border-[var(--tng-slate-200)] bg-white pl-9 pr-8 text-xs font-medium text-[var(--tng-slate-700)] hover:border-[var(--tng-slate-300)] focus:border-[var(--tng-blue-500)] focus:ring-1 focus:ring-[var(--tng-blue-500)] transition-colors cursor-pointer appearance-none truncate shadow-2xs"
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
                                className="h-9 rounded-xl border border-[var(--tng-slate-200)] bg-white pl-9 pr-8 text-xs font-medium text-[var(--tng-slate-700)] hover:border-[var(--tng-slate-300)] focus:border-[var(--tng-blue-500)] focus:ring-1 focus:ring-[var(--tng-blue-500)] transition-colors cursor-pointer appearance-none shadow-2xs"
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
                                className="h-9 px-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-600 text-xs font-medium hover:bg-slate-100 transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
                            >
                                <RotateCcw className="h-3.5 w-3.5" />
                                Reset
                            </button>
                        )}
                    </div>
                </div>

                {/* ── STRUCTURED & CLEAN ESCALATED DOCUMENTS TABLE ──────────── */}
                <div className="w-full rounded-xl border border-[var(--tng-slate-200)] bg-white shadow-xs overflow-hidden">
                    <div className="px-5 py-3.5 border-b border-[var(--tng-slate-100)] flex items-center justify-between">
                        <div>
                            <h2 className="text-[18px] md:text-[20px] font-medium text-[#0066cc]">
                                ARTA Escalation Records ({escalations.length})
                            </h2>
                            <p className="text-xs text-[var(--tng-slate-500)] mt-0.5">
                                Consolidated view of specific document escalations, elapsed timelines, controlling offices, and resolution status
                            </p>
                        </div>
                    </div>

                    <div className="overflow-x-auto w-full">
                        <table className="w-full text-left border-collapse text-[13px] text-slate-700">
                            <thead className="bg-[var(--tng-slate-50)] border-b border-[var(--tng-slate-200)]">
                                <tr>
                                    <th className="px-4 py-3 text-left text-[14px] font-normal text-slate-600">Tracking #</th>
                                    <th className="px-4 py-3 text-left text-[14px] font-normal text-slate-600">Document Title</th>
                                    <th className="px-4 py-3 text-left text-[14px] font-normal text-slate-600">Severity</th>
                                    <th className="px-4 py-3 text-left text-[14px] font-normal text-slate-600">Days Elapsed vs SLA</th>
                                    <th className="px-4 py-3 text-left text-[14px] font-normal text-slate-600">Originating Dept</th>
                                    <th className="px-4 py-3 text-left text-[14px] font-normal text-slate-600">Current Holder / Office</th>
                                    <th className="px-4 py-3 text-left text-[14px] font-normal text-slate-600">Notified User</th>
                                    <th className="px-4 py-3 text-left text-[14px] font-normal text-slate-600">Escalated At</th>
                                    <th className="px-4 py-3 text-right text-[14px] font-normal text-slate-600">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--tng-slate-100)]">
                                {paginatedEscalations.length > 0 ? (
                                    paginatedEscalations.map((item) => {
                                        return (
                                            <tr
                                                key={item.id}
                                                className="transition-colors odd:bg-white even:bg-slate-50/75 hover:bg-blue-50/40 group"
                                            >
                                                {/* 1. Tracking # */}
                                                <td className="px-4 py-3 whitespace-nowrap text-[13px] font-normal text-slate-700">
                                                    <Link
                                                        href={`/cart/documents/${item.id}`}
                                                        className="font-mono text-[#0066cc] hover:underline flex items-center gap-1.5 text-[13px] font-normal"
                                                    >
                                                        {item.tracking_number}
                                                        <ExternalLink className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400" />
                                                    </Link>
                                                    <span className="text-[12px] text-slate-400 font-mono block mt-0.5">
                                                        Ref: {item.reference_number}
                                                    </span>
                                                </td>

                                                {/* 2. Document Title */}
                                                <td className="px-4 py-3 max-w-xs text-[13px] font-normal text-slate-700">
                                                    <Link
                                                        href={`/cart/documents/${item.id}`}
                                                        className="text-slate-900 hover:text-[#0066cc] transition-colors line-clamp-1 block text-[13px] font-normal"
                                                    >
                                                        {item.title}
                                                    </Link>
                                                    <span className="text-[12px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded font-normal inline-block mt-1">
                                                        {item.type_name}
                                                    </span>
                                                </td>

                                                {/* 3. Severity (Warning, Critical, Overdue) */}
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    {item.severity === 'Resolved' && (
                                                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[12px] font-medium text-emerald-700 border border-emerald-200">
                                                            <CheckCircle2 className="h-3.5 w-3.5" />
                                                            Resolved
                                                        </span>
                                                    )}
                                                    {item.severity === 'Critical' && (
                                                        <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-0.5 text-[12px] font-semibold text-rose-700 border border-rose-200">
                                                            <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
                                                            Critical
                                                        </span>
                                                    )}
                                                    {item.severity === 'Overdue' && (
                                                        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-0.5 text-[12px] font-semibold text-red-700 border border-red-200">
                                                            <AlertTriangle className="h-3.5 w-3.5" />
                                                            Overdue
                                                        </span>
                                                    )}
                                                    {item.severity === 'Warning' && (
                                                        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-[12px] font-medium text-amber-700 border border-amber-200">
                                                            <Clock className="h-3.5 w-3.5" />
                                                            Warning
                                                        </span>
                                                    )}
                                                </td>

                                                {/* 4. Days Elapsed vs SLA Threshold */}
                                                <td className="px-4 py-3 whitespace-nowrap text-[13px] font-normal text-slate-700">
                                                    <div className="flex items-center gap-1.5">
                                                        <span
                                                            className={`tabular-nums text-[13px] font-normal ${
                                                                item.days_elapsed > item.sla_threshold
                                                                    ? 'text-red-600 font-semibold'
                                                                    : 'text-slate-800'
                                                                }`}
                                                        >
                                                            {item.days_elapsed}
                                                        </span>
                                                        <span className="text-slate-400">/</span>
                                                        <span className="text-slate-600 tabular-nums text-[13px] font-normal">
                                                            {item.sla_threshold}d SLA
                                                        </span>
                                                    </div>
                                                    <div className="mt-0.5">
                                                        {item.variance > 0 ? (
                                                            <span className="text-[12px] font-normal text-red-600">
                                                                +{item.variance}d breach
                                                            </span>
                                                        ) : (
                                                            <span className="text-[12px] font-normal text-emerald-600">
                                                                On-Time ({Math.abs(item.variance)}d left)
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* 5. Originating Department */}
                                                <td className="px-4 py-3 whitespace-nowrap text-[13px] font-normal text-slate-700">
                                                    <div className="flex items-center gap-1.5">
                                                        <Building2 className="h-4 w-4 text-slate-400 shrink-0" />
                                                        <div>
                                                            <p className="font-normal text-slate-800 text-[13px]">
                                                                {item.originating_department}
                                                            </p>
                                                            <span className="text-[12px] text-slate-400 font-mono">
                                                                Code: {item.originating_department_code}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* 6. Current Holder / Office */}
                                                <td className="px-4 py-3 whitespace-nowrap text-[13px] font-normal text-slate-700">
                                                    <div className="space-y-0.5">
                                                        <p className="font-normal text-slate-800 flex items-center gap-1 text-[13px]">
                                                            <User className="h-3.5 w-3.5 text-slate-400" />
                                                            {item.current_holder_user}
                                                        </p>
                                                        <p className="text-[12px] text-slate-500 font-normal">
                                                            {item.current_holder_office}
                                                        </p>
                                                    </div>
                                                </td>

                                                {/* 7. Notified User */}
                                                <td className="px-4 py-3 whitespace-nowrap text-[13px] font-normal text-slate-700">
                                                    <p className="font-normal text-slate-800 text-[13px]">{item.notified_user}</p>
                                                    <p className="text-[12px] text-slate-400 font-normal">
                                                        {item.notified_role}
                                                    </p>
                                                </td>

                                                {/* 8. Escalated At (Date/Time) */}
                                                <td className="px-4 py-3 whitespace-nowrap text-slate-500 font-normal text-[13px]">
                                                    <p className="text-[13px] text-slate-700 font-normal">{item.escalated_at}</p>
                                                    {item.resolved_at && (
                                                        <span className="text-[12px] text-emerald-600 block mt-0.5 font-normal">
                                                            Resolved: {item.resolved_at}
                                                        </span>
                                                    )}
                                                </td>

                                                <td className="px-4 py-3 whitespace-nowrap text-right">
                                                    <TableActionButtons
                                                        onEdit={() => setResolvingItem(item)}
                                                        editTitle="Edit Record"
                                                        onDelete={() => {
                                                            if (confirm(`Are you sure you want to delete escalation case for ${item.tracking_number}?`)) {
                                                                router.reload();
                                                            }
                                                        }}
                                                        deleteTitle="Delete Record"
                                                        extraActions={
                                                            <Link
                                                                href={`/cart/documents/${item.id}`}
                                                                title="Inspect Document"
                                                                aria-label="Inspect Document"
                                                                className="p-1 text-slate-400 hover:text-[#0066cc] transition-colors rounded hover:bg-slate-100/70 focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 active:scale-95 cursor-pointer"
                                                            >
                                                                <Eye className="h-[18px] w-[18px]" />
                                                            </Link>
                                                        }
                                                    />
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
