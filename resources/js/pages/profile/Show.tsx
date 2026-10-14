import { Head, useForm, usePage } from '@inertiajs/react';
import { User, Mail, Building, KeyRound, Save, CheckCircle2, History, X, ShieldCheck, AlertTriangle } from 'lucide-react';
import { DocumentPinFields, PIN_RULES_HINT, PinInput } from '@/components/trackngo/DocumentPinFields';
import TrackngoLayout from '@/layouts/trackngo/TrackngoLayout';
import { ROLE_LABELS } from '@/types/trackngo';
import type { UserRole } from '@/types/trackngo';
import { EMAIL_HINT, MOBILE_LENGTH, mobileDigits } from '@/lib/form-rules';
import { cn } from '@/lib/utils';
import { CollapsiblePanel } from '@/components/trackngo/CollapsiblePanel';

const fieldClass = 'w-full rounded-lg border border-[var(--tng-slate-200)] bg-white px-4 py-2 text-sm text-[var(--tng-slate-900)] focus:border-[var(--tng-blue-500)] focus:outline-none focus:ring-2 focus:ring-[var(--tng-blue-500)]/20';
const labelClass = 'mb-1.5 block text-base font-medium text-[var(--tng-slate-700)]';

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

    // Document PIN asked before downloads / exports
    const documentPin = props.documentPin || { required: false, is_set: false, updated_at: null };
    const pinMissing = documentPin.required && !documentPin.is_set;

    // Form for Profile Info (department and role are assigned by HR / the Administrator, not here)
    const profileForm = useForm({
        first_name: firstName,
        last_name: lastName,
        middle_name: middleName,
        email: user.email,
        mobile_number: user.mobile_number || '',
    });

    const updateProfile = (e: React.FormEvent) => {
        e.preventDefault();
        profileForm.put('/profile', {
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
        passwordForm.put('/profile/password', {
            preserveScroll: true,
            onSuccess: () => passwordForm.reset(),
        });
    };

    // Form for the document PIN: changing it needs the current PIN, the first one the login password
    const pinForm = useForm({
        current_pin: '',
        current_password: '',
        pin: '',
        pin_confirmation: '',
    });

    const updateDocumentPin = (e: React.FormEvent) => {
        e.preventDefault();
        pinForm.put('/profile/document-pin', {
            preserveScroll: true,
            onSuccess: () => pinForm.reset(),
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

                    {pinMissing && (
                        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
                            <p className="flex items-start gap-2 text-sm text-amber-900">
                                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                                <span><span className="font-semibold">Set your document PIN.</span> You cannot download or export documents until you do.</span>
                            </p>
                            <a href="#document-pin" className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700">
                                Set Document PIN
                            </a>
                        </div>
                    )}

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
                                        {profileForm.errors.email
                                            ? <p className="mt-1 text-sm text-red-600">{profileForm.errors.email}</p>
                                            : <p className="mt-1 text-xs text-[var(--tng-slate-400)]">{EMAIL_HINT}</p>}
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="mb-1.5 block text-base font-medium text-[var(--tng-slate-700)]">
                                            Contact Number <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            maxLength={MOBILE_LENGTH}
                                            value={profileForm.data.mobile_number}
                                            // Digits only, at most 11: 09XXXXXXXXX
                                            onChange={(e) => profileForm.setData('mobile_number', mobileDigits(e.target.value))}
                                            className="w-full rounded-lg border border-[var(--tng-slate-200)] bg-white px-4 py-2 text-sm text-[var(--tng-slate-900)] focus:border-[var(--tng-blue-500)] focus:outline-none focus:ring-2 focus:ring-[var(--tng-blue-500)]/20"
                                            placeholder="09171234567"
                                        />
                                        {profileForm.errors.mobile_number && <p className="mt-1 text-sm text-red-600">{profileForm.errors.mobile_number}</p>}
                                    </div>
                                    {/* Assigned by HR / the Administrator: shown, never edited here */}
                                    {[['Department', deptName], ['Role', user.role?.role_name ?? roleLabel]].map(([label, value]) => (
                                        <div key={label}>
                                            <span className={labelClass}>{label}</span>
                                            <p className="rounded-lg border border-[var(--tng-slate-200)] bg-[var(--tng-slate-50)] px-4 py-2 text-sm text-[var(--tng-slate-700)]">{value}</p>
                                        </div>
                                    ))}
                                    <p className="text-xs text-[var(--tng-slate-500)] md:col-span-2">
                                        Your department and role are assigned by HR or the Administrator. Ask them if either needs to change.
                                    </p>
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

                            {/* Document PIN: asked before any document is downloaded or exported */}
                            <div id="document-pin" className="scroll-mt-6">
                                <CollapsiblePanel
                                    title={
                                        <div className="flex items-center gap-2 text-lg font-semibold text-[var(--tng-slate-900)]">
                                            <ShieldCheck className="h-5 w-5 text-[var(--tng-slate-500)]" />
                                            Document PIN
                                            <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', documentPin.is_set ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800')}>
                                                {documentPin.is_set ? 'Set' : 'Not set'}
                                            </span>
                                        </div>
                                    }
                                    defaultExpanded={pinMissing}
                                >
                                    <form onSubmit={updateDocumentPin} className="space-y-6">
                                        <p className="text-sm text-[var(--tng-slate-600)]">
                                            A 6-digit PIN, separate from your login password, asked every time you download or export a document.
                                            {documentPin.updated_at && ` Last changed ${new Date(documentPin.updated_at).toLocaleString()}.`}
                                        </p>

                                        {documentPin.is_set ? (
                                            <div>
                                                <label className={labelClass}>Current Document PIN</label>
                                                <PinInput
                                                    value={pinForm.data.current_pin}
                                                    onValueChange={(v) => pinForm.setData('current_pin', v)}
                                                    autoComplete="off"
                                                    aria-label="Current Document PIN"
                                                    className={cn(fieldClass, 'sm:max-w-xs')}
                                                />
                                                {pinForm.errors.current_pin && <p className="mt-1 text-sm text-red-600">{pinForm.errors.current_pin}</p>}
                                                <p className="mt-1 text-xs text-[var(--tng-slate-500)]">Forgot it? Ask HR or the Administrator to reset it.</p>
                                            </div>
                                        ) : (
                                            <div>
                                                <label className={labelClass}>Login Password</label>
                                                <input
                                                    type="password"
                                                    autoComplete="current-password"
                                                    value={pinForm.data.current_password}
                                                    onChange={(e) => pinForm.setData('current_password', e.target.value)}
                                                    className={cn(fieldClass, 'sm:max-w-xs')}
                                                />
                                                {pinForm.errors.current_password && <p className="mt-1 text-sm text-red-600">{pinForm.errors.current_password}</p>}
                                            </div>
                                        )}

                                        <DocumentPinFields
                                            label={documentPin.is_set ? 'New Document PIN' : 'Document PIN'}
                                            pin={pinForm.data.pin}
                                            confirmation={pinForm.data.pin_confirmation}
                                            onPinChange={(v) => pinForm.setData('pin', v)}
                                            onConfirmationChange={(v) => pinForm.setData('pin_confirmation', v)}
                                            required
                                            hint={PIN_RULES_HINT}
                                            error={pinForm.errors.pin}
                                            inputClassName={fieldClass}
                                            labelClassName={labelClass}
                                        />

                                        <div className="flex items-center gap-4">
                                            <button
                                                type="submit"
                                                disabled={pinForm.processing}
                                                className="flex items-center gap-2 rounded-lg bg-[var(--tng-blue-600)] px-6 py-2.5 text-base font-bold text-white transition-colors hover:bg-[var(--tng-blue-700)] disabled:opacity-70"
                                            >
                                                <Save className="h-4 w-4" />
                                                {documentPin.is_set ? 'Change Document PIN' : 'Set Document PIN'}
                                            </button>
                                            {pinForm.recentlySuccessful && (
                                                <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-600 animate-in fade-in slide-in-from-left-2">
                                                    <CheckCircle2 className="h-4 w-4" />
                                                    Document PIN saved.
                                                </p>
                                            )}
                                        </div>
                                    </form>
                                </CollapsiblePanel>
                            </div>

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
