import { Head, Link } from '@inertiajs/react';
import TrackngoLayout from '@/layouts/trackngo/TrackngoLayout';
import { Users, Search, Plus, Filter, MoreVertical, Edit2, ShieldBan, ShieldCheck } from 'lucide-react';
import { useState } from 'react';

const mockUsers = [
    { id: 1, name: 'Mayor Michelle N. Rabat', email: 'mayor@maticity.gov.ph', role: 'Mayor', department: 'Office of the Mayor', status: 'active', avatar: 'MR' },
    { id: 2, name: 'Atty. Maria Elena', email: 'legal@maticity.gov.ph', role: 'Department Head', department: 'City Legal Office', status: 'active', avatar: 'ME' },
    { id: 3, name: 'Engr. Juan Dela Cruz', email: 'engineering@maticity.gov.ph', role: 'Department Head', department: 'City Engineering Office', status: 'active', avatar: 'JC' },
    { id: 4, name: 'CART Officer Anna', email: 'cart@maticity.gov.ph', role: 'CART', department: 'Anti-Red Tape Authority', status: 'active', avatar: 'CA' },
    { id: 5, name: 'Receiving Clerk 1', email: 'receiving@maticity.gov.ph', role: 'Receiving Clerk', department: 'Records Division', status: 'active', avatar: 'RC' },
    { id: 6, name: 'Former Employee', email: 'inactive@maticity.gov.ph', role: 'Department Head', department: 'City Planning', status: 'inactive', avatar: 'FE' },
];

export default function UserAccounts() {
    const [searchQuery, setSearchQuery] = useState('');

    const filteredUsers = mockUsers.filter(u => 
        u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        u.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.department.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <TrackngoLayout>
            <Head title="User Accounts — TrackNGo Mati" />

            <div className="flex h-[calc(100vh-140px)] flex-col space-y-6 overflow-y-auto tng-scrollbar pb-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between shrink-0 gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-[var(--tng-slate-900)] flex items-center gap-2">
                            <Users className="h-6 w-6 text-[var(--tng-blue-600)]" />
                            User Accounts Management
                        </h1>
                        <p className="mt-0.5 text-sm text-[var(--tng-slate-500)]">
                            Manage LGU employees, assign role-based access, and configure departments.
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button className="flex items-center gap-2 rounded-lg border border-[var(--tng-slate-200)] bg-white px-4 py-2 text-sm font-medium text-[var(--tng-slate-700)] hover:bg-[var(--tng-slate-50)] transition-colors">
                            <Filter className="h-4 w-4" /> Filter Roles
                        </button>
                        <Link href="/admin/users/create" className="flex items-center gap-2 rounded-lg bg-[var(--tng-blue-600)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--tng-blue-700)] transition-colors shadow-md">
                            <Plus className="h-4 w-4" /> Add New User
                        </Link>
                    </div>
                </div>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--tng-slate-400)]" />
                    <input
                        type="text"
                        placeholder="Search by name, role, or department..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full rounded-xl border border-[var(--tng-slate-200)] bg-white py-3.5 pl-10 pr-4 text-sm outline-none transition-all placeholder:text-[var(--tng-slate-400)] focus:border-[var(--tng-blue-500)] focus:ring-4 focus:ring-[var(--tng-blue-500)]/10"
                    />
                </div>

                {/* Table */}
                <div className="overflow-hidden rounded-xl border border-[var(--tng-slate-200)] bg-white">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-[var(--tng-slate-600)]">
                            <thead className="bg-[var(--tng-slate-50)] text-xs uppercase text-[var(--tng-slate-500)] border-b border-[var(--tng-slate-200)]">
                                <tr>
                                    <th className="px-6 py-4 font-semibold">User</th>
                                    <th className="px-6 py-4 font-semibold">Role Access</th>
                                    <th className="px-6 py-4 font-semibold">Department</th>
                                    <th className="px-6 py-4 font-semibold">Status</th>
                                    <th className="px-6 py-4 font-semibold text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--tng-slate-100)]">
                                {filteredUsers.map((user) => (
                                    <tr key={user.id} className="group transition-colors hover:bg-[var(--tng-blue-50)]/50">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-bold text-white shadow-sm ${user.status === 'active' ? 'bg-[var(--tng-blue-600)]' : 'bg-[var(--tng-slate-400)]'}`}>
                                                    {user.avatar}
                                                </div>
                                                <div>
                                                    <div className="font-semibold text-[var(--tng-slate-900)]">{user.name}</div>
                                                    <div className="text-xs text-[var(--tng-slate-500)]">{user.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="inline-flex rounded-full bg-[var(--tng-purple-100)] px-2.5 py-0.5 text-xs font-semibold text-[var(--tng-purple-700)] border border-[var(--tng-purple-200)]">
                                                {user.role}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 font-medium">{user.department}</td>
                                        <td className="px-6 py-4">
                                            {user.status === 'active' ? (
                                                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                                                    <ShieldCheck className="h-3.5 w-3.5" /> Active
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">
                                                    <ShieldBan className="h-3.5 w-3.5" /> Inactive
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button className="rounded p-1.5 text-[var(--tng-slate-400)] hover:bg-[var(--tng-slate-100)] hover:text-[var(--tng-blue-600)] transition-colors">
                                                    <Edit2 className="h-4 w-4" />
                                                </button>
                                                <button className="rounded p-1.5 text-[var(--tng-slate-400)] hover:bg-[var(--tng-slate-100)] hover:text-red-600 transition-colors">
                                                    <MoreVertical className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </TrackngoLayout>
    );
}
