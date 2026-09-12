import React, { useState } from 'react';
import { Lock, Download, AlertCircle, ShieldCheck } from 'lucide-react';
import {
    BaseModal,
    ModalSection,
    ModalField,
    ModalPrimaryButton,
    ModalSecondaryButton,
} from './BaseModal';

type Props = {
    isOpen: boolean;
    onClose: () => void;
    documentId: number | string;
    onSuccess: (message: string) => void;
    identifier?: string;
};

export function ExportPasswordModal({ isOpen, onClose, documentId, onSuccess, identifier }: Props) {
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
            const csrfToken = (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content ?? '';
            const response = await fetch(`/documents/${documentId}/export`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                    'Accept': 'application/json',
                },
                body: JSON.stringify({ password }),
            });

            const data = await response.json();

            if (!response.ok) {
                setError(data.message || 'Security verification failed. Please check your password.');
                return;
            }

            // On success, trigger the download if a URL is provided
            if (data.url) {
                const link = document.createElement('a');
                link.href = data.url;
                link.target = '_blank';
                link.download = '';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }

            onSuccess('Document exported successfully and logged in Audit Trail.');
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
