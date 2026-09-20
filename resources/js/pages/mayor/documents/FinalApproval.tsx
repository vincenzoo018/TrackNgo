import { Head, Link, usePage, router } from '@inertiajs/react';
import { Search, ScanLine, Plus, Download, Lock, QrCode, Eye, CheckCircle2, FileSignature, CheckSquare, FileText, ArrowUp, ArrowDown, X, Inbox, Clock, Send, RotateCcw } from 'lucide-react';
import { useState, useMemo } from 'react';
import TrackngoLayout from '@/layouts/trackngo/TrackngoLayout';
import { SeverityPill } from '@/components/trackngo/SeverityPill';
import { ForwardModal } from '@/components/trackngo/ForwardModal';
import { StepDots } from '@/components/trackngo/StepProgress';
import { ArtaBadge } from '@/components/trackngo/ArtaBadge';
import { cn } from '@/lib/utils';
import CreateDocumentModal from './CreateDocumentModal';
import { ExportPasswordModal } from '@/components/trackngo/ExportPasswordModal';
import { getStandardizedStatus, StandardizedStatus, isFinalizedOrArchived } from '@/lib/status-helper';
import TablePagination from '@/components/trackngo/TablePagination';
import TabNavigation, { TabItem } from '@/components/trackngo/TabNavigation';
import TableActionButtons from '@/components/trackngo/TableActionButtons';
import { StatCard } from '@/components/trackngo/StatCard';

