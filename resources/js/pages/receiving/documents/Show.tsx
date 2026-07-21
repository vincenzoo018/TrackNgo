import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, Forward, Printer, Download, MessageSquare, QrCode, Link as LinkIcon, ShieldAlert, History, BellRing, Ban, FileClock, Lock, Map, ScanText, Users, Bot, GitMerge, Sparkles } from 'lucide-react';
import { useState } from 'react';
import TrackngoLayout from '@/layouts/trackngo/TrackngoLayout';
import { StepProgress } from '@/components/trackngo/StepProgress';
import { ForwardModal } from '@/components/trackngo/ForwardModal';
import { DraggableSignature } from '@/components/trackngo/DraggableSignature';
import { UrgentBadge, SpClearedBadge } from '@/components/trackngo/SeverityPill';
import { mockDocuments, mockAuditTrail } from '@/lib/mock-data';

export default function ReceivingDocumentShow() {
    const doc = mockDocuments[0]; // TNG-2026-0004
    const trail = mockAuditTrail.filter((a) => a.document_ref === doc.reference_number);
    const [forwardModalOpen, setForwardModalOpen] = useState(false);
    
    // Feature Modals
    const [qrModalOpen, setQrModalOpen] = useState(false);
    const [linkModalOpen, setLinkModalOpen] = useState(false);
    const [escalateModalOpen, setEscalateModalOpen] = useState(false);
    const [parallelRoutingOpen, setParallelRoutingOpen] = useState(false);
    const [privacyModalOpen, setPrivacyModalOpen] = useState(false);
    const [reminderModalOpen, setReminderModalOpen] = useState(false);
    const [delegateModalOpen, setDelegateModalOpen] = useState(false);
    const [aiTemplateOpen, setAiTemplateOpen] = useState(false);
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'audit' | 'discussion'>('audit');

    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 3000);
    };

    return (
        <TrackngoLayout
            breadcrumbs={[
                { title: 'Home', href: '/receiving' },
                { title: 'My Documents', href: '/receiving/documents' },
                { title: doc.reference_number, href: '#' },
            ]}
        >
            <Head title={`${doc.reference_number} — TrackNGo Mati`} />

            {/* Toast Notification */}
            {toastMessage && (
                <div className="fixed top-4 right-4 z-50 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-medium text-white shadow-lg animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center gap-2">
                        <BellRing className="h-4 w-4" />
                        {toastMessage}
                    </div>
                </div>
            )}

            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-start justify-between">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <h1 className="text-2xl font-bold text-[var(--tng-slate-900)]">
                                {doc.reference_number}
                            </h1>
                            <UrgentBadge />
                            <SpClearedBadge />
                        </div>
                        <p className="text-sm text-[var(--tng-slate-500)]">
                            {doc.title} — {doc.sender ?? doc.submitted_by}
                        </p>
                    </div>
                    <Link
                        href="/receiving/documents"
                        className="flex items-center gap-1.5 rounded-lg border border-[var(--tng-slate-200)] bg-white px-3 py-2 text-sm font-medium text-[var(--tng-slate-600)] transition-colors hover:bg-[var(--tng-slate-50)]"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back to List
                    </Link>
                </div>

                {/* Step Progress */}
                <div className="rounded-xl border border-[var(--tng-slate-200)] bg-white p-6">
                    <StepProgress currentStep={doc.step_progress} totalSteps={doc.total_steps} />
                </div>

                {/* Current Holder Banner */}
                <div className="flex items-center justify-center gap-4 rounded-xl border border-[var(--tng-slate-200)] bg-[var(--tng-slate-50)] px-4 py-3 text-sm text-[var(--tng-slate-600)]">
                    <span>Tracking No: <strong>{doc.reference_number}</strong></span>
                    <span className="text-[var(--tng-slate-300)]">|</span>
                    <span>Department: <strong>{doc.department.name}</strong></span>
                    <span className="text-[var(--tng-slate-300)]">|</span>
                    <span>
                        Current Holder:{' '}
                        <span className="inline-flex rounded-md border border-[var(--tng-slate-300)] bg-white px-2.5 py-1 text-xs font-semibold text-[var(--tng-slate-700)] uppercase">
                            {doc.current_holder ?? 'N/A'}
                        </span>
                    </span>
                </div>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                    {/* Document Metadata (2 cols) */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Executive Briefing (Mayor Feature) */}
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
                            <h2 className="mb-4 text-base font-semibold text-[var(--tng-slate-800)]">
                                Document Metadata
                            </h2>
                            <div className="grid grid-cols-2 gap-x-8 gap-y-4 md:grid-cols-3">
                                <MetaField label="Tracking Number" value={doc.reference_number} />
                                <MetaField label="Department" value={doc.department.name} />
                                <MetaField
                                    label="Date Filed"
                                    value={new Date(doc.submitted_at).toLocaleDateString('en-US', {
                                        month: 'short',
                                        day: '2-digit',
                                        year: 'numeric',
                                    }) + ' - ' + new Date(doc.submitted_at).toLocaleTimeString('en-US', {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                    })}
                                />
                                <MetaField label="Document Category" value={doc.document_type.name} />
                                <MetaField label="Contact Number" value={doc.contact_number ?? 'N/A'} />
                                <MetaField
                                    label="Expected Due Date (SLA)"
                                    value={doc.arta_due_date
                                        ? new Date(doc.arta_due_date).toLocaleDateString('en-US', {
                                              month: 'short',
                                              day: '2-digit',
                                              year: 'numeric',
                                          })
                                        : 'N/A'}
                                />
                                <MetaField label="Sender / Submitted By" value={doc.sender ?? doc.submitted_by} />
                                <MetaField
                                    label="Classification"
                                    value={
                                        <span className={doc.classification === 'urgent' ? 'text-red-600 font-semibold' : 'text-green-600 font-semibold'}>
                                            {doc.classification.toUpperCase()}
                                        </span>
                                    }
                                />
                                <MetaField label="Linked Document / Version" value={doc.linked_document ? `${doc.linked_document} / ${doc.version}` : `None / ${doc.version ?? 'v1.0'}`} />
                            </div>
                        </div>

                        {/* Document Preview */}
                        <div className="rounded-xl border border-[var(--tng-slate-200)] bg-white p-6">
                            <div className="mb-4 flex items-center justify-between">
                                <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--tng-slate-800)]">
                                    👁️ Document Preview
                                </h2>
                                <div className="flex items-center gap-2">
                                    <label className="flex items-center gap-1.5 text-xs text-[var(--tng-slate-500)]">
                                        <input type="checkbox" className="h-3.5 w-3.5 rounded border-[var(--tng-slate-300)]" />
                                        Show unresolved only
                                    </label>
                                    <button className="rounded-md border border-[var(--tng-blue-300)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--tng-blue-600)] transition-colors hover:bg-[var(--tng-blue-50)]">
                                        📋 Add Anchored Comment
                                    </button>
                                    <button className="rounded-md border border-[var(--tng-blue-300)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--tng-blue-600)] transition-colors hover:bg-[var(--tng-blue-50)]">
                                        Open in New Tab
                                    </button>
                                </div>
                            </div>
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
                                            <div className="font-bold text-slate-800 border-b border-slate-800 pb-1 mb-1">System Admin (You)</div>
                                            <div className="text-xs text-slate-500">Approved / Forwarded By</div>
                                        </div>

                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Actions + Audit Trail (1 col) */}
                    <div className="space-y-6">
                        {/* Standard Actions */}
                        <div className="rounded-xl border border-[var(--tng-slate-200)] bg-white p-6">
                            <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-[var(--tng-slate-800)]">
                                ⚡ Core Actions
                            </h2>
                            <div className="space-y-3">
                                <button onClick={() => setForwardModalOpen(true)} className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--tng-blue-600)] px-4 py-3 text-sm font-semibold text-white shadow-md shadow-blue-600/25 transition-all hover:bg-[var(--tng-blue-700)] hover:shadow-lg">
                                    <Forward className="h-4 w-4" />
                                    Endorse Document
                                </button>
                                <div className="grid grid-cols-2 gap-3">
                                    <button onClick={() => setQrModalOpen(true)} className="flex items-center justify-center gap-1.5 rounded-lg border border-[var(--tng-slate-200)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--tng-slate-700)] transition-colors hover:bg-[var(--tng-slate-50)]">
                                        <QrCode className="h-4 w-4" />
                                        Print QR
                                    </button>
                                    <button className="flex items-center justify-center gap-1.5 rounded-lg border border-[var(--tng-slate-200)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--tng-slate-700)] transition-colors hover:bg-[var(--tng-slate-50)]">
                                        <Download className="h-4 w-4" />
                                        Export PDF
                                    </button>
                                </div>
                                <button
                                    onClick={() => setParallelRoutingOpen(true)}
                                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--tng-blue-100)] px-4 py-2.5 text-sm font-medium text-[var(--tng-blue-700)] transition-colors hover:bg-[var(--tng-blue-200)]"
                                >
                                    <GitMerge className="h-4 w-4" />
                                    Parallel Routing (Split)
                                </button>
                            </div>
                        </div>

                        {/* Advanced Tracking Features */}
                        <div className="rounded-xl border border-[var(--tng-slate-200)] bg-white p-6">
                            <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-[var(--tng-slate-800)]">
                                🛠️ Advanced Tools
                            </h2>
                            <div className="space-y-2">
                                <button 
                                    onClick={() => setPrivacyModalOpen(true)}
                                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-[var(--tng-slate-700)] transition-colors hover:bg-[var(--tng-slate-50)]"
                                >
                                    <span className="flex items-center gap-2"><Lock className="h-4 w-4 text-[var(--tng-slate-500)]" /> Access & Privacy</span>
                                </button>
                                <button 
                                    onClick={() => setAiTemplateOpen(true)}
                                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-[var(--tng-slate-700)] transition-colors hover:bg-[var(--tng-slate-50)]"
                                >
                                    <span className="flex items-center gap-2"><Bot className="h-4 w-4 text-[var(--tng-blue-500)]" /> AI Template Auto-Responder</span>
                                </button>
                                <Link 
                                    href={`/receiving/documents/${doc.id}/ocr-workspace`}
                                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-[var(--tng-slate-700)] transition-colors hover:bg-[var(--tng-slate-50)]"
                                >
                                    <span className="flex items-center gap-2"><ScanText className="h-4 w-4 text-[var(--tng-purple-500)]" /> Full OCR Workspace</span>
                                </Link>
                                <Link 
                                    href={`/receiving/documents/${doc.id}/location-map`}
                                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-[var(--tng-slate-700)] transition-colors hover:bg-[var(--tng-slate-50)]"
                                >
                                    <span className="flex items-center gap-2"><Map className="h-4 w-4 text-[var(--tng-emerald-500)]" /> Physical Location Map</span>
                                </Link>
                                <button 
                                    onClick={() => setDelegateModalOpen(true)}
                                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-[var(--tng-slate-700)] transition-colors hover:bg-[var(--tng-slate-50)]"
                                >
                                    <span className="flex items-center gap-2"><Users className="h-4 w-4 text-[var(--tng-amber-500)]" /> Delegate / Reassign</span>
                                </button>
                                <button 
                                    onClick={() => setReminderModalOpen(true)}
                                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-[var(--tng-slate-700)] transition-colors hover:bg-[var(--tng-slate-50)]"
                                >
                                    <span className="flex items-center gap-2"><BellRing className="h-4 w-4 text-[var(--tng-blue-500)]" /> Automated Reminders</span>
                                </button>
                                <button 
                                    onClick={() => setLinkModalOpen(true)}
                                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-[var(--tng-slate-700)] transition-colors hover:bg-[var(--tng-slate-50)]"
                                >
                                    <span className="flex items-center gap-2"><LinkIcon className="h-4 w-4 text-[var(--tng-emerald-500)]" /> Link Related Docs</span>
                                </button>
                                <Link 
                                    href={`/receiving/documents/${doc.id}/versions`}
                                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-[var(--tng-slate-700)] transition-colors hover:bg-[var(--tng-slate-50)]"
                                >
                                    <span className="flex items-center gap-2"><History className="h-4 w-4 text-[var(--tng-purple-500)]" /> Version History</span>
                                </Link>
                                <Link 
                                    href={`/receiving/documents/${doc.id}/arta-timeline`}
                                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-[var(--tng-slate-700)] transition-colors hover:bg-[var(--tng-slate-50)]"
                                >
                                    <span className="flex items-center gap-2"><FileClock className="h-4 w-4 text-[var(--tng-amber-500)]" /> ARTA SLA Timeline</span>
                                </Link>
                                <button 
                                    onClick={() => setEscalateModalOpen(true)}
                                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
                                >
                                    <span className="flex items-center gap-2"><ShieldAlert className="h-4 w-4" /> Escalate to CART</span>
                                </button>
                            </div>
                        </div>

                        {/* Audit Trail & Comments */}
                        <div className="rounded-xl border border-[var(--tng-slate-200)] bg-white flex flex-col h-[500px]">
                            <div className="flex border-b border-[var(--tng-slate-200)]">
                                <button 
                                    onClick={() => setActiveTab('audit')} 
                                    className={`flex-1 py-3 text-sm font-semibold ${activeTab === 'audit' ? 'border-b-2 border-[var(--tng-blue-600)] text-[var(--tng-blue-700)]' : 'text-[var(--tng-slate-500)] hover:text-[var(--tng-slate-700)]'}`}
                                >
                                    Audit Trail
                                </button>
                                <button 
                                    onClick={() => setActiveTab('discussion')} 
                                    className={`flex-1 py-3 text-sm font-semibold ${activeTab === 'discussion' ? 'border-b-2 border-[var(--tng-blue-600)] text-[var(--tng-blue-700)]' : 'text-[var(--tng-slate-500)] hover:text-[var(--tng-slate-700)]'}`}
                                >
                                    Discussion
                                </button>
                            </div>

                            <div className="p-6 flex-1 overflow-y-auto tng-scrollbar">
                                {activeTab === 'audit' ? (
                                    trail.length > 0 ? (
                                        <div className="space-y-4">
                                            {trail.map((entry) => (
                                                <div key={entry.id} className="relative pl-5 before:absolute before:left-1.5 before:top-2 before:h-2 before:w-2 before:rounded-full before:bg-[var(--tng-blue-500)] after:absolute after:left-[9px] after:top-5 after:h-full after:w-px after:bg-[var(--tng-slate-200)] last:after:hidden">
                                                    <p className="text-sm font-medium text-[var(--tng-slate-800)]">
                                                        {entry.action}
                                                    </p>
                                                    <p className="text-xs text-[var(--tng-slate-500)]">
                                                        {entry.description}
                                                    </p>
                                                    <p className="mt-1 text-[10px] text-[var(--tng-slate-400)]">
                                                        {entry.user} · {new Date(entry.timestamp).toLocaleString()}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-[var(--tng-slate-400)]">No tracking history yet.</p>
                                    )
                                ) : (
                                    <div className="flex flex-col h-full">
                                        <div className="flex-1 space-y-4 mb-4">
                                            <div className="flex gap-3">
                                                <div className="h-8 w-8 rounded-full bg-[var(--tng-slate-200)] flex items-center justify-center text-xs font-bold text-[var(--tng-slate-600)]">HR</div>
                                                <div className="flex-1 rounded-lg bg-[var(--tng-slate-100)] p-3 text-sm text-[var(--tng-slate-800)]">
                                                    <p className="font-semibold text-xs text-[var(--tng-slate-500)] mb-1">Human Resources · 2h ago</p>
                                                    Please ensure the supplementary files are attached before the Mayor signs.
                                                </div>
                                            </div>
                                            <div className="flex gap-3 flex-row-reverse">
                                                <div className="h-8 w-8 rounded-full bg-[var(--tng-blue-600)] flex items-center justify-center text-xs font-bold text-white">RC</div>
                                                <div className="flex-1 rounded-lg bg-[var(--tng-blue-50)] border border-[var(--tng-blue-100)] p-3 text-sm text-[var(--tng-blue-900)]">
                                                    <p className="font-semibold text-xs text-[var(--tng-blue-500)] mb-1">Receiving Clerk · 1h ago</p>
                                                    Yes, they have been uploaded as a linked document.
                                                </div>
                                            </div>
                                        </div>
                                        <div className="mt-auto relative">
                                            <input type="text" placeholder="Type a message..." className="w-full rounded-lg border border-[var(--tng-slate-200)] pr-10 pl-3 py-2 text-sm focus:border-[var(--tng-blue-500)] focus:ring-1 focus:ring-[var(--tng-blue-500)]" />
                                            <button className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--tng-blue-600)]"><MessageSquare className="h-4 w-4" /></button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <ForwardModal
                open={forwardModalOpen}
                onClose={() => setForwardModalOpen(false)}
                onConfirm={(dest, rem) => { showToast('Document endorsed successfully'); setForwardModalOpen(false); }}
            />

            {/* Modals for new features */}
            {qrModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setQrModalOpen(false)} />
                    <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200 text-center">
                        <h3 className="text-lg font-bold text-[var(--tng-slate-900)] mb-2">Routing Slip QR</h3>
                        <p className="text-sm text-[var(--tng-slate-500)] mb-6">{doc.reference_number}</p>
                        <div className="mx-auto flex h-48 w-48 items-center justify-center rounded-xl border-4 border-[var(--tng-slate-100)] bg-white p-4">
                            <QrCode className="h-full w-full text-[var(--tng-slate-800)]" />
                        </div>
                        <p className="mt-4 text-xs text-[var(--tng-slate-400)]">Attach this QR to the physical document</p>
                        <button onClick={() => setQrModalOpen(false)} className="mt-6 w-full rounded-lg bg-[var(--tng-blue-600)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--tng-blue-700)]">Done</button>
                    </div>
                </div>
            )}

            {linkModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setLinkModalOpen(false)} />
                    <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200">
                        <h3 className="text-lg font-bold text-[var(--tng-slate-900)] mb-1">Link Related Document</h3>
                        <p className="text-sm text-[var(--tng-slate-500)] mb-6">Attach another Tracking Number as a reference.</p>
                        <input type="text" placeholder="Search by Tracking No. (e.g. TNG-2026-...)" className="w-full rounded-lg border border-[var(--tng-slate-200)] p-3 text-sm focus:border-[var(--tng-blue-500)] focus:ring-1 focus:ring-[var(--tng-blue-500)]" />
                        <div className="mt-6 flex justify-end gap-3">
                            <button onClick={() => setLinkModalOpen(false)} className="rounded-lg px-4 py-2 text-sm font-medium text-[var(--tng-slate-600)] hover:bg-[var(--tng-slate-50)]">Cancel</button>
                            <button onClick={() => { showToast('Document linked successfully!'); setLinkModalOpen(false); }} className="rounded-lg bg-[var(--tng-blue-600)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--tng-blue-700)]">Link Document</button>
                        </div>
                    </div>
                </div>
            )}

            {escalateModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setEscalateModalOpen(false)} />
                    <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600">
                                <ShieldAlert className="h-5 w-5" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-[var(--tng-slate-900)]">Escalate to CART</h3>
                                <p className="text-xs text-[var(--tng-slate-500)]">Flag for ARTA non-compliance investigation</p>
                            </div>
                        </div>
                        <textarea rows={3} placeholder="Please provide justification for this escalation..." className="w-full rounded-lg border border-red-200 bg-red-50/50 p-3 text-sm text-[var(--tng-slate-900)] focus:border-red-500 focus:ring-1 focus:ring-red-500" />
                        <div className="mt-6 flex justify-end gap-3">
                            <button onClick={() => setEscalateModalOpen(false)} className="rounded-lg px-4 py-2 text-sm font-medium text-[var(--tng-slate-600)] hover:bg-[var(--tng-slate-50)]">Cancel</button>
                            <button onClick={() => { showToast('Document successfully escalated to CART!'); setEscalateModalOpen(false); }} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">Submit Escalation</button>
                        </div>
                    </div>
                </div>
            )}
            {/* Advanced Modals */}
            {parallelRoutingOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setParallelRoutingOpen(false)} />
                    <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200">
                        <h3 className="text-lg font-bold text-[var(--tng-slate-900)] mb-1">Parallel Routing</h3>
                        <p className="text-sm text-[var(--tng-slate-500)] mb-6">Route this document to multiple departments simultaneously for concurrent review.</p>
                        
                        <div className="space-y-4">
                            <label className="flex items-center gap-3 rounded-lg border border-[var(--tng-slate-200)] p-3 hover:bg-[var(--tng-slate-50)]">
                                <input type="checkbox" className="h-4 w-4 rounded border-[var(--tng-slate-300)]" />
                                <div><p className="text-sm font-semibold">City Legal Office</p><p className="text-xs text-[var(--tng-slate-500)]">Legal review and clearance</p></div>
                            </label>
                            <label className="flex items-center gap-3 rounded-lg border border-[var(--tng-slate-200)] p-3 hover:bg-[var(--tng-slate-50)]">
                                <input type="checkbox" className="h-4 w-4 rounded border-[var(--tng-slate-300)]" />
                                <div><p className="text-sm font-semibold">City Budget Office</p><p className="text-xs text-[var(--tng-slate-500)]">Financial obligation review</p></div>
                            </label>
                            <label className="flex items-center gap-3 rounded-lg border border-[var(--tng-slate-200)] p-3 hover:bg-[var(--tng-slate-50)]">
                                <input type="checkbox" className="h-4 w-4 rounded border-[var(--tng-slate-300)]" />
                                <div><p className="text-sm font-semibold">Human Resources</p><p className="text-xs text-[var(--tng-slate-500)]">Personnel impact review</p></div>
                            </label>
                        </div>
                        <div className="mt-6 flex justify-end gap-3">
                            <button onClick={() => setParallelRoutingOpen(false)} className="rounded-lg px-4 py-2 text-sm font-medium text-[var(--tng-slate-600)]">Cancel</button>
                            <button onClick={() => { showToast('Document routed in parallel!'); setParallelRoutingOpen(false); }} className="rounded-lg bg-[var(--tng-blue-600)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--tng-blue-700)]">Initiate Parallel Route</button>
                        </div>
                    </div>
                </div>
            )}

            {privacyModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setPrivacyModalOpen(false)} />
                    <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200">
                        <h3 className="text-lg font-bold text-[var(--tng-slate-900)] mb-4">Access Control & Privacy</h3>
                        <div className="space-y-3">
                            <label className="flex items-center gap-3 p-2 border border-transparent hover:bg-slate-50 rounded-lg cursor-pointer">
                                <input type="radio" name="privacy" defaultChecked className="text-[var(--tng-blue-600)]" />
                                <div><p className="text-sm font-semibold">Public Routing</p><p className="text-xs text-[var(--tng-slate-500)]">Visible to all handling staff</p></div>
                            </label>
                            <label className="flex items-center gap-3 p-2 border border-red-200 bg-red-50 rounded-lg cursor-pointer">
                                <input type="radio" name="privacy" className="text-red-600" />
                                <div><p className="text-sm font-semibold text-red-700">Highly Confidential</p><p className="text-xs text-red-500">Metadata hidden, restricted access</p></div>
                            </label>
                        </div>
                        <button onClick={() => { showToast('Privacy settings updated'); setPrivacyModalOpen(false); }} className="mt-6 w-full rounded-lg bg-[var(--tng-slate-900)] px-4 py-2 text-sm font-medium text-white">Save Changes</button>
                    </div>
                </div>
            )}

            {aiTemplateOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setAiTemplateOpen(false)} />
                    <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-2 mb-4 text-[var(--tng-blue-600)]">
                            <Bot className="h-6 w-6" />
                            <h3 className="text-lg font-bold text-[var(--tng-slate-900)]">AI Auto-Responder</h3>
                        </div>
                        <p className="text-sm text-[var(--tng-slate-500)] mb-4">Draft a response letter automatically based on the document metadata and extracted OCR text.</p>
                        <select className="w-full rounded-lg border border-[var(--tng-slate-200)] p-2 mb-4 text-sm">
                            <option>Notice of Approval</option>
                            <option>Request for Additional Docs</option>
                            <option>Notice of Denial</option>
                        </select>
                        <button onClick={() => { showToast('Draft generated and saved to attachments!'); setAiTemplateOpen(false); }} className="w-full flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-2 text-sm font-medium text-white shadow-lg">
                            <Bot className="h-4 w-4" /> Generate Draft
                        </button>
                    </div>
                </div>
            )}

            {delegateModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDelegateModalOpen(false)} />
                    <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200">
                        <h3 className="text-lg font-bold text-[var(--tng-slate-900)] mb-1">Delegate Document</h3>
                        <p className="text-sm text-[var(--tng-slate-500)] mb-4">Assign this to a staff member in your department.</p>
                        <select className="w-full rounded-lg border border-[var(--tng-slate-200)] p-2 mb-4 text-sm">
                            <option>Select staff member...</option>
                            <option>Staff A - Technical Reviewer</option>
                            <option>Staff B - Finance Checker</option>
                        </select>
                        <button onClick={() => { showToast('Document delegated'); setDelegateModalOpen(false); }} className="w-full rounded-lg bg-[var(--tng-blue-600)] px-4 py-2 text-sm font-medium text-white">Delegate Now</button>
                    </div>
                </div>
            )}

            {reminderModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setReminderModalOpen(false)} />
                    <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200">
                        <h3 className="text-lg font-bold text-[var(--tng-slate-900)] mb-4">Automated Reminders</h3>
                        <div className="space-y-3 mb-6 text-sm">
                            <label className="flex items-center gap-2"><input type="checkbox" className="rounded" defaultChecked /> Send Daily SMS at 8:00 AM</label>
                            <label className="flex items-center gap-2"><input type="checkbox" className="rounded" defaultChecked /> Send Daily Email at 8:00 AM</label>
                            <label className="flex items-center gap-2"><input type="checkbox" className="rounded" /> CC Department Head if delayed 2 days</label>
                        </div>
                        <button onClick={() => { showToast('Schedules saved'); setReminderModalOpen(false); }} className="w-full rounded-lg bg-[var(--tng-slate-900)] px-4 py-2 text-sm font-medium text-white">Save Schedule</button>
                    </div>
                </div>
            )}
        </TrackngoLayout>
    );
}

function MetaField({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--tng-slate-400)]">
                {label}
            </p>
            <p className="mt-0.5 text-sm font-medium text-[var(--tng-slate-800)]">
                {value}
            </p>
        </div>
    );
}
