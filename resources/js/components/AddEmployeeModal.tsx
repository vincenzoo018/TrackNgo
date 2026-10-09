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
    Eye,
    EyeOff,
    PenTool,
    Eraser,
    Phone,
    KeyRound,
    AlertCircle,
} from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';
import { toast } from 'sonner';
import { pinFieldsShown, validateEmployee } from '@/components/EmployeeFormFields';
import { DocumentPinFields, PIN_RULES_HINT } from '@/components/trackngo/DocumentPinFields';
import { MOBILE_HINT, MOBILE_LENGTH, mobileDigits } from '@/lib/form-rules';
import { isSignaturePadEmpty, signaturePadDataUrl } from '@/lib/signature-pad';
import { cn } from '@/lib/utils';

type Props = {
    isOpen: boolean;
    onClose: () => void;
    departments: Array<{ department_id: number; department_name: string; code?: string }>;
    roles: Array<{ role_id: number; role_name: string }>;
};

type Field =
    | 'first_name' | 'middle_name' | 'last_name' | 'email' | 'password' | 'mobile_number'
    | 'department_id' | 'role_id' | 'document_pin' | 'document_pin_confirmation';

// Form order, so the first field to fix gets the focus; labels name server errors in the summary banner
const FIELD_LABELS: Record<string, string> = {
    first_name: 'First name',
    middle_name: 'Middle name',
    last_name: 'Last name',
    email: 'Email address',
    password: 'Initial password',
    mobile_number: 'Mobile number',
    department_id: 'Department',
    role_id: 'System role',
    document_pin: 'Document PIN',
    signature: 'Digital signature',
};

const inputId = (field: string) => `add-employee-${field}`;

const fieldClass = (error?: string, extra = '') => cn(
    'w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm outline-none transition-all placeholder:text-slate-400 focus:ring-2',
    error
        ? 'border-red-400 focus:border-red-500 focus:ring-red-500/15'
        : 'border-slate-200 focus:border-blue-500 focus:ring-blue-500/15',
    extra,
);

