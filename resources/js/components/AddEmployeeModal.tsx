import React, { useState, useRef, useEffect } from 'react';
import { useForm } from '@inertiajs/react';
import {
    BaseModal,
    ModalSection,
    ModalField,
    ModalPrimaryButton,
    ModalSecondaryButton,
} from '@/components/trackngo/BaseModal';
import {
    UserPlus,
    User,
    Mail,
    Building2,
    Shield,
    Lock,
    Eye,
    EyeOff,
    PenTool,
    Eraser,
    Phone,
} from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type Props = {
    isOpen: boolean;
    onClose: () => void;
    departments: Array<{ department_id: number; department_name: string; code?: string }>;
    roles: Array<{ role_id: number; role_name: string }>;
};

export default function AddEmployeeModal({ isOpen, onClose, departments = [], roles = [] }: Props) {
    const signatureRef = useRef<any>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [signatureError, setSignatureError] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const { data, setData, post, processing, errors, reset, clearErrors, transform } = useForm({
        first_name: '',
        middle_name: '',
        last_name: '',
        email: '',
        password: '',
        department_id: '',
        role_id: '',
        mobile_number: '',
        signature: '',
    });

    const handleClose = () => {
        reset();
        clearErrors();
        setSignatureError('');
        setShowPassword(false);
        if (signatureRef.current) {
            signatureRef.current.clear();
        }
        onClose();
    };

    // Auto-size signature canvas when modal opens
    useEffect(() => {
        if (!isOpen) return;

        const timer = setTimeout(() => {
            if (signatureRef.current && containerRef.current) {
                const canvas = signatureRef.current.getCanvas();
                if (canvas) {
                    const rect = containerRef.current.getBoundingClientRect();
                    if (rect.width > 0 && Math.abs(canvas.width - rect.width) > 10) {
                        canvas.width = rect.width;
                        canvas.height = 160;
                        signatureRef.current.clear();
                    }
                }
            }
        }, 150);

        return () => clearTimeout(timer);
    }, [isOpen]);

    const handleClearSignature = () => {
        signatureRef.current?.clear();
        setSignatureError('');
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Validate signature
        let isSignatureEmpty = true;
        if (signatureRef.current) {
            if (typeof signatureRef.current.isEmpty === 'function') {
                isSignatureEmpty = signatureRef.current.isEmpty();
            } else {
                isSignatureEmpty = false;
            }
        }

        if (isSignatureEmpty) {
            setSignatureError('Digital signature is required for official employee records.');
            return;
        }

        let signatureDataUrl = '';
        try {
            let canvas = null;
            if (signatureRef.current) {
                if (typeof signatureRef.current.getTrimmedCanvas === 'function') {
                    try {
                        canvas = signatureRef.current.getTrimmedCanvas();
                    } catch {
                        if (typeof signatureRef.current.getCanvas === 'function') {
                            canvas = signatureRef.current.getCanvas();
                        }
                    }
                } else if (typeof signatureRef.current.getCanvas === 'function') {
                    canvas = signatureRef.current.getCanvas();
                } else if (signatureRef.current instanceof HTMLCanvasElement) {
                    canvas = signatureRef.current;
                }
            }
            signatureDataUrl = canvas ? canvas.toDataURL('image/png') : '';
        } catch (err) {
            console.error('Error getting canvas signature:', err);
            signatureDataUrl = '';
        }

        if (!signatureDataUrl) {
            setSignatureError('Failed to capture signature pad. Please sign again.');
            return;
        }

        setSignatureError('');

        transform((currentData) => ({
            ...currentData,
            signature: signatureDataUrl,
        }));

        post('/hr/employees', {
            onSuccess: () => {
                toast.success('Employee successfully added!');
                handleClose();
            },
            onError: () => {
                toast.error('Failed to save employee. Please check the highlighted fields.');
            },
        });
    };

    return (
        <BaseModal
            isOpen={isOpen}
            onClose={handleClose}
            title="Add New Employee"
            description="Register a new municipal employee account, assign organizational role, and capture digital signature."
            icon={<UserPlus className="h-5 w-5" />}
            maxWidth="max-w-2xl"
            formProps={{ onSubmit: handleSubmit }}
            footer={
                <>
                    <ModalSecondaryButton onClick={handleClose} disabled={processing}>
                        Cancel
                    </ModalSecondaryButton>
                    <ModalPrimaryButton isLoading={processing} loadingText="Saving Employee...">
                        <UserPlus className="h-4 w-4" />
                        Save Employee
                    </ModalPrimaryButton>
                </>
            }
        >
            <div className="space-y-6">
                {/* ── Section 1: Personal Information ───────────────────────── */}
                <ModalSection
                    title="Employee Information"
                    description="Official legal name for personnel records and audit verification."
                    icon={<User className="h-4 w-4" />}
                >
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <ModalField label="First Name" required error={errors.first_name}>
                            <input
                                type="text"
                                required
                                maxLength={60}
                                value={data.first_name}
                                onChange={(e) => setData('first_name', e.target.value)}
                                placeholder="e.g. Juan"
                                className={cn(
                                    "w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm outline-none transition-all placeholder:text-slate-400 focus:ring-2",
                                    errors.first_name
                                        ? "border-red-400 focus:border-red-500 focus:ring-red-500/15"
                                        : "border-slate-200 focus:border-blue-500 focus:ring-blue-500/15"
                                )}
                            />
                        </ModalField>

                        <ModalField label="Middle Name" error={errors.middle_name}>
                            <input
                                type="text"
                                maxLength={60}
                                value={data.middle_name}
                                onChange={(e) => setData('middle_name', e.target.value)}
                                placeholder="e.g. Santos (Optional)"
                                className={cn(
                                    "w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm outline-none transition-all placeholder:text-slate-400 focus:ring-2",
                                    errors.middle_name
                                        ? "border-red-400 focus:border-red-500 focus:ring-red-500/15"
                                        : "border-slate-200 focus:border-blue-500 focus:ring-blue-500/15"
                                )}
                            />
                        </ModalField>

                        <ModalField label="Last Name" required error={errors.last_name}>
                            <input
                                type="text"
                                required
                                maxLength={60}
                                value={data.last_name}
                                onChange={(e) => setData('last_name', e.target.value)}
                                placeholder="e.g. Dela Cruz"
                                className={cn(
                                    "w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm outline-none transition-all placeholder:text-slate-400 focus:ring-2",
                                    errors.last_name
                                        ? "border-red-400 focus:border-red-500 focus:ring-red-500/15"
                                        : "border-slate-200 focus:border-blue-500 focus:ring-blue-500/15"
                                )}
                            />
                        </ModalField>
                    </div>
                </ModalSection>

                {/* ── Section 2: Contact & Authentication ────────────────────── */}
                <ModalSection
                    title="Account & Contact Details"
                    description="Official government email and login credentials for system authentication."
                    icon={<Mail className="h-4 w-4" />}
                >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <ModalField label="Email Address" required error={errors.email}>
                            <input
                                type="email"
                                required
                                maxLength={100}
                                value={data.email}
                                onChange={(e) => setData('email', e.target.value)}
                                placeholder="juan.delacruz@mati.gov.ph"
                                className={cn(
                                    "w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm outline-none transition-all placeholder:text-slate-400 focus:ring-2",
                                    errors.email
                                        ? "border-red-400 focus:border-red-500 focus:ring-red-500/15"
                                        : "border-slate-200 focus:border-blue-500 focus:ring-blue-500/15"
                                )}
                            />
                        </ModalField>

                        <ModalField
                            label="Initial Password"
                            required
                            description="Minimum 8 characters"
                            error={errors.password}
                        >
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    required
                                    minLength={8}
                                    value={data.password}
                                    onChange={(e) => setData('password', e.target.value)}
                                    placeholder="Set temporary password"
                                    className={cn(
                                        "w-full rounded-xl border bg-white px-3.5 py-2.5 pr-10 text-sm outline-none transition-all placeholder:text-slate-400 focus:ring-2 font-mono",
                                        errors.password
                                            ? "border-red-400 focus:border-red-500 focus:ring-red-500/15"
                                            : "border-slate-200 focus:border-blue-500 focus:ring-blue-500/15"
                                    )}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                                    tabIndex={-1}
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                >
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </ModalField>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <ModalField label="Mobile Number" description="Optional contact for alerts" error={errors.mobile_number}>
                            <div className="relative">
                                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <input
                                    type="text"
                                    maxLength={20}
                                    value={data.mobile_number}
                                    onChange={(e) => setData('mobile_number', e.target.value)}
                                    placeholder="09171234567"
                                    className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3.5 py-2.5 text-sm outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                                />
                            </div>
                        </ModalField>
                    </div>
                </ModalSection>

                {/* ── Section 3: Organization & System Role ─────────────────── */}
                <ModalSection
                    title="Department & System Role"
                    description="Assign organizational department and system access permissions."
                    icon={<Building2 className="h-4 w-4" />}
                >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <ModalField label="Assigned Department" required error={errors.department_id}>
                            <select
                                required
                                value={data.department_id}
                                onChange={(e) => setData('department_id', e.target.value)}
                                className={cn(
                                    "w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm outline-none transition-all focus:ring-2",
                                    errors.department_id
                                        ? "border-red-400 focus:border-red-500 focus:ring-red-500/15"
                                        : "border-slate-200 focus:border-blue-500 focus:ring-blue-500/15"
                                )}
                            >
                                <option value="">Select Department...</option>
                                {departments.map((dept) => (
                                    <option key={dept.department_id} value={dept.department_id}>
                                        {dept.department_name}
                                    </option>
                                ))}
                            </select>
                        </ModalField>

                        <ModalField label="System Role" required error={errors.role_id}>
                            <select
                                required
                                value={data.role_id}
                                onChange={(e) => setData('role_id', e.target.value)}
                                className={cn(
                                    "w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm outline-none transition-all focus:ring-2",
                                    errors.role_id
                                        ? "border-red-400 focus:border-red-500 focus:ring-red-500/15"
                                        : "border-slate-200 focus:border-blue-500 focus:ring-blue-500/15"
                                )}
                            >
                                <option value="">Select Role...</option>
                                {roles.map((role) => (
                                    <option key={role.role_id} value={role.role_id}>
                                        {role.role_name}
                                    </option>
                                ))}
                            </select>
                        </ModalField>
                    </div>
                </ModalSection>

                {/* ── Section 4: Digital Signature ──────────────────────────── */}
                <ModalSection
                    title="Digital Signature"
                    description="Official signature used for authenticating routing slips and document actions."
                    icon={<PenTool className="h-4 w-4" />}
                >
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="block text-xs font-semibold text-slate-700">
                                Signature Pad <span className="text-red-500 font-bold ml-1">*</span>
                            </label>
                            <button
                                type="button"
                                onClick={handleClearSignature}
                                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-blue-600 px-2.5 py-1 rounded-lg border border-slate-200 hover:border-blue-200 hover:bg-blue-50/50 transition-colors cursor-pointer"
                            >
                                <Eraser className="h-3.5 w-3.5 text-slate-400" />
                                Clear Signature
                            </button>
                        </div>

                        <div
                            ref={containerRef}
                            className={cn(
                                "relative rounded-xl border-2 border-dashed bg-slate-50/60 transition-colors overflow-hidden",
                                signatureError || errors.signature
                                    ? "border-red-400 bg-red-50/20"
                                    : "border-slate-300 hover:border-slate-400"
                            )}
                        >
                            <SignatureCanvas
                                ref={signatureRef}
                                canvasProps={{
                                    className: 'w-full h-40 cursor-crosshair',
                                }}
                                backgroundColor="transparent"
                                penColor="#0f172a"
                                onBegin={() => setSignatureError('')}
                            />
                            <div className="pointer-events-none absolute inset-x-0 bottom-2 text-center">
                                <span className="text-[11px] text-slate-400 font-medium select-none">
                                    Draw signature above this line
                                </span>
                            </div>
                        </div>

                        {(signatureError || errors.signature) && (
                            <p className="text-xs text-red-600 font-medium animate-in fade-in">
                                {signatureError || errors.signature}
                            </p>
                        )}

                        <p className="text-[11px] text-slate-400 leading-relaxed">
                            * This digital signature is permanently bound to the employee account and will appear on official routing slips and document approval trails.
                        </p>
                    </div>
                </ModalSection>
            </div>
        </BaseModal>
    );
}
