import { Head, Link, usePage } from '@inertiajs/react';
import { Search, ScanLine, Plus, Download, Lock, QrCode, Eye, ArrowUp, ArrowDown, X, FileText, Inbox, Clock, Send, RotateCcw } from 'lucide-react';
import { useState, useMemo } from 'react';
import TrackngoLayout from '@/layouts/trackngo/TrackngoLayout';
import { SeverityPill } from '@/components/trackngo/SeverityPill';
import { StepDots } from '@/components/trackngo/StepProgress';
import { ArtaBadge } from '@/components/trackngo/ArtaBadge';
import { cn } from '@/lib/utils';
import CreateDocumentModal from './CreateDocumentModal';
import { ExportPasswordModal } from '@/components/trackngo/ExportPasswordModal';
import { getStandardizedStatus, StandardizedStatus, isFinalizedOrArchived } from '@/lib/status-helper';
import TablePagination from '@/components/trackngo/TablePagination';
import TabNavigation, { TabItem } from '@/components/trackngo/TabNavigation';

export default function ReceivingDocumentsIndex() {
    const { props } = usePage();
    const rawDocuments = (props.dbDocuments || []) as any[];
    const documents = rawDocuments;
    const departments = (props.dbDepartments || []) as any[];
    const documentTypes = (props.dbDocumentTypes || []) as any[];
    const users = (props.dbUsers || []) as any[];

    type ReceivingTab = 'all' | 'received' | 'forwarded' | 'returned';
    const [activeTab, setActiveTab] = useState<ReceivingTab>('all');

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    
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
        let received = 0;
        let forwarded = 0;
        let returned = 0;
        rawDocuments.forEach((doc: any) => {
            const s = (doc.status || '').toLowerCase();
            if (s === 'received' || s === 'pending') {
                received++;
            } else if (s === 'forwarded' || s === 'sent' || s === 'endorsed' || s === 'in_transit') {
                forwarded++;
            } else if (s === 'returned') {
                returned++;
            }
        });
        return {
            all: rawDocuments.length,
            received,
            forwarded,
            returned,
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
            
            // Receiving Clerk Tab filtering: All, Received, Forwarded, Returned
            if (activeTab === 'received') {
                if (rawStatus !== 'received' && rawStatus !== 'pending') return false;
            } else if (activeTab === 'forwarded') {
                if (rawStatus !== 'forwarded' && rawStatus !== 'sent' && rawStatus !== 'endorsed' && rawStatus !== 'in_transit') return false;
            } else if (activeTab === 'returned') {
                if (rawStatus !== 'returned') return false;
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

    const toggleSelect = (id: number) => {
        setSelectedIds((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        );
    };

    const toggleAll = () => {
        if (selectedIds.length === filteredDocs.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(filteredDocs.map((d: any) => d.document_id));
        }
    };

    const clearFilters = () => {
        setFilterType('');
        setFilterDept('');
        setFilterStatus('');
        setSearchQuery('');
        setCurrentPage(1);
    };

    return (
        <TrackngoLayout>
            <Head title="My Documents — TrackNGo Mati" />

            <div className="space-y-5">
                {/* Header */}
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <h1 className="text-[20px] font-bold text-[var(--tng-slate-900)]">
                            My Documents
                        </h1>
                        <p className="mt-0.5 text-sm text-[var(--tng-slate-500)]">
                            {filteredDocs.length} of {documents.length} records
                            {activeFilterCount > 0 && <span className="ml-1 text-[var(--tng-blue-600)]">({activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''} active)</span>}
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button className="flex items-center gap-2 rounded-lg border border-[var(--tng-blue-200)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--tng-blue-700)] transition-colors hover:bg-[var(--tng-blue-50)]">
                            <ScanLine className="h-4 w-4" />
                            OCR Scan
                        </button>
                        <button
                            onClick={() => setIsCreateModalOpen(true)}
                            className="flex items-center gap-2 rounded-lg bg-[var(--tng-blue-600)] px-4 py-2.5 text-sm font-medium text-white shadow-md shadow-blue-600/25 transition-all hover:bg-[var(--tng-blue-700)] hover:shadow-lg"
                        >
                            <Plus className="h-4 w-4" />
                            Submit New Document
                        </button>
                    </div>
                </div>

                {/* ── Standardized Tabbed Navigation (Receiving Clerk: All, Received, Forwarded, Returned) ── */}
                <TabNavigation
                    tabs={[
                        { id: 'all', label: 'All Documents', icon: <FileText className="h-4 w-4" />, count: tabCounts.all },
                        { id: 'received', label: 'Received', icon: <Inbox className="h-4 w-4 text-blue-600" />, count: tabCounts.received },
                        { id: 'forwarded', label: 'Forwarded', icon: <Send className="h-4 w-4 text-purple-600" />, count: tabCounts.forwarded },
                        { id: 'returned', label: 'Returned', icon: <RotateCcw className="h-4 w-4 text-amber-600" />, count: tabCounts.returned },
                    ]}
                    activeTab={activeTab}
                    onChange={(tab) => {
                        setActiveTab(tab);
                        setCurrentPage(1);
                    }}
                />

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
                <div className="w-full overflow-hidden rounded-xl border border-[var(--tng-slate-200)] bg-white shadow-xs">
                    <div className="overflow-x-auto w-full">
                        <table className="w-full text-left border-collapse text-[14px] text-slate-700">
                            <thead>
                                <tr className="border-b border-[var(--tng-slate-200)] bg-[var(--tng-slate-50)]">
                                    <th className="px-4 py-2.5 text-left">
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.length === filteredDocs.length && filteredDocs.length > 0}
                                            onChange={toggleAll}
                                            className="h-4 w-4 rounded border-[var(--tng-slate-300)] text-[var(--tng-blue-600)] focus:ring-[var(--tng-blue-500)]"
                                        />
                                    </th>
                                    <th
                                        className="px-4 py-2.5 text-left text-xs font-medium text-slate-600 cursor-pointer select-none hover:text-[var(--tng-blue-600)] transition-colors"
                                        onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
                                    >
                                        <span className="flex items-center gap-1">
                                            Ref No.
                                            {sortDir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
                                        </span>
                                    </th>
                                    <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-600">
                                        Document Type
                                    </th>
                                    <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-600">
                                        Department
                                    </th>
                                    <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-600">
                                        Date Filed
                                    </th>
                                    <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-600">
                                        Step Progress
                                    </th>
                                    <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-600">
                                        Status
                                    </th>
                                    <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-600">
                                        ARTA
                                    </th>
                                    <th className="px-4 py-2.5 text-center text-xs font-medium text-slate-600">
                                        QR
                                    </th>
                                    <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-600">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--tng-slate-100)]">
                                {paginatedDocs.map((doc: any, idx: number) => (
                                    <tr
                                        key={doc.document_id}
                                        className="group transition-colors odd:bg-white even:bg-slate-50/75 hover:bg-blue-50/40"
                                        style={{ animationDelay: `${idx * 40}ms` }}
                                    >
                                        <td className="px-4 py-3.5">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.includes(doc.document_id)}
                                                onChange={() => toggleSelect(doc.document_id)}
                                                className="h-4 w-4 rounded border-[var(--tng-slate-300)] text-[var(--tng-blue-600)] focus:ring-[var(--tng-blue-500)]"
                                            />
                                        </td>
                                        <td className="px-4 py-3.5 text-[14px] font-normal text-[var(--tng-slate-700)]">
                                            <Link
                                                href={`/receiving/documents/${doc.document_id}`}
                                                className="text-[14px] font-semibold text-[var(--tng-blue-600)] hover:underline"
                                            >
                                                {doc.reference_number}
                                            </Link>
                                            <p className="text-[12px] text-[var(--tng-slate-400)] mt-0.5">{doc.tracking_number}</p>
                                        </td>
                                        <td className="px-4 py-3.5 text-[14px] font-normal text-[var(--tng-slate-700)]">
                                            {doc.type?.type_name || 'N/A'}
                                        </td>
                                        <td className="px-4 py-3.5 text-[14px] font-normal text-[var(--tng-slate-600)]">
                                            {doc.department?.department_name || 'N/A'}
                                        </td>
                                        <td className="px-4 py-3.5 text-[14px] font-normal text-[var(--tng-slate-600)]">
                                            {new Date(doc.date_filed || doc.created_at).toLocaleDateString('en-US', {
                                                month: 'short',
                                                day: '2-digit',
                                                year: 'numeric',
                                            })}
                                        </td>
                                        <td className="px-4 py-3.5">
                                            <StepDots current={doc.current_step_index} total={7} />
                                        </td>
                                        <td className="px-4 py-3.5">
                                            <SeverityPill status={doc.status} />
                                        </td>
                                        <td className="px-4 py-3.5">
                                            <ArtaBadge daysLeft={doc.arta_days_left ?? 3} threshold={doc.type?.arta_processing_days ?? 3} />
                                        </td>
                                        <td className="px-4 py-3.5 text-center">
                                            <button className="rounded-lg p-2 text-[var(--tng-slate-400)] transition-all hover:bg-slate-100 hover:text-[var(--tng-blue-600)] focus:outline-none focus:ring-2 focus:ring-blue-400/50" title="View QR Code" aria-label="View QR">
                                                <QrCode className="h-[18px] w-[18px]" />
                                            </button>
                                        </td>
                                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                                            <div className="flex items-center justify-end gap-1">
                                                <Link
                                                    href={`/receiving/documents/${doc.document_id}`}
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
