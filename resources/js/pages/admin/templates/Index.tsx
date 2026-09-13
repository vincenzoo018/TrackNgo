import { Head } from '@inertiajs/react';
import TrackngoLayout from '@/layouts/trackngo/TrackngoLayout';
import { FileCode2, Upload, FileText, Download, MoreVertical, Search, FileSignature } from 'lucide-react';
import { useState } from 'react';

const mockTemplates = [
    { id: 1, name: 'Standard Disbursement Voucher', category: 'Finance', lastUpdated: 'May 1, 2026', format: 'PDF/DOCX' },
    { id: 2, name: 'Sangguniang Panlungsod Resolution', category: 'Legislative', lastUpdated: 'April 20, 2026', format: 'DOCX' },
    { id: 3, name: 'Internal Memorandum (Mayor)', category: 'Executive', lastUpdated: 'May 5, 2026', format: 'DOCX' },
    { id: 4, name: 'Leave Application Form', category: 'HR', lastUpdated: 'Jan 15, 2026', format: 'PDF' },
    { id: 5, name: 'Purchase Request Form', category: 'Procurement', lastUpdated: 'Feb 10, 2026', format: 'PDF' },
    { id: 6, name: 'Notice of Award', category: 'Procurement', lastUpdated: 'Mar 12, 2026', format: 'DOCX' },
];

export default function DocumentTemplates() {
    const [searchQuery, setSearchQuery] = useState('');

    const filteredTemplates = mockTemplates.filter(t => 
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        t.category.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <TrackngoLayout>
            <Head title="Document Templates — TrackNGo Mati" />

            <div className="space-y-6 pb-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between shrink-0 gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-[var(--tng-slate-900)] flex items-center gap-2">
                            <FileCode2 className="h-6 w-6 text-[var(--tng-blue-600)]" />
                            Document Templates
                        </h1>
                        <p className="mt-0.5 text-sm text-[var(--tng-slate-500)]">
                            Manage standardized LGU forms, templates, and automated document generation rules.
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button className="flex items-center gap-2 rounded-lg bg-[var(--tng-blue-600)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--tng-blue-700)] transition-colors shadow-md">
                            <Upload className="h-4 w-4" /> Upload Template
                        </button>
                    </div>
                </div>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--tng-slate-400)]" />
                    <input
                        type="text"
                        placeholder="Search templates by name or category..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full rounded-xl border border-[var(--tng-slate-200)] bg-white py-3.5 pl-10 pr-4 text-sm outline-none transition-all placeholder:text-[var(--tng-slate-400)] focus:border-[var(--tng-blue-500)] focus:ring-4 focus:ring-[var(--tng-blue-500)]/10"
                    />
                </div>

                {/* Template Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {filteredTemplates.map(template => (
                        <div key={template.id} className="group relative rounded-xl border border-[var(--tng-slate-200)] bg-white p-6 shadow-sm transition-all hover:border-[var(--tng-blue-300)] hover:shadow-md">
                            <div className="absolute right-4 top-4">
                                <button className="rounded p-1 text-[var(--tng-slate-400)] hover:bg-[var(--tng-slate-100)] hover:text-[var(--tng-slate-700)]">
                                    <MoreVertical className="h-5 w-5" />
                                </button>
                            </div>
                            
                            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--tng-blue-50)] text-[var(--tng-blue-600)] mb-4">
                                {template.format.includes('DOCX') ? <FileSignature className="h-6 w-6" /> : <FileText className="h-6 w-6" />}
                            </div>
                            
                            <h3 className="text-base font-bold text-[var(--tng-slate-900)] mb-1 leading-snug">{template.name}</h3>
                            <div className="flex items-center gap-2 mb-4">
                                <span className="rounded bg-[var(--tng-slate-100)] px-2 py-0.5 text-[10px] font-semibold uppercase text-[var(--tng-slate-600)]">{template.category}</span>
                                <span className="rounded bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-indigo-700">{template.format}</span>
                            </div>
                            
                            <div className="flex items-center justify-between border-t border-[var(--tng-slate-100)] pt-4 mt-4">
                                <span className="text-xs text-[var(--tng-slate-400)]">Updated {template.lastUpdated}</span>
                                <button className="flex items-center gap-1.5 text-xs font-semibold text-[var(--tng-blue-600)] hover:underline">
                                    <Download className="h-3.5 w-3.5" /> Download
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </TrackngoLayout>
    );
}
