import React, { useState } from 'react';
import { X, Lock, Download, AlertCircle } from 'lucide-react';
import axios from 'axios';

type Props = {
    isOpen: boolean;
    onClose: () => void;
    documentId: number | string;
    onSuccess: (message: string) => void;
};

export function ExportPasswordModal({ isOpen, onClose, documentId, onSuccess }: Props) {
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const handleExport = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        
        if (!password) {
            setError('Please enter your password.');
            return;
        }

        setIsLoading(true);

        try {
            const response = await axios.post(`/documents/${documentId}/export`, { password });
            
            // On success, trigger the download if a URL is provided
            if (response.data.url) {
                const link = document.createElement('a');
                link.href = response.data.url;
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
            if (err.response && err.response.data && err.response.data.message) {
                setError(err.response.data.message);
            } else {
                setError('An error occurred during verification.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose} />
            <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between border-b border-slate-200 p-6">
                    <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900">
                        <Lock className="h-5 w-5 text-blue-600" />
                        Secure Export
                    </h2>
                    <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
                        <X className="h-5 w-5" />
                    </button>
                </div>
                
                <form onSubmit={handleExport} className="p-6">
                    <p className="mb-6 text-sm text-slate-500">
                        Please enter your account password to authorize exporting this document. This action will be logged in the Audit Trail.
                    </p>

                    {error && (
                        <div className="mb-6 flex items-center gap-2 rounded-lg bg-red-50 p-4 text-sm text-red-700">
                            <AlertCircle className="h-4 w-4 shrink-0" />
                            <p>{error}</p>
                        </div>
                    )}

                    <div className="space-y-4">
                        <div>
                            <label className="mb-2 block text-sm font-semibold text-slate-700">
                                Password
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                                placeholder="Enter your password"
                                required
                            />
                        </div>
                    </div>

                    <div className="mt-8 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-xl px-5 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100"
                            disabled={isLoading}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-70"
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
                    </div>
                </form>
            </div>
        </div>
    );
}
