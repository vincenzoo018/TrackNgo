import { Head } from '@inertiajs/react';
import { Users, Building2, FileText, Search, UserPlus, Plus, Pencil, UserX, UserCheck, Key } from 'lucide-react';
import { useState } from 'react';
import TrackngoLayout from '@/layouts/trackngo/TrackngoLayout';
import { mockUsers, mockDepartments, mockDocumentTypes } from '@/lib/mock-data';

export default function SystemConfiguration() {
    const [activeTab, setActiveTab] = useState<'users' | 'departments' | 'categories'>('users');

    return (
        <TrackngoLayout role="admin">
            <Head title="System Configuration" />

            <div className="mb-8">
                <h1 className="text-2xl font-bold tracking-tight text-[var(--tng-slate-900)]">System Configuration</h1>
                <p className="mt-1 text-[var(--tng-slate-500)]">Manage user accounts, departments, and document categories</p>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b-2 border-[var(--tng-slate-200)] mb-6">
                <button
                    onClick={() => setActiveTab('users')}
                    className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                        activeTab === 'users'
                            ? 'border-b-2 border-[var(--tng-blue-600)] text-[var(--tng-blue-600)] -mb-[2px]'
                            : 'text-[var(--tng-slate-500)] hover:text-[var(--tng-slate-700)]'
                    }`}
                >
                    <Users className="w-4 h-4" /> Users
                </button>
                <button
                    onClick={() => setActiveTab('departments')}
                    className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                        activeTab === 'departments'
                            ? 'border-b-2 border-[var(--tng-blue-600)] text-[var(--tng-blue-600)] -mb-[2px]'
                            : 'text-[var(--tng-slate-500)] hover:text-[var(--tng-slate-700)]'
                    }`}
                >
                    <Building2 className="w-4 h-4" /> Departments
                </button>
                <button
                    onClick={() => setActiveTab('categories')}
                    className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                        activeTab === 'categories'
                            ? 'border-b-2 border-[var(--tng-blue-600)] text-[var(--tng-blue-600)] -mb-[2px]'
                            : 'text-[var(--tng-slate-500)] hover:text-[var(--tng-slate-700)]'
                    }`}
                >
                    <FileText className="w-4 h-4" /> Document Types
                </button>
            </div>

            {/* Users Tab */}
            {activeTab === 'users' && (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="flex justify-between items-center mb-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--tng-slate-400)]" />
                            <input
                                type="text"
                                placeholder="Search by reference number, tracking number, type, or name..."
                                className="pl-9 pr-4 py-2 w-80 rounded-md border border-[var(--tng-slate-200)] focus:border-[var(--tng-blue-600)] focus:ring-1 focus:ring-[var(--tng-blue-600)] outline-none text-sm"
                            />
                        </div>
                        <button className="flex items-center gap-2 bg-[var(--tng-blue-600)] text-white px-4 py-2 rounded-md hover:bg-[var(--tng-blue-700)] transition-colors text-sm font-medium shadow-sm">
                            <UserPlus className="w-4 h-4" /> Add User
                        </button>
                    </div>

                    <div className="w-full rounded-xl border border-[var(--tng-slate-200)] bg-white shadow-xs overflow-hidden">
                        <div className="overflow-x-auto w-full">
                            <table className="w-full text-left border-collapse text-[14px] text-slate-700">
                                <thead className="bg-[var(--tng-slate-50)] border-b border-[var(--tng-slate-200)]">
                                    <tr>
                                        <th className="px-6 py-2.5 text-xs font-medium text-slate-600">Name</th>
                                        <th className="px-6 py-2.5 text-xs font-medium text-slate-600">Email</th>
                                        <th className="px-6 py-2.5 text-xs font-medium text-slate-600">Role</th>
                                        <th className="px-6 py-2.5 text-xs font-medium text-slate-600">Department</th>
                                        <th className="px-6 py-2.5 text-xs font-medium text-slate-600">Status</th>
                                        <th className="px-6 py-2.5 text-xs font-medium text-slate-600 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--tng-slate-100)]">
                                    {mockUsers.map((user) => (
                                        <tr key={user.id} className="transition-colors odd:bg-white even:bg-slate-50/75 hover:bg-blue-50/40 group">
                                            <td className="px-6 py-3.5 font-semibold text-slate-900 text-[14px]">{user.name}</td>
                                            <td className="px-6 py-3.5 font-mono text-[14px] text-slate-600">{user.email}</td>
                                            <td className="px-6 py-3.5 text-[14px]">
                                                <span className="inline-flex items-center rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-[13px] font-bold text-blue-700 capitalize">
                                                    {user.role.replace('_', ' ')}
                                                </span>
                                            </td>
                                            <td className="px-6 py-3.5 text-[14px] text-slate-700">{user.department?.name || '—'}</td>
                                            <td className="px-6 py-3.5 whitespace-nowrap">
                                                {user.is_active ? (
                                                    <span className="inline-flex items-center rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-[13px] font-bold text-emerald-700">
                                                        Active
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center rounded-full bg-rose-50 border border-rose-200 px-2.5 py-1 text-[13px] font-bold text-rose-700">
                                                        Inactive
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-3.5 text-right whitespace-nowrap">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit">
                                                        <Pencil className="h-[18px] w-[18px]" />
                                                    </button>
                                                    <button className={`p-1.5 rounded-lg transition-colors ${user.is_active ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50' : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'}`} title={user.is_active ? "Deactivate" : "Activate"}>
                                                        {user.is_active ? <UserX className="h-[18px] w-[18px]" /> : <UserCheck className="h-[18px] w-[18px]" />}
                                                    </button>
                                                    <button className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title="Reset Password">
                                                        <Key className="h-[18px] w-[18px]" />
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
            )}

            {/* Departments Tab */}
            {activeTab === 'departments' && (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="flex justify-end mb-4">
                        <button className="flex items-center gap-2 bg-[var(--tng-blue-600)] text-white px-4 py-2 rounded-md hover:bg-[var(--tng-blue-700)] transition-colors text-sm font-medium shadow-sm">
                            <Plus className="w-4 h-4" /> Add Department
                        </button>
                    </div>

                    <div className="w-full rounded-xl border border-[var(--tng-slate-200)] bg-white shadow-xs overflow-hidden">
                        <div className="overflow-x-auto w-full">
                            <table className="w-full text-left border-collapse text-[14px] text-slate-700">
                                <thead className="bg-[var(--tng-slate-50)] border-b border-[var(--tng-slate-200)]">
                                    <tr>
                                        <th className="px-6 py-2.5 text-xs font-medium text-slate-600">Code</th>
                                        <th className="px-6 py-2.5 text-xs font-medium text-slate-600">Department Name</th>
                                        <th className="px-6 py-2.5 text-xs font-medium text-slate-600">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--tng-slate-100)]">
                                    {mockDepartments.map((dept) => (
                                        <tr key={dept.id} className="transition-colors odd:bg-white even:bg-slate-50/75 hover:bg-blue-50/40 group">
                                            <td className="px-6 py-3.5">
                                                <span className="font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[13px]">
                                                    {dept.code}
                                                </span>
                                            </td>
                                            <td className="px-6 py-3.5 font-semibold text-slate-900 text-[14px]">{dept.name}</td>
                                            <td className="px-6 py-3.5 whitespace-nowrap">
                                                <span className="inline-flex items-center rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-[13px] font-bold text-emerald-700">
                                                    Active
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Categories Tab */}
            {activeTab === 'categories' && (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="flex justify-end mb-4">
                        <button className="flex items-center gap-2 bg-[var(--tng-blue-600)] text-white px-4 py-2 rounded-md hover:bg-[var(--tng-blue-700)] transition-colors text-sm font-medium shadow-sm">
                            <Plus className="w-4 h-4" /> Add Document Type
                        </button>
                    </div>

                    <div className="w-full rounded-xl border border-[var(--tng-slate-200)] bg-white shadow-xs overflow-hidden">
                        <div className="overflow-x-auto w-full">
                            <table className="w-full text-left border-collapse text-[14px] text-slate-700">
                                <thead className="bg-[var(--tng-slate-50)] border-b border-[var(--tng-slate-200)]">
                                    <tr>
                                        <th className="px-6 py-2.5 text-xs font-medium text-slate-600">Type Name</th>
                                        <th className="px-6 py-2.5 text-xs font-medium text-slate-600">ARTA Limit</th>
                                        <th className="px-6 py-2.5 text-xs font-medium text-slate-600">ARTA Tier</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--tng-slate-100)]">
                                    {mockDocumentTypes.map((type) => (
                                        <tr key={type.id} className="transition-colors odd:bg-white even:bg-slate-50/75 hover:bg-blue-50/40 group">
                                            <td className="px-6 py-3.5 font-semibold text-slate-900 text-[14px]">{type.name}</td>
                                            <td className="px-6 py-3.5 text-[14px] text-slate-700">{type.arta_processing_days} days</td>
                                            <td className="px-6 py-3.5 whitespace-nowrap">
                                                {type.arta_processing_days <= 3 ? (
                                                    <span className="inline-flex items-center rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-[13px] font-bold text-emerald-700">Simple</span>
                                                ) : type.arta_processing_days <= 7 ? (
                                                    <span className="inline-flex items-center rounded-full bg-amber-50 border border-amber-200 px-2.5 py-1 text-[13px] font-bold text-amber-700">Complex</span>
                                                ) : (
                                                    <span className="inline-flex items-center rounded-full bg-rose-50 border border-rose-200 px-2.5 py-1 text-[13px] font-bold text-rose-700">Highly Technical</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </TrackngoLayout>
    );
}
