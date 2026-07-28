import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, CheckCircle2, RotateCcw, XCircle, Printer, Download, Sparkles, Building2, User, FileText, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import TrackngoLayout from '@/layouts/trackngo/TrackngoLayout';
import { StepProgress } from '@/components/trackngo/StepProgress';
import { AuditTrailTimeline } from '@/components/trackngo/AuditTrailTimeline';
import { ForwardModal } from '@/components/trackngo/ForwardModal';
import { DraggableSignature } from '@/components/trackngo/DraggableSignature';
import { mockDocuments, mockAuditTrail } from '@/lib/mock-data';

export default function MayorDocumentShow() {
    const doc = mockDocuments[0];
    const trail = mockAuditTrail.filter((a) => a.document_ref === doc.reference_number);
    const [forwardModalOpen, setForwardModalOpen] = useState(false);
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    return (
        <TrackngoLayout role="mayor" breadcrumbs={[
            { title: 'Dashboard', href: '/mayor' },
            { title: 'Final Approvals', href: '/mayor/documents' },
            { title: doc.reference_number, href: '#' },
        ]}>
            <Head title={`Final Approval ${doc.reference_number} — TrackNGo Mati`} />

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
                    <Link href="/mayor/documents" className="flex items-center gap-1.5 rounded-lg border border-[var(--tng-slate-200)] bg-white px-3 py-2 text-sm font-medium text-[var(--tng-slate-600)] hover:bg-[var(--tng-slate-50)]">
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
                        
                        {/* Executive Briefing */}
                        <div className="rounded-xl border border-[var(--tng-purple-200)] bg-[var(--tng-purple-50)]/50 p-6 shadow-sm">
                            <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-[var(--tng-purple-900)]">
                                <Sparkles className="h-5 w-5 text-[var(--tng-purple-600)]" />
                                AI Executive Briefing
                            </h2>
                            <ul className="space-y-3 text-sm text-[var(--tng-slate-700)]">
                                <li className="flex items-start gap-3"><div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[var(--tng-purple-500)]" /><b>Summary:</b> This resolution requests a supplementary budget of ₱1,500,000 for emergency disaster relief funds in Brgy. Dahican.</li>
                                <li className="flex items-start gap-3"><div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[var(--tng-purple-500)]" /><b>Legal Basis:</b> Supported by SP Resolution No. 45-2026 and aligned with LGU Disaster Risk Reduction directives.</li>
                                <li className="flex items-start gap-3"><div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[var(--tng-purple-500)]" /><b>Endorsements:</b> Fully cleared by City Budget Office, Accounting, and Legal. Ready for final Mayoral Signature.</li>
                            </ul>
                        </div>

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

                                        {/* Authenticated User (Mayor) */}
                                        <div className="text-center relative w-48">
                                            <DraggableSignature />
                                            <div className="h-16"></div> {/* Space for signature */}
                                            <div className="font-bold text-slate-800 border-b border-slate-800 pb-1 mb-1">Hon. Mayor (You)</div>
                                            <div className="text-xs text-slate-500">Approved By</div>
                                        </div>

                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="space-y-6">
                        <div className="rounded-xl border border-[var(--tng-slate-200)] bg-white p-6">
                            <h2 className="mb-4 text-base font-semibold text-[var(--tng-slate-800)]">⚡ Final Actions</h2>
                            <div className="space-y-3">
                                {doc.status === 'routed' ? (
                                    <button 
                                        onClick={() => {
                                            router.post(`/mayor/documents/${doc.document_id}/receive`, {}, {
                                                onSuccess: () => {
                                                    setToastMessage('Document received successfully!');
                                                    setTimeout(() => setToastMessage(null), 3000);
                                                }
                                            });
                                        }}
                                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-emerald-600/25 transition-all hover:bg-emerald-700 hover:shadow-lg"
                                    >
                                        <QrCode className="h-4 w-4" />
                                        Acknowledge Receipt
                                    </button>
                                ) : (
                                    <>
                                        <button
                                            onClick={() => setForwardModalOpen(true)}
                                            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--tng-blue-600)] px-4 py-3 text-sm font-semibold text-white shadow-md shadow-blue-600/25 transition-all hover:bg-[var(--tng-blue-700)]"
                                        >
                                            <CheckCircle2 className="h-4 w-4" />
                                            Endorse Document
                                        </button>
                                        <button className="flex w-full items-center justify-center gap-2 rounded-lg border border-orange-300 bg-orange-50 px-4 py-2.5 text-sm font-medium text-orange-700 transition-colors hover:bg-orange-100">
                                            <RotateCcw className="h-4 w-4" />
                                            Return for Revisions
                                        </button>
                                        <button className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-100">
                                            <XCircle className="h-4 w-4" />
                                            Veto / Reject
                                        </button>
                                    </>
                                )}
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

                        <AuditTrailTimeline entries={trail} />
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
