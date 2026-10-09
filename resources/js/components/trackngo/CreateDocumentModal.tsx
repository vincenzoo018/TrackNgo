import React, { useState, useRef, useEffect } from 'react';
import { useForm, usePage } from '@inertiajs/react';
import { Plus, ScanLine, Loader2, FileText, CheckCircle2, AlertCircle, ChevronDown, ChevronUp, X, Inbox, Paperclip } from 'lucide-react';
import { BaseModal } from '@/components/trackngo/BaseModal';
import { ClientInfoSection, ClientInfo, EMPTY_CLIENT, validateClient } from '@/components/trackngo/ClientInfoSection';
import { extractDocumentText, withTimeout } from '@/lib/ocr';
import { qrDataUrl, useTrackingLink } from '@/lib/qr';
import { ACCEPTED_FILE_TYPES, acceptFiles, megabytes, useUploadLimits } from '@/lib/upload-files';

// OCR must never block submission: scanned pages and photos take a few seconds each, so cap the wait
const OCR_TIMEOUT_MS = 120000;

// Human-readable labels for server validation errors that have no inline slot in the form
const FIELD_LABELS: Record<string, string> = {
    file: 'Document file',
    attachments: 'Supporting files',
    title: 'Title',
    type_id: 'Document type',
    department_id: 'Originating department',
    classification: 'Classification',
    forward_to: 'Route',
    forward_to_user: 'Route',
    instruction: 'Instructions / remarks',
    ocr_text: 'Extracted text',
    urgency_justification: 'Urgency justification',
    client: 'Client information',
    signatories: 'Route',
    route: 'Route',
};

// Officials who review or sign; the Receiving Clerk only registers documents, and Admin / CART never process them
const canBeOnRoute = (u: any) => !['receiving clerk', 'admin', 'cart'].includes(String(u.role_name || '').toLowerCase());

