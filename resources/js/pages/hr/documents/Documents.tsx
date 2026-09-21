import { Head, Link, router, usePage } from '@inertiajs/react';
import { FileText, Search, Plus, ArrowUp, ArrowDown, X, Download, Lock, Inbox, Clock, Send, RotateCcw, Eye, Archive, Users, CalendarDays, AlertTriangle } from 'lucide-react';
import { useState, useMemo } from 'react';
import TrackngoLayout from '@/layouts/trackngo/TrackngoLayout';
import { SeverityPill } from '@/components/trackngo/SeverityPill';
import { ExportPasswordModal } from '@/components/trackngo/ExportPasswordModal';
import { getStandardizedStatus, StandardizedStatus, isFinalizedOrArchived } from '@/lib/status-helper';
import TablePagination from '@/components/trackngo/TablePagination';
import TabNavigation, { TabItem } from '@/components/trackngo/TabNavigation';
import TableActionButtons from '@/components/trackngo/TableActionButtons';
import { StepDots } from '@/components/trackngo/StepProgress';
import { cn } from '@/lib/utils';

export default function HrDocuments() {
    const { props } = usePage();
    const rawDocuments = (props.dbDocuments || []) as any[];
    const departments = (props.dbDepartments || []) as any[];
    const documentTypes = (props.dbDocumentTypes || []) as any[];

    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState<'all' | 'employee_records' | 'leave_requests' | 'violations'>('all');
    const [filterType, setFilterType] = useState('');
    const [filterDept, setFilterDept] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
    const [exportModalOpen, setExportModalOpen] = useState(false);
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    // Pagination state (default: 20 per page, expandable to 50, 100)
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);

    // HR Category Classifier (Employee Records, Leave Requests, Violations)
    const classifyHrCategory = (doc: any): 'employee_records' | 'leave_requests' | 'violations' => {
        const text = `${doc.title || ''} ${doc.type?.type_name || ''} ${doc.reference_number || ''}`.toLowerCase();
        if (text.includes('leave') || text.includes('vacation') || text.includes('sick') || text.includes('absence') || text.includes('voucher') || text.includes('requisition') || text.includes('permit') || [4, 7].includes(doc.type_id)) {
            return 'leave_requests';
        }
        if (text.includes('violation') || text.includes('disciplinary') || text.includes('show cause') || text.includes('warning') || text.includes('reprimand') || text.includes('resolution') || text.includes('report') || [5, 6, 8].includes(doc.type_id)) {
            return 'violations';
        }
        return 'employee_records';
    };

    const tabCounts = useMemo(() => {
        const counts = { all: rawDocuments.length, employee_records: 0, leave_requests: 0, violations: 0 };
        rawDocuments.forEach((doc: any) => {
            const cat = classifyHrCategory(doc);
            counts[cat]++;
        });
        return counts;
    }, [rawDocuments]);

    const statusOptions: StandardizedStatus[] = ['Received', 'Ongoing', 'Sent', 'Returned', 'Archived'];

    const filteredDocs = useMemo(() => {
        let result = rawDocuments.filter((doc: any) => {
            const stdStatus = getStandardizedStatus(doc.status);
            const category = classifyHrCategory(doc);

            // Tab filtering logic (HR: All, Employee Records, Leave Requests, Violations)
            if (activeTab !== 'all' && category !== activeTab) {
                return false;
            }

            const q = searchQuery.toLowerCase();
            const matchesSearch = !q ||
                (doc.reference_number || '').toLowerCase().includes(q) ||
                (doc.tracking_number || '').toLowerCase().includes(q) ||
                (doc.title || '').toLowerCase().includes(q) ||
                (doc.department?.department_name || '').toLowerCase().includes(q) ||
                stdStatus.toLowerCase().includes(q) ||
                (doc.status || '').toLowerCase().includes(q);

            const matchesType = !filterType || String(doc.type_id) === filterType;
            const matchesDept = !filterDept || String(doc.department_id) === filterDept;
            const matchesStatus = !filterStatus || stdStatus.toLowerCase() === filterStatus.toLowerCase();

            return matchesSearch && matchesType && matchesDept && matchesStatus;
        });

        result.sort((a: any, b: any) => {
            const refA = a.reference_number || '';
            const refB = b.reference_number || '';
            return sortDir === 'asc' ? refA.localeCompare(refB) : refB.localeCompare(refA);
        });

        return result;
    }, [rawDocuments, searchQuery, filterType, filterDept, filterStatus, sortDir, activeTab]);

    const paginatedDocs = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredDocs.slice(start, start + pageSize);
    }, [filteredDocs, currentPage, pageSize]);

    const activeFilterCount = [filterType, filterDept, filterStatus].filter(Boolean).length;

    const clearFilters = () => {
        setFilterType('');
        setFilterDept('');
        setFilterStatus('');
        setSearchQuery('');
        setCurrentPage(1);
    };

    return (
        <TrackngoLayout>
            <Head title="HR Documents — TrackNGo Mati" />

            <div className="space-y-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <h1 className="text-[20px] font-bold text-[var(--tng-slate-900)]">HR Documents</h1>
                        <p className="mt-0.5 text-sm text-[var(--tng-slate-500)]">
                            {filteredDocs.length} of {rawDocuments.length} records • Manage human resources policies, memos, and tracking
                            {activeFilterCount > 0 && <span className="ml-1 text-[var(--tng-blue-600)]">({activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''} active)</span>}
                        </p>
                    </div>
                    <button className="inline-flex items-center gap-2 rounded-lg bg-[#0066cc] px-4 py-2 text-[14px] font-medium text-white shadow-xs hover:shadow-sm transition-all hover:bg-[#005bb5]">
                        <Plus className="h-4 w-4 text-white" />
                        New Document
                    </button>
                </div>

                {toastMessage && (
                    <div className="rounded-lg bg-green-50 border border-green-200 p-4 flex items-center gap-3 text-green-700 animate-in slide-in-from-top-2">
                        <span className="font-semibold text-sm">{toastMessage}</span>
                    </div>
                )}

                {/* ── Standardized Tabbed Navigation (HR: All, Employee Records, Leave Requests, Violations) ── */}
                <TabNavigation
                    tabs={[
                        { id: 'all', label: 'All Records', icon: <FileText className="h-4 w-4" />, count: tabCounts.all },
                        { id: 'employee_records', label: 'Employee Records', icon: <Users className="h-4 w-4" />, count: tabCounts.employee_records },
                        { id: 'leave_requests', label: 'Leave Requests', icon: <CalendarDays className="h-4 w-4" />, count: tabCounts.leave_requests },
                        { id: 'violations', label: 'Violations', icon: <AlertTriangle className="h-4 w-4" />, count: tabCounts.violations },
                    ]}
                    activeTab={activeTab}
                    onChange={(tab) => {
                        setActiveTab(tab as any);
                        setCurrentPage(1);
                    }}
                />

                {/* Search & Filters */}
                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative flex-1 min-w-[240px]">
                        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--tng-slate-400)]" />
                        <input
                            type="text"
                            placeholder="Search by reference number, tracking number, type, or name..."
                            value={searchQuery}
                            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                            className="h-10 w-full rounded-xl border border-[var(--tng-slate-200)] bg-white pl-10 pr-4 text-sm text-[var(--tng-slate-700)] placeholder:text-[var(--tng-slate-400)] focus:border-[var(--tng-blue-500)] focus:outline-none focus:ring-1 focus:ring-[var(--tng-blue-500)]"
                        />
                    </div>

                    <select
                        value={filterType}
                        onChange={(e) => { setFilterType(e.target.value); setCurrentPage(1); }}
                        className="rounded-lg border border-[var(--tng-slate-200)] bg-white px-3 py-2 text-sm text-[var(--tng-slate-600)] hover:border-[var(--tng-blue-300)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--tng-blue-500)]/20"
                    >
                        <option value="">All Document Types</option>
                        {documentTypes.map((t: any) => (
                            <option key={t.type_id} value={t.type_id}>{t.type_name}</option>
                        ))}
                    </select>

                    <select
                        value={filterDept}
                        onChange={(e) => { setFilterDept(e.target.value); setCurrentPage(1); }}
                        className="rounded-lg border border-[var(--tng-slate-200)] bg-white px-3 py-2 text-sm text-[var(--tng-slate-600)] hover:border-[var(--tng-blue-300)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--tng-blue-500)]/20"
                    >
                        <option value="">All Departments</option>
                        {departments.map((d: any) => (
                            <option key={d.department_id} value={d.department_id}>{d.department_name}</option>
                        ))}
                    </select>

                    <select
                        value={filterStatus}
                        onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(1); }}
                        className="rounded-lg border border-[var(--tng-slate-200)] bg-white px-3 py-2 text-sm text-[var(--tng-slate-600)] hover:border-[var(--tng-blue-300)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--tng-blue-500)]/20"
                    >
                        <option value="">All Statuses</option>
                        {statusOptions.map((s) => (
                            <option key={s} value={s}>{s}</option>
                        ))}
                    </select>

                    {activeFilterCount > 0 && (
                        <button
                            onClick={clearFilters}
                            className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-100"
                        >
                            <X className="h-3.5 w-3.5" />
                            Clear Filters
                        </button>
                    )}

                    <button 
                        onClick={() => setExportModalOpen(true)}
                        className="ml-auto flex items-center gap-2 rounded-lg border border-[var(--tng-slate-200)] bg-white px-4 py-2 text-sm font-medium text-[var(--tng-slate-600)] transition-colors hover:bg-[var(--tng-slate-50)]"
                    >
                        <Download className="h-4 w-4" />
                        Export
                        <Lock className="h-3 w-3 text-[var(--tng-amber-500)]" />
                    </button>
                </div>

                {/* Documents Table */}
                <div className="w-full rounded-xl border border-[var(--tng-slate-200)] bg-white shadow-xs overflow-hidden">
                    <div className="overflow-x-auto w-full">
                        <table className="w-full text-left border-collapse text-[13px] text-slate-700">
                            <thead className="bg-[var(--tng-slate-50)] border-b border-[var(--tng-slate-200)]">
                                <tr>
                                    <th
                                        className="px-4 py-3 cursor-pointer select-none hover:text-[#0066cc] transition-colors text-left text-[14px] font-normal text-slate-600"
                                        onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
                                    >
                                        <span className="flex items-center gap-1">
                                            Reference No.
                                            {sortDir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
                                        </span>
                                    </th>
                                    <th className="px-4 py-3 text-left text-[14px] font-normal text-slate-600">Title</th>
                                    <th className="px-4 py-3 text-left text-[14px] font-normal text-slate-600">Type</th>
                                    <th className="px-4 py-3 text-left text-[14px] font-normal text-slate-600">Step Progress</th>
                                    <th className="px-4 py-3 text-left text-[14px] font-normal text-slate-600">Status</th>
                                    <th className="px-4 py-3 text-left text-[14px] font-normal text-slate-600">Date</th>
                                    <th className="px-4 py-3 text-right text-[14px] font-normal text-slate-600">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--tng-slate-100)]">
                                {paginatedDocs.map((doc: any) => (
                                    <tr 
                                        key={doc.document_id} 
                                        onClick={() => router.visit(`/hr/documents/${doc.document_id}`)}
                                        className="transition-colors odd:bg-white even:bg-slate-50/75 hover:bg-blue-50/40 cursor-pointer group"
                                    >
                                        <td className="px-4 py-3 text-[13px] font-normal text-[#0066cc] group-hover:underline">
                                            {doc.reference_number}
                                            {doc.tracking_number && (
                                                <div className="text-[12px] text-slate-500 font-normal">{doc.tracking_number}</div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-[13px] font-normal text-slate-900">{doc.title}</td>
                                        <td className="px-4 py-3 text-[13px] font-normal text-slate-600">{doc.type?.type_name || 'N/A'}</td>
                                        <td className="px-4 py-3">
                                            <StepDots
                                                current={doc.current_step_index}
                                                total={doc.is_internal ? 6 : 7}
                                                isInternal={doc.is_internal}
                                                isSlaBreached={Boolean(doc.is_escalated || (doc.arta_days_left !== undefined && doc.arta_days_left < 0))}
                                            />
                                        </td>
                                        <td className="px-4 py-3">
                                            <SeverityPill status={doc.status} />
                                        </td>
                                        <td className="px-4 py-3 text-[13px] font-normal text-slate-600">
                                            {new Date(doc.date_filed || doc.created_at).toLocaleDateString('en-US', {
                                                month: 'short',
                                                day: '2-digit',
                                                year: 'numeric',
                                            })}
                                        </td>
                                        <td className="px-4 py-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                            <TableActionButtons
                                                editHref={`/hr/documents/${doc.document_id}`}
                                                editTitle="Edit Record"
                                                onDelete={() => {
                                                    if (confirm(`Are you sure you want to delete document ${doc.reference_number}?`)) {
                                                        router.delete(`/documents/${doc.document_id}`);
                                                    }
                                                }}
                                                deleteTitle="Delete Record"
                                                extraActions={
                                                    <Link
                                                        href={`/hr/documents/${doc.document_id}`}
                                                        title="View Document"
                                                        aria-label="View Document"
                                                        className="p-1 text-slate-400 hover:text-[#0066cc] transition-colors rounded hover:bg-slate-100/70 focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 active:scale-95 cursor-pointer"
                                                    >
                                                        <Eye className="h-[18px] w-[18px]" />
                                                    </Link>
                                                }
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination Controls at Bottom */}
                    <TablePagination
                        currentPage={currentPage}
                        pageSize={pageSize}
                        totalItems={filteredDocs.length}
                        onPageChange={setCurrentPage}
                        onPageSizeChange={setPageSize}
                        itemLabel="documents"
                    />
                </div>
            </div>

            <ExportPasswordModal
                isOpen={exportModalOpen}
                onClose={() => setExportModalOpen(false)}
                documentId={filteredDocs[0]?.document_id ?? 'all'}
                onSuccess={(msg) => setToastMessage(msg)}
            />
        </TrackngoLayout>
    );
}
