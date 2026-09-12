import { Head, Link, router, usePage } from '@inertiajs/react';
import { FileText, Search, Plus, ArrowUp, ArrowDown, X, Download, Lock, Inbox, Clock, Send, RotateCcw, Eye } from 'lucide-react';
import { useState, useMemo } from 'react';
import TrackngoLayout from '@/layouts/trackngo/TrackngoLayout';
import { SeverityPill } from '@/components/trackngo/SeverityPill';
import { ExportPasswordModal } from '@/components/trackngo/ExportPasswordModal';
import { getStandardizedStatus, StandardizedStatus, isFinalizedOrArchived } from '@/lib/status-helper';
import TablePagination from '@/components/trackngo/TablePagination';
import { cn } from '@/lib/utils';

export default function HrDocuments() {
    const { props } = usePage();
    const rawDocuments = (props.dbDocuments || []) as any[];
    const departments = (props.dbDepartments || []) as any[];
    const documentTypes = (props.dbDocumentTypes || []) as any[];

    // Only active, ongoing, received, sent, or returned documents
    const documents = useMemo(() => {
        return rawDocuments.filter((doc: any) => !isFinalizedOrArchived(doc.status));
    }, [rawDocuments]);

    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState<'all' | 'received' | 'ongoing' | 'sent' | 'returned'>('all');
    const [filterType, setFilterType] = useState('');
    const [filterDept, setFilterDept] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
    const [exportModalOpen, setExportModalOpen] = useState(false);
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    // Pagination state (default: 20 per page, expandable to 50, 100)
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);

    const tabCounts = useMemo(() => {
        const counts = { all: documents.length, received: 0, ongoing: 0, sent: 0, returned: 0 };
        documents.forEach((doc: any) => {
            const std = getStandardizedStatus(doc.status).toLowerCase() as keyof typeof counts;
            if (counts[std] !== undefined) {
                counts[std]++;
            }
        });
        return counts;
    }, [documents]);

    const statusOptions: StandardizedStatus[] = ['Received', 'Ongoing', 'Sent', 'Returned'];

    const filteredDocs = useMemo(() => {
        let result = documents.filter((doc: any) => {
            const stdStatus = getStandardizedStatus(doc.status);

            // Tab filtering logic
            if (activeTab !== 'all' && stdStatus.toLowerCase() !== activeTab) {
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
            const matchesStatus = !filterStatus || stdStatus === filterStatus;

            return matchesSearch && matchesType && matchesDept && matchesStatus;
        });

        result.sort((a: any, b: any) => {
            const refA = a.reference_number || '';
            const refB = b.reference_number || '';
            return sortDir === 'asc' ? refA.localeCompare(refB) : refB.localeCompare(refA);
        });

        return result;
    }, [documents, searchQuery, filterType, filterDept, filterStatus, sortDir, activeTab]);

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
                            {filteredDocs.length} of {documents.length} records • Manage human resources policies, memos, and tracking
                            {activeFilterCount > 0 && <span className="ml-1 text-[var(--tng-blue-600)]">({activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''} active)</span>}
                        </p>
                    </div>
                    <button className="flex items-center gap-2 rounded-lg bg-[var(--tng-blue-600)] px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-600/25 transition-all hover:bg-[var(--tng-blue-700)]">
                        <Plus className="h-4 w-4" />
                        New Document
                    </button>
                </div>

                {toastMessage && (
                    <div className="rounded-lg bg-green-50 border border-green-200 p-4 flex items-center gap-3 text-green-700 animate-in slide-in-from-top-2">
                        <span className="font-semibold text-sm">{toastMessage}</span>
                    </div>
                )}

                {/* Tabs */}
                <div className="flex items-center gap-2 border-b border-[var(--tng-slate-200)]">
                    {[
                        { id: 'all', label: 'All Documents', icon: null, count: tabCounts.all },
                        { id: 'received', label: 'Received', icon: <Inbox className="h-4 w-4 mr-1.5" />, count: tabCounts.received },
                        { id: 'ongoing', label: 'Ongoing', icon: <Clock className="h-4 w-4 mr-1.5" />, count: tabCounts.ongoing },
                        { id: 'sent', label: 'Sent', icon: <Send className="h-4 w-4 mr-1.5" />, count: tabCounts.sent },
                        { id: 'returned', label: 'Returned', icon: <RotateCcw className="h-4 w-4 mr-1.5" />, count: tabCounts.returned }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={cn(
                                "flex items-center px-4 py-3 text-sm font-medium border-b-2 transition-colors",
                                activeTab === tab.id
                                    ? "border-[var(--tng-blue-600)] text-[var(--tng-blue-600)]"
                                    : "border-transparent text-[var(--tng-slate-500)] hover:text-[var(--tng-slate-700)] hover:border-[var(--tng-slate-300)]"
                            )}
                        >
                            {tab.icon}
                            {tab.label}
                            <span className={cn(
                                "ml-2 rounded-full px-2 py-0.5 text-xs font-semibold",
                                activeTab === tab.id ? "bg-[var(--tng-blue-100)] text-[var(--tng-blue-700)]" : "bg-slate-100 text-slate-600"
                            )}>
                                {tab.count}
                            </span>
                        </button>
                    ))}
                </div>

                {/* Search & Filters */}
                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative flex-1 min-w-[240px]">
                        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--tng-slate-400)]" />
                        <input
                            type="text"
                            placeholder="Search by reference no, title..."
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
                <div className="w-full rounded-2xl border border-[var(--tng-slate-200)] bg-white shadow-xs overflow-hidden">
                    <div className="overflow-x-auto w-full">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-[var(--tng-slate-50)] border-b border-[var(--tng-slate-200)]">
                                <tr>
                                    <th
                                        className="px-6 py-3.5 text-[16px] font-bold text-[var(--tng-slate-800)] cursor-pointer select-none hover:text-[var(--tng-blue-600)] transition-colors"
                                        onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
                                    >
                                        <span className="flex items-center gap-1">
                                            Reference No.
                                            {sortDir === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                                        </span>
                                    </th>
                                    <th className="px-6 py-3.5 text-[16px] font-bold text-[var(--tng-slate-800)]">Title</th>
                                    <th className="px-6 py-3.5 text-[16px] font-bold text-[var(--tng-slate-800)]">Type</th>
                                    <th className="px-6 py-3.5 text-[16px] font-bold text-[var(--tng-slate-800)]">Status</th>
                                    <th className="px-6 py-3.5 text-[16px] font-bold text-[var(--tng-slate-800)]">Date</th>
                                    <th className="px-6 py-3.5 text-[16px] font-bold text-[var(--tng-slate-800)] text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--tng-slate-100)]">
                                {paginatedDocs.map((doc: any) => (
                                    <tr 
                                        key={doc.document_id} 
                                        onClick={() => router.visit(`/hr/documents/${doc.document_id}`)}
                                        className="transition-colors odd:bg-white even:bg-slate-50/75 hover:bg-blue-50/40 cursor-pointer group"
                                    >
                                        <td className="px-6 py-3.5 text-[14px] font-semibold text-[var(--tng-blue-600)] group-hover:underline">
                                            {doc.reference_number}
                                            {doc.tracking_number && (
                                                <div className="text-[12px] text-[var(--tng-slate-400)]">{doc.tracking_number}</div>
                                            )}
                                        </td>
                                        <td className="px-6 py-3.5 text-[14px] font-medium text-[var(--tng-slate-800)]">{doc.title}</td>
                                        <td className="px-6 py-3.5 text-[14px] font-normal text-[var(--tng-slate-600)]">{doc.type?.type_name || 'N/A'}</td>
                                        <td className="px-6 py-3.5">
                                            <SeverityPill status={doc.status} />
                                        </td>
                                        <td className="px-6 py-3.5 text-[14px] font-normal text-[var(--tng-slate-500)]">
                                            {new Date(doc.date_filed || doc.created_at).toLocaleDateString('en-US', {
                                                month: 'short',
                                                day: '2-digit',
                                                year: 'numeric',
                                            })}
                                        </td>
                                        <td className="px-6 py-3.5 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                            <div className="flex items-center justify-end gap-1">
                                                <Link
                                                    href={`/hr/documents/${doc.document_id}`}
                                                    title="View Document"
                                                    aria-label="View Document"
                                                    className="rounded-lg p-2 text-[var(--tng-slate-400)] transition-all hover:bg-blue-50 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400/50"
                                                >
                                                    <Eye className="h-[18px] w-[18px]" />
                                                </Link>
                                            </div>
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
