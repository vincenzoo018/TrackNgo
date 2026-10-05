import { router } from '@inertiajs/react';
import { AlertCircle, UploadCloud, X } from 'lucide-react';
import React, { useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { BaseModal } from './BaseModal';
import { ResignNotice, VersionFileField, useVersionFile } from './DocumentRevisionModal';

type DocumentCorrectionModalProps = {
    open: boolean;
    onClose: () => void;
    document: any;
    returnReason?: string;
    onSuccess?: () => void;
};

/** version: the corrected main file becomes a new version; files: supporting files next to the main file */
type CorrectionMode = 'files' | 'version';

const MAX_FILES = 5;
const ACCEPT = '.pdf,.doc,.docx,.png,.jpg,.jpeg';

function formatBytes(bytes?: number): string {
    if (!bytes) {
        return '0 B';
    }
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/** Who returned the document: the latest "return" routing slip (falls back to the holder's office). */
export function findReturner(doc: any): string {
    const slip = [...(doc?.routing_slips || [])].reverse().find((s: any) => s.action === 'return');
    return slip?.from_user?.name || slip?.sender_name || 'the office that returned it';
}

/**
 * Returned document → the holder sends the correction back to whoever returned it (POST /documents/{id}/resubmit):
 * either missing / corrected supporting files (kept alongside the original), or — when they may upload versions —
 * the corrected main file as a new version (every earlier version is kept).
 */
export function DocumentCorrectionModal({ open, onClose, document: doc, returnReason, onSuccess }: DocumentCorrectionModalProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [files, setFiles] = useState<File[]>([]);
    const [note, setNote] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [dragActive, setDragActive] = useState(false);
    const canUploadVersion = Boolean(doc?.abilities?.create_revision);
    const [mode, setMode] = useState<CorrectionMode>('files');
    const versionMode = canUploadVersion && mode === 'version';
    const mainFile = useVersionFile();
    const nextVersion = (Number(doc?.revision_info?.current) || 1) + 1;

    const docRef = doc?.reference_number ?? doc?.tracking_number ?? 'Document';
    const reasonText = returnReason || doc?.return_reason || 'Document requires remediation or missing files.';
    const returner = findReturner(doc);
    const ready = versionMode ? Boolean(mainFile.file) && !mainFile.reading && note.trim().length >= 5 : files.length > 0;

    const addFiles = (list: FileList | null) => {
        if (!list) {
            return;
        }
        setErrorMessage(null);
        setFiles(prev => {
            const merged = [...prev, ...Array.from(list)];
            if (merged.length > MAX_FILES) {
                setErrorMessage(`Attach up to ${MAX_FILES} files at a time.`);
            }
            return merged.slice(0, MAX_FILES);
        });
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const reset = () => {
        setFiles([]);
        setNote('');
        setErrorMessage(null);
        setMode('files');
        mainFile.reset();
    };

    const handleSubmit = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!ready) {
            setErrorMessage(versionMode
                ? 'Choose the corrected file and describe the correction.'
                : 'Attach at least one corrected or missing file.');
            return;
        }

        setIsUploading(true);
        setErrorMessage(null);
        const payload = versionMode
            ? { mode: 'version', main_file: mainFile.file, note, ...(mainFile.ocrText ? { ocr_text: mainFile.ocrText } : {}) }
            : { files, note };
        router.post(`/documents/${doc.document_id}/resubmit`, payload, {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => {
                reset();
                onSuccess?.();
                onClose();
            },
            onError: (errors) => {
                setErrorMessage(Object.values(errors)[0] || 'The correction could not be submitted.');
            },
            onFinish: () => setIsUploading(false),
        });
    };

    return (
        <BaseModal
            isOpen={open}
            onClose={isUploading ? () => {} : onClose}
            title="Upload Document Correction"
            identifier={docRef}
            description={versionMode
                ? `Upload the corrected document as Version ${nextVersion}. ${docRef} will be sent back to ${returner}.`
                : `Attach the missing or corrected files. ${docRef} will be sent back to ${returner}.`}
            icon={<AlertCircle className="h-5 w-5 text-rose-600" />}
            maxWidth="max-w-xl"
            headerClassName="bg-rose-50/70 rounded-t-[8px]"
            iconContainerClassName="bg-rose-100 text-rose-600"
            formProps={{ onSubmit: handleSubmit }}
            footer={
                <>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isUploading}
                        className="rounded-lg px-4 py-2 text-[14px] font-medium text-slate-600 transition-colors hover:bg-slate-100"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={!ready || isUploading}
                        className="rounded-lg bg-rose-600 px-5 py-2 text-[14px] font-medium text-white transition-colors hover:bg-rose-700 disabled:opacity-60"
                    >
                        {isUploading ? 'Submitting...' : versionMode && mainFile.reading ? 'Reading file...' : `Submit & Send Back to ${returner}`}
                    </button>
                </>
            }
        >
            <div className="space-y-4">
                <div className="rounded-lg border border-rose-200 bg-rose-50/60 p-3.5">
                    <p className="text-[12px] font-medium text-rose-700">Reason for return</p>
                    <p className="mt-0.5 text-[14px] text-slate-900">{reasonText}</p>
                </div>

                {errorMessage && (
                    <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-[13px] text-red-700">{errorMessage}</div>
                )}

                {canUploadVersion && (
                    <div role="radiogroup" aria-label="What are you sending back?" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {([
                            ['version', 'Corrected main document', `Replaces the file as Version ${nextVersion}; earlier versions are kept`],
                            ['files', 'Supporting files', 'Missing or extra files attached next to the main document'],
                        ] as const).map(([value, label, hint]) => (
                            <button
                                key={value}
                                type="button"
                                role="radio"
                                aria-checked={mode === value}
                                onClick={() => {
                                    setMode(value);
                                    setErrorMessage(null);
                                }}
                                className={cn(
                                    'rounded-lg border p-3 text-left transition-colors',
                                    mode === value ? 'border-rose-400 bg-rose-50 ring-1 ring-rose-400' : 'border-slate-200 bg-white hover:bg-slate-50',
                                )}
                            >
                                <span className="block text-[13px] font-semibold text-slate-900">{label}</span>
                                <span className="mt-0.5 block text-[12px] text-slate-500">{hint}</span>
                            </button>
                        ))}
                    </div>
                )}

                {versionMode ? (
                    <>
                        <ResignNotice doc={doc} sendsBack />
                        <VersionFileField picker={mainFile} tone="rose" />
                    </>
                ) : (
                <div>
                    <label className="mb-1.5 block text-[13px] font-medium text-slate-800">
                        Corrected / Missing Files <span className="text-rose-500">*</span>
                    </label>
                    <input ref={fileInputRef} type="file" multiple accept={ACCEPT} className="hidden" onChange={(e) => addFiles(e.target.files)} />
                    <div
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                        onDragLeave={() => setDragActive(false)}
                        onDrop={(e) => { e.preventDefault(); setDragActive(false); addFiles(e.dataTransfer.files); }}
                        className={cn(
                            'flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center transition-colors',
                            dragActive ? 'border-rose-400 bg-rose-50' : 'border-slate-200 bg-slate-50 hover:border-rose-300 hover:bg-rose-50/40'
                        )}
                    >
                        <UploadCloud className="mb-2 h-6 w-6 text-rose-500" />
                        <p className="text-[14px] font-medium text-slate-800">Click to choose files or drag them here</p>
                        <p className="mt-1 text-[12px] text-slate-500">PDF, DOC, DOCX, PNG or JPG · up to {MAX_FILES} files</p>
                    </div>

                    {files.length > 0 && (
                        <ul className="mt-3 space-y-2">
                            {files.map((file, idx) => (
                                <li key={`${file.name}-${idx}`} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
                                    <div className="min-w-0">
                                        <p className="truncate text-[13px] font-medium text-slate-800">{file.name}</p>
                                        <p className="text-[12px] text-slate-500">{formatBytes(file.size)}</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setFiles(prev => prev.filter((_, i) => i !== idx))}
                                        className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                                        aria-label={`Remove ${file.name}`}
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
                )}

                <div>
                    <label className="mb-1.5 block text-[13px] font-medium text-slate-800">
                        {versionMode
                            ? <>What Was Corrected <span className="text-rose-500">*</span></>
                            : <>Correction Notes <span className="font-normal text-slate-400">(Optional)</span></>}
                    </label>
                    <textarea
                        rows={3}
                        maxLength={500}
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder={versionMode
                            ? 'e.g. Corrected the lot number and the applicant\'s name.'
                            : 'e.g. Attached the missing barangay clearance and updated application form.'}
                        className="w-full rounded-lg border border-slate-200 p-3 text-[14px] focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
                    />
                </div>
            </div>
        </BaseModal>
    );
}
