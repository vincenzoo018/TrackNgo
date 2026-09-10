import { Head, Link, usePage } from '@inertiajs/react';
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
import { getStandardizedStatus, StandardizedStatus } from '@/lib/status-helper';

export default function MayorFinalApproval() {
    const { props } = usePage();
    const documents = (props.dbDocuments || []) as any[];
    const departments = (props.dbDepartments || []) as any[];
    const documentTypes = (props.dbDocumentTypes || []) as any[];
    const users = (props.dbUsers || []) as any[];

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedDocs, setSelectedDocs] = useState<number[]>([]);
    const [forwardModalOpen, setForwardModalOpen] = useState(false);
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    
    const [activeTab, setActiveTab] = useState<'all' | 'received' | 'ongoing' | 'sent' | 'returned'>('all');

    const [filterType, setFilterType] = useState('');
    const [filterDept, setFilterDept] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
    const [exportModalOpen, setExportModalOpen] = useState(false);

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

    const pendingApprovals = filteredDocs.filter((doc: any) => doc.status === 'endorsed' || doc.status === 'in_review');
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
    };

    return (
        <TrackngoLayout role="mayor">
            <Head title="All Documents — TrackNGo Mati" />

            <div className="space-y-5">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between shrink-0 gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-[var(--tng-slate-900)]">Office of the Mayor — Final Approvals</h1>
                        <p className="mt-0.5 text-sm text-[var(--tng-slate-500)]">
                            Review and digitally sign approved resolutions, vouchers, and ordinances.
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
                            Submit Document
                        </button>
                    </div>
                </div>

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
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-12 w-full rounded-xl border border-[var(--tng-slate-200)] bg-white pl-12 pr-4 text-sm text-[var(--tng-slate-700)] placeholder:text-[var(--tng-slate-400)] focus:border-[var(--tng-blue-500)] focus:outline-none focus:ring-2 focus:ring-[var(--tng-blue-500)]/20"
                    />
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-3">
                    <select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                        className="rounded-lg border border-[var(--tng-slate-200)] bg-white px-3 py-2 text-sm text-[var(--tng-slate-600)] hover:border-[var(--tng-blue-300)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--tng-blue-500)]/20"
                    >
                        <option value="">All Document Types</option>
                        {documentTypes.map((t: any) => (
                            <option key={t.type_id} value={t.type_id}>{t.type_name}</option>
                        ))}
                    </select>

                    <select
                        value={filterDept}
                        onChange={(e) => setFilterDept(e.target.value)}
                        className="rounded-lg border border-[var(--tng-slate-200)] bg-white px-3 py-2 text-sm text-[var(--tng-slate-600)] hover:border-[var(--tng-blue-300)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--tng-blue-500)]/20"
                    >
                        <option value="">All Departments</option>
                        {departments.map((d: any) => (
                            <option key={d.department_id} value={d.department_id}>{d.department_name}</option>
                        ))}
                    </select>

                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
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
                <div className="overflow-hidden rounded-xl border border-[var(--tng-slate-200)] bg-white">
                    <div className="overflow-x-auto">
                        <table className="w-full">
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
                                        className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--tng-slate-500)] cursor-pointer select-none hover:text-[var(--tng-blue-600)] transition-colors"
                                        onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
                                    >
                                        <span className="flex items-center gap-1">
                                            Ref No.
                                            {sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                                        </span>
                                    </th>
                                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--tng-slate-500)]">
                                        Document Type
                                    </th>
                                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--tng-slate-500)]">
                                        Department
                                    </th>
                                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--tng-slate-500)]">
                                        Date Filed
                                    </th>
                                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--tng-slate-500)]">
                                        Step Progress
                                    </th>
                                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--tng-slate-500)]">
                                        Status
                                    </th>
                                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--tng-slate-500)]">
                                        ARTA
                                    </th>
                                    <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-[var(--tng-slate-500)]">
                                        QR
                                    </th>
                                    <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-[var(--tng-slate-500)]">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--tng-slate-100)]">
                                {filteredDocs.map((doc: any, idx: number) => (
                                    <tr
                                        key={doc.document_id}
                                        className="group transition-colors hover:bg-[var(--tng-blue-50)]/50"
                                        style={{ animationDelay: `${idx * 40}ms` }}
                                    >
                                        <td className="px-4 py-3">
                                            <input
                                                type="checkbox"
                                                checked={selectedDocs.includes(doc.document_id)}
                                                onChange={() => toggleDocSelection(doc.document_id)}
                                                className="h-4 w-4 rounded border-[var(--tng-slate-300)] text-[var(--tng-blue-600)] focus:ring-[var(--tng-blue-500)]"
                                            />
                                        </td>
                                        <td className="px-4 py-3">
                                            <Link
                                                href={`/mayor/documents/${doc.document_id}`}
                                                className="text-sm font-semibold text-[var(--tng-blue-600)] hover:underline"
                                            >
                                                {doc.reference_number}
                                            </Link>
                                            <p className="text-[10px] text-[var(--tng-slate-400)] mt-0.5">{doc.tracking_number}</p>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-[var(--tng-slate-700)]">
                                            {doc.type?.type_name || 'N/A'}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-[var(--tng-slate-600)]">
                                            {doc.department?.department_name || 'N/A'}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-[var(--tng-slate-600)]">
                                            {new Date(doc.date_filed || doc.created_at).toLocaleDateString('en-US', {
                                                month: 'short',
                                                day: '2-digit',
                                                year: 'numeric',
                                            })}
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
                                            <button className="rounded-md p-1.5 text-[var(--tng-slate-400)] transition-colors hover:bg-[var(--tng-slate-100)] hover:text-[var(--tng-blue-600)]">
                                                <QrCode className="h-4 w-4" />
                                            </button>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <Link
                                                href={`/mayor/documents/${doc.document_id}`}
                                                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--tng-blue-600)] px-3 py-1.5 text-xs font-medium text-white transition-all hover:bg-[var(--tng-blue-700)] hover:shadow-md"
                                            >
                                                <Eye className="h-3.5 w-3.5" />
                                                Review
                                            </Link>
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
                </div>
            </div>

            {/* Forward Modal for Batch Action */}
            <ForwardModal
                open={forwardModalOpen}
                onClose={() => setForwardModalOpen(false)}
                onForward={handleBulkEndorse}
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
