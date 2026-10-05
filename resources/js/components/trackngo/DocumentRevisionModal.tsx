import { router, usePage } from '@inertiajs/react';
import { FilePlus2, FileText, Loader2, PenLine, UploadCloud } from 'lucide-react';
import React, { useRef, useState } from 'react';
import { extractDocumentText, withTimeout } from '@/lib/ocr';
import { requestJson } from '@/lib/request';
import { cn } from '@/lib/utils';
import { BaseModal, ModalField, ModalPrimaryButton, ModalSecondaryButton } from './BaseModal';

const OCR_TIMEOUT_MS = 120000;
/** Formats the viewer and signature stamping handle (same as at filing) */
const ACCEPT = '.pdf,.docx,.png,.jpg,.jpeg';
const ACCEPTED_NAME = /\.(pdf|docx|png|jpe?g)$/i;

export function formatBytes(bytes?: number | null): string {
    if (!bytes) {
        return '—';
    }

    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);

    return `${parseFloat((bytes / Math.pow(1024, i)).toFixed(1))} ${units[i]}`;
}

/** The corrected file: checked against the server's upload limit, then its text is read (OCR) as at filing */
export function useVersionFile() {
    const { upload } = usePage<any>().props;
    const maxBytes: number = upload?.max_bytes || 10 * 1024 * 1024;
    const maxLabel: string = upload?.max_label || '10 MB';
    const [file, setFile] = useState<File | null>(null);
    const [ocrText, setOcrText] = useState('');
    const [reading, setReading] = useState(false);
    const [fileError, setFileError] = useState<string | null>(null);
    const latest = useRef<File | null>(null);

    const pick = async (picked?: File | null) => {
        if (!picked) {
            return;
        }

        if (!ACCEPTED_NAME.test(picked.name)) {
            setFileError('Choose a PDF, Word (.docx) or image (PNG/JPG) file.');

            return;
        }

        if (picked.size > maxBytes) {
            setFileError(`This file is ${(picked.size / (1024 * 1024)).toFixed(2)} MB. The server accepts files up to ${maxLabel}.`);

            return;
        }

        latest.current = picked;
        setFileError(null);
        setFile(picked);
        setOcrText('');
        setReading(true);
        const text = await withTimeout(extractDocumentText(picked, picked.name), OCR_TIMEOUT_MS).catch(() => '');

        // A file picked meanwhile replaces this one
        if (latest.current === picked) {
            setOcrText(text.trim());
            setReading(false);
        }
    };

    const reset = () => {
        latest.current = null;
        setFile(null);
        setOcrText('');
        setReading(false);
        setFileError(null);
    };

    return { file, ocrText, reading, fileError, pick, reset };
}

type VersionFile = ReturnType<typeof useVersionFile>;

/** Drop zone / chosen file for a new version */
export function VersionFileField({ picker, tone = 'blue' }: { picker: VersionFile; tone?: 'blue' | 'rose' }) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [dragActive, setDragActive] = useState(false);
    const accent = tone === 'rose' ? 'text-rose-500' : 'text-[var(--tng-blue-600)]';

    return (
        <ModalField label="Corrected File" required error={picker.fileError ?? undefined}>
            <input
                ref={inputRef}
                type="file"
                accept={ACCEPT}
                className="hidden"
                aria-label="Corrected file"
                onChange={(e) => {
                    void picker.pick(e.target.files?.[0]);
                    e.target.value = '';
                }}
            />
            {picker.file ? (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                    <div className="flex min-w-0 items-center gap-2.5">
                        <FileText className={cn('h-5 w-5 shrink-0', accent)} />
                        <div className="min-w-0">
                            <p className="truncate text-[13px] font-medium text-slate-800">{picker.file.name}</p>
                            <p className="flex items-center gap-1 text-[12px] text-slate-500">
                                {formatBytes(picker.file.size)}
                                {picker.reading && <><span>·</span><Loader2 className="h-3 w-3 animate-spin" /> Reading text...</>}
                            </p>
                        </div>
                    </div>
                    <button type="button" onClick={() => inputRef.current?.click()} className="shrink-0 text-[13px] font-medium text-[#0066cc] hover:underline">
                        Change
                    </button>
                </div>
            ) : (
                <div
                    role="button"
                    tabIndex={0}
                    onClick={() => inputRef.current?.click()}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
                    onDragOver={(e) => {
                        e.preventDefault();
                        setDragActive(true);
                    }}
                    onDragLeave={() => setDragActive(false)}
                    onDrop={(e) => {
                        e.preventDefault();
                        setDragActive(false);
                        void picker.pick(e.dataTransfer.files?.[0]);
                    }}
                    className={cn(
                        'flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-5 text-center transition-colors',
                        dragActive ? 'border-blue-400 bg-blue-50' : 'border-slate-200 bg-slate-50 hover:border-blue-300 hover:bg-blue-50/40',
                    )}
                >
                    <UploadCloud className={cn('mb-1.5 h-6 w-6', accent)} />
                    <p className="text-[14px] font-medium text-slate-800">Click to choose the corrected file or drag it here</p>
                    <p className="mt-0.5 text-[12px] text-slate-500">PDF, Word (.docx), PNG or JPG</p>
                </div>
            )}
        </ModalField>
    );
}

