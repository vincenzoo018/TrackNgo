import { Head, Link } from '@inertiajs/react';
import { Search, ScanLine, Plus, Download, Lock, QrCode, Eye } from 'lucide-react';
import { useState } from 'react';
import TrackngoLayout from '@/layouts/trackngo/TrackngoLayout';
import { SeverityPill } from '@/components/trackngo/SeverityPill';
import { ArtaBadge } from '@/components/trackngo/ArtaBadge';
import { StepDots } from '@/components/trackngo/StepProgress';
import { mockDocuments } from '@/lib/mock-data';
import { cn } from '@/lib/utils';
import type { Document } from '@/types/trackngo';

export default function AdminDocumentsIndex() {
    const documents = mockDocuments;
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    
    const filteredDocs = documents.filter((doc) =>
        doc.reference_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.submitted_by.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const toggleSelect = (id: number) => {
        setSelectedIds((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        );
    };

    const toggleAll = () => {
        if (selectedIds.length === filteredDocs.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(filteredDocs.map((d) => d.id));
        }
    };

    return (
        <TrackngoLayout role="admin">
            <Head title="All Documents — TrackNGo Mati" />

            <div className="space-y-5">
                {/* Header */}
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-[var(--tng-slate-900)]">
                            All Documents
                        </h1>
                        <p className="mt-0.5 text-sm text-[var(--tng-slate-500)]">
                            {documents.length} total records across 52 departments
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button className="flex items-center gap-2 rounded-lg border border-[var(--tng-blue-200)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--tng-blue-700)] transition-colors hover:bg-[var(--tng-blue-50)]">
                            <ScanLine className="h-4 w-4" />
                            OCR Scan
                        </button>
                        <Link
                            href="/admin/documents/create"
                            className="flex items-center gap-2 rounded-lg bg-[var(--tng-blue-600)] px-4 py-2.5 text-sm font-medium text-white shadow-md shadow-blue-600/25 transition-all hover:bg-[var(--tng-blue-700)] hover:shadow-lg"
                        >
                            <Plus className="h-4 w-4" />
                            Submit New Document
                        </Link>
                    </div>
                </div>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--tng-slate-400)]" />
                    <input
                        type="text"
                        placeholder="Search by reference number, type, or name..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-12 w-full rounded-xl border border-[var(--tng-slate-200)] bg-white pl-12 pr-4 text-sm text-[var(--tng-slate-700)] placeholder:text-[var(--tng-slate-400)] focus:border-[var(--tng-blue-500)] focus:outline-none focus:ring-2 focus:ring-[var(--tng-blue-500)]/20"
                    />
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-3">
                    {['Document Type', 'Department', 'Status'].map((filter) => (
                        <div
                            key={filter}
                            className="flex items-center gap-2 rounded-lg border border-[var(--tng-slate-200)] bg-white px-3 py-2 text-sm text-[var(--tng-slate-600)] cursor-pointer hover:border-[var(--tng-blue-300)] transition-colors"
                        >
                            <span>{filter}</span>
                            <span className="text-[var(--tng-slate-400)]">▾</span>
                        </div>
                    ))}
                    <div className="flex items-center gap-2 rounded-lg border border-[var(--tng-slate-200)] bg-white px-3 py-2 text-sm text-[var(--tng-slate-600)]">
                        <span>May 1, 2026 — May 29, 2026</span>
                        <span className="text-[var(--tng-slate-400)]">▾</span>
                    </div>

                    <button className="ml-auto flex items-center gap-2 rounded-lg border border-[var(--tng-slate-200)] bg-white px-4 py-2 text-sm font-medium text-[var(--tng-slate-600)] transition-colors hover:bg-[var(--tng-slate-50)]">
                        <Download className="h-4 w-4" />
                        Export
                        <Lock className="h-3 w-3 text-[var(--tng-amber-500)]" />
                    </button>
                </div>

                {/* Table */}
                <div className="overflow-hidden rounded-xl border border-[var(--tng-slate-200)] bg-white">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-[var(--tng-slate-200)] bg-[var(--tng-slate-50)]">
                                    <th className="px-4 py-3 text-left">
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.length === filteredDocs.length && filteredDocs.length > 0}
                                            onChange={toggleAll}
                                            className="h-4 w-4 rounded border-[var(--tng-slate-300)] text-[var(--tng-blue-600)] focus:ring-[var(--tng-blue-500)]"
                                        />
                                    </th>
                                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--tng-slate-500)]">
                                        Ref No.
                                    </th>
                                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--tng-slate-500)]">
                                        Document Type
                                    </th>
                                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--tng-slate-500)]">
                                        Submitted By
                                    </th>
                                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--tng-slate-500)]">
                                        Department
                                    </th>
                                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--tng-slate-500)]">
                                        Date Filed
                                    </th>
                                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--tng-slate-500)]">
                                        Step Progress
                                    </th>
                                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--tng-slate-500)]">
                                        Status
                                    </th>
                                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--tng-slate-500)]">
                                        ARTA
                                    </th>
                                    <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-[var(--tng-slate-500)]">
                                        QR
                                    </th>
                                    <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-[var(--tng-slate-500)]">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--tng-slate-100)]">
                                {filteredDocs.map((doc, idx) => (
                                    <tr
                                        key={doc.id}
                                        className="group transition-colors hover:bg-[var(--tng-blue-50)]/50"
                                        style={{ animationDelay: `${idx * 40}ms` }}
                                    >
                                        <td className="px-4 py-3">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.includes(doc.id)}
                                                onChange={() => toggleSelect(doc.id)}
                                                className="h-4 w-4 rounded border-[var(--tng-slate-300)] text-[var(--tng-blue-600)] focus:ring-[var(--tng-blue-500)]"
                                            />
                                        </td>
                                        <td className="px-4 py-3">
                                            <Link
                                                href={`/admin/documents/${doc.id}`}
                                                className="text-sm font-semibold text-[var(--tng-blue-600)] hover:underline"
                                            >
                                                {doc.reference_number}
                                            </Link>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-[var(--tng-slate-700)]">
                                            {doc.document_type.name}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-[var(--tng-slate-700)]">
                                            {doc.submitted_by}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-[var(--tng-slate-600)]">
                                            {doc.department.name}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-[var(--tng-slate-600)]">
                                            {new Date(doc.submitted_at).toLocaleDateString('en-US', {
                                                month: 'short',
                                                day: '2-digit',
                                                year: 'numeric',
                                            })}
                                        </td>
                                        <td className="px-4 py-3">
                                            <StepDots current={doc.step_progress} total={doc.total_steps} />
                                        </td>
                                        <td className="px-4 py-3">
                                            <SeverityPill status={doc.status} />
                                        </td>
                                        <td className="px-4 py-3">
                                            <ArtaBadge daysLeft={doc.arta_days_left} threshold={doc.arta_threshold} />
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <button className="rounded-md p-1.5 text-[var(--tng-slate-400)] transition-colors hover:bg-[var(--tng-slate-100)] hover:text-[var(--tng-blue-600)]">
                                                <QrCode className="h-4 w-4" />
                                            </button>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <Link
                                                href={`/admin/documents/${doc.id}`}
                                                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--tng-blue-600)] px-3 py-1.5 text-xs font-medium text-white transition-all hover:bg-[var(--tng-blue-700)] hover:shadow-md"
                                            >
                                                <Eye className="h-3.5 w-3.5" />
                                                View
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {filteredDocs.length === 0 && (
                        <div className="py-12 text-center">
                            <FileText className="mx-auto h-12 w-12 text-[var(--tng-slate-300)]" />
                            <p className="mt-3 text-sm text-[var(--tng-slate-500)]">
                                No documents found matching your search.
                            </p>
                        </div>
                    )}
                </div>
            </div>

             />
            )}
        </TrackngoLayout>
    );
}

// Dummy import to prevent unused reference
import { FileText } from 'lucide-react';


