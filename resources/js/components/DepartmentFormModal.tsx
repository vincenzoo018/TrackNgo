import React from 'react';
import { BaseModal } from '@/components/trackngo/BaseModal';
import { Building2, Save } from 'lucide-react';
import { useForm } from '@inertiajs/react';

type Props = {
    isOpen: boolean;
    onClose: () => void;
    users: any[];
};

export default function DepartmentFormModal({ isOpen, onClose, users }: Props) {
    const { data, setData, post, processing, errors, reset, clearErrors } = useForm({
        department_name: '',
        code: '',
        description: '',
        head_id: '',
        is_active: 1,
    });

    const handleClose = () => {
        reset();
        clearErrors();
        onClose();
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        post(route('hr.departments.store'), {
            onSuccess: () => {
                handleClose();
            }
        });
    };

    return (
        <BaseModal
            isOpen={isOpen}
            onClose={handleClose}
            title="Add New Department"
            description="Create a new department and assign a department head."
            icon={<Building2 className="h-5 w-5" />}
            maxWidth="max-w-xl"
            formProps={{ onSubmit: handleSubmit }}
            footer={
                <>
                    <button
                        type="button"
                        onClick={handleClose}
                        className="px-4 py-2 text-sm font-medium text-[var(--tng-slate-600)] hover:bg-[var(--tng-slate-100)] rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={processing}
                        className="flex items-center gap-2 px-4 py-2 bg-[var(--tng-blue-600)] text-white text-sm font-medium rounded-lg shadow-md hover:bg-[var(--tng-blue-700)] transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        <Save className="h-4 w-4" />
                        {processing ? 'Saving...' : 'Save Department'}
                    </button>
                </>
            }
        >
            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5 col-span-2 sm:col-span-1">
                        <label className="text-sm font-medium text-[var(--tng-slate-700)]">Department Name *</label>
                        <input
                            type="text"
                            value={data.department_name}
                            onChange={e => setData('department_name', e.target.value)}
                            className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--tng-blue-500)]/20 ${errors.department_name ? 'border-red-500' : 'border-[var(--tng-slate-200)]'}`}
                            placeholder="City Engineer's Office"
                        />
                        {errors.department_name && <p className="text-xs text-red-500">{errors.department_name}</p>}
                    </div>
                    <div className="space-y-1.5 col-span-2 sm:col-span-1">
                        <label className="text-sm font-medium text-[var(--tng-slate-700)]">Department Code</label>
                        <input
                            type="text"
                            value={data.code}
                            onChange={e => setData('code', e.target.value)}
                            className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--tng-blue-500)]/20 ${errors.code ? 'border-red-500' : 'border-[var(--tng-slate-200)]'}`}
                            placeholder="ENG-01"
                        />
                        {errors.code && <p className="text-xs text-red-500">{errors.code}</p>}
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className="text-sm font-medium text-[var(--tng-slate-700)]">Description</label>
                    <textarea
                        value={data.description}
                        onChange={e => setData('description', e.target.value)}
                        className="w-full rounded-lg border border-[var(--tng-slate-200)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--tng-blue-500)]/20 min-h-[80px]"
                        placeholder="Brief description of the department's role..."
                    />
                    {errors.description && <p className="text-xs text-red-500">{errors.description}</p>}
                </div>

                <div className="space-y-1.5">
                    <label className="text-sm font-medium text-[var(--tng-slate-700)]">Department Head</label>
                    <select
                        value={data.head_id}
                        onChange={e => setData('head_id', e.target.value)}
                        className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--tng-blue-500)]/20 ${errors.head_id ? 'border-red-500' : 'border-[var(--tng-slate-200)]'}`}
                    >
                        <option value="">No Department Head Assigned</option>
                        {users.map(user => (
                            <option key={user.id} value={user.id}>{user.name} ({user.email})</option>
                        ))}
                    </select>
                    {errors.head_id && <p className="text-xs text-red-500">{errors.head_id}</p>}
                </div>

                <div className="space-y-1.5">
                    <label className="text-sm font-medium text-[var(--tng-slate-700)]">Status</label>
                    <select
                        value={data.is_active}
                        onChange={e => setData('is_active', Number(e.target.value))}
                        className="w-full rounded-lg border border-[var(--tng-slate-200)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--tng-blue-500)]/20"
                    >
                        <option value={1}>Active</option>
                        <option value={0}>Inactive</option>
                    </select>
                </div>
            </div>
        </BaseModal>
    );
}
