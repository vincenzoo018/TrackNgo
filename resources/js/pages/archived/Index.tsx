import { Head, Link, usePage } from '@inertiajs/react';
import {
    Archive,
    Search,
    Download,
    Eye,
    QrCode,
    FileText,
    CheckCircle2,
    Clock,
    ShieldCheck,
    ArrowUp,
    ArrowDown,
    X,
    Building2,
    Calendar,
    ExternalLink,
    AlertCircle,
    Check,
    FileCheck2,
} from 'lucide-react';
import { useState, useMemo } from 'react';
import TrackngoLayout from '@/layouts/trackngo/TrackngoLayout';
import { SeverityPill } from '@/components/trackngo/SeverityPill';
import { ArtaBadge } from '@/components/trackngo/ArtaBadge';
import { ExportPasswordModal } from '@/components/trackngo/ExportPasswordModal';
import { BaseModal, ModalSection, ModalSecondaryButton } from '@/components/trackngo/BaseModal';
import { getStandardizedStatus } from '@/lib/status-helper';
import { cn } from '@/lib/utils';
import TablePagination from '@/components/trackngo/TablePagination';

export default function ArchivedDocumentsIndex() {
    const { props, url } = usePage();
    const documents = (props.dbDocuments || []) as any[];
    const departments = (props.dbDepartments || []) as any[];
    const documentTypes = (props.dbDocumentTypes || []) as any[];

    // Determine current role segment from URL or prop
    const urlSegment = url.split('/')[1] || 'receiving';
    const currentRole = (props.role as string) || (urlSegment === 'department-head' ? 'department-head' : urlSegment);

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [activeTab, setActiveTab] = useState<'all' | 'approved' | 'completed' | 'archived'>('all');
    const [filterType, setFilterType] = useState('');
    const [filterDept, setFilterDept] = useState('');
    const [filterArta, setFilterArta] = useState<'all' | 'compliant' | 'overdue'>('all');
    const [sortField, setSortField] = useState<'ref' | 'date_filed' | 'completed_at'>('completed_at');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
    const [exportModalOpen, setExportModalOpen] = useState(false);
    const [previewDoc, setPreviewDoc] = useState<any | null>(null);

    // KPI Metrics calculation
    const metrics = useMemo(() => {
        let approvedCount = 0;
        let completedCount = 0;
        let compliantCount = 0;

        documents.forEach((doc: any) => {
            const s = (doc.status || '').toLowerCase();
            if (s === 'approved') approvedCount++;
            if (s === 'completed') completedCount++;

            // ARTA compliance: either days_left >= 0 or not overdue
            const daysLeft = doc.arta_days_left ?? 3;
            if (daysLeft >= 0) {
                compliantCount++;
            }
        });

        const complianceRate = documents.length > 0
            ? Math.round((compliantCount / documents.length) * 100)
            : 100;

        return {
            total: documents.length,
            approved: approvedCount,
            completed: completedCount,
            complianceRate,
        };
    }, [documents]);

    const tabCounts = useMemo(() => {
        const counts = { all: documents.length, approved: 0, completed: 0, archived: 0 };
        documents.forEach((doc: any) => {
            const s = (doc.status || '').toLowerCase();
            if (s === 'approved') counts.approved++;
            else if (s === 'completed') counts.completed++;
            else counts.archived++;
        });
        return counts;
    }, [documents]);

    const filteredDocs = useMemo(() => {
        let result = documents.filter((doc: any) => {
            const s = (doc.status || '').toLowerCase();

            // Tab filtering
            if (activeTab === 'approved' && s !== 'approved') return false;
            if (activeTab === 'completed' && s !== 'completed') return false;
            if (activeTab === 'archived' && s !== 'archived' && s !== 'archive') return false;

            // ARTA status filtering
            const daysLeft = doc.arta_days_left ?? 3;
            if (filterArta === 'compliant' && daysLeft < 0) return false;
            if (filterArta === 'overdue' && daysLeft >= 0) return false;

            // Search query filtering
            const q = searchQuery.toLowerCase();
            const matchesSearch = !q ||
                (doc.reference_number || '').toLowerCase().includes(q) ||
                (doc.tracking_number || '').toLowerCase().includes(q) ||
                (doc.title || '').toLowerCase().includes(q) ||
                (doc.department?.department_name || '').toLowerCase().includes(q) ||
                (doc.type?.type_name || '').toLowerCase().includes(q) ||
                (doc.sender || '').toLowerCase().includes(q);

            const matchesType = !filterType || String(doc.type_id) === filterType;
            const matchesDept = !filterDept || String(doc.department_id) === filterDept;

            return matchesSearch && matchesType && matchesDept;
        });

        result.sort((a: any, b: any) => {
            if (sortField === 'ref') {
                const refA = a.reference_number || '';
                const refB = b.reference_number || '';
                return sortDir === 'asc' ? refA.localeCompare(refB) : refB.localeCompare(refA);
            }
            if (sortField === 'date_filed') {
                const dateA = new Date(a.date_filed || a.created_at || 0).getTime();
                const dateB = new Date(b.date_filed || b.created_at || 0).getTime();
                return sortDir === 'asc' ? dateA - dateB : dateB - dateA;
            }
            // default: completed_at / updated_at
            const compA = new Date(a.completed_at || a.updated_at || a.created_at || 0).getTime();
            const compB = new Date(b.completed_at || b.updated_at || b.created_at || 0).getTime();
            return sortDir === 'asc' ? compA - compB : compB - compA;
        });

        return result;
    }, [documents, searchQuery, activeTab, filterType, filterDept, filterArta, sortField, sortDir]);

    const paginatedDocs = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredDocs.slice(start, start + pageSize);
    }, [filteredDocs, currentPage, pageSize]);

    const activeFilterCount = [
        filterType,
        filterDept,
        filterArta !== 'all' ? filterArta : '',
    ].filter(Boolean).length;

    const toggleSelect = (id: number) => {
        setSelectedIds((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        );
    };

    const toggleAll = () => {
        if (selectedIds.length === paginatedDocs.length && paginatedDocs.length > 0) {
            setSelectedIds([]);
        } else {
            setSelectedIds(paginatedDocs.map((d: any) => d.document_id));
        }
    };

    const clearFilters = () => {
        setFilterType('');
        setFilterDept('');
        setFilterArta('all');
        setSearchQuery('');
        setActiveTab('all');
        setCurrentPage(1);
    };

    const handleSort = (field: 'ref' | 'date_filed' | 'completed_at') => {
        if (sortField === field) {
            setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortField(field);
            setSortDir('desc');
        }
    };

    const handleExportCSV = () => {
        const header = [
            'Reference Number',
            'Tracking Number',
            'Title',
            'Document Type',
            'Department',
            'Date Filed',
            'Final Status',
            'ARTA Processing Days',
            'ARTA Status',
        ];
        const rows = filteredDocs.map((d: any) => {
            const daysLeft = d.arta_days_left ?? 3;
            const artaStatus = daysLeft < 0 ? `Overdue (${Math.abs(daysLeft)}d)` : `Compliant (${daysLeft}d left)`;
            return [
                d.reference_number,
                d.tracking_number ?? '',
                d.title ?? '',
                d.type?.type_name ?? '',
                d.department?.department_name ?? '',
                d.date_filed ? new Date(d.date_filed).toLocaleDateString() : (d.created_at?.slice(0, 10) ?? ''),
                d.status ?? '',
                d.type?.arta_processing_days ?? 3,
                artaStatus,
            ];
        });
        const csv = [header, ...rows].map((r) => r.map((v: any) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const urlObj = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = urlObj;
        a.download = `archived-documents-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(urlObj);
    };

    return (
        <TrackngoLayout>
            <Head title="Archived Documents — TrackNGo Mati" />

            <div className="space-y-6">
                {/* ── Page Header ────────────────────────────────────────── */}
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2.5">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white shadow-md shadow-slate-900/10">
                                <Archive className="h-5 w-5" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900">
                                    Archived Documents
                                </h1>
                                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                                    Central Repository · Finalized & Completed Records
                                </p>
                            </div>
                        </div>
                        <p className="mt-2 text-sm text-slate-600 max-w-2xl">
                            Single repository preserving finalized, approved, and completed documents across the City Government of Mati. All metadata, ARTA compliance history, and audit trails remain preserved for transparency.
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setExportModalOpen(true)}
                            className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:border-slate-400 active:scale-98"
                        >
                            <Download className="h-4 w-4 text-slate-500" />
                            Export CSV
                        </button>
                    </div>
                </div>

                {/* ── Stat Cards ─────────────────────────────────────────── */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:shadow">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                                Total Archived
                            </span>
                            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                                <Archive className="h-4 w-4" />
                            </span>
                        </div>
                        <div className="mt-3 flex items-baseline gap-2">
                            <span className="text-3xl font-bold text-slate-900">{metrics.total}</span>
                            <span className="text-xs text-slate-500">finalized records</span>
                        </div>
                        <p className="mt-1 text-xs text-slate-400">All departments combined</p>
                    </div>

                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-5 shadow-sm transition-all hover:shadow">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                                Approved Documents
                            </span>
                            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                                <CheckCircle2 className="h-4 w-4" />
                            </span>
                        </div>
                        <div className="mt-3 flex items-baseline gap-2">
                            <span className="text-3xl font-bold text-emerald-800">{metrics.approved}</span>
                            <span className="text-xs text-emerald-600">official approvals</span>
                        </div>
                        <p className="mt-1 text-xs text-emerald-600/80">Approved by Department Head / Mayor</p>
                    </div>

                    <div className="rounded-xl border border-teal-200 bg-teal-50/40 p-5 shadow-sm transition-all hover:shadow">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold uppercase tracking-wider text-teal-700">
                                Completed & Released
                            </span>
                            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-100 text-teal-700">
                                <FileCheck2 className="h-4 w-4" />
                            </span>
                        </div>
                        <div className="mt-3 flex items-baseline gap-2">
                            <span className="text-3xl font-bold text-teal-800">{metrics.completed}</span>
                            <span className="text-xs text-teal-600">fully resolved</span>
                        </div>
                        <p className="mt-1 text-xs text-teal-600/80">Released to applicants & finalized</p>
                    </div>

                    <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-5 shadow-sm transition-all hover:shadow">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold uppercase tracking-wider text-blue-700">
                                ARTA Compliance
                            </span>
                            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                                <ShieldCheck className="h-4 w-4" />
                            </span>
                        </div>
                        <div className="mt-3 flex items-baseline gap-2">
                            <span className="text-3xl font-bold text-blue-800">{metrics.complianceRate}%</span>
                            <span className="text-xs text-blue-600">on-time rate</span>
                        </div>
                        <p className="mt-1 text-xs text-blue-600/80">Processed within Republic Act 11032</p>
                    </div>
                </div>

                {/* ── Tabs & Filter Bar ──────────────────────────────────── */}
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
                    {/* Status Tabs */}
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                            {[
                                { id: 'all', label: 'All Finalized', count: tabCounts.all },
                                { id: 'approved', label: 'Approved', count: tabCounts.approved },
                                { id: 'completed', label: 'Completed', count: tabCounts.completed },
                            ].map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => { setActiveTab(tab.id as any); setCurrentPage(1); }}
                                    className={cn(
                                        'flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all',
                                        activeTab === tab.id
                                            ? 'bg-slate-900 text-white shadow-sm'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                                    )}
                                >
                                    <span>{tab.label}</span>
                                    <span
                                        className={cn(
                                            'rounded-full px-2 py-0.5 text-[10px] font-bold',
                                            activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-white text-slate-700'
                                        )}
                                    >
                                        {tab.count}
                                    </span>
                                </button>
                            ))}
                        </div>

                        <div className="text-xs text-slate-500">
                            Showing <span className="font-semibold text-slate-900">{filteredDocs.length}</span> of {documents.length} archived documents
                        </div>
                    </div>

                    {/* Search & Select Filters */}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
                        {/* Search Input */}
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                                placeholder="Search Ref, Tracking, Title..."
                                className="w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-9 pr-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-400"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => { setSearchQuery(''); setCurrentPage(1); }}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            )}
                        </div>

                        {/* Department Filter */}
                        <div>
                            <select
                                value={filterDept}
                                onChange={(e) => { setFilterDept(e.target.value); setCurrentPage(1); }}
                                className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-700 focus:border-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-400"
                            >
                                <option value="">All Departments</option>
                                {departments.map((dept: any) => (
                                    <option key={dept.department_id} value={dept.department_id}>
                                        {dept.department_name} ({dept.code})
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Document Type Filter */}
                        <div>
                            <select
                                value={filterType}
                                onChange={(e) => { setFilterType(e.target.value); setCurrentPage(1); }}
                                className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-700 focus:border-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-400"
                            >
                                <option value="">All Document Types</option>
                                {documentTypes.map((type: any) => (
                                    <option key={type.type_id} value={type.type_id}>
                                        {type.type_name} ({type.arta_processing_days}d ARTA)
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* ARTA Compliance Filter */}
                        <div>
                            <select
                                value={filterArta}
                                onChange={(e) => { setFilterArta(e.target.value as any); setCurrentPage(1); }}
                                className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-700 focus:border-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-400"
                            >
                                <option value="all">All ARTA Status</option>
                                <option value="compliant">Compliant (On-Time / Met)</option>
                                <option value="overdue">Overdue</option>
                            </select>
                        </div>
                    </div>

                    {/* Active filter count & clear */}
                    {(activeFilterCount > 0 || searchQuery) && (
                        <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-xs">
                            <span className="text-slate-500">
                                Filtering by {activeFilterCount} attribute{activeFilterCount > 1 ? 's' : ''}
                                {searchQuery && ` + query "${searchQuery}"`}
                            </span>
                            <button
                                onClick={clearFilters}
                                className="font-semibold text-rose-600 hover:text-rose-700 hover:underline"
                            >
                                Clear all filters
                            </button>
                        </div>
                    )}
                </div>

                {/* ── Main Data Table ────────────────────────────────────── */}
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                    <div className="overflow-x-auto w-full">
                        <table className="w-full text-left text-xs text-slate-600">
                            <thead className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                <tr>
                                    <th className="w-10 px-4 py-3 text-center">
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.length === paginatedDocs.length && paginatedDocs.length > 0}
                                            onChange={toggleAll}
                                            className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                                        />
                                    </th>
                                    <th
                                        onClick={() => handleSort('ref')}
                                        className="cursor-pointer select-none px-4 py-3 transition-colors hover:text-slate-900"
                                    >
                                        <div className="flex items-center gap-1">
                                            <span>Reference Number</span>
                                            {sortField === 'ref' && (
                                                sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                                            )}
                                        </div>
                                    </th>
                                    <th className="px-4 py-3">Department</th>
                                    <th
                                        onClick={() => handleSort('date_filed')}
                                        className="cursor-pointer select-none px-4 py-3 transition-colors hover:text-slate-900"
                                    >
                                        <div className="flex items-center gap-1">
                                            <span>Date Filed</span>
                                            {sortField === 'date_filed' && (
                                                sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                                            )}
                                        </div>
                                    </th>
                                    <th className="px-4 py-3">Final Status</th>
                                    <th className="px-4 py-3">ARTA Compliance</th>
                                    <th className="px-4 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {paginatedDocs.map((doc: any) => {
                                    const showUrl = `/${currentRole}/documents/${doc.document_id}`;
                                    const dateFiled = doc.date_filed || doc.created_at;
                                    const formattedDateFiled = dateFiled
                                        ? new Date(dateFiled).toLocaleDateString('en-US', {
                                              month: 'short',
                                              day: '2-digit',
                                              year: 'numeric',
                                          })
                                        : '—';

                                    const isApproved = (doc.status || '').toLowerCase() === 'approved';
                                    const isCompleted = (doc.status || '').toLowerCase() === 'completed';

                                    return (
                                        <tr
                                            key={doc.document_id}
                                            className="group transition-colors odd:bg-white even:bg-slate-50/70 hover:bg-blue-50/40"
                                        >
                                            {/* Checkbox */}
                                            <td className="px-4 py-3.5 text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedIds.includes(doc.document_id)}
                                                    onChange={() => toggleSelect(doc.document_id)}
                                                    className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                                                />
                                            </td>

                                            {/* Reference & Title */}
                                            <td className="px-4 py-3.5">
                                                <div className="flex items-start gap-2.5">
                                                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                                                        <FileText className="h-3.5 w-3.5" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <Link
                                                            href={showUrl}
                                                            className="font-bold text-slate-900 hover:text-blue-600 hover:underline"
                                                        >
                                                            {doc.reference_number}
                                                        </Link>
                                                        <p className="truncate text-xs text-slate-700 font-medium max-w-sm">
                                                            {doc.title || 'Untitled Document'}
                                                        </p>
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            <span className="text-[10px] text-slate-400 font-mono">
                                                                {doc.tracking_number || 'No Tracking #'}
                                                            </span>
                                                            <span className="text-[10px] rounded bg-slate-100 px-1.5 py-0.2 text-slate-600">
                                                                {doc.type?.type_name || 'General'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Department */}
                                            <td className="px-4 py-3.5">
                                                <div className="flex items-center gap-1.5">
                                                    <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                                    <span className="font-medium text-slate-700">
                                                        {doc.department?.department_name || 'General Administration'}
                                                    </span>
                                                </div>
                                                <span className="text-[10px] text-slate-400 pl-5">
                                                    Code: {doc.department?.code || 'GEN'}
                                                </span>
                                            </td>

                                            {/* Date Filed */}
                                            <td className="px-4 py-3.5">
                                                <div className="flex items-center gap-1 text-slate-700 font-medium">
                                                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                                                    <span>{formattedDateFiled}</span>
                                                </div>
                                                {doc.completed_at && (
                                                    <div className="text-[10px] text-slate-400 mt-0.5">
                                                        Finalized: {new Date(doc.completed_at).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}
                                                    </div>
                                                )}
                                            </td>

                                            {/* Status */}
                                            <td className="px-4 py-3.5">
                                                {isApproved ? (
                                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
                                                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                                        Approved
                                                    </span>
                                                ) : isCompleted ? (
                                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-700 border border-teal-200">
                                                        <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
                                                        Completed
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 border border-slate-300">
                                                        <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
                                                        Archived
                                                    </span>
                                                )}
                                            </td>

                                            {/* ARTA Compliance */}
                                            <td className="px-4 py-3.5">
                                                <ArtaBadge
                                                    daysLeft={doc.arta_days_left ?? 3}
                                                    threshold={doc.type?.arta_processing_days ?? 3}
                                                />
                                            </td>

                                            {/* Actions */}
                                            <td className="px-4 py-3.5 text-right whitespace-nowrap">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button
                                                        onClick={() => setPreviewDoc(doc)}
                                                        title="Quick Overview"
                                                        aria-label="Quick Overview"
                                                        className="rounded-lg p-2 text-slate-400 transition-all hover:bg-blue-50 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400/50"
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </button>
                                                    <Link
                                                        href={showUrl}
                                                        title="Full Details & Audit Trail"
                                                        aria-label="View Full Details"
                                                        className="rounded-lg p-2 text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400/50"
                                                    >
                                                        <ExternalLink className="h-4 w-4" />
                                                    </Link>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Empty State */}
                    {filteredDocs.length === 0 && (
                        <div className="py-16 text-center">
                            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                                <Archive className="h-6 w-6" />
                            </div>
                            <h3 className="mt-3 text-sm font-semibold text-slate-900">
                                No archived documents found
                            </h3>
                            <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
                                Documents marked as Approved or Completed will automatically appear here once finalized.
                            </p>
                            {activeFilterCount > 0 && (
                                <button
                                    onClick={clearFilters}
                                    className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                >
                                    Reset Filters
                                </button>
                            )}
                        </div>
                    )}

                    <TablePagination
                        currentPage={currentPage}
                        pageSize={pageSize}
                        totalItems={filteredDocs.length}
                        onPageChange={setCurrentPage}
                        onPageSizeChange={setPageSize}
                        itemLabel="documents"
                    />
                </div>

                {/* ── Standardized Quick Overview Modal ────────────────────── */}
                <BaseModal
                    isOpen={!!previewDoc}
                    onClose={() => setPreviewDoc(null)}
                    title={previewDoc?.reference_number || 'Archived Document'}
                    description={previewDoc?.tracking_number ? `Tracking No: ${previewDoc.tracking_number}` : 'Archived document record overview'}
                    icon={Archive}
                    badge="Archived"
                    badgeVariant="default"
                    maxWidth="lg"
                    footer={
                        previewDoc && (
                            <>
                                <ModalSecondaryButton onClick={() => setPreviewDoc(null)}>
                                    Close
                                </ModalSecondaryButton>
                                <Link
                                    href={`/${currentRole}/documents/${previewDoc.document_id}`}
                                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 transition-colors"
                                >
                                    <span>Open Full Show Page</span>
                                    <ExternalLink className="h-3.5 w-3.5" />
                                </Link>
                            </>
                        )
                    }
                >
                    {previewDoc && (
                        <div className="space-y-4">
                            <ModalSection title="Document Information">
                                <div className="space-y-3">
                                    <div>
                                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                                            Document Title
                                        </span>
                                        <p className="mt-0.5 text-sm font-semibold text-slate-900">
                                            {previewDoc.title || 'Untitled Document'}
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 border border-slate-100">
                                        <div>
                                            <span className="text-slate-400 text-[10px] font-medium uppercase">
                                                Department
                                            </span>
                                            <p className="font-semibold text-slate-800 text-xs mt-0.5">
                                                {previewDoc.department?.department_name || 'General'}
                                            </p>
                                        </div>
                                        <div>
                                            <span className="text-slate-400 text-[10px] font-medium uppercase">
                                                Document Type
                                            </span>
                                            <p className="font-semibold text-slate-800 text-xs mt-0.5">
                                                {previewDoc.type?.type_name || 'General'}
                                            </p>
                                        </div>
                                        <div>
                                            <span className="text-slate-400 text-[10px] font-medium uppercase">
                                                Date Filed
                                            </span>
                                            <p className="font-semibold text-slate-800 text-xs mt-0.5">
                                                {previewDoc.date_filed ? new Date(previewDoc.date_filed).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : '—'}
                                            </p>
                                        </div>
                                        <div>
                                            <span className="text-slate-400 text-[10px] font-medium uppercase">
                                                Final Status
                                            </span>
                                            <div className="mt-1">
                                                <SeverityPill status={previewDoc.status} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </ModalSection>

                            <ModalSection title="ARTA Compliance Standard">
                                <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3.5">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-semibold text-blue-900">
                                            Processing Standard
                                        </span>
                                        <ArtaBadge
                                            daysLeft={previewDoc.arta_days_left ?? 3}
                                            threshold={previewDoc.type?.arta_processing_days ?? 3}
                                        />
                                    </div>
                                    <p className="mt-1.5 text-xs text-blue-700 leading-relaxed">
                                        Mandated processing window: <span className="font-semibold">{previewDoc.type?.arta_processing_days ?? 3} working days</span> under ARTA Citizen's Charter.
                                    </p>
                                </div>
                            </ModalSection>
                        </div>
                    )}
                </BaseModal>

                {/* ── Export Password Modal ──────────────────────────────── */}
                <ExportPasswordModal
                    isOpen={exportModalOpen}
                    onClose={() => setExportModalOpen(false)}
                    onSuccess={handleExportCSV}
                    documentId={0}
                    title="Export Central Archive Repository"
                />
            </div>
        </TrackngoLayout>
    );
}
