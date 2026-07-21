import { Head } from '@inertiajs/react';
import { PenTool, Upload, Shield, Image as ImageIcon, Trash2 } from 'lucide-react';
import TrackngoLayout from '@/layouts/trackngo/TrackngoLayout';

export default function Signature() {
    return (
        <TrackngoLayout role="mayor">
            <Head title="Digital Signature Management" />

            <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-[var(--tng-slate-900)]">Digital Signature</h1>
                    <p className="mt-1 text-[var(--tng-slate-500)]">Manage your secure digital signature for document approvals</p>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2 space-y-6">
                    <div className="rounded-xl border border-[var(--tng-slate-200)] bg-white p-6 shadow-sm">
                        <div className="flex items-center justify-between border-b border-[var(--tng-slate-100)] pb-4 mb-6">
                            <h3 className="font-semibold text-[var(--tng-slate-900)] flex items-center gap-2">
                                <ImageIcon className="w-5 h-5 text-[var(--tng-slate-400)]" />
                                Current Signature
                            </h3>
                        </div>

                        <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-[var(--tng-slate-200)] rounded-lg bg-[var(--tng-slate-50)] relative group">
                            {/* Mock Signature Display */}
                            <div className="text-4xl font-[cursive] text-[var(--tng-slate-800)] opacity-60">
                                Engr. Pedro Lim
                            </div>
                            <div className="absolute inset-0 bg-white/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                <button className="flex items-center gap-2 bg-white border border-[var(--tng-slate-200)] px-4 py-2 rounded-md shadow-sm text-sm font-medium text-[var(--tng-slate-700)] hover:bg-[var(--tng-slate-50)] transition-colors">
                                    <Upload className="w-4 h-4" /> Replace
                                </button>
                                <button className="flex items-center gap-2 bg-red-50 border border-red-100 px-4 py-2 rounded-md shadow-sm text-sm font-medium text-red-600 hover:bg-red-100 transition-colors">
                                    <Trash2 className="w-4 h-4" /> Remove
                                </button>
                            </div>
                        </div>

                        <div className="mt-6 flex flex-col sm:flex-row gap-4">
                            <button className="flex-1 flex items-center justify-center gap-2 bg-[var(--tng-blue-600)] text-white px-4 py-2.5 rounded-md hover:bg-[var(--tng-blue-700)] transition-colors text-sm font-medium shadow-sm">
                                <Upload className="w-4 h-4" /> Upload New Signature
                            </button>
                            <button className="flex-1 flex items-center justify-center gap-2 bg-white border border-[var(--tng-slate-200)] text-[var(--tng-slate-700)] px-4 py-2.5 rounded-md hover:bg-[var(--tng-slate-50)] transition-colors text-sm font-medium shadow-sm">
                                <PenTool className="w-4 h-4" /> Draw Signature
                            </button>
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="rounded-xl border border-[var(--tng-slate-200)] bg-[var(--tng-slate-50)] p-6 shadow-sm">
                        <div className="flex items-center gap-3 mb-4 text-[var(--tng-blue-700)]">
                            <Shield className="w-6 h-6" />
                            <h3 className="font-semibold">Security Protocol</h3>
                        </div>
                        <p className="text-sm text-[var(--tng-slate-600)] mb-4">
                            Your digital signature is encrypted and securely stored. It will only be appended to documents upon your explicit approval action.
                        </p>
                        <ul className="text-xs text-[var(--tng-slate-500)] space-y-2">
                            <li className="flex items-start gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-[var(--tng-slate-400)] mt-1 shrink-0" />
                                File must be PNG with transparent background
                            </li>
                            <li className="flex items-start gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-[var(--tng-slate-400)] mt-1 shrink-0" />
                                Maximum file size is 2MB
                            </li>
                            <li className="flex items-start gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-[var(--tng-slate-400)] mt-1 shrink-0" />
                                Optimal resolution: 400x200 pixels
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </TrackngoLayout>
    );
}

