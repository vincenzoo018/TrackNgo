import { Head, Link } from '@inertiajs/react';
import { Search, ScanLine, Plus, Download, Lock, QrCode, Eye, CheckCircle2, FileSignature, CheckSquare, FileText } from 'lucide-react';
import { useState } from 'react';
import TrackngoLayout from '@/layouts/trackngo/TrackngoLayout';
import { SeverityPill } from '@/components/trackngo/SeverityPill';
import { ForwardModal } from '@/components/trackngo/ForwardModal';
import { StepDots } from '@/components/trackngo/StepProgress';
import { mockDocuments } from '@/lib/mock-data';
import { cn } from '@/lib/utils';
import type { Document } from '@/types/trackngo';

export default function MayorFinalApproval() {
    const documents = mockDocuments;
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
    const [forwardModalOpen, setForwardModalOpen] = useState(false);
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);

    const pendingApprovals = mockDocuments.filter(doc => doc.status === 'pending');

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedDocs(pendingApprovals.map(d => d.id as unknown as string));
        } else {
            setSelectedDocs([]);
        }
    };

    const toggleDocSelection = (id: string) => {
        setSelectedDocs(prev => prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]);
    };

    const handleBulkEndorse = (destinationId: string, remarks: string) => {
        setToastMessage(`Successfully endorsed ${selectedDocs.length} documents!`);
        setForwardModalOpen(false);
        setSelectedDocs([]);
        setTimeout(() => setToastMessage(null), 3000);
    };

    const filteredDocs = documents.filter((doc) =>
        doc.reference_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.submitted_by.toLowerCase().includes(searchQuery.toLowerCase())
    );

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
                        placeholder="Search by reference number, type, or name..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-12 w-full rounded-xl border border-[var(--tng-slate-200)] bg-white pl-12 pr-4 text-sm text-[var(--tng-slate-700)] placeholder:text-[var(--tng-slate-400)] focus:border-[var(--tng-blue-500)] focus:outline-none focus:ring-2 focus:ring-[var(--tng-blue-500)]/20"
                    />
                </div>

                {/* Table */}
                <div className="overflow-hidden rounded-xl border border-[var(--tng-slate-200)] bg-white">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-[var(--tng-slate-600)]">
                            <thead className="bg-[var(--tng-slate-50)] text-xs uppercase text-[var(--tng-slate-500)] border-b border-[var(--tng-slate-200)]">
                                <tr>
                                    <th className="px-6 py-4 font-semibold">
                                        <input type="checkbox" onChange={handleSelectAll} checked={selectedDocs.length === pendingApprovals.length && pendingApprovals.length > 0} className="rounded border-[var(--tng-slate-300)]" />
                                    </th>
                                    <th className="px-6 py-4 font-semibold">Ref No.</th>
                                    <th className="px-6 py-4 font-semibold">Document Type</th>
                                    <th className="px-6 py-4 font-semibold">Submitted By</th>
                                    <th className="px-6 py-4 font-semibold">Department</th>
                                    <th className="px-6 py-4 font-semibold">Date Filed</th>
                                    <th className="px-6 py-4 font-semibold">Progress</th>
                                    <th className="px-6 py-4 font-semibold">Status</th>
                                    <th className="px-6 py-4 font-semibold">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--tng-slate-100)]">
                                {filteredDocs.map((doc, idx) => (
                                    <tr
                                        key={doc.id}
                                        className="group transition-colors hover:bg-[var(--tng-blue-50)]/50"
                                    >
                                        <td className="px-6 py-4">
                                            <input type="checkbox" checked={selectedDocs.includes(doc.id.toString())} onChange={() => toggleDocSelection(doc.id.toString())} className="rounded border-[var(--tng-slate-300)]" />
                                        </td>
                                        <td className="px-6 py-4 font-semibold text-[var(--tng-blue-600)]">
                                            <Link href={`/mayor/documents/${doc.id}`} className="hover:underline">{doc.reference_number}</Link>
                                        </td>
                                        <td className="px-6 py-4">{doc.document_type.name}</td>
                                        <td className="px-6 py-4">{doc.submitted_by}</td>
                                        <td className="px-6 py-4">{doc.department.name}</td>
                                        <td className="px-6 py-4">
                                            {new Date(doc.submitted_at).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}
                                        </td>
                                        <td className="px-6 py-4">
                                            <StepDots current={doc.step_progress} total={doc.total_steps} />
                                        </td>
                                        <td className="px-6 py-4">
                                            <SeverityPill status={doc.status} />
                                        </td>
                                        <td className="px-6 py-4">
                                            <Link href={`/mayor/documents/${doc.id}`} className="text-[var(--tng-blue-600)] font-medium hover:underline text-xs">Review</Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Create Document Modal */}
            {showCreateModal && (
                <CreateDocumentModal onClose={() => setShowCreateModal(false)} />
            )}
            
            {/* Forward Modal for Batch Action */}
            <ForwardModal
                open={forwardModalOpen}
                onClose={() => setForwardModalOpen(false)}
                onConfirm={handleBulkEndorse}
            />
        </TrackngoLayout>
    );
}

