import { Head } from '@inertiajs/react';
import { Users, Search, Filter, UserPlus, Mail, Phone } from 'lucide-react';
import TrackngoLayout from '@/layouts/trackngo/TrackngoLayout';

const mockEmployees = [
    { id: 1, name: 'Juan Dela Cruz', department: 'City Engineering Office', position: 'Senior Engineer', status: 'active', email: 'juan@mati.com', phone: '09171234567' },
    { id: 2, name: 'Maria Santos', department: 'Admin Office', position: 'Administrative Officer', status: 'active', email: 'maria@mati.com', phone: '09181234567' },
    { id: 3, name: 'Pedro Reyes', department: 'IT Department', position: 'IT Specialist', status: 'active', email: 'pedro@mati.com', phone: '09191234567' },
    { id: 4, name: 'Ana Garcia', department: 'Finance Office', position: 'Accountant', status: 'on_leave', email: 'ana@mati.com', phone: '09201234567' },
    { id: 5, name: 'Jose Mendoza', department: 'Planning & Development', position: 'Project Officer', status: 'active', email: 'jose@mati.com', phone: '09211234567' },
    { id: 6, name: 'Carmen Lopez', department: 'Social Welfare', position: 'Social Worker', status: 'active', email: 'carmen@mati.com', phone: '09221234567' },
];

const statusStyles: Record<string, { bg: string; text: string; label: string }> = {
    active: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Active' },
    on_leave: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'On Leave' },
    inactive: { bg: 'bg-red-100', text: 'text-red-700', label: 'Inactive' },
};

export default function EmployeeIndex() {
    return (
        <TrackngoLayout>
            <Head title="Employee Records — TrackNGo Mati" />

            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-[var(--tng-slate-900)]">Employee Records</h1>
                        <p className="mt-0.5 text-sm text-[var(--tng-slate-500)]">
                            Manage employee information and personnel records
                        </p>
                    </div>
                    <button className="flex items-center gap-2 rounded-lg bg-[var(--tng-blue-600)] px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-600/25 transition-all hover:bg-[var(--tng-blue-700)]">
                        <UserPlus className="h-4 w-4" />
                        Add Employee
                    </button>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative flex-1 min-w-[250px] max-w-md">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--tng-slate-400)]" />
                        <input
                            type="text"
                            placeholder="Search employees..."
                            className="h-10 w-full rounded-lg border border-[var(--tng-slate-200)] bg-white pl-9 pr-4 text-sm text-[var(--tng-slate-700)] placeholder:text-[var(--tng-slate-400)] focus:border-[var(--tng-blue-500)] focus:outline-none focus:ring-2 focus:ring-[var(--tng-blue-500)]/20"
                        />
                    </div>
                    <button className="flex items-center gap-2 rounded-lg border border-[var(--tng-slate-200)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--tng-slate-600)] hover:bg-[var(--tng-slate-50)]">
                        <Filter className="h-4 w-4" />
                        Department
                    </button>
                    <button className="flex items-center gap-2 rounded-lg border border-[var(--tng-slate-200)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--tng-slate-600)] hover:bg-[var(--tng-slate-50)]">
                        <Filter className="h-4 w-4" />
                        Status
                    </button>
                </div>

                {/* Employee Cards */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {mockEmployees.map((emp) => {
                        const status = statusStyles[emp.status] ?? statusStyles.active;
                        return (
                            <div key={emp.id} className="rounded-2xl border border-[var(--tng-slate-200)] bg-white p-6 shadow-sm transition-all hover:shadow-md hover:border-[var(--tng-blue-200)] cursor-pointer">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-teal-100 text-sm font-bold text-teal-700">
                                            {emp.name.split(' ').map(n => n[0]).join('')}
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-semibold text-[var(--tng-slate-900)]">{emp.name}</h3>
                                            <p className="text-xs text-[var(--tng-slate-500)]">{emp.position}</p>
                                        </div>
                                    </div>
                                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${status.bg} ${status.text}`}>
                                        {status.label}
                                    </span>
                                </div>
                                <div className="mt-4 space-y-2 border-t border-[var(--tng-slate-100)] pt-4">
                                    <p className="text-xs text-[var(--tng-slate-600)]">
                                        <span className="font-medium text-[var(--tng-slate-700)]">Department:</span> {emp.department}
                                    </p>
                                    <div className="flex items-center gap-1 text-xs text-[var(--tng-slate-500)]">
                                        <Mail className="h-3 w-3" />
                                        {emp.email}
                                    </div>
                                    <div className="flex items-center gap-1 text-xs text-[var(--tng-slate-500)]">
                                        <Phone className="h-3 w-3" />
                                        {emp.phone}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </TrackngoLayout>
    );
}
