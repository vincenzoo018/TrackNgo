import { Head, Link } from '@inertiajs/react';
import { Plus, ScanLine, ArrowLeft } from 'lucide-react';
import TrackngoLayout from '@/layouts/trackngo/TrackngoLayout';

export default function CreateDocument() {
    return (
        <TrackngoLayout
            breadcrumbs={[
                { title: 'Home', href: '/cart' },
                { title: 'My Documents', href: '/cart/escalations' },
                { title: 'Submit New Document', href: '#' },
            ]}
        >
            <Head title="Submit New Document — TrackNGo Mati" />

            <div className="mx-auto max-w-4xl space-y-6">
                {/* Header */}
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--tng-blue-50)] text-[var(--tng-blue-600)]">
                            <Plus className="h-6 w-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-[var(--tng-slate-900)]">
                                Submit New Document
                            </h1>
                            <p className="text-sm text-[var(--tng-slate-500)]">
                                Upload a document and create its initial routing slip
                            </p>
                        </div>
                    </div>
                    <Link
                        href="/cart/escalations"
                        className="flex items-center gap-1.5 rounded-lg border border-[var(--tng-slate-200)] bg-white px-3 py-2 text-sm font-medium text-[var(--tng-slate-600)] transition-colors hover:bg-[var(--tng-slate-50)]"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back to List
                    </Link>
                </div>

                {/* Form Content */}
                <div className="rounded-2xl border border-[var(--tng-slate-200)] bg-white shadow-sm">
                    <div className="p-8 space-y-10">
                        {/* Section 1: File Upload */}
                        <section>
                            <h3 className="text-base font-semibold text-[var(--tng-slate-900)] mb-5 flex items-center gap-2">
                                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--tng-slate-100)] text-xs text-[var(--tng-slate-600)]">1</span>
                                Document Details
                            </h3>
                            <div className="space-y-6 pl-8">
                                {/* File Upload Area */}
                                <div className="group relative flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--tng-slate-200)] bg-[var(--tng-slate-50)] py-10 transition-colors hover:border-[var(--tng-blue-400)] hover:bg-[var(--tng-blue-50)]">
                                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-sm group-hover:bg-[var(--tng-blue-100)] group-hover:text-[var(--tng-blue-600)] transition-colors">
                                        <ScanLine className="h-6 w-6 text-[var(--tng-slate-400)] group-hover:text-[var(--tng-blue-600)]" />
                                    </div>
                                    <div className="text-center">
                                        <p className="text-sm font-medium text-[var(--tng-slate-700)]">Click to upload or drag and drop</p>
                                        <p className="text-xs text-[var(--tng-slate-500)] mt-1">PDF, PNG, JPG (max. 10MB)</p>
                                    </div>
                                </div>
                                
                                {/* OCR Result Simulation */}
                                <div className="rounded-xl border border-[var(--tng-blue-100)] bg-[var(--tng-blue-50)] p-5">
                                    <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-[var(--tng-blue-600)] flex items-center gap-1.5">
                                        ✨ Auto-filled by OCR
                                    </p>
                                    <div className="grid grid-cols-2 gap-5">
                                        <div>
                                            <label className="mb-1.5 block text-sm font-medium text-[var(--tng-slate-700)]">
                                                Title
                                            </label>
                                            <input
                                                type="text"
                                                defaultValue="Executive Order No. 12"
                                                className="h-10 w-full rounded-lg border border-[var(--tng-blue-200)] bg-white px-3 text-sm text-[var(--tng-slate-900)] focus:border-[var(--tng-blue-500)] focus:outline-none focus:ring-2 focus:ring-[var(--tng-blue-500)]/20"
                                            />
                                        </div>
                                        <div>
                                            <label className="mb-1.5 block text-sm font-medium text-[var(--tng-slate-700)]">
                                                Document Category
                                            </label>
                                            <select className="h-10 w-full rounded-lg border border-[var(--tng-blue-200)] bg-white px-3 text-sm text-[var(--tng-slate-900)] focus:border-[var(--tng-blue-500)] focus:outline-none focus:ring-2 focus:ring-[var(--tng-blue-500)]/20">
                                                <option>Executive Order</option>
                                                <option>Memorandum</option>
                                                <option>Travel Order</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-5">
                                    <div>
                                        <label className="mb-1.5 block text-sm font-medium text-[var(--tng-slate-700)]">
                                            Originating Department
                                        </label>
                                        <select className="h-10 w-full rounded-lg border border-[var(--tng-slate-200)] bg-white px-3 text-sm text-[var(--tng-slate-900)] focus:border-[var(--tng-blue-500)] focus:outline-none focus:ring-2 focus:ring-[var(--tng-blue-500)]/20">
                                            <option>Select department...</option>
                                            <option>Admin Office</option>
                                            <option>HR Department</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="mb-1.5 block text-sm font-medium text-[var(--tng-slate-700)]">
                                            Submitted By
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="Name of submitter"
                                            className="h-10 w-full rounded-lg border border-[var(--tng-slate-200)] bg-white px-3 text-sm text-[var(--tng-slate-900)] placeholder:text-[var(--tng-slate-400)] focus:border-[var(--tng-blue-500)] focus:outline-none focus:ring-2 focus:ring-[var(--tng-blue-500)]/20"
                                        />
                                    </div>
                                </div>

                                {/* Urgency */}
                                <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
                                    <label className="flex items-start gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="mt-1 h-4 w-4 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                                        />
                                        <div>
                                            <span className="block text-sm font-semibold text-amber-800">
                                                Mark as Urgent / Rush
                                            </span>
                                            <span className="block text-sm text-amber-700/80 mt-1">
                                                Halves the ARTA SLA threshold for this document type. Requires justification.
                                            </span>
                                        </div>
                                    </label>
                                    <div className="mt-4">
                                        <input
                                            type="text"
                                            placeholder="Reason for urgency..."
                                            className="h-10 w-full rounded-lg border border-amber-200 bg-white px-3 text-sm text-[var(--tng-slate-900)] placeholder:text-amber-400/70 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 disabled:opacity-50 disabled:bg-amber-50/50"
                                            disabled
                                        />
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Section 2: Routing Slip */}
                        <section>
                            <h3 className="text-base font-semibold text-[var(--tng-slate-900)] mb-5 flex items-center gap-2">
                                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--tng-slate-100)] text-xs text-[var(--tng-slate-600)]">2</span>
                                Initial Routing Slip
                            </h3>
                            <div className="space-y-5 pl-8">
                                <div>
                                    <label className="mb-1.5 block text-sm font-medium text-[var(--tng-slate-700)]">
                                        Forward To (Destination)
                                    </label>
                                    <select className="h-10 w-full rounded-lg border border-[var(--tng-slate-200)] bg-white px-3 text-sm text-[var(--tng-slate-900)] focus:border-[var(--tng-blue-500)] focus:outline-none focus:ring-2 focus:ring-[var(--tng-blue-500)]/20">
                                        <option>Select Destination Department...</option>
                                        <option>Office of the Mayor</option>
                                        <option>City Engineering Office</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="mb-1.5 block text-sm font-medium text-[var(--tng-slate-700)]">
                                        Instruction / Remarks
                                    </label>
                                    <textarea
                                        placeholder="Enter instructions for the recipient..."
                                        rows={4}
                                        className="w-full rounded-lg border border-[var(--tng-slate-200)] bg-white p-3 text-sm text-[var(--tng-slate-900)] placeholder:text-[var(--tng-slate-400)] focus:border-[var(--tng-blue-500)] focus:outline-none focus:ring-2 focus:ring-[var(--tng-blue-500)]/20"
                                    />
                                </div>
                            </div>
                        </section>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-end gap-3 border-t border-[var(--tng-slate-100)] bg-[var(--tng-slate-50)] px-8 py-5 rounded-b-2xl">
                        <Link
                            href="/cart/escalations"
                            className="rounded-lg px-4 py-2.5 text-sm font-medium text-[var(--tng-slate-600)] transition-colors hover:bg-[var(--tng-slate-200)]"
                        >
                            Cancel
                        </Link>
                        <Link href="/cart/escalations" className="flex items-center gap-2 rounded-lg bg-[var(--tng-blue-600)] px-6 py-2.5 text-sm font-medium text-white shadow-md shadow-blue-600/25 transition-all hover:bg-[var(--tng-blue-700)] hover:shadow-lg">
                            Generate Routing Slip & Submit
                        </Link>
                    </div>
                </div>
            </div>
        </TrackngoLayout>
    );
}
