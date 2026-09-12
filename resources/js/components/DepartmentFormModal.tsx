import React from 'react';
import {
    BaseModal,
    ModalSection,
    ModalField,
    ModalPrimaryButton,
    ModalSecondaryButton,
} from '@/components/trackngo/BaseModal';
import { Building2, Save } from 'lucide-react';
import { useForm } from '@inertiajs/react';

type Props = {
    isOpen: boolean;
    onClose: () => void;
    users: any[];
    department?: any;
};

export default function DepartmentFormModal({ isOpen, onClose, users, department }: Props) {
    const isEditing = Boolean(department);

    const { data, setData, post, put, processing, errors, reset, clearErrors } = useForm({
        department_name: department?.department_name || '',
        code: department?.code || '',
        description: department?.description || '',
        head_id: department?.head_id || '',
        is_active: department?.is_active !== undefined ? Number(department.is_active) : 1,
    });

    const handleClose = () => {
        reset();
        clearErrors();
        onClose();
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        if (isEditing) {
            put(route('hr.departments.update', department.department_id), {
                onSuccess: () => {
                    handleClose();
                }
            });
        } else {
            post(route('hr.departments.store'), {
                onSuccess: () => {
                    handleClose();
                }
            });
        }
    };

    return (
        <BaseModal
            isOpen={isOpen}
            onClose={handleClose}
            title={isEditing ? `Edit Department: ${department.department_name}` : "Add New Department"}
            description={isEditing ? "Update department metadata, assigned leadership, and operational status." : "Register a new municipal department or office and assign leadership."}
            icon={<Building2 className="h-5 w-5" />}
            maxWidth="max-w-xl"
            formProps={{ onSubmit: handleSubmit }}
            footer={
                <>
                    <ModalSecondaryButton onClick={handleClose} disabled={processing}>
                        Cancel
                    </ModalSecondaryButton>
                    <ModalPrimaryButton isLoading={processing} loadingText={isEditing ? "Updating..." : "Saving..."}>
                        <Save className="h-4 w-4" />
                        {isEditing ? "Save Department Changes" : "Save Department"}
                    </ModalPrimaryButton>
                </>
            }
        >
            <div className="space-y-6">
                {/* Section 1: Department Details */}
                <ModalSection
                    title="Department Details"
                    description="Official naming and municipal identification code."
                >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <ModalField label="Department Name" required error={errors.department_name}>
                            <input
                                type="text"
                                required
                                value={data.department_name}
                                onChange={e => setData('department_name', e.target.value)}
                                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                                placeholder="e.g. City Engineering Office"
                            />
                        </ModalField>

                        <ModalField label="Department Code" error={errors.code}>
                            <input
                                type="text"
                                value={data.code}
                                onChange={e => setData('code', e.target.value)}
                                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 uppercase font-mono"
                                placeholder="e.g. CEO"
                            />
                        </ModalField>
                    </div>

                    <ModalField label="Description / Function" error={errors.description}>
                        <textarea
                            rows={3}
                            value={data.description}
                            onChange={e => setData('description', e.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                            placeholder="Brief description of department scope and responsibilities..."
                        />
                    </ModalField>
                </ModalSection>

                {/* Section 2: Leadership & Administration */}
                <ModalSection
                    title="Leadership & Administration"
                    description="Designate department head and operational status."
                >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <ModalField label="Department Head" error={errors.head_id}>
                            <select
                                value={data.head_id}
                                onChange={e => setData('head_id', e.target.value)}
                                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                            >
                                <option value="">No Department Head Assigned</option>
                                {users.map(user => (
                                    <option key={user.id} value={user.id}>{user.name} ({user.email})</option>
                                ))}
                            </select>
                        </ModalField>

                        <ModalField label="Operational Status" required>
                            <select
                                value={data.is_active}
                                onChange={e => setData('is_active', Number(e.target.value))}
                                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                            >
                                <option value={1}>Active</option>
                                <option value={0}>Inactive</option>
                            </select>
                        </ModalField>
                    </div>
                </ModalSection>
            </div>
        </BaseModal>
    );
}
