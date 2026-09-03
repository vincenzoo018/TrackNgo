import React, { useState, useRef, useEffect } from 'react';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { Plus, ScanLine, ArrowLeft, Loader2, CheckCircle2, QrCode, FileText } from 'lucide-react';
import TrackngoLayout from '@/layouts/trackngo/TrackngoLayout';
import { ConfirmActionModal } from '@/components/trackngo/ConfirmActionModal';
import { SuccessModal } from '@/components/trackngo/SuccessModal';
import * as pdfjsLib from 'pdfjs-dist';

// Set up the PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

export default function CreateDocument() {
    const { props } = usePage();
    const departments = (props.departments || []) as any[];
    const documentTypes = (props.document_types || []) as any[];
    
    // Default receiving department if it exists
    const receivingDept = departments.find(d => d.code === 'REC' || d.department_name.toLowerCase().includes('receiving'));

    const { data, setData, post, processing, errors, reset } = useForm({
        title: '',
        type_id: '',
        department_id: '',
        file: null as File | null,
        classification: 'normal',
        is_internal: false,
        forward_to: '',
        instruction: '',
        ocr_text: '',
    });

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isScanning, setIsScanning] = useState(false);
    const [ocrComplete, setOcrComplete] = useState(false);
    const [submitSuccess, setSubmitSuccess] = useState(false);
    const [trackingNumber, setTrackingNumber] = useState('');
    const [isConfidential, setIsConfidential] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [successOpen, setSuccessOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleFileUploadClick = () => {
        if (ocrComplete || isScanning) return;
        fileInputRef.current?.click();
    };

    const extractTextFromPDF = async (file: File) => {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            let fullText = '';
            
            // Extract text from all pages
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
            // Mock OCR for images
            await new Promise(resolve => setTimeout(resolve, 2000));
            extractedText = `Mock extracted text from image: ${file.name}`;
        }
        
        const generatedTitle = formatFileNameToTitle(file.name);
        
        // Auto-select document type based on title keywords
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

    const handleSubmit = () => {
        if (!ocrComplete || processing) return;
        setConfirmOpen(true);
    };

    const handleConfirmSubmit = () => {
        setIsSubmitting(true);
        post('/department-head/documents', {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: (page: any) => {
                setConfirmOpen(false);
                setIsSubmitting(false);
                const flashMessage = page.props?.flash?.success || '';
                const match = flashMessage.match(/RS-\d{4}-\d{4}/);
                if (match) {
                    setTrackingNumber(match[0]);
                } else {
                    setTrackingNumber('RS-' + new Date().getFullYear() + '-XXXX');
                }
                setSuccessOpen(true);
            },
            onError: (errs: any) => {
                setConfirmOpen(false);
                setIsSubmitting(false);
                console.error('Submission errors:', errs);
            }
        });
    };

    const handleSuccessClose = () => {
        setSuccessOpen(false);
        setSubmitSuccess(true);
    };

    if (submitSuccess) {
        return (
            <TrackngoLayout
                role="department-head"
                breadcrumbs={[
                    { title: 'Home', href: '/department-head' },
                    { title: 'Endorsements', href: '/department-head/documents' },
                    { title: 'Create Document', href: '#' },
                ]}
            >
                <Head title="Document Submitted — TrackNGo Mati" />

                <div className="mx-auto max-w-3xl mt-8">
                    <div className="rounded-2xl border border-[var(--tng-slate-200)] bg-white p-10 text-center shadow-sm">
                        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
                            <CheckCircle2 className="h-10 w-10 text-emerald-600" />
                        </div>
                        <h2 className="mb-2 text-2xl font-bold text-[var(--tng-slate-900)]">
                            Document Successfully Submitted
                        </h2>
                        <p className="mb-8 text-[var(--tng-slate-500)]">
                            The document has been recorded and an initial routing slip has been generated.
                        </p>

                        <div className="mx-auto mb-8 max-w-sm overflow-hidden rounded-xl border border-[var(--tng-slate-200)] bg-[var(--tng-slate-50)]">
                            <div className="border-b border-[var(--tng-slate-200)] bg-white p-4">
                                <p className="text-sm font-semibold uppercase tracking-wider text-[var(--tng-slate-500)]">Routing Slip & Tracking</p>
                                <p className="mt-1 text-xl font-bold text-[var(--tng-blue-600)]">{trackingNumber}</p>
                            </div>
                            <div className="flex flex-col items-center p-6">
                                <div className="mb-4 rounded-lg bg-white p-3 shadow-sm border border-[var(--tng-slate-200)]">
                                    <QrCode className="h-32 w-32 text-[var(--tng-slate-800)]" strokeWidth={1} />
                                </div>
                                <p className="text-sm text-[var(--tng-slate-600)]">Scan QR code to track document status</p>
                            </div>
                        </div>

                        <div className="flex justify-center gap-4">
                            <Link
                                href="/department-head/documents"
                                className="rounded-lg border border-[var(--tng-slate-200)] bg-white px-6 py-2.5 text-sm font-medium text-[var(--tng-slate-600)] transition-colors hover:bg-[var(--tng-slate-50)]"
                            >
                                Back to Documents
                            </Link>
                            <button
                                onClick={() => {
                                    setSubmitSuccess(false);
                                    setOcrComplete(false);
                                    reset();
                                    if (fileInputRef.current) fileInputRef.current.value = '';
                                }}
                                className="rounded-lg bg-[var(--tng-blue-600)] px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--tng-blue-700)] shadow-md shadow-blue-600/25"
                            >
                                Submit Another
                            </button>
                        </div>
                    </div>
                </div>
            </TrackngoLayout>
        );
    }

    return (
        <TrackngoLayout
            role="department-head"
            breadcrumbs={[
                { title: 'Home', href: '/department-head' },
                { title: 'Endorsements', href: '/department-head/documents' },
                { title: 'Create Document', href: '#' },
            ]}
        >
            <Head title="Submit New Document — TrackNGo Mati" />

            <form onSubmit={handleSubmit} className="mx-auto max-w-4xl space-y-6">
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
                        href="/department-head/documents"
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
                                <input 
                                    type="file" 
                                    ref={fileInputRef} 
                                    className="hidden" 
                                    accept=".pdf,.png,.jpg,.jpeg" 
                                    onChange={handleFileChange} 
                                />
                                
                                {!ocrComplete && !isScanning && (
                                    <div 
                                        onClick={handleFileUploadClick}
                                        className={`group relative flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed ${errors.file ? 'border-red-400 bg-red-50' : 'border-[var(--tng-slate-200)] bg-[var(--tng-slate-50)] hover:border-[var(--tng-blue-400)] hover:bg-[var(--tng-blue-50)]'} py-10 transition-colors`}
                                    >
                                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-sm group-hover:bg-[var(--tng-blue-100)] group-hover:text-[var(--tng-blue-600)] transition-colors">
                                            <ScanLine className="h-6 w-6 text-[var(--tng-slate-400)] group-hover:text-[var(--tng-blue-600)]" />
                                        </div>
                                        <div className="text-center">
                                            <p className="text-sm font-medium text-[var(--tng-slate-700)]">Click to upload or drag and drop</p>
                                            <p className="text-xs text-[var(--tng-slate-500)] mt-1">PDF, PNG, JPG (max. 10MB)</p>
                                        </div>
                                        {errors.file && <p className="text-sm text-red-600 mt-2">{errors.file}</p>}
                                    </div>
                                )}

                                {isScanning && (
                                    <div className="flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed border-[var(--tng-blue-300)] bg-[var(--tng-blue-50)] py-10">
                                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-sm">
                                            <Loader2 className="h-6 w-6 animate-spin text-[var(--tng-blue-600)]" />
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
                                
                                {ocrComplete && (
                                    <div className="rounded-xl border border-[var(--tng-blue-100)] bg-[var(--tng-blue-50)] p-5 tng-stagger">
                                        <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-[var(--tng-blue-600)] flex items-center gap-1.5">
                                            ✨ Auto-filled by OCR
                                        </p>
                                        <div className="grid grid-cols-2 gap-5 mb-4">
                                            <div>
                                                <label className="mb-1.5 block text-sm font-medium text-[var(--tng-slate-700)]">
                                                    Title
                                                </label>
                                                <input
                                                    type="text"
                                                    value={data.title}
                                                    onChange={e => setData('title', e.target.value)}
                                                    className="h-10 w-full rounded-lg border border-[var(--tng-blue-200)] bg-white px-3 text-sm text-[var(--tng-slate-900)] focus:border-[var(--tng-blue-500)] focus:outline-none focus:ring-2 focus:ring-[var(--tng-blue-500)]/20"
                                                />
                                                {errors.title && <p className="text-sm text-red-600 mt-1">{errors.title}</p>}
                                            </div>
                                            <div>
                                                <label className="mb-1.5 block text-sm font-medium text-[var(--tng-slate-700)]">
                                                    Document Category
                                                </label>
                                                <select 
                                                    value={data.type_id}
                                                    onChange={e => setData('type_id', e.target.value)}
                                                    className="h-10 w-full rounded-lg border border-[var(--tng-blue-200)] bg-white px-3 text-sm text-[var(--tng-slate-900)] focus:border-[var(--tng-blue-500)] focus:outline-none focus:ring-2 focus:ring-[var(--tng-blue-500)]/20"
                                                >
                                                    <option value="">Select Document Category...</option>
                                                    {documentTypes.map(type => (
                                                        <option key={type.type_id} value={type.type_id}>{type.type_name}</option>
                                                    ))}
                                                </select>
                                                {errors.type_id && <p className="text-sm text-red-600 mt-1">{errors.type_id}</p>}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="mb-1.5 block text-sm font-medium text-[var(--tng-slate-700)] flex justify-between">
                                                <span>Extracted Text Content</span>
                                                <span className="text-[var(--tng-blue-600)] text-xs font-normal bg-white px-2 py-0.5 rounded-full border border-[var(--tng-blue-200)]">{data.ocr_text.length} characters found</span>
                                            </label>
                                            <textarea
                                                readOnly
                                                value={data.ocr_text}
                                                rows={3}
                                                className="w-full rounded-lg border border-[var(--tng-blue-200)] bg-white/50 p-3 text-xs text-[var(--tng-slate-600)] focus:outline-none"
                                            />
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <label className="mb-1.5 block text-sm font-medium text-[var(--tng-slate-700)]">
                                        Originating Department
                                    </label>
                                    <select 
                                        value={data.department_id}
                                        onChange={e => setData('department_id', e.target.value)}
                                        className="h-10 w-full md:w-1/2 rounded-lg border border-[var(--tng-slate-200)] bg-white px-3 text-sm text-[var(--tng-slate-900)] focus:border-[var(--tng-blue-500)] focus:outline-none focus:ring-2 focus:ring-[var(--tng-blue-500)]/20"
                                    >
                                        <option value="">Select department...</option>
                                        {departments.map(dept => (
                                            <option key={dept.department_id} value={dept.department_id}>{dept.department_name}</option>
                                        ))}
                                    </select>
                                    {errors.department_id && <p className="text-sm text-red-600 mt-1">{errors.department_id}</p>}
                                </div>

                                {/* Confidential & Internal */}
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 mt-6">
                                    <label className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 cursor-pointer transition-colors hover:border-red-300">
                                        <input
                                            type="checkbox"
                                            checked={isConfidential}
                                            onChange={(e) => {
                                                setIsConfidential(e.target.checked);
                                                setData('classification', e.target.checked ? 'Confidential' : 'normal');
                                            }}
                                            className="mt-1 h-4 w-4 rounded border-red-300 text-red-600 focus:ring-red-500"
                                        />
                                        <div>
                                            <span className="block text-sm font-semibold text-red-700">
                                                Mark as Confidential
                                            </span>
                                            <span className="block text-xs text-red-600/80 mt-0.5">
                                                Receiving Clerk will only see metadata, not contents.
                                            </span>
                                        </div>
                                    </label>
                                    
                                    <label className="flex items-start gap-3 rounded-xl border border-[var(--tng-slate-200)] bg-white p-4 cursor-pointer transition-colors hover:border-[var(--tng-blue-300)] hover:bg-[var(--tng-blue-50)] shadow-sm">
                                        <input
                                            type="checkbox"
                                            checked={data.is_internal}
                                            onChange={e => setData('is_internal', e.target.checked)}
                                            className="mt-1 h-4 w-4 rounded border-[var(--tng-slate-300)] text-[var(--tng-blue-600)] focus:ring-[var(--tng-blue-500)]"
                                        />
                                        <div>
                                            <span className="block text-sm font-semibold text-[var(--tng-slate-800)]">
                                                Internal Document (Requires Registration)
                                            </span>
                                            <span className="block text-xs text-[var(--tng-slate-500)] mt-0.5">
                                                This document will be sent to the Receiving Clerk for registration and tracking number assignment before reaching its destination.
                                            </span>
                                        </div>
                                    </label>
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
                                    <select 
                                        value={data.forward_to}
                                        onChange={e => setData('forward_to', e.target.value)}
                                        className="h-10 w-full rounded-lg border border-[var(--tng-slate-200)] bg-white px-3 text-sm text-[var(--tng-slate-900)] focus:border-[var(--tng-blue-500)] focus:outline-none focus:ring-2 focus:ring-[var(--tng-blue-500)]/20"
                                    >
                                        <option value="">Select Destination Department...</option>
                                        {departments.map(dept => (
                                            <option key={dept.department_id} value={dept.department_id}>{dept.department_name}</option>
                                        ))}
                                    </select>
                                    {errors.forward_to && <p className="text-sm text-red-600 mt-1">{errors.forward_to}</p>}
                                </div>
                                <div>
                                    <label className="mb-1.5 block text-sm font-medium text-[var(--tng-slate-700)]">
                                        Instruction / Remarks
                                    </label>
                                    <textarea
                                        value={data.instruction}
                                        onChange={e => setData('instruction', e.target.value)}
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
                            href="/department-head/documents"
                            className="rounded-lg px-4 py-2.5 text-sm font-medium text-[var(--tng-slate-600)] transition-colors hover:bg-[var(--tng-slate-200)]"
                        >
                            Cancel
                        </Link>
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={processing || !ocrComplete}
                            className="flex items-center gap-2 rounded-lg bg-[var(--tng-blue-600)] px-6 py-2.5 text-sm font-medium text-white shadow-md shadow-blue-600/25 transition-all hover:bg-[var(--tng-blue-700)] hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {processing ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Generating...
                                </>
                            ) : (
                                'Generate Routing Slip & Submit'
                            )}
                        </button>
                    </div>
                </div>
            </form>

            {/* Confirmation Modal */}
            <ConfirmActionModal
                isOpen={confirmOpen}
                onClose={() => setConfirmOpen(false)}
                onConfirm={handleConfirmSubmit}
                title="Generate Routing Slip & Submit"
                message={`Are you sure you want to submit this document${data.is_internal ? ' as an internal document for registration' : ''}? A routing slip will be generated and the document will be forwarded to the destination department.`}
                confirmText="Submit"
                cancelText="Cancel"
                isLoading={isSubmitting}
            />

            {/* Success Modal */}
            <SuccessModal
                isOpen={successOpen}
                onClose={handleSuccessClose}
                title="Successfully"
                message={`Document submitted successfully.${trackingNumber ? ' Tracking: ' + trackingNumber : ' A tracking number will be assigned upon registration.'}`}
                buttonText="Continue"
            />
        </TrackngoLayout>
    );
}
