import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, Forward, RotateCcw, Users, XCircle, Printer, Download } from 'lucide-react';
import { useState } from 'react';
import TrackngoLayout from '@/layouts/trackngo/TrackngoLayout';
import { StepProgress } from '@/components/trackngo/StepProgress';
import { ForwardModal } from '@/components/trackngo/ForwardModal';
import { DraggableSignature } from '@/components/trackngo/DraggableSignature';
import { mockDocuments, mockAuditTrail } from '@/lib/mock-data';

export default function DepartmentHeadReviewAndActions() {
    const doc = mockDocuments[0];
    const trail = mockAuditTrail.filter((a) => a.document_ref === doc.reference_number);
    const [forwardModalOpen, setForwardModalOpen] = useState(false);
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    return (
        <TrackngoLayout breadcrumbs={[
            { title: 'Dashboard', href: '/department-head' },
            { title: 'Endorsements', href: '/department-head/documents' },
            { title: doc.reference_number, href: '#' },
        ]}>
            <Head title={`Review ${doc.reference_number} — TrackNGo Mati`} />

            {/* Toast Notification */}
            {toastMessage && (
                <div className="fixed top-4 right-4 z-50 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-medium text-white shadow-lg animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center gap-2">
                        {toastMessage}
                    </div>
                </div>
            )}

            <div className="space-y-6">
                <div className="flex items-start justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-[var(--tng-slate-900)]">{doc.reference_number}</h1>
                        <p className="mt-0.5 text-sm text-[var(--tng-slate-500)]">{doc.title} — {doc.sender ?? doc.submitted_by}</p>
                    </div>
                    <Link href="/department-head/documents" className="flex items-center gap-1.5 rounded-lg border border-[var(--tng-slate-200)] bg-white px-3 py-2 text-sm font-medium text-[var(--tng-slate-600)] hover:bg-[var(--tng-slate-50)]">
                        <ArrowLeft className="h-4 w-4" />
                        Back
                    </Link>
                </div>

                <div className="rounded-xl border border-[var(--tng-slate-200)] bg-white p-6">
                    <StepProgress currentStep={doc.step_progress} totalSteps={doc.total_steps} />
                </div>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                    {/* Document Info */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="rounded-xl border border-[var(--tng-slate-200)] bg-white p-6">
                            <h2 className="mb-4 text-base font-semibold text-[var(--tng-slate-800)]">Document Metadata</h2>
                            <div className="grid grid-cols-2 gap-x-8 gap-y-4 md:grid-cols-3">
                                <MetaField label="Tracking Number" value={doc.reference_number} />
                                <MetaField label="Department" value={doc.department.name} />
                                <MetaField label="Document Category" value={doc.document_type.name} />
                                <MetaField label="Submitted By" value={doc.submitted_by} />
                                <MetaField label="Classification" value={<span className={doc.classification === 'urgent' ? 'text-red-600 font-semibold' : 'text-green-600 font-semibold'}>{doc.classification.toUpperCase()}</span>} />
                                <MetaField label="SLA Due Date" value={doc.arta_due_date ?? 'N/A'} />
                            </div>
                        </div>

                        <div className="rounded-xl border border-[var(--tng-slate-200)] bg-white p-6">
                            <h2 className="mb-4 text-base font-semibold text-[var(--tng-slate-800)]">👁️ Document Preview</h2>
                            
                            <div className="relative flex h-[600px] w-full flex-col bg-slate-50 shadow-inner border border-slate-300 rounded-lg p-8 overflow-hidden select-none">
                                {/* Mock Document Content */}
                                <div className="flex-1 bg-white border border-slate-200 shadow-sm p-12 relative overflow-hidden">
                                    <div className="h-4 bg-slate-100 rounded w-3/4 mb-6"></div>
                                    <div className="h-4 bg-slate-100 rounded w-full mb-6"></div>
                                    <div className="h-4 bg-slate-100 rounded w-5/6 mb-6"></div>
                                    <div className="h-4 bg-slate-100 rounded w-full mb-6"></div>
                                    <div className="h-4 bg-slate-100 rounded w-2/3 mb-12"></div>
                                    
                                    {/* Signatures Section at the bottom */}
                                    <div className="absolute bottom-12 left-12 right-12 flex justify-between">
                                        
                                        {/* Sender */}
                                        <div className="text-center relative w-48">
                                            <div className="h-16"></div> {/* Space for signature */}
                                            <div className="font-bold text-slate-800 border-b border-slate-800 pb-1 mb-1">{doc.sender ?? doc.submitted_by}</div>
                                            <div className="text-xs text-slate-500">Prepared By</div>
                                        </div>

                                        {/* Authenticated User */}
                                        <div className="text-center relative w-48">
                                            <DraggableSignature />
                                            <div className="h-16"></div> {/* Space for signature */}
                                            <div className="font-bold text-slate-800 border-b border-slate-800 pb-1 mb-1">Department Head (You)</div>
                                            <div className="text-xs text-slate-500">Approved / Endorsed By</div>
                                        </div>

                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="space-y-6">
                        <div className="rounded-xl border border-[var(--tng-slate-200)] bg-white p-6">
                            <h2 className="mb-4 text-base font-semibold text-[var(--tng-slate-800)]">⚡ Review Actions</h2>
                            <div className="space-y-3">
                                <button
                                    onClick={() => setForwardModalOpen(true)}
                                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--tng-blue-600)] px-4 py-3 text-sm font-semibold text-white shadow-md shadow-blue-600/25 transition-all hover:bg-[var(--tng-blue-700)]"
                                >
                                    <Forward className="h-4 w-4" />
                                    Endorse Document
                                </button>
                                <button className="flex w-full items-center justify-center gap-2 rounded-lg border border-orange-300 bg-orange-50 px-4 py-2.5 text-sm font-medium text-orange-700 transition-colors hover:bg-orange-100">
                                    <RotateCcw className="h-4 w-4" />
                                    Return Document
                                </button>
                                <button className="flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--tng-slate-200)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--tng-slate-600)] transition-colors hover:bg-[var(--tng-slate-50)]">
                                    <Users className="h-4 w-4" />
                                    Reassign
                                </button>
                                <button className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-100">
                                    <XCircle className="h-4 w-4" />
                                    Reject
                                </button>
                                <div className="grid grid-cols-2 gap-3 pt-2">
                                    <button className="flex items-center justify-center gap-1.5 rounded-lg border border-[var(--tng-slate-200)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--tng-slate-700)] hover:bg-[var(--tng-slate-50)]">
                                        <Printer className="h-4 w-4" /> Print
                                    </button>
                                    <button className="flex items-center justify-center gap-1.5 rounded-lg border border-[var(--tng-slate-200)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--tng-slate-700)] hover:bg-[var(--tng-slate-50)]">
                                        <Download className="h-4 w-4" /> Export
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-xl border border-[var(--tng-slate-200)] bg-white p-6">
                            <h2 className="mb-4 text-base font-semibold text-[var(--tng-slate-800)]">✨ Audit Trail</h2>
                            <div className="space-y-4">
                                {trail.map((entry) => (
                                    <div key={entry.id} className="relative pl-5 before:absolute before:left-1.5 before:top-2 before:h-2 before:w-2 before:rounded-full before:bg-[var(--tng-blue-500)] after:absolute after:left-[9px] after:top-5 after:h-full after:w-px after:bg-[var(--tng-slate-200)] last:after:hidden">
                                        <p className="text-sm font-medium text-[var(--tng-slate-800)]">{entry.action}</p>
                                        <p className="text-xs text-[var(--tng-slate-500)]">{entry.description}</p>
                                        <p className="mt-1 text-[10px] text-[var(--tng-slate-400)]">{entry.user} · {new Date(entry.timestamp).toLocaleString()}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <ForwardModal
                open={forwardModalOpen}
                onClose={() => setForwardModalOpen(false)}
                onConfirm={(dest, rem) => { 
                    setToastMessage('Document endorsed successfully'); 
                    setForwardModalOpen(false); 
                    setTimeout(() => setToastMessage(null), 3000);
                }}
            />
        </TrackngoLayout>
    );
}

function MetaField({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--tng-slate-400)]">{label}</p>
            <p className="mt-0.5 text-sm font-medium text-[var(--tng-slate-800)]">{value}</p>
        </div>
    );
}
