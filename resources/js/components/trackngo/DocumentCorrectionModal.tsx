import React, { useState, useRef } from 'react';
import { BaseModal } from './BaseModal';
import { 
    AlertCircle, 
    UploadCloud, 
    FileText, 
    X, 
    CheckCircle2, 
    Paperclip,
    ArrowRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

type DocumentCorrectionModalProps = {
    open: boolean;
    onClose: () => void;
    document: any;
    returnReason?: string;
    onSuccess?: (newAttachment?: any, newAudit?: any) => void;
};

function formatBytes(bytes?: number): string {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function DocumentCorrectionModal({
    open,
    onClose,
    document: doc,
    returnReason,
    onSuccess,
}: DocumentCorrectionModalProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [fileToUpload, setFileToUpload] = useState<File | null>(null);
    const [remediationNote, setRemediationNote] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [dragActive, setDragActive] = useState(false);

    const docId = doc?.document_id;
    const docRef = doc?.reference_number ?? doc?.tracking_number ?? 'Document';
    const reasonText = returnReason || doc?.return_reason || 'Document requires remediation or missing files.';

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFileToUpload(e.target.files[0]);
            setErrorMessage(null);
        }
    };

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            setFileToUpload(e.dataTransfer.files[0]);
            setErrorMessage(null);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!fileToUpload) {
            setErrorMessage('Please select a corrected document file to upload.');
            return;
        }

        setIsUploading(true);
        setErrorMessage(null);

        const formData = new FormData();
        formData.append('file', fileToUpload);
        if (remediationNote.trim()) {
            formData.append('reason', remediationNote.trim());
        }

        try {
            const csrfToken = (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content ?? '';
            const res = await fetch(`/documents/${docId}/attachments`, {
                method: 'POST',
                headers: {
                    'X-CSRF-TOKEN': csrfToken,
                    'Accept': 'application/json',
                },
                body: formData,
            });

            const data = await res.json();
            if (!res.ok) {
                setErrorMessage(data.message || 'Failed to upload corrected file.');
                return;
            }

            // Reset and close
            setFileToUpload(null);
            setRemediationNote('');
            if (fileInputRef.current) fileInputRef.current.value = '';
            
            if (onSuccess) {
                onSuccess(data.attachment, data.audit);
            }
            onClose();
        } catch (err: any) {
            setErrorMessage('Network error while uploading corrected document.');
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <BaseModal
            isOpen={open}
            onClose={onClose}
            title="Document Correction & Remediation"
            description={`Submit corrected file and remediation notes for ${docRef}.`}
            icon={<AlertCircle className="h-5 w-5 text-rose-600" />}
            maxWidth="max-w-xl"
            headerClassName="bg-rose-50/70 rounded-t-[8px]"
            iconContainerClassName="bg-rose-100 text-rose-600"
            footer={
                <div className="flex items-center justify-between w-full">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isUploading}
                        className="rounded-[8px] px-4 py-2 text-[14px] font-medium text-slate-600 transition-colors hover:bg-slate-100"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={!fileToUpload || isUploading}
                        className={cn(
                            "flex items-center gap-2 rounded-[8px] px-5 py-2.5 text-[14px] font-semibold text-white transition-all shadow-[0_4px_12px_rgba(0,0,0,0.2)]",
                            fileToUpload && !isUploading
                                ? "bg-rose-600 hover:bg-rose-700 active:scale-98"
                                : "bg-slate-300 cursor-not-allowed shadow-none"
                        )}
                    >
                        {isUploading ? (
                            <>
                                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                Uploading Correction...
                            </>
                        ) : (
                            <>
                                <CheckCircle2 className="h-4 w-4" />
                                Submit Document Correction
                            </>
                        )}
                    </button>
                </div>
            }
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                {/* Official Return Reason Quote Box */}
                <div className="rounded-[8px] border border-rose-200 bg-rose-50/60 p-3.5 shadow-xs">
                    <div className="flex items-center gap-2 mb-1.5">
                        <span className="inline-flex items-center gap-1 rounded-[6px] bg-rose-200 px-2 py-0.5 text-[11px] font-bold text-rose-800 uppercase tracking-wide">
                            Reason for Return
                        </span>
                        <span className="text-[12px] text-slate-500">• Official Reviewer Remarks</span>
                    </div>
                    <p className="text-[14px] font-medium text-slate-900 leading-relaxed pl-1 border-l-2 border-rose-400">
                        "{reasonText}"
                    </p>
                </div>

                {errorMessage && (
                    <div className="rounded-[8px] border border-red-200 bg-red-50 p-3 text-[14px] text-red-700 flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                        <span>{errorMessage}</span>
                    </div>
                )}

                {/* File Upload Dropzone */}
                <div>
                    <label className="block text-[14px] font-semibold text-slate-800 mb-1.5">
                        Upload Corrected / Missing File <span className="text-rose-500">*</span>
                    </label>

                    <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                        onChange={handleFileChange}
                    />

                    {!fileToUpload ? (
                        <div
                            onDragEnter={handleDrag}
                            onDragLeave={handleDrag}
                            onDragOver={handleDrag}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                            className={cn(
                                "flex flex-col items-center justify-center rounded-[8px] border-2 border-dashed p-6 text-center cursor-pointer transition-all duration-200",
                                dragActive
                                    ? "border-rose-500 bg-rose-50/80 scale-[0.99]"
                                    : "border-slate-300 bg-slate-50/70 hover:border-rose-400 hover:bg-rose-50/30"
                            )}
                        >
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600 mb-2">
                                <UploadCloud className="h-6 w-6" />
                            </div>
                            <p className="text-[14px] font-semibold text-slate-800">
                                Click to select or drag & drop corrected document
                            </p>
                            <p className="text-[12px] text-slate-500 mt-1">
                                Supported formats: PDF, Word (.docx), Excel (.xlsx), JPG, PNG (Max: 25MB)
                            </p>
                        </div>
                    ) : (
                        <div className="flex items-center justify-between rounded-[8px] border border-slate-200 bg-slate-50 p-3 shadow-xs">
                            <div className="flex items-center gap-3 truncate">
                                <div className="flex h-10 w-10 items-center justify-center rounded-[6px] bg-rose-100 text-rose-700 shrink-0">
                                    <FileText className="h-5 w-5" />
                                </div>
                                <div className="truncate">
                                    <p className="text-[14px] font-semibold text-slate-800 truncate">
                                        {fileToUpload.name}
                                    </p>
                                    <p className="text-[12px] text-slate-500">
                                        {formatBytes(fileToUpload.size)}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setFileToUpload(null);
                                    if (fileInputRef.current) fileInputRef.current.value = '';
                                }}
                                className="rounded-[6px] p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    )}
                </div>

                {/* Remediation Notes Textarea */}
                <div>
                    <label className="block text-[14px] font-semibold text-slate-800 mb-1.5">
                        Remediation Explanation / Correction Notes <span className="text-slate-400 font-normal">(Optional)</span>
                    </label>
                    <textarea
                        value={remediationNote}
                        onChange={(e) => setRemediationNote(e.target.value)}
                        placeholder="Detail the corrections, signatures added, or missing requirements attached..."
                        rows={4}
                        className="w-full rounded-[8px] border border-slate-200 bg-white p-3 text-[14px] text-slate-900 placeholder:text-slate-400 focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500 shadow-xs"
                    />
                    <p className="mt-1 text-[12px] text-slate-500">
                        This explanation will be permanently recorded in the official Audit Trail alongside your upload.
                    </p>
                </div>
            </form>
        </BaseModal>
    );
}

export default DocumentCorrectionModal;
