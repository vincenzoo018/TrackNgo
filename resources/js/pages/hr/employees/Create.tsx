import { Head, Link, useForm, router } from '@inertiajs/react';
import TrackngoLayout from '@/layouts/trackngo/TrackngoLayout';
import { EmployeeFormFields } from '@/components/EmployeeFormFields';
import { isSignaturePadEmpty, signaturePadDataUrl } from '@/lib/signature-pad';
import { UserPlus, Save, Eraser, ChevronRight, Home, Users } from 'lucide-react';
import { useState, useRef } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { toast } from 'sonner';

type Props = {
    dbDepartments: any[];
    dbRoles: any[];
};

export default function Create({ dbDepartments, dbRoles }: Props) {
    const signatureRef = useRef<any>(null);
    const [signatureError, setSignatureError] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const { data, setData, errors } = useForm({
        first_name: '',
        middle_name: '',
        last_name: '',
        email: '',
        department_id: '',
        role_id: '',
        mobile_number: '',
        password: '',
        signature: '',
    });

    const handleClearSignature = () => {
        signatureRef.current?.clear();
        setSignatureError('');
    };

    const handleSubmit = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        
        try {
            if (isSignaturePadEmpty(signatureRef.current)) {
                setSignatureError('Signature is required for new employees.');
                return;
            }

            const signatureDataUrl = signaturePadDataUrl(signatureRef.current);

            // Use Sonner toast for non-blocking confirmation
            toast('Are you sure you want to save this new employee?', {
                action: {
                    label: 'Yes, Save Employee',
                    onClick: () => {
                        setIsProcessing(true);
                        router.post('/hr/employees', {
                            ...data,
                            signature: signatureDataUrl,
                        }, {
                            onSuccess: () => {
                                setIsProcessing(false);
                                toast.success('Employee successfully created!');
                            },
                            onError: (errs) => {
                                console.error('Validation errors received from backend:', errs);
                                setIsProcessing(false);
                                toast.error('Failed to save. Please fix the errors highlighted below.');
                            },
                            onFinish: () => {
                                setIsProcessing(false);
                            }
                        });
                    }
                },
                cancel: {
                    label: 'Cancel',
                    onClick: () => console.log('Save cancelled')
                },
                duration: 5000,
            });

        } catch (error) {
            console.error('Submission error:', error);
            setIsProcessing(false);
            toast.error('An unexpected error occurred while preparing the form.');
        }
    };

    return (
        <TrackngoLayout>
            <Head title="Add Employee — TrackNGo Mati" />

            {/* Breadcrumbs */}
            <div className="flex items-center gap-2 text-sm text-[var(--tng-slate-500)] mb-6">
                <Link href="/hr" className="hover:text-[var(--tng-blue-600)] transition-colors flex items-center gap-1">
                    <Home className="h-4 w-4" /> Home
                </Link>
                <ChevronRight className="h-4 w-4" />
                <Link href="/hr/employees" className="hover:text-[var(--tng-blue-600)] transition-colors">
                    Employee Records
                </Link>
                <ChevronRight className="h-4 w-4" />
                <span className="text-[var(--tng-slate-800)] font-medium">Add Employee</span>
            </div>

            <div className="mb-6">
                <h1 className="text-3xl font-bold text-[var(--tng-slate-900)] flex items-center gap-3">
                    Add New Employee
                </h1>
                <p className="mt-2 text-[var(--tng-slate-500)]">
                    Create a new employee account and capture their digital signature.
                </p>
            </div>

            <div className="bg-white rounded-2xl border border-[var(--tng-slate-200)] shadow-sm overflow-hidden">
                <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6">
                    <EmployeeFormFields
                        data={data}
                        setData={setData}
                        errors={errors}
                        departments={dbDepartments}
                        roles={dbRoles}
                        passwordPlaceholder="Set login password"
                    />

                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-medium text-[var(--tng-slate-700)]">Digital Signature</label>
                            <button
                                type="button"
                                onClick={handleClearSignature}
                                className="text-xs text-[var(--tng-blue-600)] hover:text-[var(--tng-blue-800)] flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                            >
                                <Eraser className="h-4 w-4" /> Clear Signature
                            </button>
                        </div>
                        <div className={`border-2 border-dashed rounded-xl bg-[var(--tng-slate-50)] overflow-hidden transition-colors ${signatureError || errors.signature ? 'border-red-400 bg-red-50/30' : 'border-[var(--tng-slate-300)] hover:border-[var(--tng-slate-400)]'}`}>
                            <SignatureCanvas
                                ref={signatureRef}
                                canvasProps={{
                                    className: 'w-full h-48 cursor-crosshair'
                                }}
                                backgroundColor="transparent"
                                penColor="#0f172a"
                            />
                        </div>
                        {(signatureError || errors.signature) && <p className="text-xs text-red-500 mt-1">{signatureError || errors.signature}</p>}
                        <p className="text-xs text-[var(--tng-slate-400)] italic mt-2">
                            * This signature will be converted to an image and permanently bound to the user's account for document signing.
                        </p>
                    </div>

                    <div className="pt-6 border-t border-[var(--tng-slate-100)] flex items-center justify-end gap-3">
                        <Link
                            href="/hr/employees"
                            className="px-5 py-2.5 text-sm font-medium text-[var(--tng-slate-600)] hover:bg-[var(--tng-slate-100)] rounded-xl transition-colors"
                        >
                            Cancel
                        </Link>
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={isProcessing}
                            className="flex items-center gap-2 px-6 py-2.5 bg-[var(--tng-blue-600)] text-white text-sm font-medium rounded-xl shadow-md shadow-blue-600/20 hover:bg-[var(--tng-blue-700)] transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            <Save className="h-4 w-4" />
                            {isProcessing ? 'Saving...' : 'Save Employee'}
                        </button>
                    </div>
                </form>
            </div>
        </TrackngoLayout>
    );
}
