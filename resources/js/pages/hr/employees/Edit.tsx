import { Head, Link, useForm } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import TrackngoLayout from '@/layouts/trackngo/TrackngoLayout';
import { Save, ChevronRight, Home, Eraser, PenLine } from 'lucide-react';
import { toast } from 'sonner';

type Props = {
    dbEmployee: any;
    dbDepartments: any[];
    dbRoles: any[];
    /** Registered signature (PNG data URL); stamped on documents this employee approves as a signatory */
    currentSignature?: string | null;
};

export default function Edit({ dbEmployee, dbDepartments, dbRoles, currentSignature = null }: Props) {
    const signaturePadRef = useRef<any>(null);
    const [replacingSignature, setReplacingSignature] = useState(!currentSignature);

    // Match the canvas resolution to its box so strokes are not stretched
    useEffect(() => {
        const canvas = signaturePadRef.current?.getCanvas?.();
        if (replacingSignature && canvas && canvas.offsetWidth > 0) {
            canvas.width = canvas.offsetWidth;
            canvas.height = canvas.offsetHeight;
            signaturePadRef.current.clear();
        }
    }, [replacingSignature]);

    const { data, setData, put, processing, errors, transform } = useForm({
        first_name: dbEmployee.first_name || '',
        middle_name: dbEmployee.middle_name || '',
        last_name: dbEmployee.last_name || '',
        email: dbEmployee.email || '',
        department_id: dbEmployee.department_id || '',
        role_id: dbEmployee.role_id || '',
        mobile_number: dbEmployee.mobile_number || '',
        password: '',
        is_active: dbEmployee.is_active !== undefined ? dbEmployee.is_active : 1,
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!window.confirm('Are you sure you want to save these changes?')) {
            return;
        }

        // A newly drawn signature replaces the registered one; an untouched pad keeps it
        const pad = signaturePadRef.current;
        let signature = '';
        if (replacingSignature && pad && !pad.isEmpty?.()) {
            try {
                signature = pad.getTrimmedCanvas().toDataURL('image/png');
            } catch {
                signature = pad.getCanvas?.()?.toDataURL('image/png') ?? '';
            }
        }
        transform(form => (signature ? { ...form, signature } : form));

        put(`/hr/employees/${dbEmployee.id}`, {
            onSuccess: () => {
                toast.success('Employee changes saved successfully!');
            },
            onError: () => {
                toast.error('Failed to save. Please fix the errors highlighted below.');
            }
        });
    };

    return (
        <TrackngoLayout>
            <Head title={`Edit Employee: ${dbEmployee.name} — TrackNGo Mati`} />

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
                <span className="text-[var(--tng-slate-800)] font-medium">Edit Employee</span>
            </div>

            <div className="mb-6">
                <h1 className="text-3xl font-bold text-[var(--tng-slate-900)]">
                    {dbEmployee.first_name} {dbEmployee.last_name}
                </h1>
                <p className="mt-2 text-[var(--tng-slate-500)]">
                    Update employee information and system access settings.
                </p>
            </div>

            <div className="bg-white rounded-2xl border border-[var(--tng-slate-200)] shadow-sm overflow-hidden">
                <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4 md:col-span-2">
                            <label className="text-sm font-medium text-[var(--tng-slate-700)]">Employee Name</label>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-1">
                                    <input
                                        type="text"
                                        maxLength={60}
                                        value={data.first_name}
                                        onChange={e => setData('first_name', e.target.value)}
                                        className={`w-full rounded-xl border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--tng-blue-500)]/20 ${errors.first_name ? 'border-red-500' : 'border-[var(--tng-slate-200)]'}`}
                                        placeholder="First Name (e.g. Juan)"
                                    />
                                    {errors.first_name && <p className="text-xs text-red-500">{errors.first_name}</p>}
                                </div>
                                <div className="space-y-1">
                                    <input
                                        type="text"
                                        maxLength={60}
                                        value={data.middle_name}
                                        onChange={e => setData('middle_name', e.target.value)}
                                        className={`w-full rounded-xl border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--tng-blue-500)]/20 ${errors.middle_name ? 'border-red-500' : 'border-[var(--tng-slate-200)]'}`}
                                        placeholder="Middle Name (Optional)"
                                    />
                                    {errors.middle_name && <p className="text-xs text-red-500">{errors.middle_name}</p>}
                                </div>
                                <div className="space-y-1">
                                    <input
                                        type="text"
                                        maxLength={60}
                                        value={data.last_name}
                                        onChange={e => setData('last_name', e.target.value)}
                                        className={`w-full rounded-xl border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--tng-blue-500)]/20 ${errors.last_name ? 'border-red-500' : 'border-[var(--tng-slate-200)]'}`}
                                        placeholder="Last Name (e.g. Dela Cruz)"
                                    />
                                    {errors.last_name && <p className="text-xs text-red-500">{errors.last_name}</p>}
                                </div>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-[var(--tng-slate-700)]">Email Address</label>
                            <input
                                type="email"
                                maxLength={100}
                                value={data.email}
                                onChange={e => setData('email', e.target.value)}
                                className={`w-full rounded-xl border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--tng-blue-500)]/20 ${errors.email ? 'border-red-500' : 'border-[var(--tng-slate-200)]'}`}
                                placeholder="juan@mati.gov.ph"
                            />
                            {errors.email && <p className="text-xs text-red-500">{errors.email}</p>}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-[var(--tng-slate-700)]">Department</label>
                            <select
                                value={data.department_id}
                                onChange={e => setData('department_id', e.target.value)}
                                className={`w-full rounded-xl border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--tng-blue-500)]/20 ${errors.department_id ? 'border-red-500' : 'border-[var(--tng-slate-200)]'}`}
                            >
                                <option value="">Select Department</option>
                                {dbDepartments.map(dept => (
                                    <option key={dept.department_id} value={dept.department_id}>{dept.department_name}</option>
                                ))}
                            </select>
                            {errors.department_id && <p className="text-xs text-red-500">{errors.department_id}</p>}
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-[var(--tng-slate-700)]">System Role</label>
                            <select
                                value={data.role_id}
                                onChange={e => setData('role_id', e.target.value)}
                                className={`w-full rounded-xl border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--tng-blue-500)]/20 ${errors.role_id ? 'border-red-500' : 'border-[var(--tng-slate-200)]'}`}
                            >
                                <option value="">Select Role</option>
                                {dbRoles.map(role => (
                                    <option key={role.role_id} value={role.role_id}>{role.role_name}</option>
                                ))}
                            </select>
                            {errors.role_id && <p className="text-xs text-red-500">{errors.role_id}</p>}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-[var(--tng-slate-700)]">Mobile Number (Optional)</label>
                            <input
                                type="text"
                                value={data.mobile_number}
                                onChange={e => setData('mobile_number', e.target.value)}
                                className="w-full rounded-xl border border-[var(--tng-slate-200)] px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--tng-blue-500)]/20"
                                placeholder="09171234567"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-[var(--tng-slate-700)]">Password</label>
                            <input
                                type="password"
                                value={data.password}
                                onChange={e => setData('password', e.target.value)}
                                className={`w-full rounded-xl border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--tng-blue-500)]/20 ${errors.password ? 'border-red-500' : 'border-[var(--tng-slate-200)]'}`}
                                placeholder="Leave blank to keep current password"
                            />
                            {errors.password && <p className="text-xs text-red-500">{errors.password}</p>}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-[var(--tng-slate-700)]">Status</label>
                            <select
                                value={data.is_active}
                                onChange={e => setData('is_active', Number(e.target.value))}
                                className="w-full rounded-xl border border-[var(--tng-slate-200)] px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--tng-blue-500)]/20"
                            >
                                <option value={1}>Active</option>
                                <option value={0}>Inactive</option>
                            </select>
                        </div>
                    </div>

                    {/* Registered digital signature: stamped automatically on documents this employee approves */}
                    <div className="space-y-3 rounded-xl border border-[var(--tng-slate-200)] p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                                <p className="text-sm font-medium text-[var(--tng-slate-700)]">Digital Signature</p>
                                <p className="text-xs text-[var(--tng-slate-500)]">
                                    Stamped automatically on documents this employee forwards or approves as a signatory.
                                </p>
                            </div>
                            {currentSignature && (
                                <button
                                    type="button"
                                    onClick={() => setReplacingSignature(r => !r)}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--tng-slate-200)] px-3 py-1.5 text-xs font-medium text-[var(--tng-slate-600)] hover:bg-[var(--tng-slate-50)]"
                                >
                                    <PenLine className="h-3.5 w-3.5" /> {replacingSignature ? 'Keep current signature' : 'Replace signature'}
                                </button>
                            )}
                        </div>

                        {currentSignature && !replacingSignature && (
                            <div className="flex h-28 items-center justify-center rounded-lg border border-[var(--tng-slate-200)] bg-[var(--tng-slate-50)]">
                                <img src={currentSignature} alt={`Signature of ${dbEmployee.name}`} className="max-h-24 max-w-[280px] object-contain mix-blend-multiply" />
                            </div>
                        )}

                        {replacingSignature && (
                            <div className="space-y-2">
                                {!currentSignature && (
                                    <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                                        No signature registered yet. This employee cannot be chosen as a signatory until one is added.
                                    </p>
                                )}
                                <div className="relative overflow-hidden rounded-xl border-2 border-dashed border-[var(--tng-slate-300)] bg-[var(--tng-slate-50)]">
                                    <SignatureCanvas
                                        ref={signaturePadRef}
                                        canvasProps={{ className: 'h-40 w-full cursor-crosshair' }}
                                        backgroundColor="transparent"
                                        penColor="#0f172a"
                                    />
                                    <span className="pointer-events-none absolute inset-x-0 bottom-2 select-none text-center text-[11px] text-[var(--tng-slate-400)]">
                                        Draw the employee's signature above this line
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => signaturePadRef.current?.clear()}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--tng-slate-200)] px-2.5 py-1 text-xs font-medium text-[var(--tng-slate-600)] hover:bg-[var(--tng-slate-50)]"
                                >
                                    <Eraser className="h-3.5 w-3.5" /> Clear
                                </button>
                            </div>
                        )}
                        {(errors as Record<string, string>).signature && <p className="text-xs text-red-500">{(errors as Record<string, string>).signature}</p>}
                    </div>

                    <div className="pt-6 border-t border-[var(--tng-slate-100)] flex items-center justify-end gap-3">
                        <Link
                            href="/hr/employees"
                            className="px-5 py-2.5 text-sm font-medium text-[var(--tng-slate-600)] hover:bg-[var(--tng-slate-100)] rounded-xl transition-colors"
                        >
                            Cancel
                        </Link>
                        <button
                            type="submit"
                            disabled={processing}
                            className="flex items-center gap-2 px-6 py-2.5 bg-[var(--tng-blue-600)] text-white text-sm font-medium rounded-xl shadow-md shadow-blue-600/20 hover:bg-[var(--tng-blue-700)] transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            <Save className="h-4 w-4" />
                            {processing ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </TrackngoLayout>
    );
}
