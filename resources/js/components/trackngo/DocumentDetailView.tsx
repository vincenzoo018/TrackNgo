import { Link, router, usePage } from '@inertiajs/react';
import { AlertCircle, ArrowLeft, CheckCircle2, Lock, PenLine } from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BaseModal } from '@/components/trackngo/BaseModal';
import DiscussionAuditTimeline from '@/components/trackngo/DiscussionAuditTimeline';
import { DocumentCorrectionModal, findReturner } from '@/components/trackngo/DocumentCorrectionModal';
import { SignatoriesPanel, summarizeSignatures } from '@/components/trackngo/DocumentSigning';
import { ExportPasswordModal } from '@/components/trackngo/ExportPasswordModal';
import IntegratedDocumentViewer from '@/components/trackngo/IntegratedDocumentViewer';
import { csrfHeaders } from '@/lib/csrf';
import type { RoutingSlipModalData } from '@/components/trackngo/RoutingSlipModal';
import { RoutingSlipModal } from '@/components/trackngo/RoutingSlipModal';
import { SeverityPill } from '@/components/trackngo/SeverityPill';
import { StepProgress } from '@/components/trackngo/StepProgress';
import { getArtaDueDate } from '@/lib/arta';
import { describeHolder, isCurrentHolder } from '@/lib/document-holder';
import { qrDataUrl, useTrackingLink } from '@/lib/qr';
import { generateSignedCopy, signatureBlocks, stampableKind } from '@/lib/signed-pdf';
import { getStandardizedStatus } from '@/lib/status-helper';

/** Uniform action button styles for the role action panels. */
export const actionButton = {
    primary: 'flex w-full items-center justify-center rounded-lg bg-[#0066cc] px-4 py-2.5 text-[14px] font-medium text-white transition-colors hover:bg-[#005bb5] disabled:opacity-60',
    secondary: 'flex w-full items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-[14px] font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60',
    danger: 'flex w-full items-center justify-center rounded-lg bg-rose-600 px-4 py-2.5 text-[14px] font-medium text-white transition-colors hover:bg-rose-700',
};

function formatDate(value?: string | Date | null, withTime = false): string | null {
    if (!value) {
        return null;
    }
    const d = new Date(value);
    if (isNaN(d.getTime())) {
        return null;
    }
    const date = d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
    return withTime ? `${date}, ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}` : date;
}

/** Label / value pair; optional values are hidden when empty so the summary only shows what is known. */
function InfoItem({ label, value, wide = false }: { label: string; value?: React.ReactNode; wide?: boolean }) {
    if (value === null || value === undefined || value === '') {
        return null;
    }
    return (
        <div className={wide ? 'sm:col-span-2' : undefined}>
            <dt className="text-[12px] text-slate-500">{label}</dt>
            <dd className="mt-0.5 text-[14px] font-medium text-slate-900 break-words">{value}</dd>
        </div>
    );
}

function Card({ title, aside, children, className }: { title?: string; aside?: React.ReactNode; children: React.ReactNode; className?: string }) {
    return (
        <section className={`rounded-lg border border-slate-200 bg-white ${className ?? ''}`}>
            {title && (
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3.5">
                    <h2 className="text-[15px] font-semibold text-slate-900">{title}</h2>
                    {aside}
                </div>
            )}
            {children}
        </section>
    );
}

export type DocumentDetailViewProps = {
    doc: any;
    trail: any[];
    comments: any[];
    attachments: any[];
    users: any[];
    /** Role key for the official routing slip modal links */
    role: string;
    backUrl: string;
    actionsTitle?: string;
    actions: React.ReactNode;
    /** Opened from the Returned notice; owned by the page so its own buttons can open it too */
    correctionOpen: boolean;
    onCorrectionOpenChange: (open: boolean) => void;
};

