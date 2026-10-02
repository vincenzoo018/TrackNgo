import { Link, router } from '@inertiajs/react';
import { Lock, Search } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { ArtaBadge } from '@/components/trackngo/ArtaBadge';
import { BaseModal } from '@/components/trackngo/BaseModal';
import { ExportPasswordModal } from '@/components/trackngo/ExportPasswordModal';
import { SeverityPill } from '@/components/trackngo/SeverityPill';
import { StepDots } from '@/components/trackngo/StepProgress';
import TablePagination from '@/components/trackngo/TablePagination';
import { getArtaDaysLeft } from '@/lib/arta';
import { qrDataUrl, useTrackingLink } from '@/lib/qr';
import type { StandardizedStatus } from '@/lib/status-helper';
import { getStandardizedStatus } from '@/lib/status-helper';
import { cn } from '@/lib/utils';

export type DocumentListTab = {
    id: string;
    label: string;
    match: (doc: any) => boolean;
};

export type DocumentListViewProps = {
    title: string;
    subtitle?: string;
    documents: any[];
    departments: any[];
    documentTypes: any[];
    /** e.g. "/receiving/documents"; rows open `${basePath}/${id}` */
    basePath: string;
    /** Documents the signed-in user must act on (shown first, in the default "Needs Action" tab) */
    needsAction: (doc: any) => boolean;
    /** Name of the first tab (default "Needs Action"; the Mayor's is "For Approval") */
    needsActionLabel?: string;
    /** Role-specific tabs shown after "Needs Action" and "All" */
    tabs: DocumentListTab[];
    allLabel?: string;
    /** Which documents the "All" tab lists (e.g. Admin keeps finished documents under "Archived") */
    allFilter?: (doc: any) => boolean;
    createLabel?: string;
    onCreate?: () => void;
    /** Delete endpoint for roles that have one (Admin) */
    deleteUrl?: (doc: any) => string;
    exportFileName: string;
    /** Extra line under the status pill (e.g. the Mayor's "Waiting to be routed") */
    rowNote?: (doc: any) => React.ReactNode;
    /** Bulk action on the selected rows (e.g. the Mayor's batch endorse) */
    bulkAction?: { label: string; run: (ids: number[]) => void };
    statusOptions?: StandardizedStatus[];
};

type SortKey = 'date' | 'ref';

const filterSelect = 'h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-600 focus:border-[var(--tng-blue-500)] focus:outline-none focus:ring-2 focus:ring-[var(--tng-blue-500)]/20';
const textButton = 'rounded-md px-2 py-1 text-[13px] font-medium transition-colors';

function filedTime(doc: any): number {
    const t = new Date(doc.date_filed || doc.created_at || 0).getTime();
    return isNaN(t) ? 0 : t;
}

function formatDate(doc: any): string {
    const t = filedTime(doc);
    return t ? new Date(t).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : 'N/A';
}

