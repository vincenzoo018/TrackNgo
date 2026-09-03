import { Head, Link, router } from '@inertiajs/react';
import { Users, Search, Filter, UserPlus, Mail, Phone, Edit, Trash2 } from 'lucide-react';
import TrackngoLayout from '@/layouts/trackngo/TrackngoLayout';
import { useState } from 'react';

type Employee = {
    id: number;
    first_name: string;
    middle_name: string | null;
    last_name: string;
    email: string;
    mobile_number: string | null;
    is_active: number;
    department: { department_id: number; department_name: string };
    role: { role_id: number; role_name: string };
};

type Props = {
    dbEmployees: Employee[];
    dbDepartments: any[];
    dbRoles: any[];
};

export default function EmployeeIndex({ dbEmployees, dbDepartments, dbRoles }: Props) {
    const [searchQuery, setSearchQuery] = useState('');

    const filteredEmployees = dbEmployees.filter(emp => 
        emp.first_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        emp.last_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        emp.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (emp.department?.department_name || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleDelete = (id: number) => {
        if (confirm('Are you sure you want to delete this employee?')) {
            router.delete(route('hr.employees.destroy', id));
        }
    };

    return (
        <TrackngoLayout>
            <Head title="Employee Records — TrackNGo Mati" />

            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-[var(--tng-slate-900)]">Employee Records</h1>
                        <p className="mt-0.5 text-sm text-[var(--tng-slate-500)]">
                            Manage employee information, departments, and personnel records
                        </p>
                    </div>
                    <Link 
                        href="/hr/employees/create"
                        className="flex items-center gap-2 rounded-lg bg-[var(--tng-blue-600)] px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-600/25 transition-all hover:bg-[var(--tng-blue-700)]"
                    >
                        <UserPlus className="h-4 w-4" />
                        Add Employee
                    </Link>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative flex-1 min-w-[250px] max-w-md">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--tng-slate-400)]" />
                        <input
                            type="text"
                            placeholder="Search employees by name, email, or department..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="h-10 w-full rounded-lg border border-[var(--tng-slate-200)] bg-white pl-9 pr-4 text-sm text-[var(--tng-slate-700)] placeholder:text-[var(--tng-slate-400)] focus:border-[var(--tng-blue-500)] focus:outline-none focus:ring-2 focus:ring-[var(--tng-blue-500)]/20"
                        />
                    </div>
                </div>

                {/* Employee Data Table */}
                <div className="rounded-2xl border border-[var(--tng-slate-200)] bg-white shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-[var(--tng-slate-600)]">
                            <thead className="bg-[var(--tng-slate-50)] text-xs font-semibold uppercase text-[var(--tng-slate-500)] border-b border-[var(--tng-slate-200)]">
                                <tr>
                                    <th className="px-6 py-4">Employee Name</th>
                                    <th className="px-6 py-4">Role & Department</th>
                                    <th className="px-6 py-4">Contact Info</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--tng-slate-100)]">
                                {filteredEmployees.length > 0 ? filteredEmployees.map((emp) => (
                                    <tr key={emp.id} className="hover:bg-[var(--tng-slate-50)] transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-100 text-sm font-bold text-teal-700">
                                                    {emp.first_name[0]}{emp.last_name[0]}
                                                </div>
                                                <div>
                                                    <div className="font-semibold text-[var(--tng-slate-900)]">
                                                        {emp.last_name}, {emp.first_name} {emp.middle_name ? emp.middle_name[0] + '.' : ''}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-[var(--tng-slate-900)] font-medium">{emp.role?.role_name || 'No Role'}</div>
                                            <div className="text-[var(--tng-slate-500)] text-xs">{emp.department?.department_name || 'No Department'}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap space-y-1">
                                            <div className="flex items-center gap-2 text-[var(--tng-slate-600)]">
                                                <Mail className="h-3.5 w-3.5 text-[var(--tng-slate-400)]" />
                                                {emp.email}
                                            </div>
                                            {emp.mobile_number && (
                                                <div className="flex items-center gap-2 text-[var(--tng-slate-600)]">
                                                    <Phone className="h-3.5 w-3.5 text-[var(--tng-slate-400)]" />
                                                    {emp.mobile_number}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {emp.is_active ? (
                                                <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                                                    Active
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
                                                    Inactive
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                            <Link 
                                                href={`/hr/employees/${emp.id}/edit`}
                                                className="inline-block text-[var(--tng-blue-600)] hover:text-[var(--tng-blue-800)] p-1.5 rounded-md hover:bg-blue-50 transition-colors mr-2"
                                            >
                                                <Edit className="h-4 w-4" />
                                            </Link>
                                            <button 
                                                onClick={() => handleDelete(emp.id)}
                                                className="text-red-500 hover:text-red-700 p-1.5 rounded-md hover:bg-red-50 transition-colors"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-8 text-center text-[var(--tng-slate-500)]">
                                            No employees found. Try adjusting your search query.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </TrackngoLayout>
    );
}
