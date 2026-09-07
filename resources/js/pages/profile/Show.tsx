import { Head, useForm, usePage } from '@inertiajs/react';
import { User, Mail, Building, KeyRound, Save, CheckCircle2, History, X } from 'lucide-react';
import TrackngoLayout from '@/layouts/trackngo/TrackngoLayout';
import { ROLE_LABELS } from '@/types/trackngo';
import type { UserRole } from '@/types/trackngo';
import { cn } from '@/lib/utils';
import { CollapsiblePanel } from '@/components/trackngo/CollapsiblePanel';

// ── Role avatar colors ──────────────────────────────────────────────
const ROLE_COLORS: Record<string, string> = {
    admin: 'bg-purple-600',
    receiving: 'bg-blue-600',
    department_head: 'bg-emerald-600',
    mayor: 'bg-amber-600',
    cart: 'bg-rose-600',
    hr: 'bg-teal-600',
};

export default function ProfileShow() {
    const { props } = usePage<any>();
    const user = props.user;
    const recentActivity = props.recentActivity || [];
    
    const roleKey = user.role?.role_name?.toLowerCase().replace(' ', '_') || props.auth.user.role;
    const userRole = roleKey as UserRole;
    
    // Ensure we handle case where user structure varies
    const firstName = user.first_name || user.name?.split(' ')[0] || '';
    const lastName = user.last_name || user.name?.split(' ').slice(1).join(' ') || '';
    const middleName = user.middle_name || '';

    const roleLabel = ROLE_LABELS[userRole] ?? user.role?.role_name ?? 'User';
    const deptName = user.department?.department_name ?? 'Not Assigned';

    const roles = props.roles || [];
    const departments = props.departments || [];

    // Form for Profile Info
    const profileForm = useForm({
        first_name: firstName,
        last_name: lastName,
        middle_name: middleName,
        email: user.email,
        mobile_number: user.mobile_number || '',
        role_id: user.role_id || '',
        department_id: user.department_id || '',
    });

    const updateProfile = (e: React.FormEvent) => {
        e.preventDefault();
        profileForm.put(route('profile.update'), {
            preserveScroll: true,
        });
    };

    // Form for Password Update
    const passwordForm = useForm({
        current_password: '',
        password: '',
        password_confirmation: '',
    });

    const updatePassword = (e: React.FormEvent) => {
        e.preventDefault();
        passwordForm.put(route('profile.password'), {
            preserveScroll: true,
            onSuccess: () => passwordForm.reset(),
        });
    };

    return (
        <TrackngoLayout
            breadcrumbs={[
                { title: 'Home', href: '#' },
                { title: 'My Profile', href: '/profile' },
            ]}
        >
            <Head title="My Profile — TrackNGo Mati" />

            <div className="relative min-h-[calc(100vh-8.5rem)] pb-24">
                <div className="mx-auto max-w-5xl space-y-8 p-4 lg:p-6">
                    <div>
                        <h1 className="text-xl font-bold text-[var(--tng-slate-900)]">
                            My Profile
                        </h1>
                        <p className="mt-1 text-sm text-[var(--tng-slate-500)]">
                            Manage your personal information, security settings, and view recent activity.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
                        
                        {/* Left Column: Avatar & Summary */}
                        <div className="md:col-span-1 space-y-6">
                            <div className="rounded-xl border border-[var(--tng-slate-200)] bg-white overflow-hidden text-center shadow-sm">
                                <div className="h-24 bg-[var(--tng-slate-100)]" />
                                <div className="relative -mt-12 mb-4 flex justify-center">
                                    <div className={cn(
                                        'flex h-24 w-24 items-center justify-center rounded-full text-3xl font-bold text-white border-4 border-white shadow-sm',
                                        ROLE_COLORS[userRole] ?? 'bg-[var(--tng-blue-600)]',
                                    )}>
                                        {(firstName.charAt(0) || user.name?.charAt(0) || 'U').toUpperCase()}
                                    </div>
                                </div>
                                <div className="px-6 pb-6">
                                    <h2 className="text-lg font-semibold text-[var(--tng-slate-900)]">
                                        {profileForm.data.first_name} {profileForm.data.last_name}
                                    </h2>
                                    <p className="text-sm font-medium text-[var(--tng-slate-500)] mb-4">{roleLabel}</p>
                                    
                                    <div className="space-y-3 text-left">
                                        <div className="flex items-center gap-3 text-sm text-[var(--tng-slate-700)]">
                                            <Building className="h-4 w-4 text-[var(--tng-slate-400)] shrink-0" />
                                            <span className="truncate">{deptName}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right Column: Edit Forms & Activity */}
                        <div className="md:col-span-2 space-y-8">
                            
                            {/* Personal Information */}
                            <form id="profile-form" onSubmit={updateProfile} className="space-y-6 rounded-xl border border-[var(--tng-slate-200)] bg-white p-6 shadow-sm">
                                <h2 className="text-lg font-semibold text-[var(--tng-slate-900)] flex items-center gap-2">
                                    <User className="h-5 w-5 text-[var(--tng-slate-500)]" />
                                    Personal Information
                                </h2>
                                
                                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                                    <div>
                                        <label className="mb-1.5 block text-base font-medium text-[var(--tng-slate-700)]">
                                            First Name
                                        </label>
                                        <input
                                            type="text"
                                            value={profileForm.data.first_name}
                                            onChange={(e) => profileForm.setData('first_name', e.target.value)}
                                            className="w-full rounded-lg border border-[var(--tng-slate-200)] bg-white px-4 py-2 text-sm text-[var(--tng-slate-900)] focus:border-[var(--tng-blue-500)] focus:outline-none focus:ring-2 focus:ring-[var(--tng-blue-500)]/20"
                                        />
                                        {profileForm.errors.first_name && <p className="mt-1 text-sm text-red-600">{profileForm.errors.first_name}</p>}
                                    </div>
                                    <div>
                                        <label className="mb-1.5 block text-base font-medium text-[var(--tng-slate-700)]">
                                            Last Name
                                        </label>
                                        <input
                                            type="text"
                                            value={profileForm.data.last_name}
                                            onChange={(e) => profileForm.setData('last_name', e.target.value)}
                                            className="w-full rounded-lg border border-[var(--tng-slate-200)] bg-white px-4 py-2 text-sm text-[var(--tng-slate-900)] focus:border-[var(--tng-blue-500)] focus:outline-none focus:ring-2 focus:ring-[var(--tng-blue-500)]/20"
                                        />
                                        {profileForm.errors.last_name && <p className="mt-1 text-sm text-red-600">{profileForm.errors.last_name}</p>}
                                    </div>
                                    <div>
                                        <label className="mb-1.5 block text-base font-medium text-[var(--tng-slate-700)]">
                                            Middle Name
                                        </label>
                                        <input
                                            type="text"
                                            value={profileForm.data.middle_name}
                                            onChange={(e) => profileForm.setData('middle_name', e.target.value)}
                                            className="w-full rounded-lg border border-[var(--tng-slate-200)] bg-white px-4 py-2 text-sm text-[var(--tng-slate-900)] focus:border-[var(--tng-blue-500)] focus:outline-none focus:ring-2 focus:ring-[var(--tng-blue-500)]/20"
                                        />
                                        {profileForm.errors.middle_name && <p className="mt-1 text-sm text-red-600">{profileForm.errors.middle_name}</p>}
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="mb-1.5 block text-base font-medium text-[var(--tng-slate-700)]">
                                            Email Address
                                        </label>
                                        <div className="relative">
                                            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--tng-slate-400)]" />
                                            <input
                                                type="email"
                                                value={profileForm.data.email}
                                                onChange={(e) => profileForm.setData('email', e.target.value)}
                                                className="w-full rounded-lg border border-[var(--tng-slate-200)] bg-white pl-10 pr-4 py-2 text-sm text-[var(--tng-slate-900)] focus:border-[var(--tng-blue-500)] focus:outline-none focus:ring-2 focus:ring-[var(--tng-blue-500)]/20"
                                            />
                                        </div>
                                        {profileForm.errors.email && <p className="mt-1 text-sm text-red-600">{profileForm.errors.email}</p>}
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="mb-1.5 block text-base font-medium text-[var(--tng-slate-700)]">
                                            Contact Number
                                        </label>
                                        <input
                                            type="text"
                                            value={profileForm.data.mobile_number}
                                            onChange={(e) => profileForm.setData('mobile_number', e.target.value)}
                                            className="w-full rounded-lg border border-[var(--tng-slate-200)] bg-white px-4 py-2 text-sm text-[var(--tng-slate-900)] focus:border-[var(--tng-blue-500)] focus:outline-none focus:ring-2 focus:ring-[var(--tng-blue-500)]/20"
                                            placeholder="+63 9XX XXX XXXX"
                                        />
                                        {profileForm.errors.mobile_number && <p className="mt-1 text-sm text-red-600">{profileForm.errors.mobile_number}</p>}
                                    </div>
                                    <div>
                                        <label className="mb-1.5 block text-base font-medium text-[var(--tng-slate-700)]">
                                            Department
                                        </label>
                                        <select
                                            value={profileForm.data.department_id}
                                            onChange={(e) => profileForm.setData('department_id', e.target.value)}
                                            className="w-full rounded-lg border border-[var(--tng-slate-200)] bg-white px-4 py-2 text-sm text-[var(--tng-slate-900)] focus:border-[var(--tng-blue-500)] focus:outline-none focus:ring-2 focus:ring-[var(--tng-blue-500)]/20"
                                        >
                                            <option value="">Select Department</option>
                                            {departments.map((dept: any) => (
                                                <option key={dept.department_id} value={dept.department_id}>
                                                    {dept.department_name}
                                                </option>
                                            ))}
                                        </select>
                                        {profileForm.errors.department_id && <p className="mt-1 text-sm text-red-600">{profileForm.errors.department_id}</p>}
                                    </div>
                                    <div>
                                        <label className="mb-1.5 block text-base font-medium text-[var(--tng-slate-700)]">
                                            Role
                                        </label>
                                        <select
                                            value={profileForm.data.role_id}
                                            onChange={(e) => profileForm.setData('role_id', e.target.value)}
                                            className="w-full rounded-lg border border-[var(--tng-slate-200)] bg-white px-4 py-2 text-sm text-[var(--tng-slate-900)] focus:border-[var(--tng-blue-500)] focus:outline-none focus:ring-2 focus:ring-[var(--tng-blue-500)]/20"
                                        >
                                            <option value="">Select Role</option>
                                            {roles.map((r: any) => (
                                                <option key={r.role_id} value={r.role_id}>
                                                    {r.role_name}
                                                </option>
                                            ))}
                                        </select>
                                        {profileForm.errors.role_id && <p className="mt-1 text-sm text-red-600">{profileForm.errors.role_id}</p>}
                                    </div>
                                </div>
                            </form>

                            {/* Account Settings */}
                            <CollapsiblePanel 
                                title={
                                    <div className="flex items-center gap-2 text-lg font-semibold text-[var(--tng-slate-900)]">
                                        <KeyRound className="h-5 w-5 text-[var(--tng-slate-500)]" />
                                        Change Password
                                    </div>
                                } 
                                defaultExpanded={false}
                            >
                                <form onSubmit={updatePassword} className="space-y-6">
                                    <div>
                                        <label className="mb-1.5 block text-base font-medium text-[var(--tng-slate-700)]">
                                            Current Password
                                        </label>
                                        <input
                                            type="password"
                                            value={passwordForm.data.current_password}
                                            onChange={(e) => passwordForm.setData('current_password', e.target.value)}
                                            className="w-full rounded-lg border border-[var(--tng-slate-200)] bg-white px-4 py-2 text-sm text-[var(--tng-slate-900)] focus:border-[var(--tng-blue-500)] focus:outline-none focus:ring-2 focus:ring-[var(--tng-blue-500)]/20"
                                        />
                                        {passwordForm.errors.current_password && <p className="mt-1 text-sm text-red-600">{passwordForm.errors.current_password}</p>}
                                    </div>

                                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                                        <div>
                                            <label className="mb-1.5 block text-base font-medium text-[var(--tng-slate-700)]">
                                                New Password
                                            </label>
                                            <input
                                                type="password"
                                                value={passwordForm.data.password}
                                                onChange={(e) => passwordForm.setData('password', e.target.value)}
                                                className="w-full rounded-lg border border-[var(--tng-slate-200)] bg-white px-4 py-2 text-sm text-[var(--tng-slate-900)] focus:border-[var(--tng-blue-500)] focus:outline-none focus:ring-2 focus:ring-[var(--tng-blue-500)]/20"
                                            />
                                            {passwordForm.errors.password && <p className="mt-1 text-sm text-red-600">{passwordForm.errors.password}</p>}
                                        </div>

                                        <div>
                                            <label className="mb-1.5 block text-base font-medium text-[var(--tng-slate-700)]">
                                                Confirm New Password
                                            </label>
                                            <input
                                                type="password"
                                                value={passwordForm.data.password_confirmation}
                                                onChange={(e) => passwordForm.setData('password_confirmation', e.target.value)}
                                                className="w-full rounded-lg border border-[var(--tng-slate-200)] bg-white px-4 py-2 text-sm text-[var(--tng-slate-900)] focus:border-[var(--tng-blue-500)] focus:outline-none focus:ring-2 focus:ring-[var(--tng-blue-500)]/20"
                                            />
                                            {passwordForm.errors.password_confirmation && <p className="mt-1 text-sm text-red-600">{passwordForm.errors.password_confirmation}</p>}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        <button
                                            type="submit"
                                            disabled={passwordForm.processing}
                                            className="flex items-center gap-2 rounded-lg bg-[var(--tng-blue-600)] px-6 py-2.5 text-base font-bold text-white transition-colors hover:bg-[var(--tng-blue-700)] disabled:opacity-70"
                                        >
                                            <Save className="h-4 w-4" />
                                            Update Password
                                        </button>

                                        {passwordForm.recentlySuccessful && (
                                            <p className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium animate-in fade-in slide-in-from-left-2">
                                                <CheckCircle2 className="h-4 w-4" />
                                                Password updated.
                                            </p>
                                        )}
                                    </div>
                                </form>
                            </CollapsiblePanel>

                            {/* Activity Logs */}
                            <CollapsiblePanel
                                title={
                                    <div className="flex items-center gap-2 text-lg font-semibold text-[var(--tng-slate-900)]">
                                        <History className="h-5 w-5 text-[var(--tng-slate-500)]" />
                                        Activity & Logs
                                    </div>
                                }
                                defaultExpanded={true}
                            >
                                {recentActivity.length > 0 ? (
                                    <div className="space-y-4">
                                        {recentActivity.map((log: any) => (
                                            <div key={log.id} className="flex items-start gap-3 rounded-lg border border-[var(--tng-slate-100)] bg-[var(--tng-slate-50)] p-4">
                                                <div className="flex-1 min-w-0 text-sm">
                                                    <p className="text-[var(--tng-slate-900)]">
                                                        <span className="font-semibold text-[var(--tng-slate-700)] uppercase mr-1">{log.action}</span> 
                                                        {log.document ? log.document.reference_number : ''}
                                                    </p>
                                                    {log.details && (
                                                        <p className="text-[var(--tng-slate-500)] mt-1 truncate">{log.details}</p>
                                                    )}
                                                    <p className="text-xs text-[var(--tng-slate-400)] mt-2">
                                                        {new Date(log.timestamp).toLocaleString()}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-[var(--tng-slate-500)] py-4 text-center">
                                        No recent activity found.
                                    </p>
                                )}
                            </CollapsiblePanel>
                        </div>
                    </div>
                </div>
                
                {/* Fixed Footer for Profile Edit */}
                <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--tng-slate-200)] bg-white/90 backdrop-blur-md lg:left-64 shadow-[0_-4px_6px_-1px_rgb(0,0,0,0.05)] transition-all duration-300">
                    <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 lg:px-6">
                        <div className="flex items-center gap-2">
                            {profileForm.recentlySuccessful && (
                                <p className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium animate-in fade-in slide-in-from-left-2">
                                    <CheckCircle2 className="h-4 w-4" />
                                    Profile Saved
                                </p>
                            )}
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() => profileForm.reset()}
                                disabled={profileForm.processing}
                                className="flex items-center gap-2 rounded-lg border border-[var(--tng-slate-200)] bg-white px-6 py-2.5 text-base font-bold text-[var(--tng-slate-700)] transition-colors hover:bg-[var(--tng-slate-50)] hover:text-[var(--tng-slate-900)] disabled:opacity-50"
                            >
                                <X className="h-4 w-4" />
                                Cancel
                            </button>
                            <button
                                type="submit"
                                form="profile-form"
                                disabled={profileForm.processing || !profileForm.isDirty}
                                className="flex items-center gap-2 rounded-lg bg-[var(--tng-blue-600)] px-6 py-2.5 text-base font-bold text-white transition-colors hover:bg-[var(--tng-blue-700)] disabled:opacity-70 disabled:cursor-not-allowed shadow-sm"
                            >
                                <Save className="h-4 w-4" />
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </TrackngoLayout>
    );
}
