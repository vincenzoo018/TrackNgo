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
                                placeholder="Search users..."
                                className="pl-9 pr-4 py-2 w-64 rounded-md border border-[var(--tng-slate-200)] focus:border-[var(--tng-blue-600)] focus:ring-1 focus:ring-[var(--tng-blue-600)] outline-none text-sm"
                            />
                        </div>
                        <button className="flex items-center gap-2 bg-[var(--tng-blue-600)] text-white px-4 py-2 rounded-md hover:bg-[var(--tng-blue-700)] transition-colors text-sm font-medium shadow-sm">
                            <UserPlus className="w-4 h-4" /> Add User
                        </button>
                    </div>

                    <div className="bg-white rounded-xl border border-[var(--tng-slate-200)] shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-[var(--tng-slate-600)]">
                                <thead className="bg-[var(--tng-slate-50)] text-[var(--tng-slate-500)] border-b border-[var(--tng-slate-200)]">
                                    <tr>
                                        <th className="px-6 py-4 font-semibold">Name</th>
                                        <th className="px-6 py-4 font-semibold">Email</th>
                                        <th className="px-6 py-4 font-semibold">Role</th>
                                        <th className="px-6 py-4 font-semibold">Department</th>
                                        <th className="px-6 py-4 font-semibold">Status</th>
                                        <th className="px-6 py-4 font-semibold text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--tng-slate-200)]">
                                    {mockUsers.map((user) => (
                                        <tr key={user.id} className="hover:bg-[var(--tng-slate-50)] transition-colors">
                                            <td className="px-6 py-4 font-medium text-[var(--tng-slate-900)]">{user.name}</td>
                                            <td className="px-6 py-4 font-mono text-xs">{user.email}</td>
                                            <td className="px-6 py-4">
                                                <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10 capitalize">
                                                    {user.role.replace('_', ' ')}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">{user.department?.name || '—'}</td>
                                            <td className="px-6 py-4">
                                                {user.is_active ? (
                                                    <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                                                        Active
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/10">
                                                        Inactive
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button className="p-2 text-[var(--tng-slate-400)] hover:text-[var(--tng-blue-600)] hover:bg-blue-50 rounded-md transition-colors" title="Edit">
                                                        <Pencil className="w-4 h-4" />
                                                    </button>
                                                    <button className={`p-2 rounded-md transition-colors ${user.is_active ? 'text-[var(--tng-slate-400)] hover:text-red-600 hover:bg-red-50' : 'text-[var(--tng-slate-400)] hover:text-emerald-600 hover:bg-emerald-50'}`} title={user.is_active ? "Deactivate" : "Activate"}>
                                                        {user.is_active ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                                                    </button>
                                                    <button className="p-2 text-[var(--tng-slate-400)] hover:text-amber-600 hover:bg-amber-50 rounded-md transition-colors" title="Reset Password">
                                                        <Key className="w-4 h-4" />
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

                    <div className="bg-white rounded-xl border border-[var(--tng-slate-200)] shadow-sm overflow-hidden">
                        <table className="w-full text-left text-sm text-[var(--tng-slate-600)]">
                            <thead className="bg-[var(--tng-slate-50)] text-[var(--tng-slate-500)] border-b border-[var(--tng-slate-200)]">
                                <tr>
                                    <th className="px-6 py-4 font-semibold">Code</th>
                                    <th className="px-6 py-4 font-semibold">Department Name</th>
                                    <th className="px-6 py-4 font-semibold">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--tng-slate-200)]">
                                {mockDepartments.map((dept) => (
                                    <tr key={dept.id} className="hover:bg-[var(--tng-slate-50)] transition-colors">
                                        <td className="px-6 py-4">
                                            <span className="font-medium text-[var(--tng-slate-700)] bg-[var(--tng-slate-100)] px-2 py-1 rounded">
                                                {dept.code}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 font-medium text-[var(--tng-slate-900)]">{dept.name}</td>
                                        <td className="px-6 py-4">
                                            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                                                Active
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
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

                    <div className="bg-white rounded-xl border border-[var(--tng-slate-200)] shadow-sm overflow-hidden">
                        <table className="w-full text-left text-sm text-[var(--tng-slate-600)]">
                            <thead className="bg-[var(--tng-slate-50)] text-[var(--tng-slate-500)] border-b border-[var(--tng-slate-200)]">
                                <tr>
                                    <th className="px-6 py-4 font-semibold">Type Name</th>
                                    <th className="px-6 py-4 font-semibold">ARTA Limit</th>
                                    <th className="px-6 py-4 font-semibold">ARTA Tier</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--tng-slate-200)]">
                                {mockDocumentTypes.map((type) => (
                                    <tr key={type.id} className="hover:bg-[var(--tng-slate-50)] transition-colors">
                                        <td className="px-6 py-4 font-medium text-[var(--tng-slate-900)]">{type.name}</td>
                                        <td className="px-6 py-4">{type.arta_processing_days} days</td>
                                        <td className="px-6 py-4">
                                            {type.arta_processing_days <= 3 ? (
                                                <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">Simple</span>
                                            ) : type.arta_processing_days <= 7 ? (
                                                <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">Complex</span>
                                            ) : (
                                                <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/10">Highly Technical</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </TrackngoLayout>
    );
}
