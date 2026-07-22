import { Head, Link, usePage } from '@inertiajs/react';
import { Search, ScanLine, Plus, Download, Lock, QrCode, Eye } from 'lucide-react';
import { useState } from 'react';
import TrackngoLayout from '@/layouts/trackngo/TrackngoLayout';
import { SeverityPill } from '@/components/trackngo/SeverityPill';
import { ArtaBadge } from '@/components/trackngo/ArtaBadge';
import { StepDots } from '@/components/trackngo/StepProgress';
import { cn } from '@/lib/utils';
import type { Document } from '@/types/trackngo';

export default function DepartmentHeadEndorsements() {
    const { props } = usePage();
    const documents = (props.dbDocuments || []) as any[];
    const departments = (props.departments || []) as any[];
    const documentTypes = (props.document_types || []) as any[];
    
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [showCreateModal, setShowCreateModal] = useState(false);

    const filteredDocs = documents.filter((doc) =>
        (doc.reference_number && doc.reference_number.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (doc.title && doc.title.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (doc.sender && doc.sender.toLowerCase().includes(searchQuery.toLowerCase()))
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
        <TrackngoLayout role="department-head">
            <Head title="All Documents — TrackNGo Mati" />

            <div className="space-y-5">
                {/* Header */}
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-[var(--tng-slate-900)]">
                            All Documents
                        </h1>
                        <p className="mt-0.5 text-sm text-[var(--tng-slate-500)]">
                            {documents.length} total records
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button className="flex items-center gap-2 rounded-lg border border-[var(--tng-blue-200)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--tng-blue-700)] transition-colors hover:bg-[var(--tng-blue-50)]">
                            <ScanLine className="h-4 w-4" />
                            OCR Scan
                        </button>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="flex items-center gap-2 rounded-lg bg-[var(--tng-blue-600)] px-4 py-2.5 text-sm font-medium text-white shadow-md shadow-blue-600/25 transition-all hover:bg-[var(--tng-blue-700)] hover:shadow-lg"
                        >
                            <Plus className="h-4 w-4" />
                            Endorse Document
                        </button>
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
                                        key={doc.document_id}
                                        className="group transition-colors hover:bg-[var(--tng-blue-50)]/50"
                                        style={{ animationDelay: `${idx * 40}ms` }}
                                    >
                                        <td className="px-4 py-3">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.includes(doc.document_id)}
                                                onChange={() => toggleSelect(doc.document_id)}
                                                className="h-4 w-4 rounded border-[var(--tng-slate-300)] text-[var(--tng-blue-600)] focus:ring-[var(--tng-blue-500)]"
                                            />
                                        </td>
                                        <td className="px-4 py-3">
                                            <Link
                                                href={`/department-head/documents/${doc.document_id}`}
                                                className="text-sm font-semibold text-[var(--tng-blue-600)] hover:underline"
                                            >
                                                {doc.reference_number}
                                            </Link>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-[var(--tng-slate-700)]">
                                            {doc.type?.type_name}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-[var(--tng-slate-700)]">
                                            {doc.sender || 'Unknown'}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-[var(--tng-slate-600)]">
                                            {doc.department?.department_name}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-[var(--tng-slate-600)]">
                                            {new Date(doc.created_at || doc.submitted_at).toLocaleDateString('en-US', {
                                                month: 'short',
                                                day: '2-digit',
                                                year: 'numeric',
                                            })}
                                        </td>
                                        <td className="px-4 py-3">
                                            <StepDots current={doc.current_step_index} total={doc.total_steps} />
                                        </td>
                                        <td className="px-4 py-3">
                                            <SeverityPill status={doc.status} />
                                        </td>
                                        <td className="px-4 py-3">
                                            <ArtaBadge daysLeft={3} threshold={doc.type?.arta_processing_days || 3} />
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <button className="rounded-md p-1.5 text-[var(--tng-slate-400)] transition-colors hover:bg-[var(--tng-slate-100)] hover:text-[var(--tng-blue-600)]">
                                                <QrCode className="h-4 w-4" />
                                            </button>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <Link
                                                href={`/department-head/documents/${doc.document_id}`}
                                                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--tng-blue-600)] px-3 py-1.5 text-xs font-medium text-white transition-all hover:bg-[var(--tng-blue-700)] hover:shadow-md"
                                            >
                                                <Eye className="h-3.5 w-3.5" />
                                                Review
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

            {/* Create Document Modal */}
            {showCreateModal && (
                <CreateDocumentModal 
                    onClose={() => setShowCreateModal(false)} 
                    departments={departments}
                    documentTypes={documentTypes}
                />
            )}
        </TrackngoLayout>
    );
}

