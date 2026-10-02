import React, { useState, useRef, useEffect } from 'react';
import { useForm, usePage } from '@inertiajs/react';
import { Plus, ScanLine, Loader2, FileText, CheckCircle2, AlertCircle, ChevronDown, ChevronUp, X, Inbox } from 'lucide-react';
import { BaseModal } from '@/components/trackngo/BaseModal';
import { ClientInfoSection, ClientInfo, EMPTY_CLIENT, validateClient } from '@/components/trackngo/ClientInfoSection';
import { extractDocumentText, withTimeout } from '@/lib/ocr';
import { qrDataUrl, useTrackingLink } from '@/lib/qr';

// OCR must never block submission: scanned pages and photos take a few seconds each, so cap the wait
const OCR_TIMEOUT_MS = 120000;
// Formats the system can display (old .doc files cannot be previewed in the browser)
const ACCEPTED_FILES = '.pdf,.docx,.png,.jpg,.jpeg';

// Human-readable labels for server validation errors that have no inline slot in the form
const FIELD_LABELS: Record<string, string> = {
    file: 'Document file',
    title: 'Title',
    type_id: 'Document type',
    department_id: 'Originating department',
    classification: 'Classification',
    forward_to: 'Forward to',
    forward_to_user: 'Recipient',
    instruction: 'Instructions / remarks',
    ocr_text: 'Extracted text',
    urgency_justification: 'Urgency justification',
    client: 'Client information',
    signatories: 'Signatories',
};

// Officials who can sign; the Receiving Clerk only registers documents and Admin accounts are not signatories
const canBeSignatory = (u: any) => !['receiving clerk', 'admin'].includes(String(u.role_name || '').toLowerCase());
// Full name as the server builds it (first, middle, last), e.g. "Dr. Elena Pascual"
const personName = (u: any) => u.name || [u.first_name, u.last_name].filter(Boolean).join(' ') || `User #${u.id}`;

const inputClass = 'h-9 w-full rounded-lg border border-[var(--tng-slate-200)] bg-white px-3 text-sm text-[var(--tng-slate-900)] focus:border-[var(--tng-blue-500)] focus:outline-none focus:ring-2 focus:ring-[var(--tng-blue-500)]/20';
const readOnlyClass = 'h-9 w-full rounded-lg border border-[var(--tng-slate-200)] bg-[var(--tng-slate-50)] px-3 text-sm text-[var(--tng-slate-600)] cursor-not-allowed flex items-center truncate';
const labelClass = 'mb-1.5 block text-xs font-medium text-[var(--tng-slate-700)]';
const errorClass = 'text-[11px] text-red-600 mt-1 font-medium';

type CreatedDocument = {
    document_id?: number;
    reference_number?: string;
    tracking_number?: string | null;
    recipient_name?: string | null;
    recipient_office?: string | null;
    is_internal?: boolean;
    addressee_name?: string | null;
    addressee_office?: string | null;
};

export interface CreateDocumentModalProps {
    isOpen: boolean;
    onClose: () => void;
    departments?: any[];
    documentTypes?: any[];
    users?: any[];
}

function SectionHeading({ step, title }: { step: number; title: string }) {
    return (
        <h3 className="text-sm font-semibold text-[var(--tng-slate-900)] mb-4 flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--tng-slate-100)] text-[10px] text-[var(--tng-slate-600)]">{step}</span>
            {title}
        </h3>
    );
}

