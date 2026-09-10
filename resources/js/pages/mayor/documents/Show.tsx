import { Head, Link, router, usePage } from '@inertiajs/react';
import { ArrowLeft, Forward, RotateCcw, Printer, Download, MessageSquare, QrCode, Link as LinkIcon, ShieldAlert, History, BellRing, Ban, FileClock, Lock, Map, ScanText, Users, Bot, GitMerge, Sparkles, Send, CheckCircle2 } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

import TrackngoLayout from '@/layouts/trackngo/TrackngoLayout';
import { StepProgress } from '@/components/trackngo/StepProgress';
import { CollapsiblePanel } from '@/components/trackngo/CollapsiblePanel';

import { ForwardModal } from '@/components/trackngo/ForwardModal';
import { ReturnModal } from '@/components/trackngo/ReturnModal';
import { DraggableSignature } from '@/components/trackngo/DraggableSignature';
import { ConfirmActionModal } from '@/components/trackngo/ConfirmActionModal';
import { SuccessModal } from '@/components/trackngo/SuccessModal';
import { ExportPasswordModal } from '@/components/trackngo/ExportPasswordModal';
import IntegratedDocumentViewer from '@/components/trackngo/IntegratedDocumentViewer';
import DiscussionAuditTimeline from '@/components/trackngo/DiscussionAuditTimeline';
import { getStandardizedStatus } from '@/lib/status-helper';
import { cn } from '@/lib/utils';
import { mockDocuments, mockAuditTrail } from '@/lib/mock-data';

