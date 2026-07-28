import { Head, Link, useForm } from '@inertiajs/react';
import TrackngoLayout from '@/layouts/trackngo/TrackngoLayout';
import { Save, ChevronRight, Home } from 'lucide-react';
import { toast } from 'sonner';

type Props = {
    dbEmployee: any;
    dbDepartments: any[];
    dbRoles: any[];
};

export default function Edit({ dbEmployee, dbDepartments, dbRoles }: Props) {
    const { data, setData, put, processing, errors } = useForm({
        name: dbEmployee.name || '',
        email: dbEmployee.email || '',
        department_id: dbEmployee.department_id || '',
        role_id: dbEmployee.role_id || '',
        mobile_number: dbEmployee.mobile_number || '',
        is_active: dbEmployee.is_active !== undefined ? dbEmployee.is_active : 1,
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!window.confirm('Are you sure you want to save these changes?')) {
            return;
        }

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
                    {dbEmployee.name}
                </h1>
                <p className="mt-2 text-[var(--tng-slate-500)]">
                    Update employee information and system access settings.
                </p>
            </div>

            <div className="bg-white rounded-2xl border border-[var(--tng-slate-200)] shadow-sm overflow-hidden">
                <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-[var(--tng-slate-700)]">Full Name</label>
                            <input
                                type="text"
                                value={data.name}
                                onChange={e => setData('name', e.target.value)}
                                className={`w-full rounded-xl border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--tng-blue-500)]/20 ${errors.name ? 'border-red-500' : 'border-[var(--tng-slate-200)]'}`}
                                placeholder="Juan Dela Cruz"
                            />
                            {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-[var(--tng-slate-700)]">Email Address</label>
                            <input
                                type="email"
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