export default function MayorFinalApproval() {
    const { props } = usePage();
    const rawDocuments = (props.dbDocuments || []) as any[];
    const departments = (props.dbDepartments || []) as any[];
    const documentTypes = (props.dbDocumentTypes || []) as any[];
    const users = (props.dbUsers || []) as any[];

    type MayorTab = 'all' | 'for_approval' | 'approved' | 'returned';
    const [activeTab, setActiveTab] = useState<MayorTab>('all');

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedDocs, setSelectedDocs] = useState<number[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [forwardModalOpen, setForwardModalOpen] = useState(false);
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    const [filterType, setFilterType] = useState('');
    const [filterDept, setFilterDept] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
    const [exportModalOpen, setExportModalOpen] = useState(false);

    // Dynamic document list based on active tab
    const documents = useMemo(() => {
        if (activeTab === 'approved') {
            return rawDocuments.filter((doc: any) => {
                const s = (doc.status || '').toLowerCase();
                return s === 'approved' || s === 'completed';
            });
        }
        return rawDocuments.filter((doc: any) => {
            const s = (doc.status || '').toLowerCase();
            return s !== 'archived';
        });
    }, [rawDocuments, activeTab]);

    const tabCounts = useMemo(() => {
        let forApproval = 0;
        let approved = 0;
        let returned = 0;
        rawDocuments.forEach((doc: any) => {
            const s = (doc.status || '').toLowerCase();
            if (s === 'endorsed' || s === 'in_review' || s === 'pending_approval' || s === 'pending' || s === 'ongoing') {
                forApproval++;
            } else if (s === 'approved' || s === 'completed') {
                approved++;
            } else if (s === 'returned') {
                returned++;
            }
        });
        return {
            all: rawDocuments.length,
            for_approval: forApproval,
            approved: approved,
            returned: returned,
        };
    }, [rawDocuments]);

    const handleExportList = () => {
        const header = ['Ref No', 'Tracking No', 'Document Type', 'Department', 'Date Filed', 'Status'];
        const rows = filteredDocs.map((d: any) => [
            d.reference_number, d.tracking_number ?? '', d.type?.type_name ?? '',
            d.department?.department_name ?? '', d.created_at?.slice(0, 10) ?? '', getStandardizedStatus(d.status)
        ]);
        const csv = [header, ...rows].map(r => r.map((v: string) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'documents.csv';
        document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    };

    const statusOptions: StandardizedStatus[] = ['Received', 'Ongoing', 'Sent', 'Returned'];

    const filteredDocs = useMemo(() => {
        let result = documents.filter((doc: any) => {
            const stdStatus = getStandardizedStatus(doc.status);
            const rawStatus = (doc.status || '').toLowerCase();
            
            // Mayor Tab filtering logic: All, For Approval, Approved, Returned
            if (activeTab === 'for_approval') {
                if (!(rawStatus === 'endorsed' || rawStatus === 'in_review' || rawStatus === 'pending_approval' || rawStatus === 'pending' || rawStatus === 'ongoing')) {
                    return false;
                }
            } else if (activeTab === 'approved') {
                if (!(rawStatus === 'approved' || rawStatus === 'completed')) {
                    return false;
                }
            } else if (activeTab === 'returned') {
                if (rawStatus !== 'returned') {
                    return false;
                }
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

    const pendingApprovals = useMemo(() => {
        return paginatedDocs.filter((doc: any) => doc.status === 'endorsed' || doc.status === 'in_review');
    }, [paginatedDocs]);

    const activeFilterCount = [filterType, filterDept, filterStatus].filter(Boolean).length;

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedDocs(pendingApprovals.map((d: any) => d.document_id));
        } else {
            setSelectedDocs([]);
        }
    };

    const toggleDocSelection = (id: number) => {
        setSelectedDocs(prev => prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]);
    };

    const handleBulkEndorse = (destinationId: string, remarks: string) => {
        setToastMessage(`Successfully endorsed ${selectedDocs.length} documents!`);
        setForwardModalOpen(false);
        setSelectedDocs([]);
        setTimeout(() => setToastMessage(null), 3000);
    };

    const clearFilters = () => {
        setFilterType('');
        setFilterDept('');
        setFilterStatus('');
        setSearchQuery('');
        setCurrentPage(1);
    };

    return (
        <TrackngoLayout role="mayor">
            <Head title="All Documents — TrackNGo Mati" />

            <div className="space-y-5">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between shrink-0 gap-4">
                    <div>
                        <h1 className="text-[20px] font-bold text-[var(--tng-slate-900)]">Office of the Mayor — Final Approvals</h1>
                        <p className="mt-0.5 text-sm text-[var(--tng-slate-500)]">
                            Review and digitally sign approved resolutions, vouchers, and ordinances.
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 border border-slate-200 px-4 py-2 text-[14px] font-medium text-slate-700 hover:bg-slate-200 transition-colors shadow-xs">
                            <ScanLine className="h-4 w-4 text-slate-600" />
                            OCR Scan
                        </button>
                        <button
                            onClick={() => setIsCreateModalOpen(true)}
                            className="inline-flex items-center gap-2 rounded-lg bg-[#0066cc] px-4 py-2 text-[14px] font-medium text-white shadow-xs transition-all hover:bg-[#005bb5] hover:shadow-sm"
                        >
                            <Plus className="h-4 w-4 text-white" />
                            Submit Document
                        </button>
                    </div>
                </div>

                {/* ── Standardized Summary Cards (System Blue #0066cc) ── */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
                    <StatCard
                        title="Total Documents"
                        value={tabCounts.all}
                        sublabel="Executive docket"
                        icon={FileText}
                        active={activeTab === 'all'}
                        onClick={() => { setActiveTab('all'); setCurrentPage(1); }}
                    />
                    <StatCard
                        title="For Approval"
                        value={tabCounts.for_approval}
                        sublabel="Pending mayoral action"
                        icon={FileSignature}
                        active={activeTab === 'for_approval'}
                        onClick={() => { setActiveTab('for_approval'); setCurrentPage(1); }}
                    />
                    <StatCard
                        title="Approved"
                        value={tabCounts.approved}
                        sublabel="Approved & signed"
                        icon={CheckCircle2}
                        active={activeTab === 'approved'}
                        onClick={() => { setActiveTab('approved'); setCurrentPage(1); }}
                    />
                    <StatCard
                        title="Returned"
                        value={tabCounts.returned}
                        sublabel="Returned for revisions"
                        icon={RotateCcw}
                        active={activeTab === 'returned'}
                        onClick={() => { setActiveTab('returned'); setCurrentPage(1); }}
                    />
                </div>

                {/* ── Standardized Tabbed Navigation (Mayor: All, For Approval, Approved, Returned) ── */}
                <TabNavigation
                    tabs={[
                        { id: 'all', label: 'All Documents', icon: <FileText className="h-4 w-4" />, count: tabCounts.all },
                        { id: 'for_approval', label: 'For Approval', icon: <FileSignature className="h-4 w-4 text-blue-600" />, count: tabCounts.for_approval },
                        { id: 'approved', label: 'Approved', icon: <CheckCircle2 className="h-4 w-4 text-emerald-600" />, count: tabCounts.approved },
                        { id: 'returned', label: 'Returned', icon: <RotateCcw className="h-4 w-4 text-amber-600" />, count: tabCounts.returned },
                    ]}
                    activeTab={activeTab}
                    onChange={(tab) => {
                        setActiveTab(tab);
                        setCurrentPage(1);
                    }}
                />

                {toastMessage && (
                    <div className="rounded-lg bg-green-50 border border-green-200 p-4 flex items-center gap-3 text-green-700 animate-in slide-in-from-top-2">
                        <CheckCircle2 className="h-5 w-5" />
                        <span className="font-semibold text-sm">{toastMessage}</span>
                    </div>
                )}

                {/* Bulk Actions Toolbar */}
                {selectedDocs.length > 0 && (
                    <div className="rounded-xl border border-[var(--tng-blue-200)] bg-[var(--tng-blue-50)] p-4 flex items-center justify-between animate-in fade-in duration-300">
                        <div className="flex items-center gap-2">
                            <CheckSquare className="h-5 w-5 text-[var(--tng-blue-600)]" />
                            <span className="font-semibold text-[var(--tng-blue-800)]">{selectedDocs.length} documents selected</span>
                        </div>
                        <button 
                            onClick={() => setForwardModalOpen(true)}
                            className="flex items-center gap-2 rounded-lg bg-[var(--tng-blue-600)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--tng-blue-700)] shadow-md transition-all"
                        >
                            <FileSignature className="h-4 w-4" /> Batch Endorse All
                        </button>
                    </div>
                )}

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--tng-slate-400)]" />
                    <input
                        type="text"
                        placeholder="Search by reference number, tracking number, type, or name..."
                        value={searchQuery}
                        onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                        className="h-12 w-full rounded-xl border border-[var(--tng-slate-200)] bg-white pl-12 pr-4 text-sm text-[var(--tng-slate-700)] placeholder:text-[var(--tng-slate-400)] focus:border-[var(--tng-blue-500)] focus:outline-none focus:ring-2 focus:ring-[var(--tng-blue-500)]/20"
                    />
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-3">
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

                    <button onClick={() => setExportModalOpen(true)} className="ml-auto flex items-center gap-2 rounded-lg border border-[var(--tng-slate-200)] bg-white px-4 py-2 text-sm font-medium text-[var(--tng-slate-600)] transition-colors hover:bg-[var(--tng-slate-50)]">
                        <Download className="h-4 w-4" />
                        Export
                        <Lock className="h-3 w-3 text-[var(--tng-amber-500)]" />
                    </button>
                </div>

                {/* Table */}
                <div className="w-full rounded-xl border border-[var(--tng-slate-200)] bg-white shadow-xs overflow-hidden">
                    <div className="overflow-x-auto w-full">
                        <table className="w-full text-left border-collapse text-[13px] text-slate-700">
                            <thead>
                                <tr className="border-b border-[var(--tng-slate-200)] bg-[var(--tng-slate-50)]">
                                    <th className="px-4 py-3 text-left">
                                        <input
                                            type="checkbox"
                                            checked={selectedDocs.length === pendingApprovals?.length && pendingApprovals?.length > 0}
                                            onChange={handleSelectAll}
                                            className="h-4 w-4 rounded border-[var(--tng-slate-300)] text-[var(--tng-blue-600)] focus:ring-[var(--tng-blue-500)]"
                                        />
                                    </th>
                                    <th
                                        className="px-4 py-3 text-left text-[14px] font-normal text-slate-600 cursor-pointer select-none hover:text-[#0066cc] transition-colors"
                                        onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
                                    >
                                        <span className="flex items-center gap-1">
                                            Ref No.
                                            {sortDir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
                                        </span>
                                    </th>
                                    <th className="px-4 py-3 text-left text-[14px] font-normal text-slate-600">
                                        Document Type
                                    </th>
                                    <th className="px-4 py-3 text-left text-[14px] font-normal text-slate-600">
                                        Department
                                    </th>
                                    <th className="px-4 py-3 text-left text-[14px] font-normal text-slate-600">
                                        Date Filed
                                    </th>
                                    <th className="px-4 py-3 text-left text-[14px] font-normal text-slate-600">
                                        Step Progress
                                    </th>
                                    <th className="px-4 py-3 text-left text-[14px] font-normal text-slate-600">
                                        Status
                                    </th>
                                    <th className="px-4 py-3 text-left text-[14px] font-normal text-slate-600">
                                        ARTA
                                    </th>
                                    <th className="px-4 py-3 text-center text-[14px] font-normal text-slate-600">
                                        QR
                                    </th>
                                    <th className="px-4 py-3 text-right text-[14px] font-normal text-slate-600">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--tng-slate-200)]">
                                {paginatedDocs.map((doc: any) => (
                                    <tr
                                        key={doc.document_id}
                                        className="group transition-colors odd:bg-white even:bg-slate-50/75 hover:bg-blue-50/40"
                                    >
                                        <td className="px-4 py-3">
                                            <input
                                                type="checkbox"
                                                checked={selectedDocs.includes(doc.document_id)}
                                                onChange={() => toggleDocSelection(doc.document_id)}
                                                className="h-4 w-4 rounded border-[var(--tng-slate-300)] text-[var(--tng-blue-600)] focus:ring-[var(--tng-blue-500)]"
                                            />
                                        </td>
                                        <td className="px-4 py-3 text-[13px] font-normal text-slate-700">
                                            <Link
                                                href={`/mayor/documents/${doc.document_id}`}
                                                className="text-[13px] font-normal text-[#0066cc] hover:underline"
                                            >
                                                {doc.reference_number}
                                            </Link>
                                            <p className="text-[12px] text-slate-500 mt-0.5">{doc.tracking_number}</p>
                                        </td>
                                        <td className="px-4 py-3 text-[13px] font-normal text-slate-700">
                                            {doc.type?.type_name || 'N/A'}
                                        </td>
                                        <td className="px-4 py-3 text-[13px] font-normal text-slate-600">
                                            {doc.department?.department_name || 'N/A'}
                                        </td>
                                        <td className="px-4 py-3 text-[13px] font-normal text-slate-600">
                                            {doc.date_filed || doc.created_at ? new Date(doc.date_filed || doc.created_at).toLocaleDateString('en-US', {
                                                month: 'short',
                                                day: '2-digit',
                                                year: 'numeric',
                                            }) : 'N/A'}
                                        </td>
                                        <td className="px-4 py-3">
                                            <StepDots current={doc.current_step_index} total={7} />
                                        </td>
                                        <td className="px-4 py-3">
                                            <SeverityPill status={doc.status} />
                                        </td>
                                        <td className="px-4 py-3">
                                            <ArtaBadge daysLeft={doc.arta_days_left ?? 3} threshold={doc.type?.arta_processing_days ?? 3} />
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <button className="rounded-lg p-2 text-[var(--tng-slate-400)] transition-all hover:bg-slate-50 hover:text-[#0066cc] focus:outline-none focus:ring-2 focus:ring-blue-400/50" title="View QR Code" aria-label="View QR">
                                                <QrCode className="h-[18px] w-[18px]" />
                                            </button>
                                        </td>
                                        <td className="px-4 py-3 text-right whitespace-nowrap">
                                            <TableActionButtons
                                                editHref={`/mayor/documents/${doc.document_id}`}
                                                editTitle="Edit Record"
                                                onDelete={() => {
                                                    if (confirm(`Are you sure you want to delete document ${doc.reference_number}?`)) {
                                                        router.delete(`/documents/${doc.document_id}`);
                                                    }
                                                }}
                                                deleteTitle="Delete Record"
                                                extraActions={
                                                    <Link
                                                        href={`/mayor/documents/${doc.document_id}`}
                                                        title="Review Document"
                                                        aria-label="Review Document"
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

                    {filteredDocs.length === 0 && (
                        <div className="py-12 text-center">
                            <FileText className="mx-auto h-12 w-12 text-[var(--tng-slate-300)]" />
                            <p className="mt-3 text-sm text-[var(--tng-slate-500)]">
                                No documents found matching your search.
                            </p>
                            {activeFilterCount > 0 && (
                                <button onClick={clearFilters} className="mt-2 text-sm text-[var(--tng-blue-600)] hover:underline">
                                    Clear all filters
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
            </div>

            {/* Forward Modal for Batch Action */}
            <ForwardModal
                open={forwardModalOpen}
                onClose={() => setForwardModalOpen(false)}
                onForward={handleBulkEndorse}
                onConfirm={(_type, destId, rem) => handleBulkEndorse(destId, rem)}
                departments={departments}
                users={users}
                defaultRemarks="Digitally signed and approved by the Mayor's Office."
            />
            
            <CreateDocumentModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                departments={departments}
                documentTypes={documentTypes}
                users={users}
            />

            <ExportPasswordModal
                isOpen={exportModalOpen}
                onClose={() => setExportModalOpen(false)}
                documentId={0}
                onSuccess={(msg) => { handleExportList(); setToastMessage(msg); setTimeout(() => setToastMessage(null), 3500); }}
            />
        </TrackngoLayout>
    );
}