export default function MayorDocumentShow({ dbDocument, dbAuditTrail, dbComments, dbDepartments, dbUsers }: any) {
    const { auth } = usePage<any>().props;
    const doc = dbDocument || mockDocuments[0];
    const trail = dbAuditTrail || mockAuditTrail.filter((a: any) => a.document_ref === doc.reference_number);
    const comments = dbComments || [];
    const departments = dbDepartments || [];
    const users = dbUsers || [];

    // Unified Timeline
    const unifiedTimeline = [
        ...trail.map((t: any) => ({ ...t, _type: 'audit', _date: new Date(t.timestamp || t.created_at) })),
        ...comments.map((c: any) => ({ ...c, _type: 'comment', _date: new Date(c.created_at) }))
    ].sort((a, b) => a._date.getTime() - b._date.getTime());
    const [forwardModalOpen, setForwardModalOpen] = useState(false);
    const [returnModalOpen, setReturnModalOpen] = useState(false);
    
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
    const [exportModalOpen, setExportModalOpen] = useState(false);

    // Anchored Comments State
    const [selectedOcrText, setSelectedOcrText] = useState('');
    const [anchorModalOpen, setAnchorModalOpen] = useState(false);
    const [anchorCommentText, setAnchorCommentText] = useState('');
    const [normalCommentText, setNormalCommentText] = useState('');

    const [confirmState, setConfirmState] = useState({ isOpen: false, action: '', title: '', message: '', btnText: '' });
    const [successState, setSuccessState] = useState({ isOpen: false, title: '', message: '' });
    const [isActionLoading, setIsActionLoading] = useState(false);

    useEffect(() => {
        const interval = setInterval(() => {
            router.reload({ only: ['dbDocument', 'dbAuditTrail', 'dbComments'] });
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    const handleTextSelection = () => {
        const selection = window.getSelection();
        if (selection && selection.toString().trim().length > 0) {
            setSelectedOcrText(selection.toString().trim());
        }
    };

    const handleEndorse = (destType: string, destId: string, rem: string) => {
        router.post(`/mayor/documents/${doc.document_id}/endorse`, {
            destination_type: destType,
            destination_id: destId,
            remarks: rem
        }, {
            onSuccess: () => {
                showToast('Document endorsed successfully');
                setForwardModalOpen(false);
            }
        });
    };

    const handleEscalate = () => {
        const just = (document.getElementById('escalateJustification') as HTMLTextAreaElement)?.value;
        if (!just) return alert('Justification required');
        router.post(`/mayor/documents/${doc.document_id}/escalate`, {
            justification: just
        }, {
            onSuccess: () => {
                showToast('Document successfully escalated to CART!');
                setEscalateModalOpen(false);
            }
        });
    };

    const handleLink = () => {
        const tk = (document.getElementById('linkTrackingNo') as HTMLInputElement)?.value;
        if (!tk) return alert('Tracking No required');
        router.post(`/mayor/documents/${doc.document_id}/link`, {
            tracking_number: tk
        }, {
            onSuccess: () => {
                showToast('Document linked successfully!');
                setLinkModalOpen(false);
            }
        });
    };

    const handleAddComment = (e?: React.FormEvent, isAnchored = false) => {
        if (e) e.preventDefault();
        const text = isAnchored ? anchorCommentText : normalCommentText;
        if (!text) return;
        
        router.post(`/mayor/documents/${doc.document_id}/comments`, {
            comment: text,
            quoted_text: isAnchored ? selectedOcrText : null
        }, {
            onSuccess: () => {
                showToast('Comment added!');
                if (isAnchored) {
                    setAnchorModalOpen(false);
                    setAnchorCommentText('');
                    setSelectedOcrText('');
                } else {
                    setNormalCommentText('');
                }
                setActiveTab('discussion');
            }
        });
    };

    const handleReturn = (reason: string) => {
        setIsActionLoading(true);
        router.post(`/documents/${doc.document_id}/return`, {
            reason
        }, {
            preserveState: true,
            preserveScroll: true,
            onSuccess: () => {
                setReturnModalOpen(false);
                setIsActionLoading(false);
                setSuccessState({ isOpen: true, title: 'Returned', message: 'Document returned successfully to sender.' });
            },
            onError: () => setIsActionLoading(false)
        });
    };

    const requestAction = (action: string, title: string, message: string, btnText: string) => {
        setConfirmState({ isOpen: true, action, title, message, btnText });
    };

    const handleConfirmAction = () => {
        setIsActionLoading(true);
        if (confirmState.action === 'accept') {
            router.post(`/mayor/documents/${doc.document_id}/accept`, {}, {
                preserveState: true,
                preserveScroll: true,
                onSuccess: () => {
                    setConfirmState(prev => ({ ...prev, isOpen: false }));
                    setIsActionLoading(false);
                    setSuccessState({ isOpen: true, title: 'Successfully', message: 'Document accepted successfully.' });
                },
                onError: () => setIsActionLoading(false)
            });
        } else if (confirmState.action === 'review') {
            router.post(`/mayor/documents/${doc.document_id}/review`, {}, {
                preserveState: true,
                preserveScroll: true,
                onSuccess: () => {
                    setConfirmState(prev => ({ ...prev, isOpen: false }));
                    setIsActionLoading(false);
                    setSuccessState({ isOpen: true, title: 'Successfully', message: 'Document marked as reviewed.' });
                },
                onError: () => setIsActionLoading(false)
            });
        } else if (confirmState.action === 'approve') {
            router.post(`/mayor/documents/${doc.document_id}/approve-route`, {}, {
                preserveState: true,
                preserveScroll: true,
                onSuccess: () => {
                    setConfirmState(prev => ({ ...prev, isOpen: false }));
                    setIsActionLoading(false);
                    setSuccessState({ isOpen: true, title: 'Successfully', message: 'Document approved and routed to Receiving Clerk!' });
                },
                onError: () => setIsActionLoading(false)
            });
        }
    };

    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 3000);
    };

    return (
        <TrackngoLayout role="mayor"
            breadcrumbs={[
                { title: 'Dashboard', href: '/mayor' },
                { title: 'Final Approvals', href: '/mayor/documents' },
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
                            {doc.title} — {doc.sender ?? doc.submitter?.name ?? 'Unknown'}
                        </p>
                    </div>
                    <Link
                        href="/mayor/documents"
                        className="flex items-center gap-1.5 rounded-lg border border-[var(--tng-slate-200)] bg-white px-3 py-2 text-sm font-medium text-[var(--tng-slate-600)] transition-colors hover:bg-[var(--tng-slate-50)]"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back to List
                    </Link>
                </div>

                {/* Step Progress */}
                <div className="rounded-xl border border-[var(--tng-slate-200)] bg-white p-6 pb-12">
                    <StepProgress currentStep={doc.current_step_index} totalSteps={7} currentHolderName={doc.currentHolder?.name} auditTrails={trail} />
                </div>

                {/* Current Holder Banner */}
                <div className="flex items-center justify-center gap-4 rounded-xl border border-[var(--tng-slate-200)] bg-[var(--tng-slate-50)] px-4 py-3 text-sm text-[var(--tng-slate-600)]">
                    <span>Tracking No: <strong>{doc.tracking_number ?? doc.reference_number}</strong></span>
                    <span className="text-[var(--tng-slate-300)]">|</span>
                    <span>Department: <strong>{doc.department?.department_name ?? 'N/A'}</strong></span>
                    <span className="text-[var(--tng-slate-300)]">|</span>
                    <span>
                        Current Holder:{' '}
                        <span className="inline-flex rounded-md border border-[var(--tng-slate-300)] bg-white px-2.5 py-1 text-xs font-semibold text-[var(--tng-slate-700)] uppercase">
                            {doc.current_holder_department?.department_name ?? doc.current_holder?.name ?? 'N/A'}
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
                                <li className="flex items-start gap-3"><div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[var(--tng-purple-500)]" /><b>Summary:</b> This document was submitted and recognized by our real-time OCR processor.</li>
                                <li className="flex items-start gap-3"><div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[var(--tng-purple-500)]" /><b>Status:</b> Currently pending endorsement/action from the appropriate personnel.</li>
                                <li className="flex items-start gap-3"><div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[var(--tng-purple-500)]" /><b>Endorsements:</b> Waiting for further routing slips to be generated.</li>
                            </ul>
                        </div>

                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                            <CollapsiblePanel title="Document Metadata">
                                    <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                                <MetaField label="Tracking Number" value={doc.tracking_number ?? doc.reference_number} />
                                <MetaField label="Department" value={doc.department?.department_name ?? 'N/A'} />
                                <MetaField
                                    label="Date Filed"
                                    value={new Date(doc.date_filed || doc.created_at).toLocaleDateString('en-US', {
                                        month: 'short',
                                        day: '2-digit',
                                        year: 'numeric',
                                    }) + ' - ' + new Date(doc.date_filed || doc.created_at).toLocaleTimeString('en-US', {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                    })}
                                />
                                <MetaField label="Document Category" value={doc.type?.type_name ?? 'N/A'} />
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
                                <MetaField label="Sender / Submitted By" value={doc.sender ?? doc.submitter?.name ?? 'Unknown'} />
                                <MetaField
                                    label="Classification"
                                    value={
                                        <span className={doc.classification === 'urgent' ? 'text-red-600 font-semibold' : 'text-green-600 font-semibold'}>
                                            {(doc.classification ?? 'NORMAL').toUpperCase()}
                                        </span>
                                    }
                                />
                                <MetaField label="Linked Document / Version" value={doc.linked_document ? `${doc.linked_document} / ${doc.version}` : `None / ${doc.version ?? 'v1.0'}`} />
                            </div>
                                </CollapsiblePanel>
                        
                        {/* Initial Routing Slip (Receipt Style) */}
                        <div className="rounded-xl border border-[var(--tng-slate-200)] bg-white p-6 shadow-sm font-mono relative overflow-hidden">
                            {doc.routing_slips && doc.routing_slips.length > 0 ? (
                                <div className="flex flex-col gap-6 text-[var(--tng-slate-900)]">
                                    {/* Header */}
                                    <div className="flex justify-between items-start border-b border-[var(--tng-slate-200)] pb-6">
                                        <div>
                                            <h2 className="text-lg font-bold uppercase tracking-tight">Routing Slip</h2>
                                            <p className="text-sm font-semibold mt-2">{doc.department?.department_name ?? 'Origin Department'}</p>
                                            <p className="text-xs text-[var(--tng-slate-600)]">{doc.sender ?? doc.submitter?.name ?? 'Unknown Sender'}</p>
                                        </div>
                                        <div className="flex flex-col items-end text-right">
                                            <img 
                                                src={`https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${doc.tracking_number ?? doc.reference_number}`}
                                                alt="QR Code"
                                                className="w-16 h-16 mb-2 mix-blend-multiply"
                                            />
                                            <p className="text-sm font-bold tracking-tight">Stop #1</p>
                                            <p className="text-sm font-semibold">{doc.tracking_number ?? doc.reference_number}</p>
                                            <p className="text-xs text-[var(--tng-slate-600)]">Submitted on {new Date(doc.routing_slips[0].created_at).toISOString().split('T')[0]}</p>
                                        </div>
                                    </div>

                                    {/* Sender and Receiver */}
                                    <div className="flex justify-between">
                                        <div className="w-1/2 pr-4">
                                            <p className="text-[10px] font-semibold text-[var(--tng-slate-500)] mb-1 uppercase tracking-wider">From:</p>
                                            <p className="text-sm font-bold">{doc.routing_slips[0].sender_name ?? doc.routing_slips[0].from_user?.name ?? 'Unknown'}</p>
                                            <p className="text-xs text-[var(--tng-slate-700)] mt-0.5 leading-tight">{doc.routing_slips[0].from_department?.department_name ?? 'N/A'}</p>
                                        </div>
                                        <div className="w-1/2 pl-4">
                                            <p className="text-[10px] font-semibold text-[var(--tng-slate-500)] mb-1 uppercase tracking-wider">To:</p>
                                            <p className="text-sm font-bold">{doc.routing_slips[0].target_department?.department_name ?? 'N/A'}</p>
                                            <p className="text-xs text-[var(--tng-slate-700)] mt-0.5 leading-tight">{doc.routing_slips[0].to_user?.name ?? 'Department Pool'}</p>
                                        </div>
                                    </div>

                                    {/* Table details */}
                                    <div className="border-t border-b border-[var(--tng-slate-800)] py-3 mt-2">
                                        <table className="w-full text-left text-sm">
                                            <thead>
                                                <tr className="text-[10px] font-bold uppercase tracking-wider text-[var(--tng-slate-800)] border-b border-[var(--tng-slate-200)]">
                                                    <th className="pb-2">Action</th>
                                                    <th className="pb-2">Status</th>
                                                    <th className="pb-2 text-right">Remarks</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <tr>
                                                    <td className="pt-3 align-top font-bold uppercase">{doc.routing_slips[0].action ?? 'forward'}</td>
                                                    <td className="pt-3 align-top">
                                                        <span className="uppercase text-xs font-bold text-[var(--tng-slate-700)]">
                                                            {doc.routing_slips[0].status ?? 'Pending'}
                                                        </span>
                                                    </td>
                                                    <td className="pt-3 align-top text-right text-xs text-[var(--tng-slate-700)] break-words max-w-[120px]">
                                                        {doc.routing_slips[0].instruction || 'None'}
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="mb-4 flex items-center justify-between">
                                        <h2 className="text-base font-semibold text-[var(--tng-slate-800)] flex items-center gap-2">
                                            <Send className="h-4 w-4 text-[var(--tng-slate-500)]" />
                                            Initial Routing Slip
                                        </h2>
                                    </div>
                                    <div className="flex h-40 flex-col items-center justify-center rounded-lg border border-dashed border-[var(--tng-slate-200)] bg-[var(--tng-slate-50)] text-[var(--tng-slate-500)] font-sans">
                                        <FileClock className="mb-2 h-6 w-6 text-[var(--tng-slate-400)]" />
                                        <p className="text-sm font-medium">No routing slip generated yet.</p>
                                        <p className="text-xs text-[var(--tng-slate-400)] mt-1">Pending Registration</p>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Document Preview with Integrated OCR */}
                        <div className="rounded-[8px] border border-slate-200 bg-white p-5 flex flex-col">
                            <div className="mb-4 flex items-center justify-between">
                                <h2 className="flex items-center gap-2 text-[16px] font-semibold text-slate-800">
                                    👁️ Document & Integrated OCR Workspace
                                </h2>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (!selectedOcrText) return alert('Please highlight text in the document preview first.');
                                            setAnchorModalOpen(true);
                                        }}
                                        className={cn(
                                            "rounded-[6px] border px-3 py-1.5 text-[14px] font-medium transition-colors",
                                            selectedOcrText
                                                ? "border-[var(--tng-blue-400)] bg-[var(--tng-blue-50)] text-[var(--tng-blue-700)] shadow-xs"
                                                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                                        )}
                                    >
                                        📋 Add Anchored Comment {selectedOcrText && '(Text Selected)'}
                                    </button>
                                </div>
                            </div>

                            <IntegratedDocumentViewer
                                pdfUrl={doc.attachment_path ? `/storage/${doc.attachment_path}` : null}
                                ocrText={doc.ocr_text}
                                fileName={doc.title || doc.reference_number}
                                documentId={doc.document_id}
                                isConfidential={Boolean(doc.is_confidential_hidden)}
                                selectedText={selectedOcrText}
                                onTextSelect={(text) => setSelectedOcrText(text)}
                                onAddAnchoredComment={(text) => {
                                    setSelectedOcrText(text);
                                    setAnchorModalOpen(true);
                                }}
                            />
                        </div>
                        
                    </div>
                </div>

                    {/* Actions + Audit Trail (1 col) */}
                    <div className="flex flex-col gap-6 lg:sticky lg:top-6 lg:h-[calc(100vh-6rem)]">
                        {/* Standard Actions */}
                        <div className="shrink-0 rounded-xl border border-[var(--tng-slate-200)] bg-white p-6">
                            <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-[var(--tng-slate-800)]">
                                ⚡ Review Actions
                            </h2>
                            <div className="space-y-3">
                                {(() => {
                                    const std = getStandardizedStatus(doc.status);
                                    if (std === 'Sent' || doc.status === 'submitted' || doc.status === 'registered') {
                                        return (
                                            <>
                                                <button 
                                                    onClick={() => requestAction('accept', 'Accept Document', 'Are you sure you want to receive and accept this document?', 'Receive')}
                                                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-emerald-600/25 transition-all hover:bg-emerald-700 hover:shadow-lg"
                                                >
                                                    <CheckCircle2 className="h-4 w-4" />
                                                    Receive / Accept Document
                                                </button>
                                                <button 
                                                    onClick={() => requestAction('approve', 'Sign and Approve', 'Are you sure you want to sign, approve, and route this document to Receiving?', 'Approve')}
                                                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-600/25 transition-all hover:bg-blue-700"
                                                >
                                                    <Sparkles className="h-4 w-4" />
                                                    Sign & Approve Document
                                                </button>
                                                <button onClick={() => setReturnModalOpen(true)} className="flex w-full items-center justify-center gap-2 rounded-lg border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 transition-colors hover:bg-rose-100">
                                                    <RotateCcw className="h-4 w-4" />
                                                    Return to Sender
                                                </button>
                                            </>
                                        );
                                    }
                                    if (std === 'Received' || std === 'Ongoing' || doc.status === 'reviewed') {
                                        return (
                                            <>
                                                <button 
                                                    onClick={() => requestAction('approve', 'Sign and Approve', 'Are you sure you want to sign, approve, and route this document to Receiving?', 'Approve')}
                                                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-emerald-600/25 transition-all hover:bg-emerald-700 hover:shadow-lg"
                                                >
                                                    <Sparkles className="h-4 w-4" />
                                                    Sign & Approve Document
                                                </button>
                                                <button onClick={() => setForwardModalOpen(true)} className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--tng-blue-600)] px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-600/25 transition-all hover:bg-[var(--tng-blue-700)]">
                                                    <Forward className="h-4 w-4" />
                                                    Forward / Endorse
                                                </button>
                                                <button onClick={() => setReturnModalOpen(true)} className="flex w-full items-center justify-center gap-2 rounded-lg border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 transition-colors hover:bg-rose-100">
                                                    <RotateCcw className="h-4 w-4" />
                                                    Return to Sender
                                                </button>
                                                <button onClick={() => setEscalateModalOpen(true)} className="flex w-full items-center justify-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 transition-colors hover:bg-amber-100">
                                                    <ShieldAlert className="h-4 w-4" />
                                                    Flag / Escalate
                                                </button>
                                            </>
                                        );
                                    }
                                    if (std === 'Returned') {
                                        return (
                                            <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-center">
                                                <p className="text-sm font-semibold text-rose-800 flex items-center justify-center gap-1.5 mb-2">
                                                    <RotateCcw className="h-4 w-4" /> Document Returned
                                                </p>
                                                <button onClick={() => setForwardModalOpen(true)} className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--tng-blue-600)] px-3 py-2 text-xs font-semibold text-white transition-all hover:bg-[var(--tng-blue-700)]">
                                                    <Forward className="h-3.5 w-3.5" />
                                                    Re-route / Endorse
                                                </button>
                                            </div>
                                        );
                                    }
                                    return (
                                        <div className="flex h-12 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-sm font-medium text-slate-500">
                                            No actions available
                                        </div>
                                    );
                                })()}
                                <div className="grid grid-cols-2 gap-3 pt-2">
                                    <button className="flex items-center justify-center gap-1.5 rounded-lg border border-[var(--tng-slate-200)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--tng-slate-700)] transition-colors hover:bg-[var(--tng-slate-50)]">
                                        <Printer className="h-4 w-4" /> Print
                                    </button>
                                    <button onClick={() => setExportModalOpen(true)} className="flex items-center justify-center gap-1.5 rounded-lg border border-[var(--tng-slate-200)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--tng-slate-700)] transition-colors hover:bg-[var(--tng-slate-50)]">
                                        <Download className="h-4 w-4" /> Export
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto tng-scrollbar flex flex-col gap-6 pb-6 pr-2 -mr-2">
                            {/* Unified Discussion & Audit Timeline */}
                            <DiscussionAuditTimeline
                                document={doc}
                                auditTrail={trail}
                                comments={comments}
                                selectedSnippet={selectedOcrText}
                                onClearSnippet={() => setSelectedOcrText('')}
                            />
                        </div>

                        {/* Signatures Section */}
                        <div className="rounded-xl border border-[var(--tng-slate-200)] bg-white p-6 flex flex-col gap-8">
                            <h3 className="text-sm font-semibold text-[var(--tng-slate-700)] flex items-center gap-2">
                                <span className="text-base">✍️</span> Signatories
                            </h3>
                            {/* Sender */}
                            <div className="text-center relative w-full flex flex-col items-center">
                                <DraggableSignature imagePath={doc.submitter?.signature} name={doc.sender ?? doc.submitter?.name ?? 'Unknown'} />
                                <div className="h-16"></div>
                                <div className="font-bold text-slate-800 underline underline-offset-4 decoration-slate-400 pb-1 mb-1">{doc.sender ?? doc.submitter?.name ?? 'Unknown'}</div>
                                <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mt-2">Prepared By</div>
                            </div>

                            {/* Authenticated User */}
                            <div className="text-center relative w-full flex flex-col items-center">
                                <DraggableSignature imagePath={auth?.user?.signature} name={auth?.user?.name} />
                                <div className="h-16"></div>
                                <div className="font-bold text-slate-800 underline underline-offset-4 decoration-slate-400 pb-1 mb-1">{auth?.user?.name ?? 'City Mayor'}</div>
                                <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mt-2">Approved By</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <ForwardModal
                open={forwardModalOpen}
                onClose={() => setForwardModalOpen(false)}
                departments={departments}
                users={users}
                onConfirm={(destType, destId, rem) => handleEndorse(destType, destId, rem)}
            />

            <ReturnModal
                open={returnModalOpen}
                onClose={() => setReturnModalOpen(false)}
                onConfirm={(reason) => handleReturn(reason)}
            />

            {/* Modals for new features */}
            {/* Modals for features */}
            {qrModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-[rgba(0,0,0,0.5)] backdrop-blur-sm" onClick={() => setQrModalOpen(false)} />
                    <div className="relative w-full max-w-sm rounded-[8px] bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200 text-center">
                        <h3 className="text-lg font-bold text-[var(--tng-slate-900)] mb-2">Routing Slip QR</h3>
                        <p className="text-[14px] text-[var(--tng-slate-500)] mb-6">{doc.reference_number}</p>
                        <div className="mx-auto flex h-48 w-48 items-center justify-center rounded-[6px] border-4 border-[var(--tng-slate-100)] bg-white p-4">
                            <QrCode className="h-full w-full text-[var(--tng-slate-800)]" />
                        </div>
                        <p className="mt-4 text-[12px] text-[var(--tng-slate-400)]">Attach this QR to the physical document</p>
                        <button onClick={() => setQrModalOpen(false)} className="mt-6 w-full rounded-[6px] bg-[var(--tng-blue-600)] px-4 py-2 text-[16px] font-medium text-white hover:bg-[var(--tng-blue-700)] transition-colors">Done</button>
                    </div>
                </div>
            )}

            {linkModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-[rgba(0,0,0,0.5)] backdrop-blur-sm" onClick={() => setLinkModalOpen(false)} />
                    <div className="relative w-full max-w-md rounded-[8px] bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200">
                        <h3 className="text-lg font-bold text-[var(--tng-slate-900)] mb-1">Link Related Document</h3>
                        <p className="text-[14px] text-[var(--tng-slate-500)] mb-6">Attach another Tracking Number as a reference.</p>
                        <input type="text" placeholder="Search by Tracking No. (e.g. TNG-2026-...)" className="w-full rounded-[6px] border border-[var(--tng-slate-200)] p-3 text-[14px] focus:border-[var(--tng-blue-500)] focus:ring-1 focus:ring-[var(--tng-blue-500)]" />
                        <div className="mt-6 flex justify-end gap-3">
                            <button onClick={() => setLinkModalOpen(false)} className="rounded-[6px] px-4 py-2 text-[16px] font-medium text-[var(--tng-slate-600)] hover:bg-[var(--tng-slate-50)] transition-colors">Cancel</button>
                            <button onClick={() => { showToast('Document linked successfully!'); setLinkModalOpen(false); }} className="rounded-[6px] bg-[var(--tng-blue-600)] px-4 py-2 text-[16px] font-medium text-white hover:bg-[var(--tng-blue-700)] transition-colors">Link Document</button>
                        </div>
                    </div>
                </div>
            )}

            {escalateModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-[rgba(0,0,0,0.5)] backdrop-blur-sm" onClick={() => setEscalateModalOpen(false)} />
                    <div className="relative w-full max-w-md rounded-[8px] bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600">
                                <ShieldAlert className="h-5 w-5" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-[var(--tng-slate-900)]">Escalate to CART</h3>
                                <p className="text-xs text-[var(--tng-slate-500)]">Flag for ARTA non-compliance investigation</p>
                            </div>
                        </div>
                        <textarea rows={3} placeholder="Please provide justification for this escalation..." className="w-full rounded-[6px] border border-red-200 bg-red-50/50 p-3 text-[14px] text-[var(--tng-slate-900)] focus:border-red-500 focus:ring-1 focus:ring-red-500" />
                        <div className="mt-6 flex justify-end gap-3">
                            <button onClick={() => setEscalateModalOpen(false)} className="rounded-[6px] px-4 py-2 text-[16px] font-medium text-[var(--tng-slate-600)] hover:bg-[var(--tng-slate-50)] transition-colors">Cancel</button>
                            <button onClick={() => { showToast('Document successfully escalated to CART!'); setEscalateModalOpen(false); }} className="rounded-[6px] bg-red-600 px-4 py-2 text-[16px] font-medium text-white hover:bg-red-700 transition-colors">Submit Escalation</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Advanced Modals */}
            {parallelRoutingOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-[rgba(0,0,0,0.5)] backdrop-blur-sm" onClick={() => setParallelRoutingOpen(false)} />
                    <div className="relative w-full max-w-lg rounded-[8px] bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200">
                        <h3 className="text-lg font-bold text-[var(--tng-slate-900)] mb-1">Parallel Routing</h3>
                        <p className="text-[14px] text-[var(--tng-slate-500)] mb-6">Route this document to multiple departments simultaneously for concurrent review.</p>
                        
                        <div className="space-y-4">
                            <label className="flex items-center gap-3 rounded-[6px] border border-[var(--tng-slate-200)] p-3 hover:bg-[var(--tng-slate-50)] cursor-pointer">
                                <input type="checkbox" className="h-4 w-4 rounded border-[var(--tng-slate-300)]" />
                                <div><p className="text-[14px] font-semibold">City Legal Office</p><p className="text-xs text-[var(--tng-slate-500)]">Legal review and clearance</p></div>
                            </label>
                            <label className="flex items-center gap-3 rounded-[6px] border border-[var(--tng-slate-200)] p-3 hover:bg-[var(--tng-slate-50)] cursor-pointer">
                                <input type="checkbox" className="h-4 w-4 rounded border-[var(--tng-slate-300)]" />
                                <div><p className="text-[14px] font-semibold">City Budget Office</p><p className="text-xs text-[var(--tng-slate-500)]">Financial obligation review</p></div>
                            </label>
                            <label className="flex items-center gap-3 rounded-[6px] border border-[var(--tng-slate-200)] p-3 hover:bg-[var(--tng-slate-50)] cursor-pointer">
                                <input type="checkbox" className="h-4 w-4 rounded border-[var(--tng-slate-300)]" />
                                <div><p className="text-[14px] font-semibold">Human Resources</p><p className="text-xs text-[var(--tng-slate-500)]">Personnel impact review</p></div>
                            </label>
                        </div>
                        <div className="mt-6 flex justify-end gap-3">
                            <button onClick={() => setParallelRoutingOpen(false)} className="rounded-[6px] px-4 py-2 text-[16px] font-medium text-[var(--tng-slate-600)] hover:bg-[var(--tng-slate-50)] transition-colors">Cancel</button>
                            <button onClick={() => { showToast('Document routed in parallel!'); setParallelRoutingOpen(false); }} className="rounded-[6px] bg-[var(--tng-blue-600)] px-4 py-2 text-[16px] font-medium text-white hover:bg-[var(--tng-blue-700)] transition-colors">Initiate Parallel Route</button>
                        </div>
                    </div>
                </div>
            )}

            {privacyModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-[rgba(0,0,0,0.5)] backdrop-blur-sm" onClick={() => setPrivacyModalOpen(false)} />
                    <div className="relative w-full max-w-sm rounded-[8px] bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200">
                        <h3 className="text-lg font-bold text-[var(--tng-slate-900)] mb-4">Access Control & Privacy</h3>
                        <div className="space-y-3">
                            <label className="flex items-center gap-3 p-2 border border-transparent hover:bg-slate-50 rounded-[6px] cursor-pointer">
                                <input type="radio" name="privacy" defaultChecked className="text-[var(--tng-blue-600)]" />
                                <div><p className="text-[14px] font-semibold">Public Routing</p><p className="text-xs text-[var(--tng-slate-500)]">Visible to all handling staff</p></div>
                            </label>
                            <label className="flex items-center gap-3 p-2 border border-red-200 bg-red-50 rounded-[6px] cursor-pointer">
                                <input type="radio" name="privacy" className="text-red-600" />
                                <div><p className="text-[14px] font-semibold text-red-700">Highly Confidential</p><p className="text-xs text-red-500">Metadata hidden, restricted access</p></div>
                            </label>
                        </div>
                        <button onClick={() => { showToast('Privacy settings updated'); setPrivacyModalOpen(false); }} className="mt-6 w-full rounded-[6px] bg-[var(--tng-slate-900)] px-4 py-2 text-[16px] font-medium text-white hover:bg-slate-800 transition-colors">Save Changes</button>
                    </div>
                </div>
            )}

            {anchorModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-[rgba(0,0,0,0.5)] backdrop-blur-sm" onClick={() => setAnchorModalOpen(false)} />
                    <div className="relative w-full max-w-lg rounded-[8px] bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200">
                        <h3 className="text-lg font-bold text-[var(--tng-slate-900)] mb-1">Add Anchored Comment</h3>
                        <p className="text-[14px] text-[var(--tng-slate-500)] mb-4">Attach your feedback to the specific selected text.</p>
                        
                        <div className="mb-4 border-l-4 border-[var(--tng-blue-400)] bg-[var(--tng-blue-50)] p-3 text-[14px] text-[var(--tng-slate-700)] italic rounded-r-[6px] max-h-32 overflow-y-auto">
                            "{selectedOcrText}"
                        </div>
                        
                        <form onSubmit={(e) => handleAddComment(e, true)}>
                            <textarea 
                                value={anchorCommentText}
                                onChange={(e) => setAnchorCommentText(e.target.value)}
                                rows={3} 
                                placeholder="Type your comment here..." 
                                className="w-full rounded-[6px] border border-[var(--tng-slate-200)] p-3 text-[14px] focus:border-[var(--tng-blue-500)] focus:ring-1 focus:ring-[var(--tng-blue-500)]" 
                                autoFocus
                            />
                            <div className="mt-6 flex justify-end gap-3">
                                <button type="button" onClick={() => setAnchorModalOpen(false)} className="rounded-[6px] px-4 py-2 text-[16px] font-medium text-[var(--tng-slate-600)] hover:bg-[var(--tng-slate-50)] transition-colors">Cancel</button>
                                <button type="submit" className="rounded-[6px] bg-[var(--tng-blue-600)] px-4 py-2 text-[16px] font-medium text-white hover:bg-[var(--tng-blue-700)] transition-colors">Save Comment</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {aiTemplateOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-[rgba(0,0,0,0.5)] backdrop-blur-sm" onClick={() => setAiTemplateOpen(false)} />
                    <div className="relative w-full max-w-md rounded-[8px] bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-2 mb-4 text-[var(--tng-blue-600)]">
                            <Bot className="h-6 w-6" />
                            <h3 className="text-lg font-bold text-[var(--tng-slate-900)]">AI Auto-Responder</h3>
                        </div>
                        <p className="text-[14px] text-[var(--tng-slate-500)] mb-4">Draft a response letter automatically based on the document metadata and extracted OCR text.</p>
                        <select className="w-full rounded-[6px] border border-[var(--tng-slate-200)] p-2 mb-4 text-[14px]">
                            <option>Notice of Approval</option>
                            <option>Request for Additional Docs</option>
                            <option>Notice of Denial</option>
                        </select>
                        <button onClick={() => { showToast('Draft generated and saved to attachments!'); setAiTemplateOpen(false); }} className="w-full flex items-center justify-center gap-2 rounded-[6px] bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-2 text-[16px] font-medium text-white shadow-lg">
                            <Bot className="h-4 w-4" /> Generate Draft
                        </button>
                    </div>
                </div>
            )}

            {delegateModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-[rgba(0,0,0,0.5)] backdrop-blur-sm" onClick={() => setDelegateModalOpen(false)} />
                    <div className="relative w-full max-w-sm rounded-[8px] bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200">
                        <h3 className="text-lg font-bold text-[var(--tng-slate-900)] mb-1">Delegate Document</h3>
                        <p className="text-[14px] text-[var(--tng-slate-500)] mb-4">Assign this to a staff member in your department.</p>
                        <select className="w-full rounded-[6px] border border-[var(--tng-slate-200)] p-2 mb-4 text-[14px]">
                            <option>Select staff member...</option>
                            <option>Staff A - Technical Reviewer</option>
                            <option>Staff B - Finance Checker</option>
                        </select>
                        <button onClick={() => { showToast('Document delegated'); setDelegateModalOpen(false); }} className="w-full rounded-[6px] bg-[var(--tng-blue-600)] px-4 py-2 text-[16px] font-medium text-white hover:bg-[var(--tng-blue-700)] transition-colors">Delegate Now</button>
                    </div>
                </div>
            )}

            {reminderModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-[rgba(0,0,0,0.5)] backdrop-blur-sm" onClick={() => setReminderModalOpen(false)} />
                    <div className="relative w-full max-w-sm rounded-[8px] bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200">
                        <h3 className="text-lg font-bold text-[var(--tng-slate-900)] mb-4">Automated Reminders</h3>
                        <div className="space-y-3 mb-6 text-[14px]">
                            <label className="flex items-center gap-2"><input type="checkbox" className="rounded" defaultChecked /> Send Daily SMS at 8:00 AM</label>
                            <label className="flex items-center gap-2"><input type="checkbox" className="rounded" defaultChecked /> Send Daily Email at 8:00 AM</label>
                            <label className="flex items-center gap-2"><input type="checkbox" className="rounded" /> CC Department Head if delayed 2 days</label>
                        </div>
                        <button onClick={() => { showToast('Schedules saved'); setReminderModalOpen(false); }} className="w-full rounded-[6px] bg-[var(--tng-slate-900)] px-4 py-2 text-[16px] font-medium text-white hover:bg-slate-800 transition-colors">Save Schedule</button>
                    </div>
                </div>
            )}

            <ConfirmActionModal
                isOpen={confirmState.isOpen}
                onClose={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
                onConfirm={handleConfirmAction}
                title={confirmState.title}
                message={confirmState.message}
                confirmText={confirmState.btnText}
                isLoading={isActionLoading}
            />

            <SuccessModal
                isOpen={successState.isOpen}
                onClose={() => setSuccessState(prev => ({ ...prev, isOpen: false }))}
                title={successState.title}
                message={successState.message}
            />

            <ExportPasswordModal
                isOpen={exportModalOpen}
                onClose={() => setExportModalOpen(false)}
                documentId={doc.document_id}
                onSuccess={(msg) => { setToastMessage(msg); setTimeout(() => setToastMessage(null), 3500); }}
            />
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