import { useForm } from '@inertiajs/react';
import { useRef, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { Loader2 } from 'lucide-react';

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

function CreateDocumentModal({ onClose, departments = [], documentTypes = [] }: { onClose: () => void, departments?: any[], documentTypes?: any[] }) {
    const { data, setData, post, processing, errors, reset } = useForm({
        title: '',
        type_id: '',
        department_id: '',
        file: null as File | null,
        classification: 'normal',
        urgency_justification: '',
        forward_to: '',
        instruction: '',
        ocr_text: '',
    });

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isScanning, setIsScanning] = useState(false);
    const [ocrComplete, setOcrComplete] = useState(false);
    const [isUrgent, setIsUrgent] = useState(false);

    const handleFileUploadClick = () => {
        if (ocrComplete || isScanning) return;
        fileInputRef.current?.click();
    };

    const extractTextFromPDF = async (file: File) => {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            let fullText = '';
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map((item: any) => item.str).join(' ');
                fullText += pageText + '\n';
            }
            return fullText;
        } catch (error) {
            console.error('Error extracting PDF text:', error);
            return 'Could not extract text.';
        }
    };

    const formatFileNameToTitle = (filename: string) => {
        let name = filename.substring(0, filename.lastIndexOf('.')) || filename;
        name = name.replace(/[-_]/g, ' ');
        return name.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase());
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        setIsScanning(true);
        setData('file', file);
        
        let extractedText = '';
        if (file.type === 'application/pdf') {
            extractedText = await extractTextFromPDF(file);
        } else {
            await new Promise(resolve => setTimeout(resolve, 2000));
            extractedText = `Mock extracted text from image: ${file.name}`;
        }
        
        const generatedTitle = formatFileNameToTitle(file.name);
        
        let matchedTypeId = '';
        if (generatedTitle.toLowerCase().includes('executive order')) {
            matchedTypeId = documentTypes.find(t => t.type_name === 'Executive Order')?.type_id || '';
        } else if (generatedTitle.toLowerCase().includes('memo')) {
            matchedTypeId = documentTypes.find(t => t.type_name === 'Memorandum')?.type_id || '';
        } else {
            matchedTypeId = documentTypes[0]?.type_id || '';
        }

        setData(data => ({
            ...data,
            file: file,
            ocr_text: extractedText.trim(),
            title: generatedTitle,
            type_id: matchedTypeId
        }));

        setIsScanning(false);
        setOcrComplete(true);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        post('/department-head/documents', {
            onSuccess: () => {
                onClose();
            },
            onError: () => {
                console.error(errors);
            }
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose} />
            <form onSubmit={handleSubmit} className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-[var(--tng-slate-100)] px-6 py-5 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--tng-blue-50)] text-[var(--tng-blue-600)]">
                            <Plus className="h-5 w-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-[var(--tng-slate-900)]">
                                Endorse Document
                            </h2>
                            <p className="text-xs text-[var(--tng-slate-500)]">
                                Upload a document and create its initial routing slip
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg p-2 text-[var(--tng-slate-400)] hover:bg-[var(--tng-slate-50)] hover:text-[var(--tng-slate-600)] transition-colors"
                    >
                        ✕
                    </button>
                </div>

                {/* Body (Scrollable) */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8">
                    {/* Section 1: File Upload */}
                    <section>
                        <h3 className="text-sm font-semibold text-[var(--tng-slate-900)] mb-4 flex items-center gap-2">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--tng-slate-100)] text-[10px] text-[var(--tng-slate-600)]">1</span>
                            Document Details
                        </h3>
                        <div className="space-y-5 pl-7">
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                className="hidden" 
                                accept=".pdf,.png,.jpg,.jpeg" 
                                onChange={handleFileChange} 
                            />

                            {/* File Upload Area */}
                            {!ocrComplete && !isScanning && (
                                <div 
                                    onClick={handleFileUploadClick}
                                    className={`group relative flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed ${errors.file ? 'border-red-400 bg-red-50' : 'border-[var(--tng-slate-200)] bg-[var(--tng-slate-50)] hover:border-[var(--tng-blue-400)] hover:bg-[var(--tng-blue-50)]'} py-8 transition-colors`}
                                >
                                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm group-hover:bg-[var(--tng-blue-100)] group-hover:text-[var(--tng-blue-600)] transition-colors">
                                        <ScanLine className="h-5 w-5 text-[var(--tng-slate-400)] group-hover:text-[var(--tng-blue-600)]" />
                                    </div>
                                    <div className="text-center">
                                        <p className="text-sm font-medium text-[var(--tng-slate-700)]">Click to upload or drag and drop</p>
                                        <p className="text-xs text-[var(--tng-slate-500)]">PDF, PNG, JPG (max. 10MB)</p>
                                    </div>
                                    {errors.file && <p className="text-xs text-red-600 mt-1">{errors.file}</p>}
                                </div>
                            )}

                            {isScanning && (
                                <div className="flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed border-[var(--tng-blue-300)] bg-[var(--tng-blue-50)] py-8">
                                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm">
                                        <Loader2 className="h-5 w-5 animate-spin text-[var(--tng-blue-600)]" />
                                    </div>
                                    <div className="text-center">
                                        <p className="text-sm font-medium text-[var(--tng-blue-700)]">Extracting text in real-time...</p>
                                        <p className="text-xs text-[var(--tng-blue-500)] mt-1">Reading PDF contents</p>
                                    </div>
                                </div>
                            )}

                            {ocrComplete && data.file && (
                                <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm">
                                            <FileText className="h-5 w-5 text-emerald-600" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-emerald-900">{data.file.name}</p>
                                            <p className="text-xs text-emerald-700 mt-0.5">Scanned successfully • {(data.file.size / (1024 * 1024)).toFixed(2)} MB</p>
                                        </div>
                                    </div>
                                    <button 
                                        type="button"
                                        onClick={() => {
                                            setOcrComplete(false);
                                            setData('file', null);
                                            if (fileInputRef.current) fileInputRef.current.value = '';
                                        }}
                                        className="text-sm font-medium text-emerald-700 hover:text-emerald-800"
                                    >
                                        Replace
                                    </button>
                                </div>
                            )}
                            
                            {/* OCR Result Simulation */}
                            {ocrComplete && (
                                <div className="rounded-lg border border-[var(--tng-blue-100)] bg-[var(--tng-blue-50)] p-4">
                                    <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--tng-blue-600)] flex items-center gap-1.5">
                                        ✨ Auto-filled by OCR
                                    </p>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="mb-1.5 block text-xs font-medium text-[var(--tng-slate-700)]">
                                                Title
                                            </label>
                                            <input
                                                type="text"
                                                value={data.title}
                                                onChange={e => setData('title', e.target.value)}
                                                className="h-9 w-full rounded-md border border-[var(--tng-blue-200)] bg-white px-3 text-sm text-[var(--tng-slate-900)] focus:border-[var(--tng-blue-500)] focus:outline-none focus:ring-1 focus:ring-[var(--tng-blue-500)]"
                                            />
                                            {errors.title && <p className="text-xs text-red-600 mt-1">{errors.title}</p>}
                                        </div>
                                        <div>
                                            <label className="mb-1.5 block text-xs font-medium text-[var(--tng-slate-700)]">
                                                Document Category
                                            </label>
                                            <select 
                                                value={data.type_id}
                                                onChange={e => setData('type_id', e.target.value)}
                                                className="h-9 w-full rounded-md border border-[var(--tng-blue-200)] bg-white px-3 text-sm text-[var(--tng-slate-900)] focus:border-[var(--tng-blue-500)] focus:outline-none focus:ring-1 focus:ring-[var(--tng-blue-500)]"
                                            >
                                                <option value="">Select Document Category...</option>
                                                {documentTypes.map(t => (
                                                    <option key={t.type_id} value={t.type_id}>{t.type_name}</option>
                                                ))}
                                            </select>
                                            {errors.type_id && <p className="text-xs text-red-600 mt-1">{errors.type_id}</p>}
                                        </div>
                                    </div>
                                    <div className="mt-3">
                                        <label className="mb-1.5 block text-xs font-medium text-[var(--tng-slate-700)] flex justify-between">
                                            <span>Extracted Text Content</span>
                                            <span className="text-[var(--tng-blue-600)] text-[10px] font-normal bg-white px-2 py-0.5 rounded-full border border-[var(--tng-blue-200)]">{data.ocr_text.length} characters</span>
                                        </label>
                                        <textarea
                                            readOnly
                                            value={data.ocr_text}
                                            rows={2}
                                            className="w-full rounded-md border border-[var(--tng-blue-200)] bg-white/50 p-2 text-[11px] text-[var(--tng-slate-600)] focus:outline-none"
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="mb-1.5 block text-xs font-medium text-[var(--tng-slate-700)]">
                                        Originating Department
                                    </label>
                                    <select 
                                        value={data.department_id}
                                        onChange={e => setData('department_id', e.target.value)}
                                        className="h-9 w-full rounded-md border border-[var(--tng-slate-200)] bg-white px-3 text-sm text-[var(--tng-slate-900)] focus:border-[var(--tng-blue-500)] focus:outline-none focus:ring-1 focus:ring-[var(--tng-blue-500)]"
                                    >
                                        <option value="">Select department...</option>
                                        {departments.map(d => (
                                            <option key={d.department_id} value={d.department_id}>{d.department_name}</option>
                                        ))}
                                    </select>
                                    {errors.department_id && <p className="text-xs text-red-600 mt-1">{errors.department_id}</p>}
                                </div>
                                <div>
                                    <label className="mb-1.5 block text-xs font-medium text-[var(--tng-slate-700)]">
                                        Submitted By
                                    </label>
                                    <input
                                        type="text"
                                        readOnly
                                        value="Current User (Auto-assigned)"
                                        className="h-9 w-full rounded-md border border-[var(--tng-slate-200)] bg-white/50 px-3 text-sm text-[var(--tng-slate-500)] focus:outline-none"
                                    />
                                </div>
                            </div>

                            {/* Urgency */}
                            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                                <label className="flex items-start gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={isUrgent}
                                        onChange={e => {
                                            setIsUrgent(e.target.checked);
                                            setData('classification', e.target.checked ? 'urgent' : 'normal');
                                            if (!e.target.checked) setData('urgency_justification', '');
                                        }}
                                        className="mt-1 h-4 w-4 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                                    />
                                    <div>
                                        <span className="block text-sm font-semibold text-amber-800">
                                            Mark as Urgent / Rush
                                        </span>
                                        <span className="block text-xs text-amber-700/80 mt-0.5">
                                            Halves the ARTA SLA threshold for this document type. Requires justification.
                                        </span>
                                    </div>
                                </label>
                                <div className={`mt-3 transition-all duration-300 ${isUrgent ? 'opacity-100 max-h-20' : 'opacity-0 max-h-0 overflow-hidden'}`}>
                                    <input
                                        type="text"
                                        value={data.urgency_justification}
                                        onChange={e => setData('urgency_justification', e.target.value)}
                                        placeholder="Reason for urgency..."
                                        className="h-9 w-full rounded-md border border-amber-200 bg-white px-3 text-sm text-[var(--tng-slate-900)] placeholder:text-amber-400/70 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                                        required={isUrgent}
                                    />
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Section 2: Routing Slip */}
                    <section>
                        <h3 className="text-sm font-semibold text-[var(--tng-slate-900)] mb-4 flex items-center gap-2">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--tng-slate-100)] text-[10px] text-[var(--tng-slate-600)]">2</span>
                            Initial Routing Slip
                        </h3>
                        <div className="space-y-4 pl-7">
                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-[var(--tng-slate-700)]">
                                    Forward To (Destination)
                                </label>
                                <select 
                                    value={data.forward_to}
                                    onChange={e => setData('forward_to', e.target.value)}
                                    className="h-9 w-full rounded-md border border-[var(--tng-slate-200)] bg-white px-3 text-sm text-[var(--tng-slate-900)] focus:border-[var(--tng-blue-500)] focus:outline-none focus:ring-1 focus:ring-[var(--tng-blue-500)]"
                                >
                                    <option value="">Select Destination Department...</option>
                                    {departments.map(d => (
                                        <option key={d.department_id} value={d.department_id}>{d.department_name}</option>
                                    ))}
                                </select>
                                {errors.forward_to && <p className="text-xs text-red-600 mt-1">{errors.forward_to}</p>}
                            </div>
                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-[var(--tng-slate-700)]">
                                    Instruction / Remarks
                                </label>
                                <textarea
                                    value={data.instruction}
                                    onChange={e => setData('instruction', e.target.value)}
                                    placeholder="Enter instructions for the recipient..."
                                    rows={3}
                                    className="w-full rounded-md border border-[var(--tng-slate-200)] bg-white p-3 text-sm text-[var(--tng-slate-900)] placeholder:text-[var(--tng-slate-400)] focus:border-[var(--tng-blue-500)] focus:outline-none focus:ring-1 focus:ring-[var(--tng-blue-500)]"
                                />
                            </div>
                        </div>
                    </section>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 border-t border-[var(--tng-slate-100)] bg-[var(--tng-slate-50)] px-6 py-4 rounded-b-2xl shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg px-4 py-2 text-sm font-medium text-[var(--tng-slate-600)] transition-colors hover:bg-[var(--tng-slate-200)]"
                    >
                        Cancel
                    </button>
                    <button 
                        type="submit"
                        disabled={processing || !ocrComplete}
                        className="flex items-center gap-2 rounded-lg bg-[var(--tng-blue-600)] px-6 py-2.5 text-sm font-medium text-white shadow-md shadow-blue-600/25 transition-all hover:bg-[var(--tng-blue-700)] hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {processing ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Submitting...
                            </>
                        ) : (
                            'Generate Routing Slip & Submit'
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}

import { FileText } from 'lucide-react';



