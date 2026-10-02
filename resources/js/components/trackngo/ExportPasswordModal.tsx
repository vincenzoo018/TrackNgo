import React, { useState } from 'react';
import { Lock, Download, AlertCircle, ShieldCheck } from 'lucide-react';
import {
    BaseModal,
    ModalSection,
    ModalField,
    ModalPrimaryButton,
    ModalSecondaryButton,
} from './BaseModal';
import { csrfHeaders } from '@/lib/csrf';

type Props = {
    isOpen: boolean;
    onClose: () => void;
    documentId: number | string;
    /** Download one of the document's attached files instead of the main document */
    attachmentId?: number | null;
    /** 'signed' downloads the final copy with every signature stamped on it */
    variant?: 'signed' | null;
    onSuccess: (message: string) => void;
    identifier?: string;
};

export function ExportPasswordModal({ isOpen, onClose, documentId, attachmentId, variant = null, onSuccess, identifier }: Props) {
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleExport = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        
        if (!password) {
            setError('Please enter your account password to verify export.');
            return;
        }

        setIsLoading(true);

        try {
            const response = await fetch(`/documents/${documentId}/export`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...csrfHeaders(),
                    'Accept': 'application/json',
                },
                body: JSON.stringify(variant ? { password, variant } : attachmentId ? { password, attachment_id: attachmentId } : { password }),
            });

            const isJson = (response.headers.get('content-type') || '').includes('application/json');
            const data = isJson ? await response.json() : null;

            if (!response.ok) {
                setError(data?.message || (response.status === 419
                    ? 'Your session expired. Please refresh the page and try again.'
                    : 'Security verification failed. Please check your password.'));
                return;
            }

            if (!isJson) {
                // The server streamed the original file: save it with the name it suggested
                const blob = await response.blob();
                const disposition = response.headers.get('content-disposition') || '';
                const fileName = disposition.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i)?.[1] || `Document_${identifier || documentId}`;
                const blobUrl = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = blobUrl;
                link.download = decodeURIComponent(fileName);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(blobUrl);
            } else if (data?.url) {
                const link = document.createElement('a');
                link.href = data.url;
                link.target = '_blank';
                link.download = '';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }

            onSuccess(Number(documentId) === 0
                ? 'Export verified. Your list has been downloaded.'
                : 'Document exported successfully and logged in Audit Trail.');
            onClose();
            setPassword('');
        } catch (err: any) {
            setError('An unexpected error occurred during verification. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <BaseModal
            isOpen={isOpen}
            onClose={isLoading ? () => {} : onClose}
            title="Secure Document Export"
            identifier={identifier}
            description="Account credential verification is required before exporting official municipal records."
            icon={<Lock className="h-5 w-5" />}
            maxWidth="max-w-md"
            formProps={{ onSubmit: handleExport }}
            footer={
                <>
                    <ModalSecondaryButton onClick={onClose} disabled={isLoading}>
                        Cancel
                    </ModalSecondaryButton>
                    <ModalPrimaryButton isLoading={isLoading} loadingText="Verifying...">
                        <Download className="h-4 w-4" />
                        Export Document
                    </ModalPrimaryButton>
                </>
            }
        >
            <div className="space-y-5">
                <ModalSection
                    title="Security Verification"
                    description="Enter your active password to authenticate this export action."
                >
                    <div className="space-y-3">
                        <ModalField
                            label="Account Password"
                            required
                            error={error}
                        >
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 font-mono"
                                placeholder="Enter your current password"
                                required
                                autoFocus
                            />
                        </ModalField>

                        <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 flex items-start gap-2 text-xs text-slate-600">
                            <ShieldCheck className="h-4 w-4 shrink-0 text-blue-600 mt-0.5" />
                            <span>
                                This export event will be permanently recorded in the system Audit Trail with timestamp, document ID, and user identity.
                            </span>
                        </div>
                    </div>
                </ModalSection>
            </div>
        </BaseModal>
    );
}