/** One person on the route, in order; `signs` stamps their registered signature when they approve */
type RouteStop = { user_id: string; signs: boolean };
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
    const uploadLimits = useUploadLimits();
    const { maxBytes: maxUploadBytes, maxLabel: maxUploadLabel, maxFiles } = uploadLimits;
    // Shared auth role key is 'receiving' (see HandleInertiaRequests); clerks only file external documents
    const isReceivingClerk = authUser?.role === 'receiving' || authUser?.role === 'receiving_clerk';

    const receivingDept = (departments || []).find(d => d.code === 'REC' || (d.department_name && d.department_name.toLowerCase().includes('receiving')));
    const defaultOriginDept = authUser?.department_id || (receivingDept ? receivingDept.department_id : (departments[0]?.department_id || ''));

    const { data, setData, post, processing, errors, reset, clearErrors, setError, transform } = useForm({
        title: '',
        type_id: '',
        department_id: defaultOriginDept,
        // The main document: its text is read (OCR) and it is the file that gets signed
        file: null as File | null,
        // Supporting files uploaded with it, kept as attachments of the same document
        attachments: [] as File[],
        classification: 'normal',
        urgency_justification: '',
        instruction: '',
        ocr_text: '',
        client: { ...EMPTY_CLIENT } as ClientInfo,
        // Who receives it, in order; the server derives the first recipient and the signatories from it
        route: [] as RouteStop[],
    });
    // The chosen type: its blank-form templates (Admin → Document Templates) and whether the Mayor must act on it
    const selectedType = documentTypes.find((t: any) => String(t.type_id) === String(data.type_id));
    const typeTemplates = ((props as any).dbTemplates ?? []).filter((t: any) => data.type_id && String(t.type_id) === String(data.type_id));
    // Client details only apply to the clerk's external intake
    transform(({ client, ...rest }) => ({
        ...rest,
        ...(isReceivingClerk ? { client } : {}),
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
        setRouteOffice('');
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

    // ── Route: the people the document goes through, in order ───────────────────────────────────
    const isMe = (id: string) => String(id) === String(authUser?.id);
    const routeIds = data.route.map(stop => stop.user_id);
    const routeUser = (id: string) => (users || []).find(u => String(u.id) === id);
    // A sender may head their own route only to sign as they submit (never a Receiving Clerk)
    const routeOptions = (users || []).filter(u =>
        canBeOnRoute(u) &&
        !routeIds.includes(String(u.id)) &&
        (!isMe(String(u.id)) || (!isReceivingClerk && data.route.length === 0)));
    // Offices that still have someone to add, for the "office, then person" picker
    const [routeOffice, setRouteOffice] = useState('');
    const routeOffices = Array.from(
        new Map(routeOptions
            .filter(u => u.department_id)
            .map(u => [String(u.department_id), u.department_name
                || departments.find(d => String(d.department_id) === String(u.department_id))?.department_name
                || `Office #${u.department_id}`])).entries(),
    )
        .map(([id, name]) => ({ id, name: String(name) }))
        .sort((a, b) => a.name.localeCompare(b.name));
    const clearRouteErrors = () => clearErrors(...(['route', 'forward_to', 'signatories'] as any[]));
    const addToRoute = (id: string) => {
        if (!id || routeIds.includes(id)) return;
        const user = routeUser(id);
        // Signing is the usual reason to route to someone; review-only is one click away
        setData('route', [...data.route, { user_id: id, signs: isMe(id) || Boolean(user?.has_signature) }]);
        clearRouteErrors();
    };
    const removeFromRoute = (index: number) => setData('route', data.route.filter((_, i) => i !== index));
    const moveOnRoute = (index: number, offset: -1 | 1) => {
        const next = [...data.route];
        const target = index + offset;
        if (target < 0 || target >= next.length) return;
        [next[index], next[target]] = [next[target], next[index]];
        setData('route', next);
    };
    const toggleSigns = (index: number) =>
        setData('route', data.route.map((stop, i) => (i === index ? { ...stop, signs: !stop.signs } : stop)));
    const anyoneSigns = data.route.some(stop => stop.signs);
    // Server errors for the route arrive as route, route.N.user_id, signatories or forward_to
    const routeError = fieldErrors.route
        || Object.entries(fieldErrors).find(([key]) => key.startsWith('route.'))?.[1]
        || fieldErrors.signatories
        || fieldErrors.forward_to
        || fieldErrors.forward_to_user;
    const fileStampable = !data.file || /\.(pdf|png|jpe?g)$/i.test(data.file.name);

    const updateClient = (field: keyof ClientInfo, value: string) => {
        setData(prev => ({ ...prev, client: { ...prev.client, [field]: value } }));
        if (fieldErrors[`client.${field}`]) clearErrors(`client.${field}` as any);
    };

    const handleFileUploadClick = () => {
        if (isScanning) return;
        fileInputRef.current?.click();
    };
    const [dragActive, setDragActive] = useState(false);
    const dropHandlers = {
        onDragOver: (e: React.DragEvent) => {
            e.preventDefault();
            if (!isScanning) setDragActive(true);
        },
        onDragLeave: () => setDragActive(false),
        onDrop: (e: React.DragEvent) => {
            e.preventDefault();
            setDragActive(false);
            addFiles(e.dataTransfer.files);
        },
    };
    const fileCount = (data.file ? 1 : 0) + data.attachments.length;
    // Server errors for supporting files arrive as attachments or attachments.N
    const attachmentsError = fieldErrors.attachments
        || Object.entries(fieldErrors).find(([key]) => key.startsWith('attachments.'))?.[1];
    const clearAttachmentErrors = () => clearErrors(...(Object.keys(fieldErrors).filter(key => key.startsWith('attachments')) as any[]));

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

    // The first file chosen is the main document; the others (and any added later) are supporting files
    const addFiles = (list: FileList | null) => {
        const picked = Array.from(list ?? []);
        if (fileInputRef.current) fileInputRef.current.value = '';
        if (!picked.length || isScanning) return;

        // Wrong types, oversized files and files past the limit are refused here with the reason (PHP would drop them silently)
        const { accepted, problems } = acceptFiles([...(data.file ? [data.file] : []), ...data.attachments], picked, uploadLimits);
        setSubmitError(null);
        clearAttachmentErrors();
        if (problems.length) setError('file', problems.join(' '));
        else clearErrors('file');
        if (!accepted.length) return;

        const main = data.file ? null : accepted[0];
        const supporting = data.file ? accepted : accepted.slice(1);
        if (supporting.length) setData(prev => ({ ...prev, attachments: [...prev.attachments, ...supporting] }));
        if (main) void scanMainFile(main);
    };

    // A supporting file becomes the main document; the current main file takes its place in the list
    const makeMain = (index: number) => {
        if (isScanning || !data.file) return;
        const next = data.attachments[index];
        const previous = data.file;
        setData(prev => ({ ...prev, attachments: prev.attachments.map((file, i) => (i === index ? previous : file)) }));
        void scanMainFile(next);
    };

    const removeAttachment = (index: number) => {
        setData(prev => ({ ...prev, attachments: prev.attachments.filter((_, i) => i !== index) }));
        clearAttachmentErrors();
    };

    const scanMainFile = async (file: File) => {
        setScanMessage('Reading document...');
        setOcrComplete(false);
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
        if (fileCount > maxFiles) found.attachments = `Upload up to ${maxFiles} files per document.`;
        if (data.file && !ocrComplete) found.file = 'Please wait for the scan to finish.';
        if (data.file && !String(data.title).trim()) found.title = 'Title is required.';
        if (data.file && !data.type_id) found.type_id = 'Select a document type.';
        if (!data.department_id) found.department_id = 'Select the originating department.';
        if (data.route.filter(stop => !isMe(stop.user_id)).length === 0) {
            found.route = data.route.length ? 'Add at least one person after yourself.' : 'Add the people this document goes to, in order.';
        }
        const unsigned = data.route.filter(stop => stop.signs && !isMe(stop.user_id) && !routeUser(stop.user_id)?.has_signature);
        if (unsigned.length) found.route = `${unsigned.map(stop => personName(routeUser(stop.user_id))).join(', ')} cannot sign yet (no registered signature). Set them to review only, or ask HR to add it.`;
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
                    .map(([field, message]) => field.startsWith('client.') ? message : `${FIELD_LABELS[field.split('.')[0]] ?? field}: ${message}`)
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
                accept={ACCEPTED_FILE_TYPES}
                multiple
                onChange={e => addFiles(e.target.files)}
            />

            {!ocrComplete && !isScanning && (
                <div
                    role="button"
                    tabIndex={0}
                    onClick={handleFileUploadClick}
                    onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && handleFileUploadClick()}
                    {...dropHandlers}
                    className={`group relative flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed ${dragActive ? 'border-[var(--tng-blue-400)] bg-[var(--tng-blue-50)]' : errors.file ? 'border-red-400 bg-red-50' : 'border-[var(--tng-slate-200)] bg-[var(--tng-slate-50)] hover:border-[var(--tng-blue-400)] hover:bg-[var(--tng-blue-50)]'} px-4 py-8 transition-colors`}
                >
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm group-hover:bg-[var(--tng-blue-100)] group-hover:text-[var(--tng-blue-600)] transition-colors">
                        <ScanLine className="h-5 w-5 text-[var(--tng-slate-400)] group-hover:text-[var(--tng-blue-600)]" />
                    </div>
                    <div className="text-center">
                        <p className="text-sm font-medium text-[var(--tng-slate-700)]">Click to upload or drag and drop</p>
                        <p className="text-xs text-[var(--tng-slate-500)] mt-1">PDF, Word (.docx), PNG, JPG · up to {maxFiles} files, max. {maxUploadLabel} each</p>
                        <p className="text-[11px] text-[var(--tng-slate-400)] mt-0.5">The first file is the main document; the others are attached as supporting files.</p>
                    </div>
                    {errors.file && <p className="text-xs text-red-600 mt-2 text-center">{errors.file}</p>}
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
                            <p className="text-[11px] text-emerald-700 mt-0.5">Main document · {megabytes(data.file.size)}</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => {
                            setOcrComplete(false);
                            setData('file', null);
                            if (fileInputRef.current) fileInputRef.current.value = '';
                        }}
                        className="shrink-0 text-[13px] font-medium text-emerald-700 hover:text-emerald-800"
                    >
                        Replace
                    </button>
                </div>
            )}

            {/* Supporting files: kept with the same document, opened from the file list in the viewer */}
            {(data.attachments.length > 0 || (ocrComplete && data.file)) && (
                <div className="space-y-2">
                    {data.attachments.length > 0 && (
                        <ul className="space-y-1.5">
                            {data.attachments.map((file, index) => (
                                <li key={`${file.name}-${file.size}-${file.lastModified}`} className="flex items-center gap-3 rounded-lg border border-[var(--tng-slate-200)] bg-white px-3 py-2">
                                    <Paperclip className="h-4 w-4 shrink-0 text-[var(--tng-slate-400)]" />
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-[13px] font-medium text-[var(--tng-slate-800)]">{file.name}</p>
                                        <p className="text-[11px] text-[var(--tng-slate-500)]">Supporting file · {megabytes(file.size)}</p>
                                    </div>
                                    {data.file && (
                                        <button
                                            type="button"
                                            onClick={() => makeMain(index)}
                                            disabled={isScanning}
                                            className="shrink-0 text-[12px] font-medium text-[var(--tng-blue-600)] hover:underline disabled:opacity-40"
                                            title="Use this file as the main document (the one that is read and signed)"
                                        >
                                            Make main
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => removeAttachment(index)}
                                        className="shrink-0 rounded p-1 text-[var(--tng-slate-400)] hover:bg-[var(--tng-slate-100)] hover:text-red-600"
                                        aria-label={`Remove ${file.name}`}
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                    {data.file && fileCount < maxFiles && (
                        <button
                            type="button"
                            onClick={handleFileUploadClick}
                            disabled={isScanning}
                            {...dropHandlers}
                            className={`flex w-full items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-2 text-[13px] font-medium transition-colors disabled:opacity-50 ${dragActive ? 'border-[var(--tng-blue-400)] bg-[var(--tng-blue-50)] text-[var(--tng-blue-700)]' : 'border-[var(--tng-slate-300)] text-[var(--tng-slate-600)] hover:border-[var(--tng-blue-400)] hover:bg-[var(--tng-blue-50)] hover:text-[var(--tng-blue-700)]'}`}
                        >
                            <Paperclip className="h-4 w-4" />
                            {data.attachments.length ? 'Add more supporting files' : 'Attach supporting files (optional)'}
                            <span className="font-normal text-[var(--tng-slate-400)]">· {maxFiles - fileCount} more allowed</span>
                        </button>
                    )}
                    {attachmentsError && <p className={errorClass}>{attachmentsError}</p>}
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
                    {(selectedType?.requires_mayoral_action || typeTemplates.length > 0) && (
                        <div className="sm:col-span-2 -mt-1 space-y-1 text-[12px] text-[var(--tng-slate-600)]">
                            {selectedType?.requires_mayoral_action && (
                                <p>An ordinance / resolution goes to the City Mayor, who has 10 calendar days to sign or veto it (LGC Sec. 54). Include the Mayor on the route.</p>
                            )}
                            {typeTemplates.length > 0 && (
                                <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                    <span>Template:</span>
                                    {typeTemplates.map((t: any) => (
                                        <a key={t.id} href={`/templates/${t.id}/download`} className="inline-flex items-center gap-1 font-medium text-[#0066cc] hover:underline">
                                            <FileText className="h-3.5 w-3.5" /> {t.name}
                                        </a>
                                    ))}
                                </p>
                            )}
                        </div>
                    )}
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
            <div className="space-y-2">
                <label className={labelClass}>
                    Route <span className="text-red-500 font-semibold">*</span>
                </label>
                <p className="text-[11px] leading-tight text-[var(--tng-slate-500)]">
                    {isReceivingClerk
                        ? 'The people this document goes to, in order. Each one approves (and signs, if ticked); it then moves to the next person automatically. After the last person it comes back to Receiving for release to the client.'
                        : 'The people this document goes to after the Receiving Clerk registers it, in order. Each one approves (and signs, if ticked); it then moves to the next person automatically. After the last person it is completed and returned to you.'}
                </p>

                {data.route.length > 0 && (
                    <ol className="space-y-1.5">
                        {data.route.map((stop, index) => {
                            const user = routeUser(stop.user_id);
                            const me = isMe(stop.user_id);
                            return (
                                <li key={stop.user_id} className="flex items-center gap-2 rounded-lg border border-[var(--tng-slate-200)] bg-[var(--tng-slate-50)] px-3 py-2">
                                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-semibold text-[var(--tng-slate-600)] border border-[var(--tng-slate-200)]">{index + 1}</span>
                                    <div className="min-w-0 flex-1">
                                        {/* The office and the person in it are shown apart, so it is clear exactly where it goes */}
                                        <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-[var(--tng-slate-500)]">
                                            {user?.department_name || 'No office'}
                                        </p>
                                        <p className="truncate text-sm text-[var(--tng-slate-900)]">
                                            {user ? personName(user) : `User #${stop.user_id}`}{me ? ' (you, signs as you submit)' : ''}
                                            {user?.role_name && <span className="text-[12px] text-[var(--tng-slate-500)]"> · {user.role_name}</span>}
                                        </p>
                                    </div>
                                    {!me && (
                                        <label
                                            className="flex items-center gap-1.5 rounded-md border border-[var(--tng-slate-200)] bg-white px-2 py-1 text-[11px] font-medium text-[var(--tng-slate-700)] cursor-pointer"
                                            title={user?.has_signature ? 'Stamp their registered signature when they approve' : 'No registered signature yet (HR adds it); this person can only review'}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={stop.signs}
                                                disabled={!user?.has_signature && !stop.signs}
                                                onChange={() => toggleSigns(index)}
                                                className="h-3.5 w-3.5 rounded border-[var(--tng-slate-300)] text-[var(--tng-blue-600)] focus:ring-[var(--tng-blue-500)]"
                                            />
                                            {stop.signs ? 'Signs' : 'Reviews'}
                                        </label>
                                    )}
                                    <button type="button" onClick={() => moveOnRoute(index, -1)} disabled={index === 0 || me || isMe(data.route[index - 1]?.user_id)} className="rounded p-1 text-[var(--tng-slate-500)] hover:bg-white disabled:opacity-30" title="Earlier on the route">
                                        <ChevronUp className="h-3.5 w-3.5" />
                                    </button>
                                    <button type="button" onClick={() => moveOnRoute(index, 1)} disabled={index === data.route.length - 1 || me} className="rounded p-1 text-[var(--tng-slate-500)] hover:bg-white disabled:opacity-30" title="Later on the route">
                                        <ChevronDown className="h-3.5 w-3.5" />
                                    </button>
                                    <button type="button" onClick={() => removeFromRoute(index)} className="rounded p-1 text-[var(--tng-slate-500)] hover:bg-white hover:text-red-600" title="Remove">
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                </li>
                            );
                        })}
                    </ol>
                )}

                {/* Add a stop: the office first, then the person in that office */}
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <select
                        value={routeOffice}
                        onChange={e => setRouteOffice(e.target.value)}
                        className={inputClass}
                        aria-label="Office of the next person on the route"
                    >
                        <option value="">{data.route.length ? 'Next office...' : 'First office...'}</option>
                        {routeOffices.map(office => (
                            <option key={office.id} value={office.id}>{office.name}</option>
                        ))}
                    </select>
                    <select
                        value=""
                        onChange={e => {
                            addToRoute(e.target.value);
                            setRouteOffice('');
                        }}
                        disabled={!routeOffice}
                        className={`${inputClass} disabled:bg-[var(--tng-slate-50)] disabled:text-[var(--tng-slate-400)]`}
                        aria-label="Add a person to the route"
                    >
                        <option value="">{routeOffice ? 'Person in this office...' : 'Choose the office first'}</option>
                        {routeOptions.filter(user => String(user.department_id) === routeOffice).map(user => (
                            <option key={user.id} value={user.id}>
                                {personName(user)}{isMe(String(user.id)) ? ' (you, to sign as you submit)' : ''}
                                {user.role_name ? ` — ${user.role_name}` : ''}
                                {user.has_signature ? '' : ' (review only: no registered signature)'}
                            </option>
                        ))}
                    </select>
                </div>
                {routeError && <p className={errorClass}>{routeError}</p>}
                {anyoneSigns && !fileStampable && (
                    <p className="text-[11px] text-amber-700">
                        Word files cannot be stamped in place, so the final copy will be a separate signature page. Upload a PDF to have the signatures stamped on the document itself.
                    </p>
                )}
            </div>
            <div>
                <label className={labelClass}>
                    Instructions / Remarks
                </label>
                <textarea
                    value={data.instruction}
                    onChange={e => setData('instruction', e.target.value)}
                    placeholder="Enter instructions for the people on the route..."
                    rows={3}
                    maxLength={500}
                    className="w-full rounded-lg border border-[var(--tng-slate-200)] bg-white p-3 text-sm text-[var(--tng-slate-900)] placeholder:text-[var(--tng-slate-400)] focus:border-[var(--tng-blue-500)] focus:outline-none focus:ring-2 focus:ring-[var(--tng-blue-500)]/20"
                />
            </div>
        </>
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
                                        The clerk registers it for the record, then it follows the route you set below.
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section>
                <SectionHeading step={2} title="Route" />
                <div className="space-y-4 sm:pl-7">{routingFields}</div>
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