/**
 * What happens to signatures already on the current version. $sendsBack: the viewer sends the corrected version
 * back now (Upload Correction), which stamps their own signature on it if they had signed the earlier one.
 */
export function ResignNotice({ doc, sendsBack = false }: { doc: any; sendsBack?: boolean }) {
    const { auth } = usePage<any>().props;
    const signedRows = (doc?.signatories || []).filter((s: any) => s.signed_at);
    const signed = signedRows.length;
    const signsNow = sendsBack && signedRows.some((s: any) => String(s.user_id) === String(auth?.user?.id));

    if (signed === 0) {
        return null;
    }

    const current = Number(doc?.revision_info?.current) || 1;

    return (
        <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[13px] text-amber-900">
            <PenLine className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
                {signed} signature{signed === 1 ? ' was' : 's were'} made on Version {current}. They stay with Version {current} (still viewable in
                Version History).{' '}
                {signsNow
                    ? `Your signature is stamped on Version ${current + 1} as you send it back; the other signatories sign it again as it reaches them.`
                    : `The signatories sign Version ${current + 1} again as it reaches them.`}
            </span>
        </p>
    );
}

type Props = {
    open: boolean;
    onClose: () => void;
    doc: any;
    onSaved: (message: string) => void;
};

/**
 * Create Revision (POST /documents/{id}/revisions): the corrected file becomes the next version and the current
 * file; every earlier version is kept. The document stays where it is in the workflow.
 */
export function DocumentRevisionModal({ open, onClose, doc, onSaved }: Props) {
    const picker = useVersionFile();
    const [reason, setReason] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const current = Number(doc?.revision_info?.current) || 1;
    const currentFile = doc?.revision_info?.versions?.find((v: any) => v.is_current);

    const close = () => {
        if (saving) {
            return;
        }

        picker.reset();
        setReason('');
        setError(null);
        onClose();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!picker.file || reason.trim().length < 5) {
            return;
        }

        const form = new FormData();
        form.append('file', picker.file);
        form.append('reason', reason.trim());

        if (picker.ocrText) {
            form.append('ocr_text', picker.ocrText);
        }

        setSaving(true);
        setError(null);

        try {
            const data = await requestJson(`/documents/${doc.document_id}/revisions`, 'POST', form);
            setSaving(false);
            close();
            onSaved(data?.message || `Version ${current + 1} uploaded.`);
            router.reload({ only: ['dbDocument', 'dbAuditTrail'] });
        } catch (err: any) {
            setError(err?.message || 'The new version could not be uploaded.');
            setSaving(false);
        }
    };

    return (
        <BaseModal
            isOpen={open}
            onClose={close}
            title="Upload New Version"
            identifier={doc?.reference_number}
            description={`The corrected file becomes Version ${current + 1}. Version ${current} and every earlier version stay in the history.`}
            icon={<FilePlus2 className="h-5 w-5" />}
            maxWidth="max-w-xl"
            formProps={{ onSubmit: handleSubmit }}
            footer={
                <>
                    <ModalSecondaryButton onClick={close} disabled={saving} />
                    <ModalPrimaryButton
                        isLoading={saving || picker.reading}
                        loadingText={picker.reading ? 'Reading file...' : 'Uploading...'}
                        disabled={!picker.file || reason.trim().length < 5}
                    >
                        Upload Version {current + 1}
                    </ModalPrimaryButton>
                </>
            }
        >
            <div className="space-y-4">
                {currentFile && (
                    <p className="text-[13px] text-slate-600">
                        Current: <span className="font-medium text-slate-900">Version {current}</span> · {currentFile.file_name}
                    </p>
                )}
                <ResignNotice doc={doc} />
                {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-[13px] text-red-700">{error}</p>}

                <VersionFileField picker={picker} />

                <ModalField label="Reason for the New Version" required description="e.g. Corrected the recipient's name, added the missing page.">
                    <textarea
                        rows={3}
                        maxLength={500}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="What was corrected?"
                        className="w-full rounded-lg border border-slate-200 p-3 text-[14px] focus:border-[var(--tng-blue-500)] focus:outline-none focus:ring-1 focus:ring-[var(--tng-blue-500)]"
                    />
                </ModalField>
            </div>
        </BaseModal>
    );
}
