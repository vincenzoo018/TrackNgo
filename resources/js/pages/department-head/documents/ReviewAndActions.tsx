import { Head, Link, router, usePage } from '@inertiajs/react';
import { ArrowLeft, Forward, RotateCcw, Printer, Download, MessageSquare, QrCode, Link as LinkIcon, ShieldAlert, History, BellRing, Ban, FileClock, Lock, Map, ScanText, Users, Bot, GitMerge, Sparkles, Send, CheckCircle2, FileSearch, Paperclip, FileText, Eye } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

import TrackngoLayout from '@/layouts/trackngo/TrackngoLayout';
import { StepProgress } from '@/components/trackngo/StepProgress';
import { CollapsiblePanel } from '@/components/trackngo/CollapsiblePanel';
import { BaseModal } from '@/components/trackngo/BaseModal';
import { RoutingSlipModal, RoutingSlipModalData } from '@/components/trackngo/RoutingSlipModal';

import { ForwardModal } from '@/components/trackngo/ForwardModal';
import { ReturnModal } from '@/components/trackngo/ReturnModal';
import { DocumentCorrectionModal } from '@/components/trackngo/DocumentCorrectionModal';
import { DraggableSignature } from '@/components/trackngo/DraggableSignature';
import { UrgentBadge, SpClearedBadge, SeverityPill } from '@/components/trackngo/SeverityPill';
import { ConfirmActionModal } from '@/components/trackngo/ConfirmActionModal';
import { SuccessModal } from '@/components/trackngo/SuccessModal';
import { ExportPasswordModal } from '@/components/trackngo/ExportPasswordModal';
import IntegratedDocumentViewer from '@/components/trackngo/IntegratedDocumentViewer';
import DiscussionAuditTimeline from '@/components/trackngo/DiscussionAuditTimeline';
import { getStandardizedStatus } from '@/lib/status-helper';
import { cn } from '@/lib/utils';
import { mockDocuments, mockAuditTrail } from '@/lib/mock-data';

