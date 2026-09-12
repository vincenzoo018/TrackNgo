import React, { useState } from 'react';
import { Lock, Download, AlertCircle } from 'lucide-react';
import { BaseModal } from './BaseModal';

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
            setError('Please enter your password.');
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
                setError(data.message || 'Verification failed.');
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
            setError('An error occurred during verification. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <BaseModal
            isOpen={isOpen}
            onClose={isLoading ? () => {} : onClose}
            title="Secure Export"
            identifier={identifier}
            description="Please enter your account password to authorize exporting this document. This action will be logged in the Audit Trail."
            icon={<Lock className="h-5 w-5" />}
            maxWidth="max-w-md"
            formProps={{ onSubmit: handleExport }}
            footer={
                <>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-200"
                        disabled={isLoading}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="flex items-center justify-center gap-2 rounded-lg bg-[var(--tng-blue-600)] px-6 py-2.5 text-sm font-medium text-white transition-all hover:bg-[var(--tng-blue-700)] shadow-md shadow-blue-600/25 disabled:opacity-70 disabled:shadow-none"
                    >
                        {isLoading ? (
                            'Verifying...'
                        ) : (
                            <>
                                <Download className="h-4 w-4" />
                                Export PDF
                            </>
                        )}
                    </button>
                </>
            }
        >
            <div className="space-y-6">
                {error && (
                    <div className="flex items-center gap-2 rounded-lg bg-red-50 p-4 text-sm text-red-700">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        <p>{error}</p>
                    </div>
                )}

                <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                        Password
                    </label>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm focus:border-[var(--tng-blue-500)] focus:ring-1 focus:ring-[var(--tng-blue-500)] focus:outline-none"
                        placeholder="Enter your password"
                        required
                    />
                </div>
            </div>
        </BaseModal>
    );
}
