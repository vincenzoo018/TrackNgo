import { Head, router } from '@inertiajs/react';
import { Search, Building2, Edit, Trash2, Plus } from 'lucide-react';
import TrackngoLayout from '@/layouts/trackngo/TrackngoLayout';
import { useState } from 'react';
import DepartmentFormModal from '@/components/DepartmentFormModal';

type Department = {
    department_id: number;
    department_name: string;
    code: string | null;
    description: string | null;
    is_active: boolean;
    users_count: number;
    head: { id: number; name: string } | null;
};

type Props = {
    dbDepartments: Department[];
    dbUsers: any[];
};

export default function DepartmentIndex({ dbDepartments, dbUsers }: Props) {
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const filteredDepartments = dbDepartments.filter(dept => 
        dept.department_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (dept.code || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (dept.head?.name || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleDelete = (id: number) => {
        if (confirm('Are you sure you want to delete this department?')) {
            router.delete(`/hr/departments/${id}`, {
                onError: (errors) => {
                    if (errors.error) {
                        alert(errors.error);
                    }
                }
            });
        }
    };

    return (
        <TrackngoLayout>
            <Head title="Departments — TrackNGo Mati" />

            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-[20px] font-bold text-[var(--tng-slate-900)]">Departments</h1>
                        <p className="mt-0.5 text-sm text-[var(--tng-slate-500)]">
                            Manage organizational departments and their heads
                        </p>
                    </div>
                    <button 
                        onClick={() => setIsAddModalOpen(true)}
                        className="flex items-center gap-2 rounded-lg bg-[var(--tng-blue-600)] px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-600/25 transition-all hover:bg-[var(--tng-blue-700)]"
                    >
                        <Plus className="h-4 w-4" />
                        Add Department
                    </button>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative flex-1 min-w-[250px] max-w-md">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--tng-slate-400)]" />
                        <input
                            type="text"
                            placeholder="Search departments..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="h-10 w-full rounded-lg border border-[var(--tng-slate-200)] bg-white pl-9 pr-4 text-sm text-[var(--tng-slate-700)] placeholder:text-[var(--tng-slate-400)] focus:border-[var(--tng-blue-500)] focus:outline-none focus:ring-2 focus:ring-[var(--tng-blue-500)]/20"
                        />
                    </div>
                </div>

                {/* Data Table */}
                <div className="w-full rounded-xl border border-[var(--tng-slate-200)] bg-white shadow-xs overflow-hidden">
                    <div className="overflow-x-auto w-full">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-[var(--tng-slate-50)] border-b border-[var(--tng-slate-200)]">
                                <tr>
                                    <th className="px-6 py-3.5 text-[16px] font-bold text-[var(--tng-slate-800)]">Department Name</th>
                                    <th className="px-6 py-3.5 text-[16px] font-bold text-[var(--tng-slate-800)]">Department Head</th>
                                    <th className="px-6 py-3.5 text-center text-[16px] font-bold text-[var(--tng-slate-800)]">Employees</th>
                                    <th className="px-6 py-3.5 text-[16px] font-bold text-[var(--tng-slate-800)]">Status</th>
                                    <th className="px-6 py-3.5 text-right text-[16px] font-bold text-[var(--tng-slate-800)]">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--tng-slate-100)]">
                                {filteredDepartments.length > 0 ? filteredDepartments.map((dept) => (
                                    <tr key={dept.department_id} className="transition-colors odd:bg-white even:bg-slate-50/75 hover:bg-blue-50/40 group">
                                        <td className="px-6 py-3.5 whitespace-nowrap text-[14px] font-normal text-[var(--tng-slate-700)]">
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--tng-blue-50)] text-[var(--tng-blue-600)]">
                                                    <Building2 className="h-5 w-5" />
                                                </div>
                                                <div>
                                                    <div className="font-semibold text-[var(--tng-slate-900)] text-[14px]">{dept.department_name}</div>
                                                    <div className="text-[12px] text-[var(--tng-slate-500)]">{dept.code || 'No Code'}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-3.5 whitespace-nowrap text-[14px] font-normal text-[var(--tng-slate-700)]">
                                            {dept.head ? (
                                                <div className="font-medium text-[var(--tng-slate-700)] text-[14px]">{dept.head.name}</div>
                                            ) : (
                                                <div className="text-[var(--tng-slate-400)] italic text-[14px]">Unassigned</div>
                                            )}
                                        </td>
                                        <td className="px-6 py-3.5 whitespace-nowrap text-center font-medium">
                                            <span className="bg-[var(--tng-slate-100)] text-[var(--tng-slate-700)] px-2.5 py-1 rounded-full text-[13px] font-bold">
                                                {dept.users_count}
                                            </span>
                                        </td>
                                        <td className="px-6 py-3.5 whitespace-nowrap">
                                            {dept.is_active ? (
                                                <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-[13px] font-bold text-emerald-700">
                                                    Active
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-[13px] font-bold text-red-700">
                                                    Inactive
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-3.5 whitespace-nowrap text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <button 
                                                    title="Edit Department"
                                                    aria-label="Edit Department"
                                                    className="rounded-lg p-2 text-[var(--tng-slate-400)] transition-all hover:bg-blue-50 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400/50"
                                                >
                                                    <Edit className="h-[18px] w-[18px]" />
                                                </button>
                                                <button 
                                                    onClick={() => handleDelete(dept.department_id)}
                                                    title="Delete Department"
                                                    aria-label="Delete Department"
                                                    className="rounded-lg p-2 text-[var(--tng-slate-400)] transition-all hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-400/50"
                                                >
                                                    <Trash2 className="h-[18px] w-[18px]" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-8 text-center text-[var(--tng-slate-500)] text-[14px]">
                                            No departments found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <DepartmentFormModal 
                isOpen={isAddModalOpen} 
                onClose={() => setIsAddModalOpen(false)} 
                users={dbUsers}
            />
        </TrackngoLayout>
    );
}
