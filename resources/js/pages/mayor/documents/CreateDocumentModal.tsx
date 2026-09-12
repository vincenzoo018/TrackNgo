import React, { useState, useRef, useEffect } from 'react';
import { useForm, usePage } from '@inertiajs/react';
import { Plus, ScanLine, X, Loader2, FileText, CheckCircle2, QrCode } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import { BaseModal } from '@/components/trackngo/BaseModal';

// Set up the PDF.js worker safely
if (typeof window !== 'undefined' && pdfjsLib?.GlobalWorkerOptions) {
    try {
        pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
    } catch (e) {
        console.warn('Could not set pdf workerSrc', e);
    }
}

interface CreateDocumentModalProps {
    isOpen: boolean;
    onClose: () => void;
    departments?: any[];
    documentTypes?: any[];
    users?: any[];
}

export default function CreateDocumentModal({ isOpen, onClose, departments = [], documentTypes = [], users = [] }: CreateDocumentModalProps) {
    const { props } = usePage();
    const authUser = (props.auth as any)?.user;

    const { data, setData, post, processing, errors, reset } = useForm({
        title: '',
        type_id: '',
        department_id: authUser?.department_id || '',
        file: null as File | null,
        classification: 'normal',
        is_internal: false,
        forward_to: '',
        forward_to_user: '',
        instruction: '',
        ocr_text: '',
    });

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isScanning, setIsScanning] = useState(false);
    const [ocrComplete, setOcrComplete] = useState(false);
    const [isConfidential, setIsConfidential] = useState(false);
    const [step, setStep] = useState<'form' | 'success'>('form');
    const [trackingNumber, setTrackingNumber] = useState('');

    useEffect(() => {
        if (isOpen) {
            setStep('form');
            setOcrComplete(false);
            setIsConfidential(false);
            reset();
            setData('department_id', authUser?.department_id || '');
        }
    }, [isOpen, authUser]);

    // Dependent dropdown for Forward To Users
    const availableUsers = data.forward_to 
        ? (users || []).filter(u => String(u.department_id) === String(data.forward_to))
        : [];

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
        if (!ocrComplete || processing) return;
        
        post('/mayor/documents', {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: (page: any) => {
                const flashMessage = page.props?.flash?.success || '';
                const match = flashMessage.match(/RS-\d{4}-\d{4}/);
                if (match) {
                    setTrackingNumber(match[0]);
                } else {
                    setTrackingNumber('RS-' + new Date().getFullYear() + '-XXXX');
                }
                setStep('success');
            },
        });
    };

    
    if (!isOpen) return null;

    return (
        <BaseModal
            isOpen={isOpen}
            onClose={onClose}
            title={step === 'form' ? "Submit New Document" : "Document Registered"}
            identifier={step === 'success' ? trackingNumber : undefined}
            description={step === 'form' ? "Upload document and generate routing slip" : "Official routing slip and tracking QR generated successfully."}
            icon={step === 'form' ? <Plus className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5 text-emerald-600" />}
            maxWidth="max-w-3xl"
            childrenContainerClassName={step === 'form' ? "p-0" : ""}
            formProps={step === 'form' ? { onSubmit: handleSubmit } : undefined}
            footer={step === 'form' ? (
                <>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-full sm:w-auto rounded-lg px-4 py-2 text-sm font-medium text-[var(--tng-slate-600)] transition-colors hover:bg-[var(--tng-slate-200)] text-center"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={processing || !ocrComplete}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-lg bg-[var(--tng-blue-600)] px-5 py-2 text-sm font-medium text-white shadow-md shadow-blue-600/25 transition-all hover:bg-[var(--tng-blue-700)] hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {processing ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Submitting...
                            </>
                        ) : (
                            'Generate & Submit'
                        )}
                    </button>
                </>
            ) : undefined}
        >
            {step === 'form' ? (
                <div className="flex flex-col h-full flex-1 overflow-y-auto">
                        <div className="p-4 sm:p-6 space-y-8">
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
                                                <p className="text-xs text-[var(--tng-slate-500)] mt-1">PDF, PNG, JPG (max. 10MB)</p>
                                            </div>
                                            {errors.file && <p className="text-xs text-red-600 mt-2">{errors.file}</p>}
                                        </div>
                                    )}

                                    {isScanning && (
                                        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-[var(--tng-blue-300)] bg-[var(--tng-blue-50)] py-8">
                                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm">
                                                <Loader2 className="h-5 w-5 animate-spin text-[var(--tng-blue-600)]" />
                                            </div>
                                            <div className="text-center">
                                                <p className="text-sm font-medium text-[var(--tng-blue-700)]">Extracting text in real-time...</p>
                                                <p className="text-xs text-[var(--tng-blue-500)] mt-1">Reading contents</p>
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
                                                    <p className="text-[11px] text-emerald-700 mt-0.5">Scanned successfully • {(data.file.size / (1024 * 1024)).toFixed(2)} MB</p>
                                                </div>
                                            </div>
                                            <button 
                                                type="button"
                                                onClick={() => {
                                                    setOcrComplete(false);
                                                    setData('file', null);
                                                    if (fileInputRef.current) fileInputRef.current.value = '';
                                                }}
                                                className="text-[13px] font-medium text-emerald-700 hover:text-emerald-800"
                                            >
                                                Replace
                                            </button>
                                        </div>
                                    )}
                                    
                                    {ocrComplete && (
                                        <div className="rounded-xl border border-[var(--tng-blue-100)] bg-[var(--tng-blue-50)] p-4 tng-stagger">
                                            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--tng-blue-600)] flex items-center gap-1.5">
                                                ✨ Auto-filled by OCR
                                            </p>
                                            <div className="grid grid-cols-2 gap-4 mb-4">
                                                <div>
                                                    <label className="mb-1.5 block text-xs font-medium text-[var(--tng-slate-700)]">
                                                        Title <span className="text-red-500 font-semibold">*</span>
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={data.title}
                                                        onChange={e => setData('title', e.target.value)}
                                                        className="h-9 w-full rounded-lg border border-[var(--tng-blue-200)] bg-white px-3 text-sm text-[var(--tng-slate-900)] focus:border-[var(--tng-blue-500)] focus:outline-none focus:ring-2 focus:ring-[var(--tng-blue-500)]/20"
                                                    />
                                                    {errors.title && <p className="text-[11px] text-red-600 mt-1 font-medium">{errors.title}</p>}
                                                </div>
                                                <div>
                                                    <label className="mb-1.5 block text-xs font-medium text-[var(--tng-slate-700)]">
                                                        Document Category <span className="text-red-500 font-semibold">*</span>
                                                    </label>
                                                    <select 
                                                        value={data.type_id}
                                                        onChange={e => setData('type_id', e.target.value)}
                                                        className="h-9 w-full rounded-lg border border-[var(--tng-blue-200)] bg-white px-3 text-sm text-[var(--tng-slate-900)] focus:border-[var(--tng-blue-500)] focus:outline-none focus:ring-2 focus:ring-[var(--tng-blue-500)]/20"
                                                    >
                                                        <option value="">Select Category...</option>
                                                        {documentTypes.map(type => (
                                                            <option key={type.type_id} value={type.type_id}>{type.type_name}</option>
                                                        ))}
                                                    </select>
                                                    {errors.type_id && <p className="text-[11px] text-red-600 mt-1 font-medium">{errors.type_id}</p>}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Originating Department & Sender */}
                                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                        <div>
                                            <label className="mb-1.5 block text-xs font-medium text-[var(--tng-slate-700)]">
                                                Originating Department
                                            </label>
                                            <div className="h-9 w-full rounded-lg border border-[var(--tng-slate-200)] bg-[var(--tng-slate-50)] px-3 py-2 text-sm text-[var(--tng-slate-500)] cursor-not-allowed">
                                                {authUser?.department_name || 'Mayor\'s Office'}
                                            </div>
                                            <input type="hidden" value={data.department_id} />
                                        </div>
                                        <div>
                                            <label className="mb-1.5 block text-xs font-medium text-[var(--tng-slate-700)]">
                                                Sender
                                            </label>
                                            <div className="h-9 w-full rounded-lg border border-[var(--tng-slate-200)] bg-[var(--tng-slate-50)] px-3 py-2 text-sm text-[var(--tng-slate-500)] cursor-not-allowed flex items-center">
                                                {authUser?.name} {authUser?.role ? `(${authUser?.role?.toUpperCase().replace('_', ' ')})` : ''}
                                            </div>
                                        </div>
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
                                                    Internal Document
                                                </span>
                                                <span className="block text-xs text-[var(--tng-slate-500)] mt-0.5">
                                                    Requires Receiving Clerk registration before proceeding.
                                                </span>
                                            </div>
                                        </label>
                                    </div>
                                </div>
                            </section>

                            {/* Section 2: Routing Slip */}
                            <section>
                                <h3 className="text-sm font-semibold text-[var(--tng-slate-900)] mb-4 flex items-center gap-2">
                                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--tng-slate-100)] text-[10px] text-[var(--tng-slate-600)]">2</span>
                                    Initial Routing Slip
                                </h3>
                                <div className="space-y-4 pl-0 sm:pl-7">
                                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                        <div>
                                            <label className="mb-1.5 block text-xs font-medium text-[var(--tng-slate-700)]">
                                                Forward To (Department) <span className="text-red-500 font-semibold">*</span>
                                            </label>
                                            <select 
                                                value={data.forward_to}
                                                onChange={e => setData(d => ({ ...d, forward_to: e.target.value, forward_to_user: '' }))}
                                                className="h-9 w-full rounded-lg border border-[var(--tng-slate-200)] bg-white px-3 text-sm text-[var(--tng-slate-900)] focus:border-[var(--tng-blue-500)] focus:outline-none focus:ring-2 focus:ring-[var(--tng-blue-500)]/20"
                                            >
                                                <option value="">Select Destination Department...</option>
                                                {departments.map(dept => (
                                                    <option key={dept.department_id} value={dept.department_id}>{dept.department_name}</option>
                                                ))}
                                            </select>
                                            {errors.forward_to && <p className="text-[11px] text-red-600 mt-1 font-medium">{errors.forward_to}</p>}
                                        </div>

                                        <div>
                                            <label className="mb-1.5 block text-xs font-medium text-[var(--tng-slate-700)]">
                                                Specific Person (Optional)
                                            </label>
                                            <select 
                                                value={data.forward_to_user}
                                                onChange={e => setData('forward_to_user', e.target.value)}
                                                disabled={!data.forward_to}
                                                className="h-9 w-full rounded-lg border border-[var(--tng-slate-200)] bg-white px-3 text-sm text-[var(--tng-slate-900)] focus:border-[var(--tng-blue-500)] focus:outline-none focus:ring-2 focus:ring-[var(--tng-blue-500)]/20 disabled:bg-[var(--tng-slate-50)] disabled:text-[var(--tng-slate-400)]"
                                            >
                                                <option value="">Anyone in department...</option>
                                                {availableUsers.map(user => (
                                                    <option key={user.id} value={user.id}>
                                                        {user.first_name} {user.last_name} {user.role_name ? `(${user.role_name})` : ''}
                                                    </option>
                                                ))}
                                            </select>
                                            {errors.forward_to_user && <p className="text-[11px] text-red-600 mt-1">{errors.forward_to_user}</p>}
                                        </div>
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
                                            className="w-full rounded-lg border border-[var(--tng-slate-200)] bg-white p-3 text-sm text-[var(--tng-slate-900)] placeholder:text-[var(--tng-slate-400)] focus:border-[var(--tng-blue-500)] focus:outline-none focus:ring-2 focus:ring-[var(--tng-blue-500)]/20"
                                        />
                                    </div>
                                </div>
                            </section>
                        </div>


                    </div>
                ) : (
                    <div className="p-10 text-center">
                        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                        </div>
                        <h2 className="mb-2 text-xl font-bold text-[var(--tng-slate-900)]">
                            Document Submitted
                        </h2>
                        <p className="mb-6 text-sm text-[var(--tng-slate-500)]">
                            The document has been recorded and an initial routing slip has been generated.
                        </p>

                        <div className="mx-auto mb-8 max-w-[280px] overflow-hidden rounded-xl border border-[var(--tng-slate-200)] bg-[var(--tng-slate-50)]">
                            <div className="border-b border-[var(--tng-slate-200)] bg-white p-3">
                                <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--tng-slate-500)]">Tracking Number</p>
                                <p className="mt-1 text-lg font-bold text-[var(--tng-blue-600)]">{trackingNumber}</p>
                            </div>
                            <div className="flex flex-col items-center p-5">
                                <div className="mb-3 rounded-lg bg-white p-2 shadow-sm border border-[var(--tng-slate-200)]">
                                    <QrCode className="h-24 w-24 text-[var(--tng-slate-800)]" strokeWidth={1} />
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row justify-center gap-3">
                            <button
                                onClick={() => {
                                    onClose();
                                    window.location.reload();
                                }}
                                className="w-full sm:w-auto rounded-lg border border-[var(--tng-slate-200)] bg-white px-5 py-2 text-sm font-medium text-[var(--tng-slate-600)] transition-colors hover:bg-[var(--tng-slate-50)]"
                            >
                                Close & Refresh
                            </button>
                            <button
                                onClick={() => {
                                    setStep('form');
                                    setOcrComplete(false);
                                    reset();
                                    if (fileInputRef.current) fileInputRef.current.value = '';
                                }}
                                className="w-full sm:w-auto rounded-lg bg-[var(--tng-blue-600)] px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--tng-blue-700)] shadow-md shadow-blue-600/25"
                            >
                                Submit Another
                            </button>
                        </div>
                    </div>
                )}
            </BaseModal>
    );
}