export function DocumentDetailView({
    doc,
    trail,
    comments,
    attachments,
    users,
    role,
    backUrl,
    actionsTitle = 'Actions',
    actions,
    correctionOpen,
    onCorrectionOpenChange,
}: DocumentDetailViewProps) {
    const { auth, errors, flash } = usePage<any>().props;
    const trackingLinkFor = useTrackingLink();
    const [slipOpen, setSlipOpen] = useState(false);
    const [exportOpen, setExportOpen] = useState(false);
    const [selectedOcrText, setSelectedOcrText] = useState('');
    const [anchorOpen, setAnchorOpen] = useState(false);
    const [anchorComment, setAnchorComment] = useState('');
    const [linkOpen, setLinkOpen] = useState(false);
    const [linkTrackingNo, setLinkTrackingNo] = useState('');
    const [linkError, setLinkError] = useState<string | null>(null);
    const [escalateOpen, setEscalateOpen] = useState(false);
    const [escalateReason, setEscalateReason] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [toast, setToast] = useState<string | null>(null);
    // null = default file: the final signed copy once it exists (listed first), otherwise the main document
    const [selectedFileKey, setSelectedFileKey] = useState<string | null>(null);

    const [generating, setGenerating] = useState(false);
    const [generateError, setGenerateError] = useState<string | null>(null);

    const showToast = (message: string) => {
        setToast(message);
        setTimeout(() => setToast(null), 3500);
    };

    const client = doc.client || null;
    const status = getStandardizedStatus(doc.status);
    const isReturned = status === 'Returned';
    const classification = String(doc.classification || 'normal');
    const isUrgent = Boolean(doc.urgency_justification) || classification.toLowerCase() === 'urgent';
    const slip = doc.routing_slips?.[0] || null;
    const trackingNo = doc.tracking_number || null;
    const filedAt = doc.date_filed || doc.created_at;
    const submitterName = doc.submitter?.name || (slip?.sender_name ?? null);
    const dueDate = getArtaDueDate(doc);
    // Only whoever the document was returned to uploads the correction (Admin keeps override rights)
    const canCorrect = isReturned && (isCurrentHolder(doc, auth?.user) || auth?.user?.role === 'admin');

    const isHidden = Boolean(doc.is_confidential_hidden);
    // Workflow actions belong to whoever holds the document now (Admin keeps override rights)
    const isHolder = isCurrentHolder(doc, auth?.user) || auth?.user?.role === 'admin';
    const signatures = summarizeSignatures(doc);
    const mainKind = stampableKind(doc.attachment_path);
    // Anyone who can open the document may build the final signed copy from the stamped signatures
    const canGenerate = !isHidden;
    // The viewer's own signature is stamped by their forward / approval while the document is with them
    const mySignatureDue = signatures.required && isCurrentHolder(doc, auth?.user)
        && signatures.pending.some((s: any) => String(s.user_id) === String(auth?.user?.id));

    // Signature block drawn on the last page, where the final signed copy carries it
    const blocks = useMemo(() => signatureBlocks(doc.signatories || []), [doc.signatories]);

    // Main document plus files attached later (e.g. corrections for a returned document)
    const files: { key: string; label: string; url: string; attachmentId: number | null }[] = [
        ...(doc.signed_file_path ? [{ key: 'signed', label: 'Final Signed Copy', url: `/storage/${doc.signed_file_path}`, attachmentId: null }] : []),
        ...(doc.attachment_path ? [{ key: 'main', label: 'Main Document', url: `/storage/${doc.attachment_path}`, attachmentId: null }] : []),
        ...attachments
            .filter((a: any) => a.file_path)
            .map((a: any) => ({ key: `att-${a.attachment_id}`, label: a.file_name, url: `/storage/${a.file_path}`, attachmentId: a.attachment_id as number })),
    ];
    const activeFile = files.find(f => f.key === selectedFileKey) ?? files[0] ?? null;
    const showFile = (key: string) => {
        setSelectedFileKey(key);
        document.getElementById('tng-document-viewer')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    const showAttachment = (attachmentId: number) => showFile(`att-${attachmentId}`);

    const generateFinalCopy = async (target: any = doc) => {
        setGenerating(true);
        setGenerateError(null);
        try {
            await generateSignedCopy(target);
            // Back to the default file, which is now the final signed copy
            setSelectedFileKey(null);
            router.reload({ only: ['dbDocument', 'dbAuditTrail'] });
            showToast('Final signed copy attached to the document.');
        } catch (e: any) {
            setGenerateError(e?.message || 'The final signed copy could not be generated. Please try again.');
        } finally {
            setGenerating(false);
        }
    };

    // Once the last signature is stamped, the first person who has the document open builds the final copy
    const needsFinalCopy = signatures.allSigned && !doc.signed_file_path && canGenerate;
    const finalCopyStarted = useRef(false);
    useEffect(() => {
        if (!needsFinalCopy || finalCopyStarted.current) {
            return;
        }
        finalCopyStarted.current = true;
        void Promise.resolve().then(() => generateFinalCopy());
    }, [needsFinalCopy]);

    // "Scan Text" on the main document stores the text it read (fixes documents whose text was not read at upload)
    const saveOcrText = async (text: string) => {
        try {
            const res = await fetch(`/documents/${doc.document_id}/ocr-text`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...csrfHeaders() },
                credentials: 'same-origin',
                body: JSON.stringify({ ocr_text: text }),
            });
            if (res.ok) {
                router.reload({ only: ['dbDocument', 'dbAuditTrail'] });
            }
        } catch {
            // The text stays visible in the viewer even if saving failed
        }
    };

    const slipData: RoutingSlipModalData = {
        slip_id: slip?.slip_id || doc.document_id,
        formatted_slip_id: slip?.tracking_number || trackingNo || doc.reference_number,
        tracking_number: trackingNo || doc.reference_number,
        document_id: doc.document_id,
        document_ref: doc.reference_number,
        document_title: doc.title,
        from_name: slip?.sender_name || slip?.from_user?.name || submitterName || 'Authorized Submitter',
        from_department: slip?.from_department?.department_name || doc.department?.department_name || 'Origin Department',
        to_name: slip?.to_user?.name || 'Department Pool',
        to_department: slip?.target_department?.department_name || 'Destination Department',
        action: slip?.action || 'Review & Forward',
        instruction: slip?.instruction || 'For review and appropriate action.',
        status: slip?.status || (isReturned ? 'Returned' : 'Active'),
        date: slip?.created_at || doc.created_at,
        formatted_date: (slip?.created_at || doc.created_at || '').slice(0, 10),
        stop_number: 'Stop #1',
        qr_data: trackingNo || doc.reference_number,
        client_name: client?.full_name,
        client_contact: client?.contact_number,
        purpose: client?.purpose,
    };

    const handleAnchoredComment = (e: React.FormEvent) => {
        e.preventDefault();
        if (!anchorComment.trim() || !selectedOcrText.trim()) {
            return;
        }
        setIsSaving(true);
        router.post(`/documents/${doc.document_id}/comments`, {
            comment: anchorComment.trim(),
            quoted_text: selectedOcrText.trim(),
        }, {
            preserveScroll: true,
            onSuccess: () => {
                setAnchorOpen(false);
                setAnchorComment('');
                setSelectedOcrText('');
                showToast('Anchored comment added to the Discussion.');
            },
            onFinish: () => setIsSaving(false),
        });
    };

    const handleLink = (e: React.FormEvent) => {
        e.preventDefault();
        if (!linkTrackingNo.trim()) {
            return;
        }
        setIsSaving(true);
        setLinkError(null);
        router.post(`/documents/${doc.document_id}/link`, { tracking_number: linkTrackingNo.trim() }, {
            preserveScroll: true,
            onSuccess: () => {
                setLinkOpen(false);
                setLinkTrackingNo('');
                showToast('Document linked successfully.');
            },
            onError: (errors) => setLinkError(errors.tracking_number || 'No document was found with that tracking number.'),
            onFinish: () => setIsSaving(false),
        });
    };

    const handleEscalate = (e: React.FormEvent) => {
        e.preventDefault();
        if (!escalateReason.trim()) {
            return;
        }
        setIsSaving(true);
        router.post(`/documents/${doc.document_id}/escalate`, { justification: escalateReason.trim() }, {
            preserveScroll: true,
            onSuccess: () => {
                setEscalateOpen(false);
                setEscalateReason('');
                showToast('Document escalated to CART.');
            },
            onFinish: () => setIsSaving(false),
        });
    };

    const linked = doc.linked_document;

    return (
        <>
            {toast && (
                <div className="fixed top-4 right-4 z-50 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-medium text-white shadow-lg">
                    {toast}
                </div>
            )}

            <div className="w-full max-w-none space-y-6 pb-12">
                {/* Summary */}
                <Card>
                    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 p-5 sm:p-6">
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="font-mono text-[13px] font-semibold text-slate-600">{doc.reference_number}</span>
                                <SeverityPill status={doc.status} />
                                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[12px] font-medium uppercase text-slate-600">
                                    {classification}
                                </span>
                                {isHidden && (
                                    <span className="flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-[12px] font-medium text-red-700" title="Only the sender and the people it is routed to can open this document">
                                        <Lock className="h-3 w-3" /> Contents restricted
                                    </span>
                                )}
                                {signatures.required && (
                                    <span className={`flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[12px] font-medium ${signatures.allSigned ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
                                        <PenLine className="h-3 w-3" /> Signatures {signatures.signed}/{signatures.total}
                                    </span>
                                )}
                                {isUrgent && (
                                    <span className="rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-[12px] font-medium text-red-700">Urgent</span>
                                )}
                                {Boolean(doc.is_escalated) && (
                                    <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-[12px] font-medium text-rose-700">Escalated to CART</span>
                                )}
                            </div>
                            <h1 className="mt-2 text-xl font-semibold text-slate-900 tracking-tight break-words">{doc.title}</h1>
                            <p className="mt-1 text-[13px] text-slate-500">
                                {trackingNo ? `Tracking No. ${trackingNo}` : 'Awaiting registration'}
                                {filedAt && ` · Filed ${formatDate(filedAt, true)}`}
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            {canCorrect && (
                                <button type="button" onClick={() => onCorrectionOpenChange(true)} className="rounded-lg bg-rose-600 px-3.5 py-2 text-[14px] font-medium text-white hover:bg-rose-700">
                                    Correct Document
                                </button>
                            )}
                            <Link
                                href={backUrl}
                                className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-[14px] font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
                            >
                                <ArrowLeft className="h-4 w-4" />
                                Back to List
                            </Link>
                        </div>
                    </div>

                    {status === 'Completed' && (
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-emerald-200 bg-emerald-50 px-5 py-4 sm:px-6">
                            <p className="flex items-center gap-2 text-[14px] font-semibold text-emerald-900">
                                <CheckCircle2 className="h-4 w-4 shrink-0" />
                                Completed{doc.completed_at ? ` on ${formatDate(doc.completed_at, true)}` : ''}.
                                {signatures.required && (doc.signed_file_path
                                    ? ' The final copy with every signature is shown below.'
                                    : ' The final signed copy is being attached.')}
                            </p>
                            {doc.signed_file_path && (
                                <button type="button" onClick={() => showFile('signed')} className="rounded-lg bg-emerald-600 px-3.5 py-2 text-[13px] font-medium text-white hover:bg-emerald-700">
                                    View Signed Copy
                                </button>
                            )}
                        </div>
                    )}

                    {isReturned && (
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rose-200 bg-rose-50 px-5 py-4 sm:px-6">
                            <div>
                                <p className="text-[14px] font-semibold text-rose-900">Document Returned for Correction by {findReturner(doc)}</p>
                                <p className="mt-0.5 text-[13px] text-rose-800">Reason: {doc.return_reason || 'Missing files or corrections required.'}</p>
                                {!canCorrect && (
                                    <p className="mt-1 text-[12px] text-rose-700">Waiting for {describeHolder(doc, users)} to upload the correction.</p>
                                )}
                            </div>
                            {canCorrect && (
                                <button type="button" onClick={() => onCorrectionOpenChange(true)} className="rounded-lg bg-rose-600 px-4 py-2 text-[14px] font-medium text-white hover:bg-rose-700">
                                    Upload Document Correction
                                </button>
                            )}
                        </div>
                    )}

                    {client?.purpose && (
                        <div className="border-b border-slate-200 bg-slate-50/60 px-5 py-4 sm:px-6">
                            <p className="text-[12px] text-slate-500">Purpose</p>
                            <p className="mt-0.5 text-[15px] font-medium text-slate-900">{client.purpose}</p>
                        </div>
                    )}

                    <div className="grid grid-cols-1 divide-y divide-slate-200 md:grid-cols-2 md:divide-x md:divide-y-0">
                        <div className="p-5 sm:p-6">
                            <h2 className="mb-4 text-[15px] font-semibold text-slate-900">From</h2>
                            <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                                {client ? (
                                    <>
                                        <InfoItem label="Name" value={client.full_name} />
                                        <InfoItem label="Client Type" value={`${client.client_type} · ${client.receipt_mode}`} />
                                        <InfoItem label="Contact Number" value={client.contact_number} />
                                        <InfoItem label="Email Address" value={client.email} />
                                        <InfoItem label="Address" value={client.full_address} wide />
                                        <InfoItem label="Organization / Company" value={client.organization} />
                                        <InfoItem label="Sex" value={client.sex} />
                                        <InfoItem label="ID Presented" value={client.id_type ? `${client.id_type} · ${client.id_number}` : null} />
                                        <InfoItem label="Authorized Representative" value={client.representative_name} />
                                    </>
                                ) : (
                                    <>
                                        <InfoItem label="Sender / Submitted By" value={doc.sender || submitterName || 'Unknown'} />
                                        <InfoItem label="Department" value={doc.department?.department_name} />
                                        <InfoItem label="Contact Number" value={doc.contact_number || 'N/A'} />
                                    </>
                                )}
                            </dl>
                        </div>
                        <div className="p-5 sm:p-6">
                            <h2 className="mb-4 text-[15px] font-semibold text-slate-900">Document Details</h2>
                            <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                                <InfoItem label="Tracking Number" value={trackingNo || doc.reference_number} />
                                <InfoItem label="Document Category" value={doc.type?.type_name || 'N/A'} />
                                {client && <InfoItem label="Department" value={doc.department?.department_name} />}
                                <InfoItem label="Date Filed" value={formatDate(filedAt, true)} />
                                <InfoItem label={client ? 'Received By' : 'Filed By'} value={submitterName} />
                                <InfoItem label="Expected Due Date (SLA)" value={formatDate(dueDate) || 'Normal Processing'} />
                                <InfoItem label="Classification" value={isUrgent ? `${classification.toUpperCase()} · URGENT` : classification.toUpperCase()} />
                                <InfoItem
                                    label="Linked Document / Version"
                                    value={`${linked ? (linked.tracking_number || linked.reference_number) : 'None'} / ${doc.version || 'v1.0'}`}
                                />
                                <InfoItem label="Current Holder" value={describeHolder(doc, users)} wide />
                                <InfoItem label="Urgency Justification" value={doc.urgency_justification} wide />
                            </dl>
                        </div>
                    </div>

                    {/* FSM Document Lifecycle Tracker */}
                    <div className="border-t border-slate-200 px-3 py-4 sm:px-5">
                        <StepProgress
                            document={doc}
                            currentStep={doc.current_step_index || 1}
                            currentHolderName={doc.current_holder?.name}
                            auditTrails={trail}
                            showProcessBadge={false}
                            compact
                        />
                    </div>
                </Card>

                <div className="grid grid-cols-1 gap-6 xl:grid-cols-12 items-start">
                    {/* Integrated Document Viewer & OCR Workspace */}
                    <Card
                        title="Integrated Document Viewer & OCR Workspace"
                        className="xl:col-span-8 overflow-hidden"
                        aside={
                            <div className="flex flex-wrap items-center gap-2">
                                {files.length > 1 && (
                                    <select
                                        value={activeFile?.key}
                                        onChange={(e) => setSelectedFileKey(e.target.value)}
                                        className="h-8 max-w-[240px] rounded-lg border border-slate-300 bg-white px-2 text-[13px] text-slate-700"
                                        aria-label="File to view"
                                    >
                                        {files.map(f => <option key={f.key} value={f.key}>{f.key === 'main' || f.key === 'signed' ? f.label : `Attachment: ${f.label}`}</option>)}
                                    </select>
                                )}
                                {!isHidden && (
                                    <>
                                        <Link href={`/documents/${doc.document_id}/ocr-workspace`} className="text-[13px] font-medium text-[#0066cc] hover:underline">
                                            Full-Screen OCR
                                        </Link>
                                        <button
                                            type="button"
                                            onClick={() => setAnchorOpen(true)}
                                            title="Comment on a passage of the document (select text first, or type the passage)"
                                            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[13px] font-medium text-slate-700 hover:bg-slate-50"
                                        >
                                            Add Anchored Comment{selectedOcrText ? ' (Text Selected)' : ''}
                                        </button>
                                    </>
                                )}
                            </div>
                        }
                    >
                        {signatures.required && activeFile?.key === 'main' && mainKind !== 'other' && (
                            <p className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-5 py-2.5 text-[13px] text-slate-600">
                                <PenLine className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                                Signatures are stamped at the bottom of the last page ({signatures.signed} of {signatures.total} stamped).
                            </p>
                        )}
                        <div id="tng-document-viewer" className="p-4 scroll-mt-4">
                            <IntegratedDocumentViewer
                                fileUrl={activeFile?.url ?? null}
                                ocrText={!activeFile || activeFile.key === 'main' ? doc.ocr_text : null}
                                fileName={activeFile && activeFile.key !== 'main' ? activeFile.label : (doc.title || doc.reference_number)}
                                documentId={doc.document_id}
                                attachmentId={activeFile?.attachmentId ?? null}
                                downloadVariant={activeFile?.key === 'signed' ? 'signed' : null}
                                signatureBlocks={signatures.required && activeFile?.key === 'main' && mainKind !== 'other' ? blocks : []}
                                onOcrText={activeFile?.key === 'main' && !isHidden ? saveOcrText : undefined}
                                isConfidential={isHidden}
                                selectedText={selectedOcrText}
                                onTextSelect={setSelectedOcrText}
                                onAddAnchoredComment={(text) => {
                                    setSelectedOcrText(text);
                                    setAnchorOpen(true);
                                }}
                            />
                        </div>
                    </Card>

                    <div className="xl:col-span-4 flex flex-col gap-6">
                        <Card title={actionsTitle}>
                            <div className="space-y-3 p-5">
                                {flash?.signature_stamped && (
                                    <p role="status" className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-[13px] text-emerald-800">
                                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                                        <span>Your registered signature was stamped on the document.</span>
                                    </p>
                                )}
                                {mySignatureDue && (auth?.user?.has_signature ? (
                                    <p className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-[13px] text-blue-900">
                                        <PenLine className="mt-0.5 h-4 w-4 shrink-0" />
                                        <span>
                                            <span className="font-semibold">You are a signatory.</span> Your registered signature will be stamped on this document automatically when you forward or approve it.
                                        </span>
                                    </p>
                                ) : (
                                    <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[13px] text-amber-900">
                                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                                        <span>
                                            <span className="font-semibold">You are a signatory, but your account has no registered signature.</span> Ask HR to add it before you approve this document.
                                        </span>
                                    </p>
                                ))}
                                {errors?.signature && (
                                    <p role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-[13px] text-red-700">
                                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                                        <span>{errors.signature}</span>
                                    </p>
                                )}
                                {actions}
                                <div className="grid grid-cols-2 gap-3 border-t border-slate-200 pt-3">
                                    <button type="button" onClick={() => setSlipOpen(true)} className={actionButton.secondary}>
                                        Print QR
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setExportOpen(true)}
                                        disabled={isHidden}
                                        title={isHidden ? 'Only the sender and recipients can download a confidential document' : undefined}
                                        className={actionButton.secondary}
                                    >
                                        Export PDF
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setLinkOpen(true)}
                                        disabled={!isHolder}
                                        title={isHolder ? undefined : 'Only the current holder can link documents'}
                                        className={actionButton.secondary}
                                    >
                                        Link Document
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setEscalateOpen(true)}
                                        disabled={Boolean(doc.is_escalated)}
                                        className={actionButton.secondary}
                                        title={doc.is_escalated ? 'Already escalated to CART' : 'Flag for ARTA non-compliance review'}
                                    >
                                        {doc.is_escalated ? 'Escalated' : 'Escalate to CART'}
                                    </button>
                                </div>
                            </div>
                        </Card>

                        <Card
                            title="Routing Slip"
                            aside={slip && (
                                <button type="button" onClick={() => setSlipOpen(true)} className="text-[13px] font-medium text-[#0066cc] hover:underline">
                                    View Official Slip
                                </button>
                            )}
                        >
                            {slip ? (
                                <div className="flex gap-4 p-5">
                                    <dl className="flex-1 space-y-3 min-w-0">
                                        <InfoItem label="From" value={[slip.sender_name || slip.from_user?.name, slip.from_department?.department_name].filter(Boolean).join(' · ')} />
                                        <InfoItem label="To" value={[slip.target_department?.department_name, slip.to_user?.name || 'Department Pool'].filter(Boolean).join(' · ')} />
                                        <InfoItem label="Instructions" value={slip.instruction || 'For review and appropriate action.'} />
                                    </dl>
                                    <div className="shrink-0 text-right">
                                        <img
                                            src={qrDataUrl(trackingLinkFor(trackingNo || doc.reference_number))}
                                            alt={`QR code for ${trackingNo || doc.reference_number}`}
                                            title={trackingLinkFor(trackingNo || doc.reference_number)}
                                            className="ml-auto h-16 w-16 mix-blend-multiply"
                                        />
                                        <p className="mt-1 text-[12px] font-semibold text-slate-700">Stop #1</p>
                                        <p className="text-[11px] text-slate-500">{formatDate(slip.created_at)}</p>
                                    </div>
                                </div>
                            ) : (
                                <p className="p-5 text-[13px] text-slate-500">No routing slip generated yet. Pending registration.</p>
                            )}
                        </Card>

                        <DiscussionAuditTimeline
                            document={doc}
                            auditTrail={trail}
                            comments={comments}
                            attachments={attachments}
                            selectedSnippet={selectedOcrText}
                            onClearSnippet={() => setSelectedOcrText('')}
                            onViewAttachment={showAttachment}
                        />

                        {/* Digital Signatories: chosen by the sender, each signs when the document reaches them */}
                        <Card
                            title="Signatories"
                            aside={signatures.required && (
                                <span className="text-[12px] font-medium text-slate-500">{signatures.signed} of {signatures.total} signed</span>
                            )}
                        >
                            <SignatoriesPanel
                                doc={doc}
                                canGenerate={canGenerate}
                                generating={generating}
                                generateError={generateError}
                                onGenerate={() => generateFinalCopy()}
                                onViewSignedCopy={() => showFile('signed')}
                            />
                        </Card>
                    </div>
                </div>
            </div>

            <RoutingSlipModal isOpen={slipOpen} onClose={() => setSlipOpen(false)} slip={slipData} currentRole={role} />

            <ExportPasswordModal
                isOpen={exportOpen}
                onClose={() => setExportOpen(false)}
                documentId={doc.document_id}
                variant={doc.signed_file_path ? 'signed' : null}
                identifier={doc.reference_number}
                onSuccess={(msg) => showToast(msg)}
            />

            <BaseModal
                isOpen={anchorOpen}
                onClose={() => setAnchorOpen(false)}
                title="Add Anchored Comment"
                identifier={doc.reference_number}
                description="Attach feedback to the highlighted text in the document."
                maxWidth="max-w-lg"
                formProps={{ onSubmit: handleAnchoredComment }}
                footer={
                    <>
                        <button type="button" onClick={() => setAnchorOpen(false)} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors">Cancel</button>
                        <button type="submit" disabled={!anchorComment.trim() || !selectedOcrText.trim() || isSaving} className="rounded-lg bg-[var(--tng-blue-600)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--tng-blue-700)] transition-colors disabled:opacity-60">Save Comment</button>
                    </>
                }
            >
                <div className="space-y-3">
                    <div>
                        <label className="mb-1.5 block text-xs font-semibold text-slate-700">Quoted Passage <span className="text-red-500">*</span></label>
                        <textarea
                            value={selectedOcrText}
                            onChange={(e) => setSelectedOcrText(e.target.value)}
                            rows={2}
                            placeholder="Select text in the document (or OCR Text view) before opening this, or type / paste the passage here..."
                            className="w-full rounded-lg border-l-4 border-blue-400 border-y border-r border-y-slate-200 border-r-slate-200 bg-blue-50/60 p-3 text-sm italic text-slate-700 focus:outline-none focus:ring-1 focus:ring-[var(--tng-blue-500)]"
                        />
                    </div>
                    <div>
                        <label className="mb-1.5 block text-xs font-semibold text-slate-700">Comment <span className="text-red-500">*</span></label>
                        <textarea
                            value={anchorComment}
                            onChange={(e) => setAnchorComment(e.target.value)}
                            rows={3}
                            placeholder="Type your comment here..."
                            className="w-full rounded-lg border border-slate-200 p-3 text-sm focus:border-[var(--tng-blue-500)] focus:ring-1 focus:ring-[var(--tng-blue-500)]"
                            autoFocus
                        />
                    </div>
                </div>
            </BaseModal>

            <BaseModal
                isOpen={linkOpen}
                onClose={() => setLinkOpen(false)}
                title="Link Related Document"
                identifier={doc.reference_number}
                description="Attach another document as a cross-reference using its tracking number."
                maxWidth="max-w-md"
                formProps={{ onSubmit: handleLink }}
                footer={
                    <>
                        <button type="button" onClick={() => setLinkOpen(false)} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors">Cancel</button>
                        <button type="submit" disabled={!linkTrackingNo.trim() || isSaving} className="rounded-lg bg-[var(--tng-blue-600)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--tng-blue-700)] transition-colors disabled:opacity-60">Link Document</button>
                    </>
                }
            >
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Tracking Number</label>
                <input
                    type="text"
                    value={linkTrackingNo}
                    onChange={(e) => setLinkTrackingNo(e.target.value)}
                    placeholder="e.g. RS-2026-0030"
                    className="w-full rounded-lg border border-slate-200 p-2.5 text-sm focus:border-[var(--tng-blue-500)] focus:ring-1 focus:ring-[var(--tng-blue-500)]"
                />
                {linkError && <p className="mt-1.5 text-[12px] font-medium text-red-600">{linkError}</p>}
                {linked && <p className="mt-2 text-[12px] text-slate-500">Currently linked to {linked.tracking_number || linked.reference_number}.</p>}
            </BaseModal>

            <BaseModal
                isOpen={escalateOpen}
                onClose={() => setEscalateOpen(false)}
                title="Escalate to CART"
                identifier={doc.reference_number}
                description="Flag for ARTA non-compliance investigation and expedited review."
                headerClassName="bg-rose-50/70"
                maxWidth="max-w-md"
                formProps={{ onSubmit: handleEscalate }}
                footer={
                    <>
                        <button type="button" onClick={() => setEscalateOpen(false)} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors">Cancel</button>
                        <button type="submit" disabled={!escalateReason.trim() || isSaving} className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 transition-colors disabled:opacity-60">Submit Escalation</button>
                    </>
                }
            >
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Escalation Justification</label>
                <textarea
                    rows={3}
                    value={escalateReason}
                    onChange={(e) => setEscalateReason(e.target.value)}
                    placeholder="Please provide justification for this escalation..."
                    className="w-full rounded-lg border border-rose-200 bg-rose-50/30 p-2.5 text-sm text-slate-900 focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                />
            </BaseModal>

            <DocumentCorrectionModal
                open={correctionOpen}
                onClose={() => onCorrectionOpenChange(false)}
                document={doc}
                returnReason={doc.return_reason}
                onSuccess={() => {
                    showToast(`Correction submitted and sent back to ${findReturner(doc)}.`);
                    router.reload({ only: ['dbDocument', 'dbAuditTrail', 'dbComments', 'dbAttachments'] });
                }}
            />
        </>
    );
}

export default DocumentDetailView;
