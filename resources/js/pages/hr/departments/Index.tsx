import { Head, router } from '@inertiajs/react';
import { Search, Building2, Edit, Trash2, Plus } from 'lucide-react';
import TrackngoLayout from '@/layouts/trackngo/TrackngoLayout';
import { useState } from 'react';
import DepartmentFormModal from '@/components/DepartmentFormModal';
import TablePagination from '@/components/trackngo/TablePagination';
import TableActionButtons from '@/components/trackngo/TableActionButtons';

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
    const [editingDept, setEditingDept] = useState<Department | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);

    const filteredDepartments = dbDepartments.filter(dept => 
        dept.department_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (dept.code || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (dept.head?.name || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    const paginatedDepartments = filteredDepartments.slice(
        (currentPage - 1) * pageSize,
        currentPage * pageSize
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
                        className="inline-flex items-center gap-2 rounded-lg bg-[#0066cc] px-4 py-2 text-[14px] font-medium text-white shadow-xs hover:shadow-sm transition-all hover:bg-[#005bb5]"
                    >
                        <Plus className="h-4 w-4 text-white" />
                        Add Department
                    </button>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative flex-1 min-w-[250px] max-w-md">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--tng-slate-400)]" />
                        <input
                            type="text"
                            placeholder="Search by reference number, tracking number, type, or name..."
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="h-10 w-full rounded-lg border border-[var(--tng-slate-200)] bg-white pl-9 pr-4 text-sm text-[var(--tng-slate-700)] placeholder:text-[var(--tng-slate-400)] focus:border-[var(--tng-blue-500)] focus:outline-none focus:ring-2 focus:ring-[var(--tng-blue-500)]/20"
                        />
                    </div>
                </div>

                {/* Data Table */}
                <div className="w-full rounded-xl border border-[var(--tng-slate-200)] bg-white shadow-xs overflow-hidden">
                    <div className="overflow-x-auto w-full">
                        <table className="w-full text-left border-collapse text-[13px] text-slate-700">
                            <thead className="bg-[var(--tng-slate-50)] border-b border-[var(--tng-slate-200)]">
                                <tr>
                                    <th className="px-4 py-3 text-left text-[14px] font-normal text-slate-600">Department Name</th>
                                    <th className="px-4 py-3 text-left text-[14px] font-normal text-slate-600">Department Head</th>
                                    <th className="px-4 py-3 text-center text-[14px] font-normal text-slate-600">Employees</th>
                                    <th className="px-4 py-3 text-left text-[14px] font-normal text-slate-600">Status</th>
                                    <th className="px-4 py-3 text-right text-[14px] font-normal text-slate-600">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--tng-slate-100)]">
                                {paginatedDepartments.length > 0 ? paginatedDepartments.map((dept) => (
                                    <tr key={dept.department_id} className="transition-colors odd:bg-white even:bg-slate-50/75 hover:bg-blue-50/40 group">
                                        <td className="px-4 py-3 whitespace-nowrap text-[13px] font-normal text-slate-700">
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--tng-blue-50)] text-[var(--tng-blue-600)]">
                                                    <Building2 className="h-4 w-4" />
                                                </div>
                                                <div>
                                                    <div className="text-[13px] font-normal text-slate-900">{dept.department_name}</div>
                                                    <div className="text-[12px] text-slate-500 font-normal">{dept.code || 'No Code'}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-[13px] font-normal text-slate-700">
                                            {dept.head ? (
                                                <div className="text-slate-800 text-[13px] font-normal">{dept.head.name}</div>
                                            ) : (
                                                <div className="text-slate-400 italic text-[13px]">Unassigned</div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-center">
                                            <span className="bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full text-[12px] font-medium">
                                                {dept.users_count}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            {dept.is_active ? (
                                                <span className="inline-flex items-center rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[12px] font-medium text-emerald-700">
                                                    Active
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center rounded-full bg-rose-50 border border-rose-200 px-2.5 py-0.5 text-[12px] font-medium text-rose-700">
                                                    Inactive
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-right">
                                            <TableActionButtons
                                                onEdit={() => setEditingDept(dept)}
                                                editTitle="Edit Record"
                                                onDelete={() => handleDelete(dept.department_id)}
                                                deleteTitle="Delete Record"
                                            />
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={5} className="px-4 py-8 text-center text-slate-500 text-[13px]">
                                            No departments found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <TablePagination
                        currentPage={currentPage}
                        pageSize={pageSize}
                        totalItems={filteredDepartments.length}
                        onPageChange={setCurrentPage}
                        onPageSizeChange={(newSize) => {
                            setPageSize(newSize);
                            setCurrentPage(1);
                        }}
                        pageSizeOptions={[20, 50, 100]}
                        itemLabel="departments"
                    />
                </div>
            </div>

            <DepartmentFormModal 
                isOpen={isAddModalOpen || editingDept !== null} 
                onClose={() => {
                    setIsAddModalOpen(false);
                    setEditingDept(null);
                }} 
                users={dbUsers}
                department={editingDept}
            />
        </TrackngoLayout>
    );
}