export default function CreateDocumentModal({
    isOpen,
    onClose,
    departments = [],
    documentTypes = [],
    users = []
}: CreateDocumentModalProps) {
    const { props } = usePage();
    const trackingLinkFor = useTrackingLink();
    const authUser = (props.auth as any)?.user;
    // Effective server upload ceiling (PHP upload_max_filesize / post_max_size / app rule), shared by HandleInertiaRequests
    const uploadLimit = (props as any).upload as { max_bytes?: number; max_label?: string } | undefined;
    const maxUploadBytes = uploadLimit?.max_bytes || 10 * 1024 * 1024;
    const maxUploadLabel = uploadLimit?.max_label || '10 MB';
    // Shared auth role key is 'receiving' (see HandleInertiaRequests); clerks only file external documents
    const isReceivingClerk = authUser?.role === 'receiving' || authUser?.role === 'receiving_clerk';
    const isDeptHeadUser = (u: any) => (u.role_name || '').toLowerCase() === 'department head';

    // Receiving clerks route external documents to a Department Head, so only offer departments that have one
    const deptHeadDeptIds = new Set((users || []).filter(isDeptHeadUser).map(u => String(u.department_id)));
    const forwardDepartments = isReceivingClerk
        ? departments.filter(d => deptHeadDeptIds.has(String(d.department_id)))
        : departments;

    const receivingDept = (departments || []).find(d => d.code === 'REC' || (d.department_name && d.department_name.toLowerCase().includes('receiving')));
    const defaultOriginDept = authUser?.department_id || (receivingDept ? receivingDept.department_id : (departments[0]?.department_id || ''));

    const { data, setData, post, processing, errors, reset, clearErrors, setError, transform } = useForm({
        title: '',
        type_id: '',
        department_id: defaultOriginDept,
        file: null as File | null,
        classification: 'normal',
        urgency_justification: '',
        forward_to: '',
        forward_to_user: '',
        instruction: '',
        ocr_text: '',
        client: { ...EMPTY_CLIENT } as ClientInfo,
        // Signing order = list order
        signatories: [] as string[],
    });
    const [requiresSignature, setRequiresSignature] = useState(false);
    // Client details only apply to the clerk's external intake; signatories only when signatures are required
    transform(({ client, signatories, ...rest }) => ({
        ...rest,
        ...(isReceivingClerk ? { client } : {}),
        ...(requiresSignature ? { signatories } : {}),
    }));
    const fieldErrors = errors as Record<string, string | undefined>;

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isScanning, setIsScanning] = useState(false);
    const [scanMessage, setScanMessage] = useState('Reading document...');
    const [textFound, setTextFound] = useState(true);
    const [ocrComplete, setOcrComplete] = useState(false);
    const [isUrgent, setIsUrgent] = useState(false);
    const [isConfidential, setIsConfidential] = useState(false);
    const [step, setStep] = useState<'form' | 'success'>('form');
    const [trackingNumber, setTrackingNumber] = useState('');
    const [createdDoc, setCreatedDoc] = useState<CreatedDocument | null>(null);
    const [submitError, setSubmitError] = useState<string | null>(null);
    // Synchronous guard so a double-click can never post twice (processing updates asynchronously)
    const submittingRef = useRef(false);
    const errorBannerRef = useRef<HTMLDivElement>(null);

    // The banner sits at the top of a scrollable body; bring it into view (the user is usually scrolled to the button)
    useEffect(() => {
        if (submitError) errorBannerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, [submitError]);

    const resetForm = () => {
        setStep('form');
        setOcrComplete(false);
        setIsScanning(false);
        setIsUrgent(false);
        setIsConfidential(false);
        setRequiresSignature(false);
        setSubmitError(null);
        setCreatedDoc(null);
        reset();
        clearErrors();
        setData('department_id', defaultOriginDept);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    useEffect(() => {
        if (isOpen) resetForm();
    }, [isOpen, defaultOriginDept]);

    // Dependent dropdown for Forward To Users
    const availableUsers = data.forward_to
        ? (users || []).filter(u =>
            String(u.department_id) === String(data.forward_to) &&
            String(u.id) !== String(authUser?.id) &&
            // The clerk registers internal documents automatically, so a clerk is never the recipient
            (isReceivingClerk ? isDeptHeadUser(u) : (u.role_name || '').toLowerCase() !== 'receiving clerk'))
        : [];

    // Internal documents within the sender's own office must name the colleague who receives them
    const sendingWithinOwnOffice = !isReceivingClerk && Boolean(data.forward_to) && String(data.forward_to) === String(authUser?.department_id);

    const signatoryOptions = (users || []).filter(u =>
        canBeSignatory(u) &&
        !data.signatories.includes(String(u.id)) &&
        (!isReceivingClerk || String(u.id) !== String(authUser?.id)));
    const signatoryUser = (id: string) => (users || []).find(u => String(u.id) === id);
    const addSignatory = (id: string) => {
        if (!id || data.signatories.includes(id)) return;
        setData('signatories', [...data.signatories, id]);
        clearErrors('signatories' as any);
    };
    const removeSignatory = (id: string) => setData('signatories', data.signatories.filter(s => s !== id));
    const moveSignatory = (index: number, offset: -1 | 1) => {
        const next = [...data.signatories];
        const target = index + offset;
        if (target < 0 || target >= next.length) return;
        [next[index], next[target]] = [next[target], next[index]];
        setData('signatories', next);
    };
    const fileStampable = !data.file || /\.(pdf|png|jpe?g)$/i.test(data.file.name);

    const updateClient = (field: keyof ClientInfo, value: string) => {
        setData(prev => ({ ...prev, client: { ...prev.client, [field]: value } }));
        if (fieldErrors[`client.${field}`]) clearErrors(`client.${field}` as any);
    };

    const handleFileUploadClick = () => {
        if (ocrComplete || isScanning) return;
        fileInputRef.current?.click();
    };

    // Real text of the file (PDF text layer, OCR for scans / photos, Word paragraphs); '' if nothing readable
    const readDocumentText = async (file: File) => {
        try {
            return await withTimeout(extractDocumentText(file, file.name, setScanMessage), OCR_TIMEOUT_MS);
        } catch (error) {
            console.error('Error reading document text:', error);
            return '';
        }
    };

    const formatFileNameToTitle = (filename: string) => {
        let name = filename.substring(0, filename.lastIndexOf('.')) || filename;
        name = name.replace(/[-_]/g, ' ');
        return name.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase());
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > maxUploadBytes) {
            // PHP would silently drop an oversized file, so reject it here with the real limit
            setError('file', `This file is ${(file.size / (1024 * 1024)).toFixed(2)} MB. The server accepts files up to ${maxUploadLabel}.`);
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

        clearErrors('file');
        setSubmitError(null);
        setScanMessage('Reading document...');
        setIsScanning(true);
        setData('file', file);

        const extractedText = await readDocumentText(file);
        setTextFound(extractedText.trim().length > 0);

        const generatedTitle = formatFileNameToTitle(file.name);

        let matchedTypeId = '';
        const titleLower = generatedTitle.toLowerCase();
        if (titleLower.includes('executive order')) {
            matchedTypeId = documentTypes.find(t => t.type_name.toLowerCase().includes('executive'))?.type_id || '';
        } else if (titleLower.includes('memo')) {
            matchedTypeId = documentTypes.find(t => t.type_name.toLowerCase().includes('memo'))?.type_id || '';
        } else if (titleLower.includes('travel')) {
            matchedTypeId = documentTypes.find(t => t.type_name.toLowerCase().includes('travel'))?.type_id || '';
        } else if (titleLower.includes('comm') || titleLower.includes('letter')) {
            matchedTypeId = documentTypes.find(t => t.type_name.toLowerCase().includes('comm'))?.type_id || '';
        } else {
            matchedTypeId = documentTypes[0]?.type_id || '';
        }

        setData(prev => ({
            ...prev,
            file: file,
            ocr_text: extractedText.trim(),
            title: generatedTitle.slice(0, 150), // documents.title is varchar(150)
            type_id: matchedTypeId || prev.type_id
        }));

        setIsScanning(false);
        setOcrComplete(true);
    };

    // Client-side check mirrors StoreDocumentRequest so a single click either submits or shows exactly what is missing
    const validateBeforeSubmit = (): Record<string, string> => {
        const found: Record<string, string> = {};
        if (!data.file) found.file = 'Upload the document first.';
        if (data.file && data.file.size > maxUploadBytes) found.file = `The file exceeds the ${maxUploadLabel} upload limit.`;
        if (data.file && !ocrComplete) found.file = 'Please wait for the scan to finish.';
        if (data.file && !String(data.title).trim()) found.title = 'Title is required.';
        if (data.file && !data.type_id) found.type_id = 'Select a document type.';
        if (!data.department_id) found.department_id = 'Select the originating department.';
        if (!data.forward_to) found.forward_to = 'Select the destination department.';
        if (sendingWithinOwnOffice && !data.forward_to_user) found.forward_to_user = 'Choose the person in your office who should receive this document.';
        if (requiresSignature && data.signatories.length === 0) found.signatories = 'Add at least one signatory, or untick "Requires signatures".';
        if (isUrgent && !String(data.urgency_justification).trim()) found.urgency_justification = 'State the justification for urgency.';
        if (isReceivingClerk) Object.assign(found, validateClient(data.client));
        return found;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (processing || isScanning || submittingRef.current) return;

        setSubmitError(null);
        clearErrors();
        const clientErrors = validateBeforeSubmit();
        if (Object.keys(clientErrors).length > 0) {
            setError(clientErrors as any);
            setSubmitError('Please complete the highlighted fields before submitting.');
            return;
        }

        submittingRef.current = true;
        post('/documents', {
            forceFormData: true,
            preserveScroll: true,
            preserveState: true,
            onSuccess: (page: any) => {
                const flash = page.props?.flash || {};
                const created: CreatedDocument | null = flash.created_document || null;
                const fromMessage = String(flash.success || '').match(/RS-\d{4}-\d{4}/)?.[0];
                setCreatedDoc(created);
                setTrackingNumber(created?.tracking_number || fromMessage || created?.reference_number || '');
                window.dispatchEvent(new CustomEvent('tng:document-sent', { detail: created }));
                window.dispatchEvent(new CustomEvent('tng:fsm-refresh'));
                setStep('success');
            },
            onError: (serverErrors) => {
                // Client field messages already name the field ("The first name field is required.")
                const summary = Object.entries(serverErrors)
                    .map(([field, message]) => field.startsWith('client.') ? message : `${FIELD_LABELS[field] ?? field}: ${message}`)
                    .join(' ');
                setSubmitError(summary || 'The document could not be submitted. Please review the form.');
            },
            // Non-validation failures (413 too large, 419 session expired, 500) would otherwise open Inertia's error dialog or do nothing visible
            onHttpException: (response: any) => {
                const status = Number(response?.status);
                setSubmitError(
                    status === 413 ? `The file is too large for the server. Please upload a file up to ${maxUploadLabel}.`
                    : status === 419 ? 'Your session expired. Please refresh the page and submit again.'
                    : `The server could not process the submission (HTTP ${status || 'error'}). Please try again.`
                );
                return false;
            },
            onNetworkError: () => {
                setSubmitError('Could not reach the server. Check that the application is running and try again.');
                return false;
            },
            onFinish: () => {
                submittingRef.current = false;
            },
        });
    };

    const qrPayload = trackingNumber || createdDoc?.reference_number || '';

    if (!isOpen) return null;

    const uploadArea = (
        <>
            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept={ACCEPTED_FILES}
                onChange={handleFileChange}
            />

            {!ocrComplete && !isScanning && (
                <div
                    onClick={handleFileUploadClick}
                    className={`group relative flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed ${errors.file ? 'border-red-400 bg-red-50' : 'border-[var(--tng-slate-200)] bg-[var(--tng-slate-50)] hover:border-[var(--tng-blue-400)] hover:bg-[var(--tng-blue-50)]'} py-8 transition-colors`}
                >
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm group-hover:bg-[var(--tng-blue-100)] group-hover:text-[var(--tng-blue-600)] transition-colors">
                        <ScanLine className="h-5 w-5 text-[var(--tng-slate-400)] group-hover:text-[var(--tng-blue-600)]" />
                    </div>
                    <div className="text-center">
                        <p className="text-sm font-medium text-[var(--tng-slate-700)]">Click to upload or drag and drop</p>
                        <p className="text-xs text-[var(--tng-slate-500)] mt-1">PDF, Word (.docx), PNG, JPG (max. {maxUploadLabel})</p>
                    </div>
                    {errors.file && <p className="text-xs text-red-600 mt-2">{errors.file}</p>}
                </div>
            )}

            {isScanning && (
                <div className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-[var(--tng-blue-300)] bg-[var(--tng-blue-50)] py-8">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm">
                        <Loader2 className="h-5 w-5 animate-spin text-[var(--tng-blue-600)]" />
                    </div>
                    <div className="text-center">
                        <p className="text-sm font-medium text-[var(--tng-blue-700)]">{scanMessage}</p>
                        <p className="text-xs text-[var(--tng-blue-500)] mt-1">Extracting text (OCR) and detecting the document type</p>
                    </div>
                </div>
            )}

            {ocrComplete && data.file && errors.file && (
                <p className={errorClass}>{errors.file}</p>
            )}

            {ocrComplete && data.file && (
                <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white shadow-sm">
                            <FileText className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-medium text-emerald-900 truncate">{data.file.name}</p>
                            <p className="text-[11px] text-emerald-700 mt-0.5">{(data.file.size / (1024 * 1024)).toFixed(2)} MB</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => {
                            setOcrComplete(false);
                            setData('file', null);
                            if (fileInputRef.current) fileInputRef.current.value = '';
                        }}
                        className="text-[13px] font-medium text-emerald-700 hover:text-emerald-800"
                    >
                        Replace
                    </button>
                </div>
            )}

            {ocrComplete && data.file && !textFound && (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
                    No readable text was found in this file. You can still submit it; the text can be read later with "Scan Text" in the document viewer.
                </p>
            )}

            {ocrComplete && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className={labelClass}>
                            Title <span className="text-red-500 font-semibold">*</span>
                        </label>
                        <input
                            type="text"
                            value={data.title}
                            maxLength={150}
                            onChange={e => setData('title', e.target.value)}
                            className={inputClass}
                        />
                        {errors.title && <p className={errorClass}>{errors.title}</p>}
                    </div>
                    <div>
                        <label className={labelClass}>
                            Document Type <span className="text-red-500 font-semibold">*</span>
                        </label>
                        <select
                            value={data.type_id}
                            onChange={e => setData('type_id', e.target.value)}
                            className={inputClass}
                        >
                            <option value="">Select type...</option>
                            {documentTypes.map(type => (
                                <option key={type.type_id} value={type.type_id}>{type.type_name}</option>
                            ))}
                        </select>
                        {errors.type_id && <p className={errorClass}>{errors.type_id}</p>}
                    </div>
                    <p className="sm:col-span-2 -mt-2 text-[11px] text-[var(--tng-slate-500)]">Detected from the file. Please check before submitting.</p>
                </div>
            )}
        </>
    );

    const urgentOption = (
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
            <label className="flex items-start gap-3 cursor-pointer">
                <input
                    type="checkbox"
                    checked={isUrgent}
                    onChange={(e) => {
                        setIsUrgent(e.target.checked);
                        if (!e.target.checked) setData('urgency_justification', '');
                    }}
                    className="mt-0.5 h-4 w-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                />
                <div className="flex-1">
                    <span className="block text-xs font-semibold text-amber-800">
                        Mark as Urgent / Rush
                    </span>
                    <span className="block text-[11px] text-amber-700/80 mt-0.5">
                        Halves the ARTA processing time for this document type. Requires justification.
                    </span>

                    {isUrgent && (
                        <div className="mt-3">
                            <input
                                type="text"
                                value={data.urgency_justification}
                                onChange={e => setData('urgency_justification', e.target.value)}
                                placeholder="State justification for urgency..."
                                className="h-8 w-full rounded-lg border border-amber-300 bg-white px-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                            />
                            {errors.urgency_justification && <p className={errorClass}>{errors.urgency_justification}</p>}
                        </div>
                    )}
                </div>
            </label>
        </div>
    );

    const routingFields = (
        <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                    <label className={labelClass}>
                        Forward To <span className="text-red-500 font-semibold">*</span>
                    </label>
                    <select
                        value={data.forward_to}
                        onChange={e => setData(d => ({ ...d, forward_to: e.target.value, forward_to_user: '' }))}
                        className={inputClass}
                    >
                        <option value="">Select destination office...</option>
                        {forwardDepartments.map(dept => (
                            <option key={dept.department_id} value={dept.department_id}>{dept.department_name}</option>
                        ))}
                    </select>
                    {errors.forward_to && <p className={errorClass}>{errors.forward_to}</p>}
                </div>

                <div>
                    <label className={labelClass}>
                        {isReceivingClerk
                            ? 'Department Head (Optional)'
                            : sendingWithinOwnOffice
                                ? <>Recipient <span className="text-red-500 font-semibold">*</span></>
                                : 'Recipient (Optional)'}
                    </label>
                    <select
                        value={data.forward_to_user}
                        onChange={e => setData('forward_to_user', e.target.value)}
                        disabled={!data.forward_to}
                        className={`${inputClass} disabled:bg-[var(--tng-slate-50)] disabled:text-[var(--tng-slate-400)]`}
                    >
                        <option value="">
                            {isReceivingClerk ? 'Department Head of this office...' : sendingWithinOwnOffice ? 'Choose a colleague...' : 'Head of the office...'}
                        </option>
                        {availableUsers.map(user => (
                            <option key={user.id} value={user.id}>
                                {user.first_name} {user.last_name} {user.role_name ? `(${user.role_name})` : ''}
                            </option>
                        ))}
                    </select>
                    {errors.forward_to_user && <p className={errorClass}>{errors.forward_to_user}</p>}
                </div>
            </div>
            <div>
                <label className={labelClass}>
                    Instructions / Remarks
                </label>
                <textarea
                    value={data.instruction}
                    onChange={e => setData('instruction', e.target.value)}
                    placeholder="Enter instructions for the recipient..."
                    rows={3}
                    maxLength={500}
                    className="w-full rounded-lg border border-[var(--tng-slate-200)] bg-white p-3 text-sm text-[var(--tng-slate-900)] placeholder:text-[var(--tng-slate-400)] focus:border-[var(--tng-blue-500)] focus:outline-none focus:ring-2 focus:ring-[var(--tng-blue-500)]/20"
                />
            </div>
        </>
    );

    const signatureSection = (
        <div className="space-y-3">
            <label className="flex items-start gap-3 rounded-lg border border-[var(--tng-slate-200)] bg-white p-3 cursor-pointer transition-colors hover:border-[var(--tng-blue-300)] hover:bg-[var(--tng-blue-50)]">
                <input
                    type="checkbox"
                    checked={requiresSignature}
                    onChange={e => {
                        setRequiresSignature(e.target.checked);
                        if (!e.target.checked) clearErrors('signatories' as any);
                    }}
                    className="mt-0.5 h-4 w-4 rounded border-[var(--tng-slate-300)] text-[var(--tng-blue-600)] focus:ring-[var(--tng-blue-500)]"
                />
                <div>
                    <span className="block text-xs font-semibold text-[var(--tng-slate-800)]">Requires signatures</span>
                    <span className="block text-[11px] text-[var(--tng-slate-500)] mt-0.5 leading-tight">
                        Each signatory's registered signature (from HR) is stamped automatically at the bottom of the last page when they forward or approve the document. It cannot be completed until everyone has signed.
                    </span>
                </div>
            </label>

            {requiresSignature && (
                <div className="space-y-2">
                    {data.signatories.length > 0 && (
                        <ol className="space-y-1.5">
                            {data.signatories.map((id, index) => {
                                const user = signatoryUser(id);
                                return (
                                    <li key={id} className="flex items-center gap-2 rounded-lg border border-[var(--tng-slate-200)] bg-[var(--tng-slate-50)] px-3 py-2">
                                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-semibold text-[var(--tng-slate-600)] border border-[var(--tng-slate-200)]">{index + 1}</span>
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm text-[var(--tng-slate-900)]">
                                                {user ? personName(user) : `User #${id}`}{String(id) === String(authUser?.id) ? ' (you)' : ''}
                                            </p>
                                            <p className="truncate text-[11px] text-[var(--tng-slate-500)]">{[user?.role_name, user?.department_name].filter(Boolean).join(' · ')}</p>
                                        </div>
                                        <button type="button" onClick={() => moveSignatory(index, -1)} disabled={index === 0} className="rounded p-1 text-[var(--tng-slate-500)] hover:bg-white disabled:opacity-30" title="Sign earlier">
                                            <ChevronUp className="h-3.5 w-3.5" />
                                        </button>
                                        <button type="button" onClick={() => moveSignatory(index, 1)} disabled={index === data.signatories.length - 1} className="rounded p-1 text-[var(--tng-slate-500)] hover:bg-white disabled:opacity-30" title="Sign later">
                                            <ChevronDown className="h-3.5 w-3.5" />
                                        </button>
                                        <button type="button" onClick={() => removeSignatory(id)} className="rounded p-1 text-[var(--tng-slate-500)] hover:bg-white hover:text-red-600" title="Remove">
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    </li>
                                );
                            })}
                        </ol>
                    )}
                    <select value="" onChange={e => addSignatory(e.target.value)} className={inputClass} aria-label="Add a signatory">
                        <option value="">{data.signatories.length ? 'Add another signatory...' : 'Add a signatory...'}</option>
                        {signatoryOptions.map(user => (
                            // Only people with an HR-registered signature can sign
                            <option key={user.id} value={user.id} disabled={!user.has_signature}>
                                {personName(user)}{String(user.id) === String(authUser?.id) ? ' (you)' : ''}
                                {user.role_name ? ` — ${user.role_name}` : ''}{user.department_name ? `, ${user.department_name}` : ''}
                                {user.has_signature ? '' : ' (no registered signature)'}
                            </option>
                        ))}
                    </select>
                    {fieldErrors.signatories && <p className={errorClass}>{fieldErrors.signatories}</p>}
                    {!fileStampable && (
                        <p className="text-[11px] text-amber-700">
                            Word files cannot be stamped in place, so the final copy will be a separate signature page. Upload a PDF to have the signatures stamped on the document itself.
                        </p>
                    )}
                </div>
            )}
        </div>
    );

    // Receiving Clerk: external intake — the document comes from an outside client, so the origin is fixed
    const clerkForm = (
        <>
            <section>
                <SectionHeading step={1} title="Document" />
                <div className="space-y-5 sm:pl-7">{uploadArea}</div>
            </section>

            <section>
                <SectionHeading step={2} title="Client Information" />
                <div className="sm:pl-7">
                    <ClientInfoSection client={data.client} errors={fieldErrors} onChange={updateClient} />
                </div>
            </section>

            <section>
                <SectionHeading step={3} title="Routing" />
                <div className="space-y-4 sm:pl-7">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                            <label className={labelClass}>Originating Department</label>
                            <div className={readOnlyClass}>External Client</div>
                        </div>
                        <div>
                            <label className={labelClass}>Received By</label>
                            <div className={readOnlyClass}>{authUser?.name}</div>
                        </div>
                    </div>
                    {routingFields}
                    {urgentOption}
                </div>
            </section>

            <section>
                <SectionHeading step={4} title="Signatures" />
                <div className="sm:pl-7">{signatureSection}</div>
            </section>
        </>
    );

    const staffForm = (
        <>
            <section>
                <SectionHeading step={1} title="Document Details" />
                <div className="space-y-5 sm:pl-7">
                    {uploadArea}

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                            {/* Staff always file from their own office (also enforced by the server) */}
                            <label className={labelClass}>Originating Department</label>
                            <div className={readOnlyClass} title="Documents are filed from your own office">
                                {authUser?.department_name
                                    || departments.find(d => String(d.department_id) === String(data.department_id))?.department_name
                                    || 'Your office'}
                            </div>
                            {errors.department_id && <p className={errorClass}>{errors.department_id}</p>}
                        </div>
                        <div>
                            <label className={labelClass}>Sender</label>
                            <div className={readOnlyClass}>{authUser?.name}</div>
                        </div>
                    </div>

                    <div className="space-y-3">
                        {urgentOption}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <label className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 cursor-pointer transition-colors hover:border-red-300">
                                <input
                                    type="checkbox"
                                    checked={isConfidential}
                                    onChange={(e) => {
                                        setIsConfidential(e.target.checked);
                                        setData('classification', e.target.checked ? 'Confidential' : 'normal');
                                    }}
                                    className="mt-0.5 h-4 w-4 rounded border-red-300 text-red-600 focus:ring-red-500"
                                />
                                <div>
                                    <span className="block text-xs font-semibold text-red-700">
                                        Confidential
                                    </span>
                                    <span className="block text-[10px] text-red-600/80 mt-0.5 leading-tight">
                                        Only you and the people it is routed to can open it. The Receiving Clerk sees the record only (reference no., sender, recipient, status).
                                    </span>
                                </div>
                            </label>

                            <div className="flex items-start gap-3 rounded-lg border border-[var(--tng-slate-200)] bg-[var(--tng-slate-50)] p-3">
                                <Inbox className="mt-0.5 h-4 w-4 shrink-0 text-[var(--tng-blue-600)]" />
                                <div>
                                    <span className="block text-xs font-semibold text-[var(--tng-slate-800)]">
                                        Passes through the Receiving Clerk
                                    </span>
                                    <span className="block text-[10px] text-[var(--tng-slate-500)] mt-0.5 leading-tight">
                                        The clerk registers it for the record, then it goes to the recipient you choose below.
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section>
                <SectionHeading step={2} title="Initial Routing Slip" />
                <div className="space-y-4 sm:pl-7">{routingFields}</div>
            </section>

            <section>
                <SectionHeading step={3} title="Signatures" />
                <div className="sm:pl-7">{signatureSection}</div>
            </section>
        </>
    );

    return (
        <BaseModal
            isOpen={isOpen}
            onClose={onClose}
            title={step === 'form' ? (isReceivingClerk ? 'Register External Document' : 'Submit New Document') : 'Document Registered'}
            identifier={step === 'success' ? trackingNumber : undefined}
            description={step === 'form'
                ? (isReceivingClerk ? "Record the client's details, upload the document and route it" : 'Upload document and generate routing slip')
                : 'Official routing slip and tracking QR generated successfully.'}
            icon={step === 'form' ? <Plus className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5 text-emerald-600" />}
            maxWidth="max-w-3xl"
            childrenContainerClassName={step === 'form' ? "p-0" : ""}
            formProps={step === 'form' ? { onSubmit: handleSubmit } : undefined}
            footer={step === 'form' ? (
                <>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-full sm:w-auto rounded-lg px-4 py-2 text-sm font-medium text-[var(--tng-slate-600)] transition-colors hover:bg-[var(--tng-slate-200)] text-center"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={processing || isScanning}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-lg bg-[var(--tng-blue-600)] px-5 py-2 text-sm font-medium text-white shadow-md shadow-blue-600/25 transition-all hover:bg-[var(--tng-blue-700)] hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {processing ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Submitting...
                            </>
                        ) : isScanning ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Scanning...
                            </>
                        ) : (
                            'Generate & Submit'
                        )}
                    </button>
                </>
            ) : undefined}
        >
            {step === 'form' ? (
                <div className="flex flex-col h-full flex-1 overflow-y-auto">
                    <div className="p-4 sm:p-6 space-y-8">
                        {submitError && (
                            <div ref={errorBannerRef} role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                                <span>{submitError}</span>
                            </div>
                        )}
                        {isReceivingClerk ? clerkForm : staffForm}
                    </div>
                </div>
            ) : (
                <div className="p-10 text-center">
                    <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                        <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                    </div>
                    <h2 className="mb-2 text-xl font-bold text-[var(--tng-slate-900)]">
                        Document Submitted
                    </h2>
                    <p className="mb-6 text-sm text-[var(--tng-slate-500)]">
                        {createdDoc?.is_internal ? (
                            <>
                                Sent to the Receiving Clerk{createdDoc.recipient_name ? <> (<span className="font-semibold text-[var(--tng-slate-700)]">{createdDoc.recipient_name}</span>)</> : ''} for registration.
                                {' '}Once registered it goes to{' '}
                                <span className="font-semibold text-[var(--tng-slate-700)]">{createdDoc.addressee_name || createdDoc.addressee_office || 'the recipient'}</span>
                                {createdDoc.addressee_name && createdDoc.addressee_office ? ` (${createdDoc.addressee_office})` : ''}.
                            </>
                        ) : createdDoc?.recipient_name || createdDoc?.recipient_office
                            ? <>Routed to <span className="font-semibold text-[var(--tng-slate-700)]">{createdDoc?.recipient_name || createdDoc?.recipient_office}</span>{createdDoc?.recipient_name && createdDoc?.recipient_office ? ` (${createdDoc.recipient_office})` : ''}. The recipient has been notified.</>
                            : 'The document has been created and the recipient has been notified automatically.'}
                    </p>

                    <div className="mx-auto mb-8 max-w-[280px] overflow-hidden rounded-xl border border-[var(--tng-slate-200)] bg-[var(--tng-slate-50)]">
                        <div className="border-b border-[var(--tng-slate-200)] bg-white p-3">
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--tng-slate-500)]">Tracking Number</p>
                            <p className="mt-1 text-lg font-bold text-[var(--tng-blue-600)]">{trackingNumber || '—'}</p>
                            {createdDoc?.reference_number && (
                                <p className="mt-0.5 text-[11px] text-[var(--tng-slate-500)]">Ref: {createdDoc.reference_number}</p>
                            )}
                        </div>
                        {qrPayload && (
                            <div className="flex flex-col items-center p-5">
                                <div className="mb-2 rounded-lg bg-white p-2 shadow-sm border border-[var(--tng-slate-200)]">
                                    <img
                                        src={qrDataUrl(trackingLinkFor(qrPayload))}
                                        alt={`QR code for ${qrPayload}`}
                                        className="h-32 w-32"
                                    />
                                </div>
                                <p className="text-[11px] text-[var(--tng-slate-500)]">Scan to track this document</p>
                                <p className="mt-1 break-all text-[10px] text-[var(--tng-slate-400)]">{trackingLinkFor(qrPayload)}</p>
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col sm:flex-row justify-center gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-full sm:w-auto rounded-lg border border-[var(--tng-slate-200)] bg-white px-5 py-2 text-sm font-medium text-[var(--tng-slate-600)] transition-colors hover:bg-[var(--tng-slate-50)]"
                        >
                            Close
                        </button>
                        {createdDoc?.document_id && (
                            <a
                                href={`/documents/${createdDoc.document_id}`}
                                className="w-full sm:w-auto rounded-lg border border-[var(--tng-blue-200)] bg-[var(--tng-blue-50)] px-5 py-2 text-sm font-medium text-[var(--tng-blue-700)] transition-colors hover:bg-[var(--tng-blue-100)]"
                            >
                                View Document
                            </a>
                        )}
                        <button
                            type="button"
                            onClick={resetForm}
                            className="w-full sm:w-auto rounded-lg bg-[var(--tng-blue-600)] px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--tng-blue-700)] shadow-md shadow-blue-600/25"
                        >
                            Submit Another
                        </button>
                    </div>
                </div>
            )}
        </BaseModal>
    );
}