function CreateDocumentModal({ onClose }: { onClose: () => void }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose} />
            <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between border-b border-[var(--tng-slate-100)] px-6 py-5 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--tng-blue-50)] text-[var(--tng-blue-600)]">
                            <Plus className="h-5 w-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-[var(--tng-slate-900)]">
                                Approve Document
                            </h2>
                            <p className="text-xs text-[var(--tng-slate-500)]">
                                Upload a document and create its initial routing slip
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="rounded-lg p-2 text-[var(--tng-slate-400)] hover:bg-[var(--tng-slate-50)] hover:text-[var(--tng-slate-600)] transition-colors"
                    >
                        ✕
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-8">
                    <section>
                        <h3 className="text-sm font-semibold text-[var(--tng-slate-900)] mb-4 flex items-center gap-2">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--tng-slate-100)] text-[10px] text-[var(--tng-slate-600)]">1</span>
                            Document Details
                        </h3>
                        <div className="space-y-5 pl-7">
                            <div className="group relative flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--tng-slate-200)] bg-[var(--tng-slate-50)] py-8 transition-colors hover:border-[var(--tng-blue-400)] hover:bg-[var(--tng-blue-50)]">
                                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm group-hover:bg-[var(--tng-blue-100)] group-hover:text-[var(--tng-blue-600)] transition-colors">
                                    <ScanLine className="h-5 w-5 text-[var(--tng-slate-400)] group-hover:text-[var(--tng-blue-600)]" />
                                </div>
                                <div className="text-center">
                                    <p className="text-sm font-medium text-[var(--tng-slate-700)]">Click to upload or drag and drop</p>
                                    <p className="text-xs text-[var(--tng-slate-500)]">PDF, PNG, JPG (max. 10MB)</p>
                                </div>
                            </div>
                            
                            <div className="rounded-lg border border-[var(--tng-blue-100)] bg-[var(--tng-blue-50)] p-4">
                                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--tng-blue-600)] flex items-center gap-1.5">
                                    ✨ Auto-filled by OCR
                                </p>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="mb-1.5 block text-xs font-medium text-[var(--tng-slate-700)]">
                                            Title
                                        </label>
                                        <input
                                            type="text"
                                            defaultValue="Executive Order No. 12"
                                            className="h-9 w-full rounded-md border border-[var(--tng-blue-200)] bg-white px-3 text-sm text-[var(--tng-slate-900)] focus:border-[var(--tng-blue-500)] focus:outline-none focus:ring-1 focus:ring-[var(--tng-blue-500)]"
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-1.5 block text-xs font-medium text-[var(--tng-slate-700)]">
                                            Document Category
                                        </label>
                                        <select className="h-9 w-full rounded-md border border-[var(--tng-blue-200)] bg-white px-3 text-sm text-[var(--tng-slate-900)] focus:border-[var(--tng-blue-500)] focus:outline-none focus:ring-1 focus:ring-[var(--tng-blue-500)]">
                                            <option>Executive Order</option>
                                            <option>Memorandum</option>
                                            <option>Travel Order</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="mb-1.5 block text-xs font-medium text-[var(--tng-slate-700)]">
                                        Originating Department
                                    </label>
                                    <select className="h-9 w-full rounded-md border border-[var(--tng-slate-200)] bg-white px-3 text-sm text-[var(--tng-slate-900)] focus:border-[var(--tng-blue-500)] focus:outline-none focus:ring-1 focus:ring-[var(--tng-blue-500)]">
                                        <option>Select department...</option>
                                        <option>Admin Office</option>
                                        <option>HR Department</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="mb-1.5 block text-xs font-medium text-[var(--tng-slate-700)]">
                                        Submitted By
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Name of submitter"
                                        className="h-9 w-full rounded-md border border-[var(--tng-slate-200)] bg-white px-3 text-sm text-[var(--tng-slate-900)] placeholder:text-[var(--tng-slate-400)] focus:border-[var(--tng-blue-500)] focus:outline-none focus:ring-1 focus:ring-[var(--tng-blue-500)]"
                                    />
                                </div>
                            </div>

                            {/* Urgency */}
                            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                                <label className="flex items-start gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="mt-1 h-4 w-4 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                                    />
                                    <div>
                                        <span className="block text-sm font-semibold text-amber-800">
                                            Mark as Urgent / Rush
                                        </span>
                                        <span className="block text-xs text-amber-700/80 mt-0.5">
                                            Halves the ARTA SLA threshold for this document type. Requires justification.
                                        </span>
                                    </div>
                                </label>
                                <div className="mt-3">
                                    <input
                                        type="text"
                                        placeholder="Reason for urgency..."
                                        className="h-9 w-full rounded-md border border-amber-200 bg-white px-3 text-sm text-[var(--tng-slate-900)] placeholder:text-amber-400/70 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:opacity-50 disabled:bg-amber-50/50"
                                        disabled
                                    />
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Section 2: Routing Slip */}
                    <section>
                        <h3 className="text-sm font-semibold text-[var(--tng-slate-900)] mb-4 flex items-center gap-2">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--tng-slate-100)] text-[10px] text-[var(--tng-slate-600)]">2</span>
                            Initial Routing Slip
                        </h3>
                        <div className="space-y-4 pl-7">
                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-[var(--tng-slate-700)]">
                                    Forward To (Destination)
                                </label>
                                <select className="h-9 w-full rounded-md border border-[var(--tng-slate-200)] bg-white px-3 text-sm text-[var(--tng-slate-900)] focus:border-[var(--tng-blue-500)] focus:outline-none focus:ring-1 focus:ring-[var(--tng-blue-500)]">
                                    <option>Select Destination Department...</option>
                                    <option>Office of the Mayor</option>
                                    <option>City Engineering Office</option>
                                </select>
                            </div>
                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-[var(--tng-slate-700)]">
                                    Instruction / Remarks
                                </label>
                                <textarea
                                    placeholder="Enter instructions for the recipient..."
                                    rows={3}
                                    className="w-full rounded-md border border-[var(--tng-slate-200)] bg-white p-3 text-sm text-[var(--tng-slate-900)] placeholder:text-[var(--tng-slate-400)] focus:border-[var(--tng-blue-500)] focus:outline-none focus:ring-1 focus:ring-[var(--tng-blue-500)]"
                                />
                            </div>
                        </div>
                    </section>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 border-t border-[var(--tng-slate-100)] bg-[var(--tng-slate-50)] px-6 py-4 rounded-b-2xl shrink-0">
                    <button
                        onClick={onClose}
                        className="rounded-lg px-4 py-2 text-sm font-medium text-[var(--tng-slate-600)] transition-colors hover:bg-[var(--tng-slate-200)]"
                    >
                        Cancel
                    </button>
                    <button className="flex items-center gap-2 rounded-lg bg-[var(--tng-blue-600)] px-6 py-2.5 text-sm font-medium text-white shadow-md shadow-blue-600/25 transition-all hover:bg-[var(--tng-blue-700)] hover:shadow-lg">
                        Generate Routing Slip & Submit
                    </button>
                </div>
            </div>
        </div>
    );
}