export default function AddEmployeeModal({ isOpen, onClose, departments = [], roles = [] }: Props) {
    const signatureRef = useRef<any>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [showPassword, setShowPassword] = useState(false);
    // Failures that are not a field error (session expired, server error, no connection)
    const [requestError, setRequestError] = useState<string | null>(null);

    const { data, setData, post, processing, errors, reset, clearErrors, setError, transform } = useForm({
        first_name: '',
        middle_name: '',
        last_name: '',
        email: '',
        password: '',
        department_id: '',
        role_id: '',
        mobile_number: '',
        document_pin: '',
        document_pin_confirmation: '',
        signature: '',
    });
    const fieldErrors = errors as Record<string, string | undefined>;
    const showPin = pinFieldsShown('register', roles, data.role_id);
    const check = () => validateEmployee(data, { roles, pinMode: 'register', passwordRequired: true });

    const handleClose = () => {
        reset();
        clearErrors();
        setRequestError(null);
        setShowPassword(false);
        signatureRef.current?.clear();
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

    // Editing a field clears its message; the PIN and its confirmation share one
    const update = (field: Field, value: string) => {
        setData(field, value);
        clearErrors(field === 'document_pin_confirmation' ? 'document_pin' : field);
    };

    // Leaving a filled-in field checks it right away (empty fields are only flagged on Save)
    const checkOnBlur = (field: Field) => {
        const key = field === 'document_pin_confirmation' ? 'document_pin' : field;
        if (!String(data[field] ?? '').trim()) return;
        if (key === 'document_pin' && (!data.document_pin || !data.document_pin_confirmation)) return;
        const message = check()[key];
        if (message) setError(key, message);
        else clearErrors(key);
    };

    const focusFirstError = (found: Record<string, unknown>) => {
        const first = Object.keys(FIELD_LABELS).find(key => found[key]);
        const target = first === 'signature' ? containerRef.current : document.getElementById(inputId(first ?? ''));
        target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement) target.focus({ preventScroll: true });
    };

    const handleClearSignature = () => {
        signatureRef.current?.clear();
        clearErrors('signature');
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (processing) return;
        setRequestError(null);

        const found = check();
        if (isSignaturePadEmpty(signatureRef.current)) {
            found.signature = 'Draw the employee\'s signature. It is stamped on documents they sign.';
        }
        const signatureDataUrl = found.signature ? '' : signaturePadDataUrl(signatureRef.current);
        if (!found.signature && !signatureDataUrl) {
            found.signature = 'The signature could not be captured. Please clear the pad and sign again.';
        }

        clearErrors();
        if (Object.keys(found).length > 0) {
            setError(found as any);
            focusFirstError(found);
            return;
        }

        // A PIN typed before switching to a role that needs none (CART) is not sent
        transform(({ document_pin, document_pin_confirmation, ...rest }) => ({
            ...rest,
            ...(showPin ? { document_pin, document_pin_confirmation } : {}),
            signature: signatureDataUrl,
        }));

        post('/hr/employees', {
            preserveScroll: true,
            onSuccess: () => {
                toast.success('Employee successfully added!');
                handleClose();
            },
            onError: (serverErrors) => {
                focusFirstError(serverErrors);
                toast.error('The employee was not saved. See the form for what to fix.');
            },
            onHttpException: (response: any) => {
                const status = Number(response?.status);
                setRequestError(
                    status === 403 ? 'You are not allowed to create this account (HR cannot create or change Administrator accounts).'
                    : status === 419 ? 'Your session expired. Please refresh the page and try again.'
                    : `The server could not save the employee (HTTP ${status || 'error'}). Please try again.`,
                );
                return false;
            },
            onNetworkError: () => {
                setRequestError('Could not reach the server. Check your connection and try again.');
                return false;
            },
        });
    };

    // Every error is listed here too, so nothing is "highlighted" out of sight
    const errorEntries = Object.entries(fieldErrors).filter(([, message]) => message) as [string, string][];
    const unknownErrors = errorEntries.filter(([key]) => !FIELD_LABELS[key]).map(([, message]) => message);
    const fieldsToFix = Object.keys(FIELD_LABELS).filter(key => fieldErrors[key]).map(key => FIELD_LABELS[key]);

    return (
        <BaseModal
            isOpen={isOpen}
            onClose={handleClose}
            title="Add New Employee"
            description="Register a new municipal employee account, assign organizational role, and capture digital signature."
            icon={<UserPlus className="h-5 w-5" />}
            maxWidth="max-w-2xl"
            formProps={{ onSubmit: handleSubmit, noValidate: true }}
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
                {(requestError || errorEntries.length > 0) && (
                    <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                        <div className="space-y-0.5">
                            {requestError && <p>{requestError}</p>}
                            {fieldsToFix.length > 0 && <p>Please fix: {fieldsToFix.join(', ')}.</p>}
                            {unknownErrors.map(message => <p key={message}>{message}</p>)}
                        </div>
                    </div>
                )}

                {/* ── Section 1: Personal Information ───────────────────────── */}
                <ModalSection
                    title="Employee Information"
                    description="Official legal name for personnel records and audit verification."
                    icon={<User className="h-4 w-4" />}
                >
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <ModalField label="First Name" required error={fieldErrors.first_name}>
                            <input
                                id={inputId('first_name')}
                                type="text"
                                maxLength={60}
                                value={data.first_name}
                                onChange={(e) => update('first_name', e.target.value)}
                                onBlur={() => checkOnBlur('first_name')}
                                aria-invalid={Boolean(fieldErrors.first_name)}
                                placeholder="e.g. Juan"
                                className={fieldClass(fieldErrors.first_name)}
                            />
                        </ModalField>

                        <ModalField label="Middle Name" error={fieldErrors.middle_name}>
                            <input
                                id={inputId('middle_name')}
                                type="text"
                                maxLength={60}
                                value={data.middle_name}
                                onChange={(e) => update('middle_name', e.target.value)}
                                onBlur={() => checkOnBlur('middle_name')}
                                aria-invalid={Boolean(fieldErrors.middle_name)}
                                placeholder="e.g. Santos (Optional)"
                                className={fieldClass(fieldErrors.middle_name)}
                            />
                        </ModalField>

                        <ModalField label="Last Name" required error={fieldErrors.last_name}>
                            <input
                                id={inputId('last_name')}
                                type="text"
                                maxLength={60}
                                value={data.last_name}
                                onChange={(e) => update('last_name', e.target.value)}
                                onBlur={() => checkOnBlur('last_name')}
                                aria-invalid={Boolean(fieldErrors.last_name)}
                                placeholder="e.g. Dela Cruz"
                                className={fieldClass(fieldErrors.last_name)}
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
                        <ModalField label="Email Address" required error={fieldErrors.email}>
                            <input
                                id={inputId('email')}
                                type="email"
                                maxLength={100}
                                value={data.email}
                                onChange={(e) => update('email', e.target.value)}
                                onBlur={() => checkOnBlur('email')}
                                aria-invalid={Boolean(fieldErrors.email)}
                                placeholder="juan.delacruz@mati.gov.ph"
                                className={fieldClass(fieldErrors.email)}
                            />
                        </ModalField>

                        <ModalField
                            label="Initial Password"
                            required
                            description="Minimum 8 characters"
                            error={fieldErrors.password}
                        >
                            <div className="relative">
                                <input
                                    id={inputId('password')}
                                    type={showPassword ? 'text' : 'password'}
                                    autoComplete="new-password"
                                    value={data.password}
                                    onChange={(e) => update('password', e.target.value)}
                                    onBlur={() => checkOnBlur('password')}
                                    aria-invalid={Boolean(fieldErrors.password)}
                                    placeholder="Set temporary password"
                                    className={fieldClass(fieldErrors.password, 'pr-10 font-mono')}
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
                        <ModalField label="Mobile Number" required description={`For SMS alerts: ${MOBILE_HINT}`} error={fieldErrors.mobile_number}>
                            <div className="relative">
                                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <input
                                    id={inputId('mobile_number')}
                                    type="text"
                                    inputMode="numeric"
                                    autoComplete="tel"
                                    maxLength={MOBILE_LENGTH}
                                    value={data.mobile_number}
                                    // Digits only, at most 11: 09XXXXXXXXX
                                    onChange={(e) => update('mobile_number', mobileDigits(e.target.value))}
                                    onBlur={() => checkOnBlur('mobile_number')}
                                    aria-invalid={Boolean(fieldErrors.mobile_number)}
                                    placeholder="09171234567"
                                    className={fieldClass(fieldErrors.mobile_number, 'pl-10 font-mono tracking-wide')}
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
                        <ModalField label="Assigned Department" required error={fieldErrors.department_id}>
                            <select
                                id={inputId('department_id')}
                                value={data.department_id}
                                onChange={(e) => update('department_id', e.target.value)}
                                aria-invalid={Boolean(fieldErrors.department_id)}
                                className={fieldClass(fieldErrors.department_id)}
                            >
                                <option value="">Select Department...</option>
                                {departments.map((dept) => (
                                    <option key={dept.department_id} value={dept.department_id}>
                                        {dept.department_name}
                                    </option>
                                ))}
                            </select>
                        </ModalField>

                        <ModalField label="System Role" required error={fieldErrors.role_id}>
                            <select
                                id={inputId('role_id')}
                                value={data.role_id}
                                onChange={(e) => update('role_id', e.target.value)}
                                aria-invalid={Boolean(fieldErrors.role_id)}
                                className={fieldClass(fieldErrors.role_id)}
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

                {/* ── Section 4: Document PIN (every role that handles documents; CART only monitors) ── */}
                {showPin && (
                    <ModalSection
                        title="Document PIN"
                        description="Asked before any document is downloaded or exported. Give it to the employee privately; they can change it in Profile Settings."
                        icon={<KeyRound className="h-4 w-4" />}
                    >
                        <div id={inputId('document_pin')} onBlur={() => checkOnBlur('document_pin_confirmation')}>
                            <DocumentPinFields
                                pin={data.document_pin}
                                confirmation={data.document_pin_confirmation}
                                onPinChange={(value) => update('document_pin', value)}
                                onConfirmationChange={(value) => update('document_pin_confirmation', value)}
                                required
                                hint={PIN_RULES_HINT}
                                error={fieldErrors.document_pin}
                                inputClassName={fieldClass(fieldErrors.document_pin)}
                                labelClassName="block text-xs font-semibold text-slate-700"
                            />
                        </div>
                    </ModalSection>
                )}

                {/* ── Section 5: Digital Signature ──────────────────────────── */}
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
                                fieldErrors.signature
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
                                onBegin={() => clearErrors('signature')}
                            />
                            <div className="pointer-events-none absolute inset-x-0 bottom-2 text-center">
                                <span className="text-[11px] text-slate-400 font-medium select-none">
                                    Draw signature above this line
                                </span>
                            </div>
                        </div>

                        {fieldErrors.signature && (
                            <p className="text-xs text-red-600 font-medium animate-in fade-in">
                                {fieldErrors.signature}
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
