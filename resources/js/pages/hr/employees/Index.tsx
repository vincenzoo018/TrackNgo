import { Head, Link, router } from '@inertiajs/react';
import { Users, Search, Filter, UserPlus, Mail, Phone, Edit, Trash2, Building2, ShieldCheck, UserX } from 'lucide-react';
import TrackngoLayout from '@/layouts/trackngo/TrackngoLayout';
import { useState, useMemo } from 'react';
import TabNavigation, { TabItem } from '@/components/trackngo/TabNavigation';
import AddEmployeeModal from '@/components/AddEmployeeModal';
import TablePagination from '@/components/trackngo/TablePagination';
import TableActionButtons from '@/components/trackngo/TableActionButtons';
import { StatCard } from '@/components/trackngo/StatCard';

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

export default function EmployeeIndex({ dbEmployees, dbDepartments = [], dbRoles = [] }: Props) {
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState<'all' | 'active' | 'inactive'>('all');
    const [deptFilter, setDeptFilter] = useState('all');
    const [roleFilter, setRoleFilter] = useState('all');

    // Pagination state (default: 20 per page, with options for 50 or 100)
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);

    const tabCounts = useMemo(() => ({
        all: dbEmployees.length,
        active: dbEmployees.filter((e) => Boolean(e.is_active)).length,
        inactive: dbEmployees.filter((e) => !e.is_active).length,
    }), [dbEmployees]);

    const tabs: TabItem[] = [
        { id: 'all', label: 'All Employees', count: tabCounts.all },
        { id: 'active', label: 'Active', count: tabCounts.active },
        { id: 'inactive', label: 'Inactive', count: tabCounts.inactive },
    ];

    const filteredEmployees = useMemo(() => {
        return dbEmployees.filter((emp) => {
            if (activeTab === 'active' && !emp.is_active) return false;
            if (activeTab === 'inactive' && emp.is_active) return false;
            if (deptFilter !== 'all' && String(emp.department?.department_id) !== deptFilter) return false;
            if (roleFilter !== 'all' && String(emp.role?.role_id) !== roleFilter) return false;

            const q = searchQuery.toLowerCase();
            return (
                !q ||
                emp.first_name.toLowerCase().includes(q) ||
                emp.last_name.toLowerCase().includes(q) ||
                emp.email.toLowerCase().includes(q) ||
                (emp.department?.department_name || '').toLowerCase().includes(q)
            );
        });
    }, [dbEmployees, activeTab, deptFilter, roleFilter, searchQuery]);

    const paginatedEmployees = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredEmployees.slice(start, start + pageSize);
    }, [filteredEmployees, currentPage, pageSize]);

    const handleDelete = (id: number) => {
        if (confirm('Are you sure you want to delete this employee?')) {
            router.delete(`/hr/employees/${id}`);
        }
    };

    return (
        <TrackngoLayout>
            <Head title="Employee Records — TrackNGo Mati" />

            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-[20px] font-bold text-[var(--tng-slate-900)]">Employee Records</h1>
                        <p className="mt-0.5 text-sm text-[var(--tng-slate-500)]">
                            Manage employee information, departments, and personnel records
                        </p>
                    </div>
                    <button 
                        type="button"
                        onClick={() => setIsAddModalOpen(true)}
                        className="flex items-center gap-2 rounded-lg bg-[var(--tng-blue-600)] px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-600/25 transition-all hover:bg-[var(--tng-blue-700)] active:scale-[0.98] cursor-pointer"
                    >
                        <UserPlus className="h-4 w-4" />
                        Add Employee
                    </button>
                </div>

                {/* ── Summary Metric Cards (Standardized System Blue) ────────── */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
                    <StatCard
                        title="Total Employees"
                        value={tabCounts.all}
                        sublabel="Registered personnel"
                        icon={Users}
                        active={activeTab === 'all'}
                        onClick={() => {
                            setActiveTab('all');
                            setCurrentPage(1);
                        }}
                    />

                    <StatCard
                        title="Active Employees"
                        value={tabCounts.active}
                        sublabel="Currently on active duty"
                        icon={ShieldCheck}
                        active={activeTab === 'active'}
                        onClick={() => {
                            setActiveTab('active');
                            setCurrentPage(1);
                        }}
                    />

                    <StatCard
                        title="Inactive Employees"
                        value={tabCounts.inactive}
                        sublabel="On leave or inactive"
                        icon={UserX}
                        active={activeTab === 'inactive'}
                        onClick={() => {
                            setActiveTab('inactive');
                            setCurrentPage(1);
                        }}
                    />

                    <StatCard
                        title="Departments"
                        value={dbDepartments.length}
                        sublabel="Assigned municipal offices"
                        icon={Building2}
                        onClick={() => {
                            setDeptFilter('all');
                            setCurrentPage(1);
                        }}
                    />
                </div>

                {/* ── Tabbed Navigation ─────────────────────────────────────── */}
                <TabNavigation
                    tabs={tabs}
                    activeTab={activeTab}
                    onChange={(tabId) => setActiveTab(tabId as any)}
                />

                {/* ── Filters Toolbar ───────────────────────────────────────── */}
                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative flex-1 min-w-[250px] max-w-md">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--tng-slate-400)]" />
                        <input
                            type="text"
                            placeholder="Search by reference number, tracking number, type, or name..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="h-10 w-full rounded-lg border border-[var(--tng-slate-200)] bg-white pl-9 pr-4 text-sm text-[var(--tng-slate-700)] placeholder:text-[var(--tng-slate-400)] focus:border-[var(--tng-blue-500)] focus:outline-none focus:ring-2 focus:ring-[var(--tng-blue-500)]/20"
                        />
                    </div>

                    {/* Department Dropdown */}
                    <select
                        value={deptFilter}
                        onChange={(e) => setDeptFilter(e.target.value)}
                        className="rounded-lg border border-[var(--tng-slate-200)] bg-white px-3 py-2 text-sm text-[var(--tng-slate-600)] hover:border-[var(--tng-blue-300)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--tng-blue-500)]/20"
                    >
                        <option value="all">All Departments</option>
                        {dbDepartments.map((d: any) => (
                            <option key={d.department_id} value={String(d.department_id)}>{d.department_name}</option>
                        ))}
                    </select>

                    {/* Role Dropdown */}
                    <select
                        value={roleFilter}
                        onChange={(e) => setRoleFilter(e.target.value)}
                        className="rounded-lg border border-[var(--tng-slate-200)] bg-white px-3 py-2 text-sm text-[var(--tng-slate-600)] hover:border-[var(--tng-blue-300)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--tng-blue-500)]/20"
                    >
                        <option value="all">All Roles</option>
                        {dbRoles.map((r: any) => (
                            <option key={r.role_id} value={String(r.role_id)}>{r.role_name}</option>
                        ))}
                    </select>
                </div>

                {/* Employee Data Table */}
                <div className="w-full rounded-xl border border-[var(--tng-slate-200)] bg-white shadow-xs overflow-hidden">
                    <div className="overflow-x-auto w-full">
                        <table className="w-full text-left border-collapse text-[14px] text-[var(--tng-slate-700)]">
                            <thead className="bg-[var(--tng-slate-50)] border-b border-[var(--tng-slate-200)] text-xs font-medium text-slate-600">
                                <tr>
                                    <th className="px-6 py-2.5 text-left">Employee Name</th>
                                    <th className="px-6 py-2.5 text-left">Role & Department</th>
                                    <th className="px-6 py-2.5 text-left">Contact Info</th>
                                    <th className="px-6 py-2.5 text-left">Status</th>
                                    <th className="px-6 py-2.5 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--tng-slate-100)]">
                                {paginatedEmployees.length > 0 ? paginatedEmployees.map((emp) => (
                                    <tr key={emp.id} className="transition-colors odd:bg-white even:bg-slate-50/75 hover:bg-blue-50/40 group">
                                        <td className="px-6 py-3.5 whitespace-nowrap text-[14px] font-normal text-[var(--tng-slate-700)]">
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-100 text-[13px] font-bold text-teal-700">
                                                    {emp.first_name[0]}{emp.last_name[0]}
                                                </div>
                                                <div>
                                                    <div className="font-semibold text-[var(--tng-slate-900)] text-[14px]">
                                                        {emp.last_name}, {emp.first_name} {emp.middle_name ? emp.middle_name[0] + '.' : ''}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-3.5 whitespace-nowrap text-[14px] font-normal text-[var(--tng-slate-700)]">
                                            <div className="text-[var(--tng-slate-900)] font-medium text-[14px]">{emp.role?.role_name || 'No Role'}</div>
                                            <div className="text-[var(--tng-slate-500)] text-[12px]">{emp.department?.department_name || 'No Department'}</div>
                                        </td>
                                        <td className="px-6 py-3.5 whitespace-nowrap space-y-0.5 text-[14px] font-normal text-[var(--tng-slate-700)]">
                                            <div className="flex items-center gap-2 text-[var(--tng-slate-600)] text-[14px]">
                                                <Mail className="h-3.5 w-3.5 text-[var(--tng-slate-400)]" />
                                                {emp.email}
                                            </div>
                                            {emp.mobile_number && (
                                                <div className="flex items-center gap-2 text-[var(--tng-slate-600)] text-[14px]">
                                                    <Phone className="h-3.5 w-3.5 text-[var(--tng-slate-400)]" />
                                                    {emp.mobile_number}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-3.5 whitespace-nowrap">
                                            {emp.is_active ? (
                                                <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-1 text-[13px] font-bold text-emerald-700">
                                                    Active
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-1 text-[13px] font-bold text-red-700">
                                                    Inactive
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-3.5 whitespace-nowrap text-right">
                                            <TableActionButtons
                                                editHref={`/hr/employees/${emp.id}/edit`}
                                                editTitle="Edit Record"
                                                onDelete={() => handleDelete(emp.id)}
                                                deleteTitle="Delete Record"
                                            />
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-6 text-center text-[var(--tng-slate-500)] text-[14px]">
                                            No employees found. Try adjusting your search query.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <TablePagination
                        currentPage={currentPage}
                        pageSize={pageSize}
                        totalItems={filteredEmployees.length}
                        onPageChange={setCurrentPage}
                        onPageSizeChange={setPageSize}
                        itemLabel="employees"
                    />
                </div>
            </div>

            <AddEmployeeModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                departments={dbDepartments}
                roles={dbRoles}
            />
        </TrackngoLayout>
    );
}