export default function DepartmentHeadReviewAndActions({ dbDocument, dbAuditTrail, dbComments, dbDepartments, dbUsers, dbAttachments }: any) {
    const { auth } = usePage<any>().props;
    const doc = dbDocument || mockDocuments[0];
    const trail = dbAuditTrail || mockAuditTrail.filter((a: any) => a.document_ref === doc.reference_number);
    const comments = dbComments || [];
    const departments = dbDepartments || [];
    const users = dbUsers || [];
    const attachments = dbAttachments || doc.attachments || [];

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
    const initialSlip = doc.routing_slips && doc.routing_slips.length > 0 ? doc.routing_slips[0] : null;
    const routingSlipModalData: RoutingSlipModalData = {
        slip_id: initialSlip?.slip_id || doc.document_id,
        formatted_slip_id: initialSlip?.tracking_number || doc.tracking_number || doc.reference_number,
        tracking_number: doc.tracking_number || doc.reference_number,
        document_id: doc.document_id,
        document_ref: doc.reference_number,
        document_title: doc.title,
        from_name: initialSlip?.sender_name || initialSlip?.from_user?.name || doc.sender || doc.submitter?.name || 'Authorized Submitter',
        from_department: initialSlip?.from_department?.department_name || doc.department?.department_name || 'Origin Department',
        to_name: initialSlip?.to_user?.name || 'Department Pool',
        to_department: initialSlip?.target_department?.department_name || initialSlip?.to_department?.department_name || 'Destination Department',
        action: initialSlip?.action || 'Review & Forward',
        instruction: initialSlip?.instruction || 'For review and appropriate action.',
        status: initialSlip?.status || (doc.status === 'completed' ? 'Completed' : doc.status === 'returned' ? 'Returned' : 'Active'),
        date: initialSlip?.created_at || doc.created_at,
        formatted_date: initialSlip?.created_at ? new Date(initialSlip.created_at).toISOString().split('T')[0] : (doc.created_at ? new Date(doc.created_at).toISOString().split('T')[0] : '2026-07-27'),
        stop_number: 'Stop #1',
        qr_data: doc.tracking_number || doc.reference_number,
    };
    const [correctionModalOpen, setCorrectionModalOpen] = useState(false);

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
            router.reload({ only: ['dbDocument', 'dbAuditTrail', 'dbComments', 'dbAttachments'] });
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
        router.post(`/department-head/documents/${doc.document_id}/endorse`, {
            destination_type: destType,
            destination_id: destId,
            remarks: rem
        }, {
            preserveState: true,
            preserveScroll: true,
            onSuccess: () => {
                setForwardModalOpen(false);
                setSuccessState({ isOpen: true, title: 'Successfully', message: 'Document endorsed successfully.' });
            }
        });
    };

    const handleEscalate = () => {
        const just = (document.getElementById('escalateJustification') as HTMLTextAreaElement)?.value;
        if (!just) return alert('Justification required');
        router.post(`/department-head/documents/${doc.document_id}/escalate`, {
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
        router.post(`/department-head/documents/${doc.document_id}/link`, {
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
        
        router.post(`/department-head/documents/${doc.document_id}/comments`, {
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
                setSuccessState({ isOpen: true, title: 'Returned', message: 'Document returned successfully with your remarks logged.' });
            },
            onError: () => setIsActionLoading(false)
        });
    };

    const handleReview = () => {
        setIsActionLoading(true);
        router.post(`/documents/${doc.document_id}/review`, {}, {
            preserveState: true,
            preserveScroll: true,
            onSuccess: () => {
                setIsActionLoading(false);
                setSuccessState({ isOpen: true, title: 'Review Active', message: 'Document marked as Ongoing review.' });
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
            router.post(`/department-head/documents/${doc.document_id}/accept`, {}, {
                preserveState: true,
                preserveScroll: true,
                onSuccess: () => {
                    setConfirmState(prev => ({ ...prev, isOpen: false }));
                    setIsActionLoading(false);
                    setSuccessState({ isOpen: true, title: 'Successfully', message: 'Document received and accepted successfully.' });
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
        <TrackngoLayout
            breadcrumbs={[
                { title: 'Home', href: '/receiving' },
                { title: 'My Documents', href: '/department-head/documents' },
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
            )}            <div className="w-full space-y-5 max-w-none">
                {/* 1. Full-Width Header Bar */}
                <div className="flex flex-wrap items-center justify-between gap-4 rounded-[8px] border border-slate-200 bg-white p-5 shadow-xs">
                    <div>
                        <div className="flex flex-wrap items-center gap-3 mb-1">
                            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                                {doc.reference_number}
                            </h1>
                            <SeverityPill status={doc.status} />
                            <UrgentBadge />
                            <SpClearedBadge />
                        </div>
                        <p className="text-[14px] text-slate-600">
                            <span className="font-semibold text-slate-800">{doc.title}</span> • Submitted by {doc.sender ?? doc.submitter?.name ?? 'Unknown'}
                        </p>
                    </div>

                    <div className="flex items-center gap-2.5">
                        {getStandardizedStatus(doc.status) === 'Returned' && (
                            <button
                                type="button"
                                onClick={() => setCorrectionModalOpen(true)}
                                className="flex items-center gap-2 rounded-[8px] bg-rose-600 px-4 py-2 text-[14px] font-semibold text-white shadow-[0_4px_12px_rgba(0,0,0,0.2)] hover:bg-rose-700 transition-all"
                            >
                                <Paperclip className="h-4 w-4" />
                                Correct Document
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => window.print()}
                            className="flex items-center gap-1.5 rounded-[8px] border border-slate-200 bg-white px-3.5 py-2 text-[14px] font-medium text-slate-700 transition-colors hover:bg-slate-50 shadow-2xs"
                        >
                            <Printer className="h-4 w-4" /> Print
                        </button>
                        <button
                            type="button"
                            onClick={() => setExportModalOpen(true)}
                            className="flex items-center gap-1.5 rounded-[8px] border border-slate-200 bg-white px-3.5 py-2 text-[14px] font-medium text-slate-700 transition-colors hover:bg-slate-50 shadow-2xs"
                        >
                            <Download className="h-4 w-4" /> Export
                        </button>
                        <Link
                            href="/department-head/documents"
                            className="flex items-center gap-1.5 rounded-[8px] border border-slate-200 bg-white px-3.5 py-2 text-[14px] font-medium text-slate-600 transition-colors hover:bg-slate-50 shadow-2xs"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            Back to List
                        </Link>
                    </div>
                </div>

                {/* 2. Returned Document Notification (if status is Returned) */}
                {getStandardizedStatus(doc.status) === 'Returned' && (
                    <div className="rounded-[8px] border border-rose-200 bg-rose-50/80 p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="rounded-[6px] bg-rose-100 p-2 text-rose-600 shrink-0">
                                <RotateCcw className="h-5 w-5" />
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold text-rose-950">Document Returned for Correction</h3>
                                <p className="text-xs sm:text-[13px] text-slate-700 mt-0.5 leading-relaxed">
                                    <strong>Official Reason for return:</strong> "{doc.return_reason || 'Missing files or corrections required.'}"
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setCorrectionModalOpen(true)}
                            className="flex items-center gap-2 rounded-[8px] bg-rose-600 px-4 py-2.5 text-[14px] font-semibold text-white shadow-[0_4px_12px_rgba(0,0,0,0.2)] hover:bg-rose-700 transition-all shrink-0 active:scale-98"
                        >
                            <Paperclip className="h-4 w-4" />
                            Upload Document Correction
                        </button>
                    </div>
                )}

                {/* 3. Collapsible Document Details, Step Progress & Routing History */}
                <CollapsiblePanel
                    title={
                        <div className="flex items-center gap-3">
                            <span className="text-sm font-semibold text-slate-800">📋 Document Details, Routing History & SLA</span>
                            <span className="text-xs font-normal text-slate-500">
                                Current Holder: <strong className="text-slate-800">{doc.current_holder_department?.department_name ?? doc.current_holder?.name ?? 'N/A'}</strong>
                            </span>
                        </div>
                    }
                    defaultExpanded={false}
                    className="shadow-2xs"
                >
                    <div className="space-y-6 pt-2">
                        {/* Step Progress */}
                        <div className="rounded-[8px] border border-slate-200 bg-white p-6 pb-10">
                            <StepProgress currentStep={doc.current_step_index} totalSteps={7} currentHolderName={doc.currentHolder?.name} auditTrails={trail} />
                        </div>

                        {/* Current Holder Banner */}
                        <div className="flex items-center justify-center gap-4 rounded-[8px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                            <span>Tracking No: <strong>{doc.tracking_number ?? doc.reference_number}</strong></span>
                            <span className="text-slate-300">|</span>
                            <span>Department: <strong>{doc.department?.department_name ?? 'N/A'}</strong></span>
                            <span className="text-slate-300">|</span>
                            <span>
                                Current Holder:{' '}
                                <span className="inline-flex rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 uppercase">
                                    {doc.current_holder_department?.department_name ?? doc.current_holder?.name ?? 'N/A'}
                                </span>
                            </span>
                        </div>

                        {/* Executive Briefing & Metadata & Routing Slip */}
                        <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-5 shadow-sm">
                            <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-purple-900">
                                <Sparkles className="h-5 w-5 text-purple-600" />
                                AI Executive Briefing
                            </h2>
                            <ul className="space-y-2 text-sm text-slate-700">
                                <li className="flex items-start gap-3"><div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-purple-500" /><b>Summary:</b> This document was submitted and recognized by our real-time OCR processor.</li>
                                <li className="flex items-start gap-3"><div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-purple-500" /><b>Status:</b> Currently pending endorsement/action from the appropriate personnel.</li>
                                <li className="flex items-start gap-3"><div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-purple-500" /><b>Endorsements:</b> Waiting for further routing slips to be generated.</li>
                            </ul>
                        </div>

                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                            <div className="rounded-xl border border-slate-200 bg-white p-6">
                                <h2 className="mb-4 text-base font-semibold text-slate-800">
                                    Document Metadata
                                </h2>
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
                            </div>
                            
                            {/* Initial Routing Slip */}
                            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm font-mono relative overflow-hidden">
                                {doc.routing_slips && doc.routing_slips.length > 0 ? (
                                    <div className="flex flex-col gap-6 text-slate-900">
                                        <div className="flex justify-between items-start border-b border-slate-200 pb-6">
                                            <div>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h2 className="text-lg font-bold uppercase tracking-tight">Routing Slip</h2>
                                                    <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                                        {doc.tracking_number ?? doc.reference_number}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setQrModalOpen(true)}
                                                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md border border-blue-200 transition-colors shadow-2xs font-sans"
                                                        title="View official routing slip modal"
                                                    >
                                                        <Eye className="h-3.5 w-3.5" />
                                                        View Official Slip
                                                    </button>
                                                </div>
                                                <p className="text-sm font-semibold mt-2">{doc.department?.department_name ?? 'Origin Department'}</p>
                                                <p className="text-xs text-slate-600">{doc.sender ?? doc.submitter?.name ?? 'Unknown Sender'}</p>
                                            </div>
                                            <div className="flex flex-col items-end text-right">
                                                <img 
                                                    src={`https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${doc.tracking_number ?? doc.reference_number}`}
                                                    alt="QR Code"
                                                    className="w-16 h-16 mb-2 mix-blend-multiply"
                                                />
                                                <p className="text-sm font-bold tracking-tight">Stop #1</p>
                                                <p className="text-sm font-semibold">{doc.tracking_number ?? doc.reference_number}</p>
                                                <p className="text-xs text-slate-600">Submitted on {new Date(doc.routing_slips[0].created_at).toISOString().split('T')[0]}</p>
                                            </div>
                                        </div>
                                        <div className="flex justify-between">
                                            <div className="w-1/2 pr-4">
                                                <p className="text-[10px] font-semibold text-slate-500 mb-1 uppercase tracking-wider">From:</p>
                                                <p className="text-sm font-bold">{doc.routing_slips[0].sender_name ?? doc.routing_slips[0].from_user?.name ?? 'Unknown'}</p>
                                                <p className="text-xs text-slate-700 mt-0.5 leading-tight">{doc.routing_slips[0].from_department?.department_name ?? 'N/A'}</p>
                                            </div>
                                            <div className="w-1/2 pl-4">
                                                <p className="text-[10px] font-semibold text-slate-500 mb-1 uppercase tracking-wider">To:</p>
                                                <p className="text-sm font-bold">{doc.routing_slips[0].target_department?.department_name ?? 'N/A'}</p>
                                                <p className="text-xs text-slate-700 mt-0.5 leading-tight">{doc.routing_slips[0].to_user?.name ?? 'Department Pool'}</p>
                                            </div>
                                        </div>
                                        <div className="border-t border-slate-200 pt-4">
                                            <p className="text-[10px] font-semibold text-slate-500 mb-1 uppercase tracking-wider">Instructions:</p>
                                            <p className="text-sm bg-slate-50 p-2.5 rounded border border-slate-100">{doc.routing_slips[0].instruction || 'No specific instruction provided.'}</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex h-40 flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-slate-500 font-sans">
                                        <FileClock className="mb-2 h-6 w-6 text-slate-400" />
                                        <p className="text-sm font-medium">No routing slip generated yet.</p>
                                        <p className="text-xs text-slate-400 mt-1">Pending Registration</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </CollapsiblePanel>

                {/* 4. Main 100% Screen Width Work Surface */}
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-12 w-full items-start">
                    {/* Primary Left Pane: Document & OCR Viewer (7 of 12 cols, ~60%-65% width) */}
                    <div className="xl:col-span-7 2xl:col-span-8 flex flex-col gap-4">
                        <div className="rounded-[8px] border border-slate-200 bg-white overflow-hidden shadow-[0_4px_12px_rgba(0,0,0,0.2)]">
                            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-5 py-3.5">
                                <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                                    <FileText className="h-4 w-4 text-blue-600" />
                                    Integrated Document Viewer & OCR Workspace
                                </h2>
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (!selectedOcrText) return alert('Please highlight text in the document preview first.');
                                        setAnchorModalOpen(true);
                                    }}
                                    className={cn(
                                        "rounded-[8px] border px-3 py-1 text-xs sm:text-[13px] font-semibold transition-colors shadow-xs",
                                        selectedOcrText
                                            ? "border-blue-400 bg-blue-50 text-blue-700 shadow-xs"
                                            : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                                    )}
                                >
                                    📋 Add Anchored Comment {selectedOcrText && '(Text Selected)'}
                                </button>
                            </div>
                            <div className="p-4">
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

                    {/* Right Activity Column: Review Actions + Distinct Discussion/Audit Panels + Signatories (5 of 12 cols) */}
                    <div className="xl:col-span-5 2xl:col-span-4 flex flex-col gap-5">
                        {/* Review Actions Card */}
                        <div className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-[0_4px_12px_rgba(0,0,0,0.2)]">
                            <h2 className="mb-3.5 flex items-center gap-2 text-sm font-semibold text-slate-800">
                                ⚡ Review Actions
                            </h2>
                            <div className="space-y-3">
                                {(() => {
                                    const std = getStandardizedStatus(doc.status);
                                    if (std === 'Sent' || doc.status === 'submitted' || doc.status === 'registered') {
                                        return (
                                            <>
                                                <button 
                                                    onClick={() => requestAction('accept', 'Accept Document', 'Are you sure you want to receive and accept this document for review?', 'Receive')}
                                                    className="flex w-full items-center justify-center gap-2 rounded-[8px] bg-emerald-600 px-4 py-2.5 text-[14px] font-semibold text-white shadow-md shadow-emerald-600/25 transition-all hover:bg-emerald-700"
                                                >
                                                    <CheckCircle2 className="h-4 w-4" />
                                                    Receive / Accept Document
                                                </button>
                                                <button onClick={() => setReturnModalOpen(true)} className="flex w-full items-center justify-center gap-2 rounded-[8px] border border-rose-300 bg-rose-50 px-4 py-2.5 text-[14px] font-medium text-rose-700 transition-colors hover:bg-rose-100">
                                                    <RotateCcw className="h-4 w-4" />
                                                    Return Document
                                                </button>
                                            </>
                                        );
                                    }
                                    if (std === 'Received' || doc.status === 'accepted' || doc.status === 'dept_accepted') {
                                        return (
                                            <>
                                                <button 
                                                    onClick={handleReview}
                                                    className="flex w-full items-center justify-center gap-2 rounded-[8px] bg-amber-600 px-4 py-2.5 text-[14px] font-semibold text-white shadow-md shadow-amber-600/25 transition-all hover:bg-amber-700"
                                                >
                                                    <FileSearch className="h-4 w-4" />
                                                    Mark as Under Review
                                                </button>
                                                <button onClick={() => setForwardModalOpen(true)} className="flex w-full items-center justify-center gap-2 rounded-[8px] bg-blue-600 px-4 py-2.5 text-[14px] font-semibold text-white shadow-md shadow-blue-600/25 transition-all hover:bg-blue-700">
                                                    <Forward className="h-4 w-4" />
                                                    Forward / Endorse
                                                </button>
                                                <button onClick={() => setReturnModalOpen(true)} className="flex w-full items-center justify-center gap-2 rounded-[8px] border border-rose-300 bg-rose-50 px-4 py-2.5 text-[14px] font-medium text-rose-700 transition-colors hover:bg-rose-100">
                                                    <RotateCcw className="h-4 w-4" />
                                                    Return Document
                                                </button>
                                            </>
                                        );
                                    }
                                    if (std === 'Ongoing' || doc.status === 'reviewed') {
                                        return (
                                            <>
                                                <button onClick={() => setForwardModalOpen(true)} className="flex w-full items-center justify-center gap-2 rounded-[8px] bg-blue-600 px-4 py-2.5 text-[14px] font-semibold text-white shadow-md shadow-blue-600/25 transition-all hover:bg-blue-700">
                                                    <Forward className="h-4 w-4" />
                                                    Endorse to Mayor
                                                </button>
                                                <button onClick={() => setReturnModalOpen(true)} className="flex w-full items-center justify-center gap-2 rounded-[8px] border border-rose-300 bg-rose-50 px-4 py-2.5 text-[14px] font-medium text-rose-700 transition-colors hover:bg-rose-100">
                                                    <RotateCcw className="h-4 w-4" />
                                                    Return Document
                                                </button>
                                            </>
                                        );
                                    }
                                    if (std === 'Returned') {
                                        return (
                                            <div className="rounded-[8px] bg-rose-50 border border-rose-200 p-3.5 text-center space-y-2.5">
                                                <p className="text-[14px] font-semibold text-rose-800 flex items-center justify-center gap-1.5">
                                                    <RotateCcw className="h-4 w-4" /> Document Returned
                                                </p>
                                                <button 
                                                    type="button"
                                                    onClick={() => setCorrectionModalOpen(true)}
                                                    className="flex w-full items-center justify-center gap-2 rounded-[8px] bg-rose-600 px-3.5 py-2 text-[13px] font-semibold text-white transition-all hover:bg-rose-700 shadow-xs"
                                                >
                                                    <Paperclip className="h-3.5 w-3.5" />
                                                    Upload Document Correction
                                                </button>
                                                <button onClick={() => setForwardModalOpen(true)} className="flex w-full items-center justify-center gap-2 rounded-[8px] bg-blue-600 px-3 py-2 text-[13px] font-semibold text-white transition-all hover:bg-blue-700">
                                                    <Forward className="h-3.5 w-3.5" />
                                                    Re-endorse / Forward
                                                </button>
                                            </div>
                                        );
                                    }
                                    return (
                                        <div className="flex h-12 items-center justify-center rounded-[8px] border border-dashed border-slate-300 bg-slate-50 text-sm font-medium text-slate-500">
                                            No actions available
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>

                        {/* Distinct Discussion & Audit Trail Panels */}
                        <DiscussionAuditTimeline
                            document={doc}
                            auditTrail={trail}
                            comments={comments}
                            attachments={attachments}
                            selectedSnippet={selectedOcrText}
                            onClearSnippet={() => setSelectedOcrText('')}
                            onOpenCorrectionModal={() => setCorrectionModalOpen(true)}
                        />

                        {/* Signatories Section */}
                        <div className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-[0_4px_12px_rgba(0,0,0,0.2)] flex flex-col gap-6">
                            <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                                <span className="text-base">✍️</span> Signatories
                            </h3>
                            {/* Sender */}
                            <div className="text-center relative w-full flex flex-col items-center">
                                <DraggableSignature imagePath={doc.submitter?.signature} name={doc.sender ?? doc.submitter?.name ?? 'Unknown'} />
                                <div className="h-14"></div>
                                <div className="font-bold text-slate-800 underline underline-offset-4 decoration-slate-400 pb-1 mb-1">{doc.sender ?? doc.submitter?.name ?? 'Unknown'}</div>
                                <div className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Prepared By</div>
                            </div>
                            {/* Authenticated User */}
                            <div className="text-center relative w-full flex flex-col items-center">
                                <DraggableSignature imagePath={auth?.user?.signature} name={auth?.user?.name} />
                                <div className="h-14"></div>
                                <div className="font-bold text-slate-800 underline underline-offset-4 decoration-slate-400 pb-1 mb-1">{auth?.user?.name ?? 'Department Head'}</div>
                                <div className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Reviewed By</div>
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
                identifier={doc.reference_number}
                onConfirm={(destType, destId, rem) => handleEndorse(destType, destId, rem)}
            />

            <ReturnModal
                open={returnModalOpen}
                onClose={() => setReturnModalOpen(false)}
                onConfirm={(reason) => handleReturn(reason)}
                identifier={doc.reference_number}
            />

            {/* Official Routing Slip Modal */}
            <RoutingSlipModal
                isOpen={qrModalOpen}
                onClose={() => setQrModalOpen(false)}
                slip={routingSlipModalData}
                currentRole="department-head"
            />

            {/* Link Related Document Modal */}
            <BaseModal
                isOpen={linkModalOpen}
                onClose={() => setLinkModalOpen(false)}
                title="Link Related Document"
                identifier={doc.reference_number}
                description="Attach another tracking number or routing slip as a cross-reference."
                icon={<LinkIcon className="h-5 w-5" />}
                maxWidth="max-w-md"
                footer={
                    <>
                        <button type="button" onClick={() => setLinkModalOpen(false)} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors">Cancel</button>
                        <button type="button" onClick={() => { showToast('Document linked successfully!'); setLinkModalOpen(false); }} className="rounded-lg bg-[var(--tng-blue-600)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--tng-blue-700)] transition-colors shadow-2xs">Link Document</button>
                    </>
                }
            >
                <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Document Tracking Number</label>
                    <input type="text" placeholder="Search by Tracking No. (e.g. RS-2026-0048 or TNG-2026-...)" className="w-full rounded-lg border border-slate-200 p-2.5 text-sm focus:border-[var(--tng-blue-500)] focus:ring-1 focus:ring-[var(--tng-blue-500)]" />
                </div>
            </BaseModal>

            {/* Escalate to CART Modal */}
            <BaseModal
                isOpen={escalateModalOpen}
                onClose={() => setEscalateModalOpen(false)}
                title="Escalate to CART"
                identifier={doc.reference_number}
                description="Flag for ARTA non-compliance investigation and expedited review."
                icon={<ShieldAlert className="h-5 w-5" />}
                headerClassName="bg-rose-50/70"
                iconContainerClassName="bg-rose-100 text-rose-600"
                maxWidth="max-w-md"
                footer={
                    <>
                        <button type="button" onClick={() => setEscalateModalOpen(false)} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors">Cancel</button>
                        <button type="button" onClick={() => { showToast('Document successfully escalated to CART!'); setEscalateModalOpen(false); }} className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 transition-colors shadow-2xs">Submit Escalation</button>
                    </>
                }
            >
                <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Escalation Justification</label>
                    <textarea rows={3} placeholder="Please provide justification for this escalation..." className="w-full rounded-lg border border-rose-200 bg-rose-50/30 p-2.5 text-sm text-slate-900 focus:border-rose-500 focus:ring-1 focus:ring-rose-500" />
                </div>
            </BaseModal>

            {/* Parallel Routing Modal */}
            <BaseModal
                isOpen={parallelRoutingOpen}
                onClose={() => setParallelRoutingOpen(false)}
                title="Parallel Routing"
                identifier={doc.reference_number}
                description="Route this document to multiple departments simultaneously for concurrent review."
                icon={<GitMerge className="h-5 w-5" />}
                maxWidth="max-w-lg"
                footer={
                    <>
                        <button type="button" onClick={() => setParallelRoutingOpen(false)} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors">Cancel</button>
                        <button type="button" onClick={() => { showToast('Document routed in parallel!'); setParallelRoutingOpen(false); }} className="rounded-lg bg-[var(--tng-blue-600)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--tng-blue-700)] transition-colors shadow-2xs">Initiate Parallel Route</button>
                    </>
                }
            >
                <div className="space-y-3">
                    <label className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50 cursor-pointer transition-colors">
                        <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-blue-600" />
                        <div><p className="text-sm font-semibold text-slate-900">City Legal Office</p><p className="text-xs text-slate-500">Legal review and clearance</p></div>
                    </label>
                    <label className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50 cursor-pointer transition-colors">
                        <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-blue-600" />
                        <div><p className="text-sm font-semibold text-slate-900">City Budget Office</p><p className="text-xs text-slate-500">Financial obligation review</p></div>
                    </label>
                    <label className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50 cursor-pointer transition-colors">
                        <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-blue-600" />
                        <div><p className="text-sm font-semibold text-slate-900">Human Resources</p><p className="text-xs text-slate-500">Personnel impact review</p></div>
                    </label>
                </div>
            </BaseModal>

            {/* Privacy Modal */}
            <BaseModal
                isOpen={privacyModalOpen}
                onClose={() => setPrivacyModalOpen(false)}
                title="Access Control & Privacy"
                identifier={doc.reference_number}
                description="Configure document routing visibility and security classification."
                icon={<Lock className="h-5 w-5" />}
                maxWidth="max-w-md"
                footer={
                    <button type="button" onClick={() => { showToast('Privacy settings updated'); setPrivacyModalOpen(false); }} className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 transition-colors shadow-2xs">Save Changes</button>
                }
            >
                <div className="space-y-3">
                    <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
                        <input type="radio" name="privacy" defaultChecked className="text-blue-600" />
                        <div><p className="text-sm font-semibold text-slate-900">Public Routing</p><p className="text-xs text-slate-500">Visible to all handling staff</p></div>
                    </label>
                    <label className="flex items-center gap-3 p-3 border border-rose-200 bg-rose-50/50 rounded-lg cursor-pointer transition-colors">
                        <input type="radio" name="privacy" className="text-rose-600" />
                        <div><p className="text-sm font-semibold text-rose-700">Highly Confidential</p><p className="text-xs text-rose-500">Metadata hidden, restricted access</p></div>
                    </label>
                </div>
            </BaseModal>

            {/* Anchored Comment Modal */}
            <BaseModal
                isOpen={anchorModalOpen}
                onClose={() => setAnchorModalOpen(false)}
                title="Add Anchored Comment"
                identifier={doc.reference_number}
                description="Attach feedback to the highlighted text in the document."
                icon={<MessageSquare className="h-5 w-5" />}
                maxWidth="max-w-lg"
                formProps={{ onSubmit: (e) => handleAddComment(e, true) }}
                footer={
                    <>
                        <button type="button" onClick={() => setAnchorModalOpen(false)} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors">Cancel</button>
                        <button type="submit" className="rounded-lg bg-[var(--tng-blue-600)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--tng-blue-700)] transition-colors shadow-2xs">Save Comment</button>
                    </>
                }
            >
                <div className="space-y-3">
                    <div className="border-l-4 border-blue-400 bg-blue-50 p-3 text-sm text-slate-700 italic rounded-r-lg max-h-32 overflow-y-auto">
                        "{selectedOcrText}"
                    </div>
                    <textarea 
                        value={anchorCommentText}
                        onChange={(e) => setAnchorCommentText(e.target.value)}
                        rows={3} 
                        placeholder="Type your comment here..." 
                        className="w-full rounded-lg border border-slate-200 p-3 text-sm focus:border-[var(--tng-blue-500)] focus:ring-1 focus:ring-[var(--tng-blue-500)]" 
                        autoFocus
                    />
                </div>
            </BaseModal>

            {/* AI Template Auto-Responder Modal */}
            <BaseModal
                isOpen={aiTemplateOpen}
                onClose={() => setAiTemplateOpen(false)}
                title="AI Auto-Responder"
                identifier={doc.reference_number}
                description="Draft a response letter automatically based on document metadata and extracted OCR text."
                icon={<Bot className="h-5 w-5 text-purple-600" />}
                maxWidth="max-w-md"
                footer={
                    <button type="button" onClick={() => { showToast('Draft generated and saved to attachments!'); setAiTemplateOpen(false); }} className="w-full flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-2 text-sm font-medium text-white shadow-md hover:from-blue-700 hover:to-purple-700 transition-all">
                        <Bot className="h-4 w-4" /> Generate Draft
                    </button>
                }
            >
                <div className="space-y-3">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Response Letter Template</label>
                    <select className="w-full rounded-lg border border-slate-200 p-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
                        <option>Notice of Approval</option>
                        <option>Request for Additional Docs</option>
                        <option>Notice of Denial</option>
                    </select>
                </div>
            </BaseModal>

            {/* Delegate Modal */}
            <BaseModal
                isOpen={delegateModalOpen}
                onClose={() => setDelegateModalOpen(false)}
                title="Delegate Document"
                identifier={doc.reference_number}
                description="Assign this document to a staff member in your department."
                icon={<Users className="h-5 w-5" />}
                maxWidth="max-w-md"
                footer={
                    <>
                        <button type="button" onClick={() => setDelegateModalOpen(false)} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors">Cancel</button>
                        <button type="button" onClick={() => { showToast('Document delegated'); setDelegateModalOpen(false); }} className="rounded-lg bg-[var(--tng-blue-600)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--tng-blue-700)] transition-colors shadow-2xs">Delegate Now</button>
                    </>
                }
            >
                <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Assignee</label>
                    <select className="w-full rounded-lg border border-slate-200 p-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
                        <option>Select staff member...</option>
                        <option>Staff A - Technical Reviewer</option>
                        <option>Staff B - Finance Checker</option>
                    </select>
                </div>
            </BaseModal>

            {/* Reminder Modal */}
            <BaseModal
                isOpen={reminderModalOpen}
                onClose={() => setReminderModalOpen(false)}
                title="Automated Reminders"
                identifier={doc.reference_number}
                description="Configure notification intervals and SLA escalations."
                icon={<BellRing className="h-5 w-5" />}
                maxWidth="max-w-md"
                footer={
                    <button type="button" onClick={() => { showToast('Schedules saved'); setReminderModalOpen(false); }} className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 transition-colors shadow-2xs">Save Schedule</button>
                }
            >
                <div className="space-y-3 text-sm text-slate-700">
                    <label className="flex items-center gap-2.5 cursor-pointer"><input type="checkbox" className="rounded border-slate-300 text-blue-600" defaultChecked /> Send Daily SMS at 8:00 AM</label>
                    <label className="flex items-center gap-2.5 cursor-pointer"><input type="checkbox" className="rounded border-slate-300 text-blue-600" defaultChecked /> Send Daily Email at 8:00 AM</label>
                    <label className="flex items-center gap-2.5 cursor-pointer"><input type="checkbox" className="rounded border-slate-300 text-blue-600" /> CC Department Head if delayed 2 days</label>
                </div>
            </BaseModal>

            <ConfirmActionModal
                isOpen={confirmState.isOpen}
                onClose={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
                onConfirm={handleConfirmAction}
                title={confirmState.title}
                message={confirmState.message}
                confirmText={confirmState.btnText}
                identifier={doc.reference_number}
                isLoading={isActionLoading}
            />

            <SuccessModal
                isOpen={successState.isOpen}
                onClose={() => setSuccessState(prev => ({ ...prev, isOpen: false }))}
                title={successState.title}
                identifier={doc.reference_number}
                message={successState.message}
            />

            <ExportPasswordModal
                isOpen={exportModalOpen}
                onClose={() => setExportModalOpen(false)}
                documentId={doc.document_id}
                identifier={doc.reference_number}
                onSuccess={(msg) => { setToastMessage(msg); setTimeout(() => setToastMessage(null), 3500); }}
            />

            <DocumentCorrectionModal
                open={correctionModalOpen}
                onClose={() => setCorrectionModalOpen(false)}
                document={doc}
                returnReason={doc.return_reason}
                onSuccess={() => {
                    setToastMessage('Document correction uploaded successfully.');
                    setTimeout(() => setToastMessage(null), 3500);
                    router.reload({ only: ['dbDocument', 'dbAuditTrail', 'dbComments', 'dbAttachments'] });
                }}
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