export function DocumentListView({
    title,
    subtitle,
    documents,
    departments,
    documentTypes,
    basePath,
    needsAction,
    needsActionLabel = 'Needs Action',
    tabs,
    allLabel = 'All Documents',
    allFilter = () => true,
    createLabel,
    onCreate,
    deleteUrl,
    exportFileName,
    rowNote,
    bulkAction,
    statusOptions = ['Received', 'Ongoing', 'Sent', 'Returned'],
}: DocumentListViewProps) {
    const [activeTab, setActiveTab] = useState('needs_action');
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState('');
    const [filterDept, setFilterDept] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [sortKey, setSortKey] = useState<SortKey>('date');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [qrDoc, setQrDoc] = useState<any | null>(null);
    const trackingLinkFor = useTrackingLink();
    const [exportOpen, setExportOpen] = useState(false);
    const [toast, setToast] = useState<string | null>(null);
    // Row just submitted from the create modal: highlighted briefly
    const [highlightId, setHighlightId] = useState<number | null>(null);

    // Real-time auto sync: reload dbDocuments on workflow events and poll every 4s
    useEffect(() => {
        const reload = () => router.reload({ only: ['dbDocuments'] });
        const handleSent = (e: Event) => {
            reload();
            const created = (e as CustomEvent).detail;
            if (created?.document_id) {
                setActiveTab('all');
                setCurrentPage(1);
                setHighlightId(Number(created.document_id));
            }
        };
        window.addEventListener('tng:document-received', reload);
        window.addEventListener('tng:document-sent', handleSent);
        window.addEventListener('tng:fsm-refresh', reload);
        const interval = setInterval(reload, 4000);

        return () => {
            window.removeEventListener('tng:document-received', reload);
            window.removeEventListener('tng:document-sent', handleSent);
            window.removeEventListener('tng:fsm-refresh', reload);
            clearInterval(interval);
        };
    }, []);

    useEffect(() => {
        if (highlightId === null) {
            return;
        }
        const timer = setTimeout(() => setHighlightId(null), 8000);
        return () => clearTimeout(timer);
    }, [highlightId]);

    const showToast = (message: string) => {
        setToast(message);
        setTimeout(() => setToast(null), 3500);
    };

    const allTabs: DocumentListTab[] = useMemo(() => [
        { id: 'needs_action', label: needsActionLabel, match: needsAction },
        { id: 'all', label: allLabel, match: allFilter },
        ...tabs,
    ], [needsAction, needsActionLabel, allLabel, allFilter, tabs]);

    const tabCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        allTabs.forEach(tab => {
            counts[tab.id] = documents.filter(tab.match).length;
        });
        return counts;
    }, [allTabs, documents]);

    const filteredDocs = useMemo(() => {
        const tab = allTabs.find(t => t.id === activeTab) ?? allTabs[1];
        const q = searchQuery.trim().toLowerCase();

        const result = documents.filter((doc: any) => {
            if (!tab.match(doc)) {
                return false;
            }
            const stdStatus = getStandardizedStatus(doc.status);
            const matchesSearch = !q || [
                doc.reference_number, doc.tracking_number, doc.title, doc.sender, doc.submitter?.name,
                doc.department?.department_name, doc.type?.type_name, stdStatus, doc.status,
            ].some(v => String(v || '').toLowerCase().includes(q));

            return matchesSearch &&
                (!filterType || String(doc.type_id) === filterType) &&
                (!filterDept || String(doc.department_id) === filterDept) &&
                (!filterStatus || stdStatus === filterStatus);
        });

        result.sort((a: any, b: any) => {
            if (highlightId !== null) {
                if (a.document_id === highlightId) {
                    return -1;
                }
                if (b.document_id === highlightId) {
                    return 1;
                }
            }
            const diff = sortKey === 'date'
                ? filedTime(a) - filedTime(b) || a.document_id - b.document_id
                : String(a.reference_number || '').localeCompare(String(b.reference_number || ''));
            return sortDir === 'asc' ? diff : -diff;
        });

        return result;
    }, [documents, allTabs, activeTab, searchQuery, filterType, filterDept, filterStatus, sortKey, sortDir, highlightId]);

    const paginatedDocs = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredDocs.slice(start, start + pageSize);
    }, [filteredDocs, currentPage, pageSize]);

    const activeFilterCount = [filterType, filterDept, filterStatus, searchQuery.trim()].filter(Boolean).length;

    const changeTab = (id: string) => {
        setActiveTab(id);
        setCurrentPage(1);
        setSelectedIds([]);
    };

    const toggleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortKey(key);
            setSortDir(key === 'date' ? 'desc' : 'asc');
        }
    };

    const clearFilters = () => {
        setFilterType('');
        setFilterDept('');
        setFilterStatus('');
        setSearchQuery('');
        setCurrentPage(1);
    };

    const pageIds = paginatedDocs.map((d: any) => d.document_id);
    const allPageSelected = pageIds.length > 0 && pageIds.every((id: number) => selectedIds.includes(id));
    const toggleSelect = (id: number) => setSelectedIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
    const togglePage = () => setSelectedIds(prev => (allPageSelected ? prev.filter(id => !pageIds.includes(id)) : Array.from(new Set([...prev, ...pageIds]))));

    // CSV of the selected rows, or of the current list when nothing is selected
    const exportCsv = () => {
        const rows = selectedIds.length ? filteredDocs.filter((d: any) => selectedIds.includes(d.document_id)) : filteredDocs;
        const header = ['Ref No', 'Tracking No', 'Title', 'From', 'Document Type', 'Department', 'Date Filed', 'Status'];
        const lines = rows.map((d: any) => [
            d.reference_number, d.tracking_number ?? '', d.title ?? '', d.sender ?? d.submitter?.name ?? '',
            d.type?.type_name ?? '', d.department?.department_name ?? '', (d.date_filed || d.created_at || '').slice(0, 10),
            getStandardizedStatus(d.status),
        ]);
        const csv = [header, ...lines].map(r => r.map((v: string) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
        const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = exportFileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const qrValue = qrDoc ? (qrDoc.tracking_number || qrDoc.reference_number) : '';
    // Scanning opens the public tracking page for this document
    const qrLink = qrValue ? trackingLinkFor(qrValue) : '';
    const qrImage = qrValue ? qrDataUrl(qrLink) : '';

    const printQr = () => {
        const win = window.open('', '_blank', 'width=420,height=560');
        if (!win || !qrDoc) {
            return;
        }
        win.document.write(`<html><head><title>${qrValue}</title></head><body style="font-family:sans-serif;text-align:center;padding:24px">
            <img src="${qrImage}" style="width:240px;height:240px" onload="window.print()" />
            <h2 style="margin:12px 0 4px">${qrValue}</h2><p style="margin:0;color:#555">${qrDoc.reference_number}</p>
            <p style="margin:6px 0 0;font-size:11px;color:#777;word-break:break-all">${qrLink}</p>
            <p style="color:#333">${String(qrDoc.title || '').replace(/</g, '&lt;')}</p></body></html>`);
        win.document.close();
    };

    const emptyMessage = activeTab === 'needs_action'
        ? 'Nothing needs your action right now.'
        : 'No documents found.';

    return (
        <>
            {toast && (
                <div className="fixed top-4 right-4 z-50 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-medium text-white shadow-lg">{toast}</div>
            )}

            <div className="space-y-5">
                {/* Header */}
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <h1 className="text-[20px] font-bold text-slate-900">{title}</h1>
                        <p className="mt-0.5 text-sm text-slate-500">
                            {subtitle ?? `${tabCounts.needs_action ?? 0} need your action · ${tabCounts.all ?? 0} documents`}
                        </p>
                    </div>
                    {onCreate && (
                        <button
                            type="button"
                            onClick={onCreate}
                            className="rounded-lg bg-[#0066cc] px-4 py-2 text-[14px] font-medium text-white shadow-xs transition-colors hover:bg-[#005bb5]"
                        >
                            {createLabel ?? 'Submit New Document'}
                        </button>
                    )}
                </div>

                {/* Tabs */}
                <div className="flex gap-1 overflow-x-auto border-b border-slate-200">
                    {allTabs.map(tab => (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => changeTab(tab.id)}
                            className={cn(
                                '-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-[14px] font-medium transition-colors',
                                activeTab === tab.id
                                    ? 'border-[#0066cc] text-[#0066cc]'
                                    : 'border-transparent text-slate-500 hover:text-slate-800'
                            )}
                        >
                            {tab.label}
                            <span className={cn(
                                'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                                tab.id === 'needs_action' && (tabCounts[tab.id] ?? 0) > 0
                                    ? 'bg-[#0066cc] text-white'
                                    : 'bg-slate-100 text-slate-600'
                            )}>
                                {tabCounts[tab.id] ?? 0}
                            </span>
                        </button>
                    ))}
                </div>

                {/* Search & filters */}
                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative min-w-[240px] flex-1">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search by reference no., tracking no., title, sender, or office..."
                            value={searchQuery}
                            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                            className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-[var(--tng-blue-500)] focus:outline-none focus:ring-2 focus:ring-[var(--tng-blue-500)]/20"
                        />
                    </div>
                    <select value={filterType} onChange={(e) => { setFilterType(e.target.value); setCurrentPage(1); }} className={filterSelect}>
                        <option value="">All Document Types</option>
                        {documentTypes.map((t: any) => <option key={t.type_id} value={t.type_id}>{t.type_name}</option>)}
                    </select>
                    <select value={filterDept} onChange={(e) => { setFilterDept(e.target.value); setCurrentPage(1); }} className={cn(filterSelect, 'max-w-[260px]')}>
                        <option value="">All Departments</option>
                        {departments.map((d: any) => <option key={d.department_id} value={d.department_id}>{d.department_name}</option>)}
                    </select>
                    <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(1); }} className={filterSelect}>
                        <option value="">All Statuses</option>
                        {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    {activeFilterCount > 0 && (
                        <button type="button" onClick={clearFilters} className="h-10 rounded-lg px-3 text-sm font-medium text-red-600 hover:bg-red-50">
                            Clear Filters
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => setExportOpen(true)}
                        className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 hover:bg-slate-50"
                        title="Password-protected export"
                    >
                        {selectedIds.length ? `Export Selected (${selectedIds.length})` : 'Export'}
                    </button>
                </div>

                {/* Selection bar */}
                {selectedIds.length > 0 && (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5">
                        <span className="text-sm font-medium text-blue-900">{selectedIds.length} selected</span>
                        <div className="flex items-center gap-2">
                            {bulkAction && (
                                <button type="button" onClick={() => bulkAction.run(selectedIds)} className="rounded-lg bg-[#0066cc] px-3.5 py-1.5 text-sm font-medium text-white hover:bg-[#005bb5]">
                                    {bulkAction.label}
                                </button>
                            )}
                            <button type="button" onClick={() => setSelectedIds([])} className="rounded-lg px-3 py-1.5 text-sm font-medium text-blue-800 hover:bg-blue-100">
                                Clear Selection
                            </button>
                        </div>
                    </div>
                )}

                {/* Table */}
                <div className="w-full overflow-hidden rounded-lg border border-slate-200 bg-white">
                    <div className="w-full overflow-x-auto">
                        <table className="w-full border-collapse text-left text-[13px] text-slate-700">
                            <thead>
                                <tr className="border-b border-slate-200 bg-slate-50 text-[13px] text-slate-500 whitespace-nowrap">
                                    <th className="w-10 px-4 py-3">
                                        <input
                                            type="checkbox"
                                            checked={allPageSelected}
                                            onChange={togglePage}
                                            aria-label="Select all on this page"
                                            className="h-4 w-4 rounded border-slate-300 text-[#0066cc]"
                                        />
                                    </th>
                                    <th className="px-4 py-3 font-medium">
                                        <button type="button" onClick={() => toggleSort('ref')} className="hover:text-[#0066cc]">
                                            Document {sortKey === 'ref' && (sortDir === 'asc' ? '↑' : '↓')}
                                        </button>
                                    </th>
                                    <th className="px-4 py-3 font-medium">From</th>
                                    <th className="px-4 py-3 font-medium">Document Type</th>
                                    <th className="px-4 py-3 font-medium">Department</th>
                                    <th className="px-4 py-3 font-medium whitespace-nowrap">
                                        <button type="button" onClick={() => toggleSort('date')} className="hover:text-[#0066cc]">
                                            Date Filed {sortKey === 'date' && (sortDir === 'asc' ? '↑' : '↓')}
                                        </button>
                                    </th>
                                    <th className="px-4 py-3 font-medium">Step Progress</th>
                                    <th className="px-4 py-3 font-medium">Status</th>
                                    <th className="px-4 py-3 font-medium">ARTA</th>
                                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {paginatedDocs.map((doc: any) => {
                                    const url = `${basePath}/${doc.document_id}`;
                                    const mine = needsAction(doc);
                                    return (
                                        <tr
                                            key={doc.document_id}
                                            onClick={() => router.visit(url)}
                                            className={cn(
                                                'cursor-pointer transition-colors hover:bg-blue-50/50',
                                                mine && 'bg-blue-50/30',
                                                doc.document_id === highlightId && 'bg-emerald-50! ring-1 ring-inset ring-emerald-300'
                                            )}
                                        >
                                            <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedIds.includes(doc.document_id)}
                                                    onChange={() => toggleSelect(doc.document_id)}
                                                    aria-label={`Select ${doc.reference_number}`}
                                                    className="h-4 w-4 rounded border-slate-300 text-[#0066cc]"
                                                />
                                            </td>
                                            <td className="px-4 py-3 max-w-[300px]">
                                                <Link href={url} onClick={(e) => e.stopPropagation()} className="font-medium text-[#0066cc] hover:underline">
                                                    {doc.reference_number}
                                                </Link>
                                                {doc.is_confidential_hidden ? (
                                                    <p className="mt-0.5 flex items-center gap-1 text-[13px] italic text-slate-500" title="Only the sender and recipients can open this document">
                                                        <Lock className="h-3 w-3 shrink-0 text-red-500" />
                                                        {doc.title}
                                                    </p>
                                                ) : (
                                                    <p className="mt-0.5 truncate text-[13px] text-slate-800" title={doc.title}>{doc.title}</p>
                                                )}
                                                {doc.tracking_number && <p className="text-[12px] text-slate-400">{doc.tracking_number}</p>}
                                            </td>
                                            <td className="px-4 py-3 min-w-[150px] text-slate-700">{doc.sender || doc.submitter?.name || 'N/A'}</td>
                                            <td className="px-4 py-3">{doc.type?.type_name || 'N/A'}</td>
                                            <td className="px-4 py-3 text-slate-600 min-w-[180px]">{doc.department?.department_name || 'N/A'}</td>
                                            <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatDate(doc)}</td>
                                            <td className="px-4 py-3">
                                                <StepDots
                                                    current={doc.current_step_index}
                                                    total={doc.is_internal ? 6 : 7}
                                                    isInternal={doc.is_internal}
                                                    isSlaBreached={Boolean(doc.is_escalated || (getArtaDaysLeft(doc) ?? 0) < 0)}
                                                />
                                            </td>
                                            <td className="px-4 py-3">
                                                <SeverityPill status={doc.status} />
                                                {mine && <span className="mt-1 block whitespace-nowrap text-[11px] font-medium text-[#0066cc]">Needs your action</span>}
                                                {rowNote?.(doc)}
                                            </td>
                                            <td className="px-4 py-3">
                                                {getArtaDaysLeft(doc) === undefined
                                                    ? <span className="text-slate-400">—</span>
                                                    : <ArtaBadge daysLeft={getArtaDaysLeft(doc)} />}
                                            </td>
                                            <td className="px-4 py-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                                <Link href={url} className={cn(textButton, 'text-[#0066cc] hover:bg-blue-50')}>Open</Link>
                                                <button type="button" onClick={() => setQrDoc(doc)} className={cn(textButton, 'text-slate-600 hover:bg-slate-100')}>QR</button>
                                                {deleteUrl && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            if (confirm(`Are you sure you want to delete document ${doc.reference_number}?`)) {
                                                                router.delete(deleteUrl(doc));
                                                            }
                                                        }}
                                                        className={cn(textButton, 'text-red-600 hover:bg-red-50')}
                                                    >
                                                        Delete
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {filteredDocs.length === 0 && (
                        <div className="py-12 text-center">
                            <p className="text-sm text-slate-500">{emptyMessage}</p>
                            {activeFilterCount > 0 ? (
                                <button type="button" onClick={clearFilters} className="mt-2 text-sm text-[#0066cc] hover:underline">Clear all filters</button>
                            ) : activeTab === 'needs_action' && (
                                <button type="button" onClick={() => changeTab('all')} className="mt-2 text-sm text-[#0066cc] hover:underline">View all documents</button>
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

            <BaseModal
                isOpen={Boolean(qrDoc)}
                onClose={() => setQrDoc(null)}
                title="Document QR Code"
                identifier={qrDoc?.reference_number}
                maxWidth="max-w-sm"
                footer={
                    <>
                        <button type="button" onClick={() => setQrDoc(null)} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">Close</button>
                        <button type="button" onClick={printQr} className="rounded-lg bg-[#0066cc] px-4 py-2 text-sm font-medium text-white hover:bg-[#005bb5]">Print QR</button>
                    </>
                }
            >
                {qrDoc && (
                    <div className="text-center">
                        <img src={qrImage} alt={`QR code for ${qrValue}`} className="mx-auto h-48 w-48 rounded-lg border border-slate-200 p-2" />
                        <p className="mt-3 font-mono text-[15px] font-semibold text-slate-900">{qrValue}</p>
                        <p className="mt-1 text-[13px] text-slate-600">{qrDoc.title}</p>
                        <p className="mt-1 text-[12px] text-slate-400">Scan to track this document</p>
                        <p className="mt-0.5 break-all text-[11px] text-slate-400">{qrLink}</p>
                    </div>
                )}
            </BaseModal>

            <ExportPasswordModal
                isOpen={exportOpen}
                onClose={() => setExportOpen(false)}
                documentId={0}
                onSuccess={(msg) => {
                    exportCsv();
                    showToast(msg);
                }}
            />
        </>
    );
}

export default DocumentListView;
