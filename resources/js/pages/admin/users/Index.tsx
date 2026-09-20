import { Head, router, useForm, usePage } from '@inertiajs/react';
import TrackngoLayout from '@/layouts/trackngo/TrackngoLayout';
import TableActionButtons from '@/components/trackngo/TableActionButtons';
import {
    BaseModal,
    ModalSection,
    ModalField,
    ModalPrimaryButton,
    ModalSecondaryButton,
} from '@/components/trackngo/BaseModal';
import {
    Users,
    Search,
    UserPlus,
    Filter,
    Edit2,
    Trash2,
    Shield,
    ShieldCheck,
    ShieldAlert,
    Building2,
    Mail,
    Phone,
    CheckCircle2,
    XCircle,
    X,
    KeyRound,
    AlertTriangle,
    Lock,
    Eye,
    EyeOff,
    RotateCcw,
    ChevronLeft,
    ChevronRight,
    Archive,
} from 'lucide-react';
import { useState, useMemo } from 'react';
import TablePagination from '@/components/trackngo/TablePagination';
import TabNavigation, { TabItem } from '@/components/trackngo/TabNavigation';
import { StatCard } from '@/components/trackngo/StatCard';

type RoleItem = {
    role_id: number;
    role_name: string;
};

type DepartmentItem = {
    department_id: number;
    department_name: string;
    code?: string;
};

type UserItem = {
    id: number;
    first_name: string;
    middle_name: string | null;
    last_name: string;
    name: string;
    email: string;
    mobile_number: string | null;
    is_active: number | boolean;
    role_id: number;
    department_id: number;
    role?: RoleItem;
    department?: DepartmentItem;
};

type Props = {
    dbUsers: UserItem[];
    dbDepartments: DepartmentItem[];
    dbRoles: RoleItem[];
    userRole?: 'admin' | 'hr';
};

export default function UserAccounts({ dbUsers = [], dbDepartments = [], dbRoles = [], userRole }: Props) {
    const { props, url } = usePage<any>();
    const currentUserId = props.auth?.user?.id;
    const authRole = (props.auth?.user?.role?.role_name || '').toLowerCase();
    const isHr = userRole === 'hr' || authRole.includes('hr') || url.startsWith('/hr');
    const isAdmin = !isHr;

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('all');
    const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('all');
    const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');

    type UserTab = 'all' | 'active' | 'suspended' | 'archived';
    const [activeTab, setActiveTab] = useState<UserTab>('all');

    // Pagination state (default: 20 per page, option to expand to 50, 100)
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [perPage, setPerPage] = useState<number>(20);

    // Modals state
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<UserItem | null>(null);
    const [overridingUser, setOverridingUser] = useState<UserItem | null>(null);
    const [deletingUser, setDeletingUser] = useState<UserItem | null>(null);

    // Filter logic
    const filteredUsers = useMemo(() => {
        return dbUsers.filter((user) => {
            const fullName = `${user.first_name || ''} ${user.middle_name || ''} ${user.last_name || ''} ${user.name || ''}`.toLowerCase();
            const email = (user.email || '').toLowerCase();
            const role = (user.role?.role_name || '').toLowerCase();
            const dept = (user.department?.department_name || '').toLowerCase();
            const phone = (user.mobile_number || '').toLowerCase();
            const q = searchQuery.toLowerCase().trim();

            const matchesSearch = !q || fullName.includes(q) || email.includes(q) || role.includes(q) || dept.includes(q) || phone.includes(q);
            const matchesRole = selectedRoleFilter === 'all' || String(user.role_id) === selectedRoleFilter;
            const matchesDept = selectedDeptFilter === 'all' || String(user.department_id) === selectedDeptFilter;
            const isActive = Boolean(user.is_active);
            const matchesStatus =
                selectedStatusFilter === 'all' ||
                (selectedStatusFilter === 'active' && isActive) ||
                (selectedStatusFilter === 'inactive' && !isActive);

            const matchesTab =
                activeTab === 'all' ||
                (activeTab === 'active' && isActive) ||
                (activeTab === 'suspended' && !isActive) ||
                (activeTab === 'archived' && !isActive && (role.includes('archive') || !user.role_id));

            return matchesTab && matchesSearch && matchesRole && matchesDept && matchesStatus;
        });
    }, [dbUsers, searchQuery, selectedRoleFilter, selectedDeptFilter, selectedStatusFilter, activeTab]);

    // Pagination slicing
    const totalItems = filteredUsers.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / perPage));
    const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

    const startIndex = (safeCurrentPage - 1) * perPage;
    const endIndex = Math.min(startIndex + perPage, totalItems);
    const paginatedUsers = useMemo(() => {
        return filteredUsers.slice(startIndex, endIndex);
    }, [filteredUsers, startIndex, endIndex]);

    // Handlers resetting page on filter/search change
    const handleTabChange = (tabId: UserTab) => {
        setActiveTab(tabId);
        setCurrentPage(1);
    };

    const handleSearchChange = (val: string) => {
        setSearchQuery(val);
        setCurrentPage(1);
    };

    const handleRoleFilterChange = (val: string) => {
        setSelectedRoleFilter(val);
        setCurrentPage(1);
    };

    const handleDeptFilterChange = (val: string) => {
        setSelectedDeptFilter(val);
        setCurrentPage(1);
    };

    const handleStatusFilterChange = (val: string) => {
        setSelectedStatusFilter(val);
        setCurrentPage(1);
    };

    const handleResetFilters = () => {
        setSearchQuery('');
        setSelectedRoleFilter('all');
        setSelectedDeptFilter('all');
        setSelectedStatusFilter('all');
        setActiveTab('all');
        setCurrentPage(1);
    };

    // KPI stats
    const stats = useMemo(() => {
        const total = dbUsers.length;
        const active = dbUsers.filter((u) => Boolean(u.is_active)).length;
        const inactive = total - active;
        const rolesCount = dbRoles.length;
        return { total, active, inactive, rolesCount };
    }, [dbUsers, dbRoles]);

    // Role badge color helper
    const getRoleBadge = (roleName?: string) => {
        const r = (roleName || '').toLowerCase();
        if (r.includes('admin')) {
            return 'bg-purple-100 text-purple-800 border-purple-200';
        }
        if (r.includes('mayor')) {
            return 'bg-amber-100 text-amber-800 border-amber-200';
        }
        if (r.includes('cart')) {
            return 'bg-rose-100 text-rose-800 border-rose-200';
        }
        if (r.includes('receiving')) {
            return 'bg-blue-100 text-blue-800 border-blue-200';
        }
        if (r.includes('department') || r.includes('head')) {
            return 'bg-emerald-100 text-emerald-800 border-emerald-200';
        }
        if (r.includes('hr')) {
            return 'bg-teal-100 text-teal-800 border-teal-200';
        }
        return 'bg-slate-100 text-slate-800 border-slate-200';
    };

    return (
        <TrackngoLayout>
            <Head title={isHr ? "Personnel Records & Department Assignments — TrackNGo Mati" : "User Accounts & Role-Based Access — TrackNGo Mati"} />

            <div className="flex flex-col space-y-6 pb-8">
                
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between shrink-0 gap-4">
                    <div>
                        <h1 className="text-[20px] font-bold text-[var(--tng-slate-900)] flex items-center gap-2">
                            <Users className="h-5 w-5 text-[var(--tng-blue-600)]" />
                            User Accounts Management
                        </h1>
                        <p className="mt-0.5 text-sm text-[var(--tng-slate-500)]">
                            {isHr
                                ? "Human Resources portal: review municipal personnel, update contact info, and override department assignments."
                                : "Full system administrator control: create users, override roles, edit credentials, and control access permissions."}
                        </p>
                    </div>
                    {isAdmin && (
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setIsCreateModalOpen(true)}
                                className="inline-flex items-center gap-2 rounded-lg bg-[#0066cc] px-4 py-2 text-[14px] font-medium text-white hover:bg-[#005bb5] shadow-xs hover:shadow-sm transition-all cursor-pointer"
                            >
                                <UserPlus className="h-4 w-4 text-white shrink-0" />
                                <span>Add User Account</span>
                            </button>
                        </div>
                    )}
                </div>

                {/* ── KPI Summary Cards (Standardized System Blue) ───────────── */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
                    <StatCard
                        title="Total Accounts"
                        value={stats.total}
                        sublabel="Registered across city government"
                        icon={Users}
                        active={activeTab === 'all'}
                        onClick={() => {
                            setActiveTab('all');
                            setCurrentPage(1);
                        }}
                    />

                    <StatCard
                        title="Active Users"
                        value={stats.active}
                        sublabel="Authorized to process workflows"
                        icon={ShieldCheck}
                        active={activeTab === 'active'}
                        onClick={() => {
                            setActiveTab('active');
                            setCurrentPage(1);
                        }}
                    />

                    <StatCard
                        title="System Roles"
                        value={stats.rolesCount}
                        sublabel="Configured access tiers"
                        icon={Shield}
                    />

                    <StatCard
                        title="Suspended / Inactive"
                        value={stats.inactive}
                        sublabel="Access restricted or revoked"
                        icon={ShieldAlert}
                        active={activeTab === 'suspended'}
                        onClick={() => {
                            setActiveTab('suspended');
                            setCurrentPage(1);
                        }}
                    />
                </div>

                {/* ── Unified Role Tabs (Admin: All, Active, Suspended, Archived) ── */}
                <TabNavigation
                    tabs={[
                        { id: 'all', label: 'All Accounts', icon: <Users className="h-4 w-4" />, count: stats.total },
                        { id: 'active', label: 'Active', icon: <ShieldCheck className="h-4 w-4 text-emerald-600" />, count: stats.active },
                        { id: 'suspended', label: 'Suspended', icon: <ShieldAlert className="h-4 w-4 text-rose-600" />, count: stats.inactive },
                        { id: 'archived', label: 'Archived', icon: <Archive className="h-4 w-4 text-slate-500" />, count: 0 },
                    ]}
                    activeTab={activeTab}
                    onChange={handleTabChange}
                />

                {/* Filters and Search Bar */}
                <div className="rounded-xl border border-[var(--tng-slate-200)] bg-white p-4 shadow-sm space-y-3">
                    <div className="flex flex-col md:flex-row md:items-center gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--tng-slate-400)]" />
                            <input
                                type="text"
                                placeholder="Search by reference number, tracking number, type, or name..."
                                value={searchQuery}
                                onChange={(e) => handleSearchChange(e.target.value)}
                                className="w-full rounded-lg border border-[var(--tng-slate-200)] bg-white py-2.5 pl-10 pr-4 text-sm text-[var(--tng-slate-800)] outline-none transition-all placeholder:text-[var(--tng-slate-400)] focus:border-[var(--tng-blue-500)] focus:ring-2 focus:ring-[var(--tng-blue-500)]/15"
                            />
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-2.5">
                            {/* Role filter */}
                            <select
                                value={selectedRoleFilter}
                                onChange={(e) => handleRoleFilterChange(e.target.value)}
                                className="rounded-lg border border-[var(--tng-slate-200)] bg-white px-3 py-2 text-xs font-medium text-[var(--tng-slate-700)] outline-none transition-all focus:border-[var(--tng-blue-500)] cursor-pointer"
                            >
                                <option value="all">All Roles ({dbRoles.length})</option>
                                {dbRoles.map((r) => (
                                    <option key={r.role_id} value={r.role_id}>
                                        {r.role_name}
                                    </option>
                                ))}
                            </select>

                            {/* Department filter */}
                            <select
                                value={selectedDeptFilter}
                                onChange={(e) => handleDeptFilterChange(e.target.value)}
                                className="rounded-lg border border-[var(--tng-slate-200)] bg-white px-3 py-2 text-xs font-medium text-[var(--tng-slate-700)] outline-none transition-all focus:border-[var(--tng-blue-500)] max-w-[200px] cursor-pointer"
                            >
                                <option value="all">All Departments</option>
                                {dbDepartments.map((d) => (
                                    <option key={d.department_id} value={d.department_id}>
                                        {d.department_name}
                                    </option>
                                ))}
                            </select>

                            {/* Status filter */}
                            <select
                                value={selectedStatusFilter}
                                onChange={(e) => handleStatusFilterChange(e.target.value)}
                                className="rounded-lg border border-[var(--tng-slate-200)] bg-white px-3 py-2 text-xs font-medium text-[var(--tng-slate-700)] outline-none transition-all focus:border-[var(--tng-blue-500)] cursor-pointer"
                            >
                                <option value="all">All Statuses</option>
                                <option value="active">Active Only</option>
                                <option value="inactive">Inactive Only</option>
                            </select>

                            {(searchQuery || selectedRoleFilter !== 'all' || selectedDeptFilter !== 'all' || selectedStatusFilter !== 'all') && (
                                <button
                                    onClick={handleResetFilters}
                                    className="rounded-lg bg-[var(--tng-slate-100)] px-3 py-2 text-xs font-semibold text-[var(--tng-slate-600)] hover:bg-[var(--tng-slate-200)] transition-colors cursor-pointer"
                                >
                                    Reset
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Table with Clean Styling, Alternating Row Colors, and Pagination */}
                <div className="w-full overflow-hidden rounded-xl border border-[var(--tng-slate-200)] bg-white shadow-xs">
                    <div className="w-full overflow-x-auto">
                        <table className="w-full text-left border-collapse text-[13px] text-[var(--tng-slate-700)]">
                            <thead className="bg-[var(--tng-slate-50)] text-[14px] font-normal text-slate-600 border-b border-[var(--tng-slate-200)]">
                                <tr>
                                    <th className="px-4 py-3 font-normal">User Name</th>
                                    <th className="px-4 py-3 font-normal">Email Address</th>
                                    <th className="px-4 py-3 font-normal">Role Access</th>
                                    <th className="px-4 py-3 font-normal">Department</th>
                                    <th className="px-4 py-3 font-normal">Status</th>
                                    <th className="px-4 py-3 text-right font-normal">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--tng-slate-200)]">
                                {paginatedUsers.map((user) => {
                                    const roleName = user.role?.role_name || 'Unassigned';
                                    const deptName = user.department?.department_name || 'None Assigned';
                                    const isActive = Boolean(user.is_active);
                                    const initials = `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase() || 'U';

                                    return (
                                        <tr
                                            key={user.id}
                                            className="min-h-[44px] transition-colors odd:bg-white even:bg-slate-50/70 hover:bg-blue-50/40"
                                        >
                                            {/* 1. User Name */}
                                            <td className="px-4 py-3 text-[13px] font-normal text-[var(--tng-slate-700)]">
                                                <div className="flex items-center gap-3">
                                                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-medium text-xs shadow-2xs ${
                                                        isActive ? 'bg-[var(--tng-blue-600)] text-white' : 'bg-slate-300 text-slate-600'
                                                    }`}>
                                                        {initials}
                                                    </div>
                                                    <div>
                                                        <div className="font-normal text-[13px] text-slate-800 flex items-center gap-2">
                                                            {user.first_name} {user.middle_name ? `${user.middle_name} ` : ''}{user.last_name}
                                                            {user.id === currentUserId && (
                                                                <span className="rounded bg-blue-50 border border-blue-200 px-1.5 py-0.5 text-[11px] font-normal text-blue-700">
                                                                    You
                                                                </span>
                                                            )}
                                                        </div>
                                                        {user.mobile_number ? (
                                                            <div className="flex items-center gap-1.5 text-[12px] text-slate-500 mt-0.5 font-normal">
                                                                <Phone className="h-3.5 w-3.5 text-slate-400" />
                                                                {user.mobile_number}
                                                            </div>
                                                        ) : (
                                                            <div className="text-[12px] text-slate-400 italic mt-0.5">No phone number</div>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>

                                            {/* 2. Email Address */}
                                            <td className="px-4 py-3 whitespace-nowrap text-[13px] font-normal text-[var(--tng-slate-700)]">
                                                <div className="flex items-center gap-2 font-mono text-[13px] text-slate-600 font-normal">
                                                    <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                                    <span>{user.email}</span>
                                                </div>
                                            </td>

                                            {/* 3. Role Access */}
                                            <td className="px-4 py-3 whitespace-nowrap text-[13px] font-normal">
                                                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12px] font-medium border ${getRoleBadge(roleName)}`}>
                                                    <Shield className="h-3.5 w-3.5" />
                                                    {roleName}
                                                </span>
                                            </td>

                                            {/* 4. Department */}
                                            <td className="px-4 py-3 text-[13px] font-normal text-[var(--tng-slate-700)]">
                                                <div className="flex items-center gap-1.5 text-[13px] text-slate-600 font-normal">
                                                    <Building2 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                                                    <span className="truncate max-w-[220px]">{deptName}</span>
                                                </div>
                                            </td>

                                            {/* 5. Status */}
                                            <td className="px-4 py-3 whitespace-nowrap text-[13px] font-normal">
                                                {isActive ? (
                                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[12px] font-medium text-emerald-700 border border-emerald-200 shadow-2xs">
                                                        <ShieldCheck className="h-3.5 w-3.5" /> Active
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-[12px] font-medium text-slate-600 border border-slate-200 shadow-2xs">
                                                        <XCircle className="h-3.5 w-3.5" /> Inactive
                                                    </span>
                                                )}
                                            </td>

                                            {/* 6. Actions (Edit, Override, Delete) */}
                                            <td className="px-4 py-3 text-right whitespace-nowrap text-[13px] font-normal">
                                                <TableActionButtons
                                                    onEdit={() => setEditingUser(user)}
                                                    editTitle="Edit Record"
                                                    onDelete={isAdmin ? () => setDeletingUser(user) : undefined}
                                                    deleteTitle={user.id === currentUserId ? "Cannot delete yourself" : "Delete Record"}
                                                    deleteDisabled={user.id === currentUserId}
                                                    showDelete={isAdmin}
                                                    extraActions={
                                                        <button
                                                            type="button"
                                                            onClick={() => setOverridingUser(user)}
                                                            title={isHr ? "Override Department Assignment" : "Override Role & Access"}
                                                            aria-label="Override"
                                                            className="p-1 text-slate-400 hover:text-[#0066cc] transition-colors rounded hover:bg-slate-100/70 focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 active:scale-95 cursor-pointer"
                                                        >
                                                            <RotateCcw className="h-[18px] w-[18px]" />
                                                        </button>
                                                    }
                                                />
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {filteredUsers.length === 0 && (
                        <div className="py-12 text-center">
                            <Users className="mx-auto h-12 w-12 text-[var(--tng-slate-300)]" />
                            <p className="mt-3 text-sm font-medium text-[var(--tng-slate-600)]">
                                No user accounts found matching current filters.
                            </p>
                            <button
                                onClick={handleResetFilters}
                                className="mt-2 text-xs font-semibold text-[var(--tng-blue-600)] hover:underline cursor-pointer"
                            >
                                Clear all filters
                            </button>
                        </div>
                    )}

                    {/* Pagination Controls at Bottom */}
                    <TablePagination
                        currentPage={currentPage}
                        pageSize={perPage}
                        totalItems={totalItems}
                        onPageChange={setCurrentPage}
                        onPageSizeChange={setPerPage}
                        itemLabel="registered users"
                    />
                </div>
            </div>

            {/* ── CREATE USER MODAL ────────────────────────────────────────────────── */}
            {isAdmin && isCreateModalOpen && (
                <CreateUserModal
                    isOpen={isCreateModalOpen}
                    onClose={() => setIsCreateModalOpen(false)}
                    departments={dbDepartments}
                    roles={dbRoles}
                />
            )}

            {/* ── EDIT USER MODAL ──────────────────────────────────────────────────── */}
            {editingUser && (
                <EditUserModal
                    user={editingUser}
                    onClose={() => setEditingUser(null)}
                    departments={dbDepartments}
                    roles={dbRoles}
                    isHr={isHr}
                />
            )}

            {/* ── OVERRIDE ACCESS MODAL ────────────────────────────────────────────── */}
            {overridingUser && (
                <OverrideAccessModal
                    user={overridingUser}
                    onClose={() => setOverridingUser(null)}
                    departments={dbDepartments}
                    roles={dbRoles}
                    isHr={isHr}
                />
            )}

            {/* ── DELETE CONFIRMATION MODAL ────────────────────────────────────────── */}
            {isAdmin && deletingUser && (
                <DeleteUserModal
                    user={deletingUser}
                    onClose={() => setDeletingUser(null)}
                    currentUserId={currentUserId}
                />
            )}
        </TrackngoLayout>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// MODAL: CREATE NEW USER (Standardized)
// ─────────────────────────────────────────────────────────────────────────────
function CreateUserModal({
    isOpen,
    onClose,
    departments,
    roles,
}: {
    isOpen: boolean;
    onClose: () => void;
    departments: DepartmentItem[];
    roles: RoleItem[];
}) {
    const { data, setData, post, processing, errors, reset } = useForm({
        first_name: '',
        middle_name: '',
        last_name: '',
        email: '',
        password: '',
        department_id: departments[0]?.department_id || '',
        role_id: roles[0]?.role_id || '',
        mobile_number: '',
        is_active: 1,
    });

    const [showPassword, setShowPassword] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        post('/admin/users', {
            onSuccess: () => {
                reset();
                onClose();
            },
        });
    };

    return (
        <BaseModal
            isOpen={isOpen}
            onClose={onClose}
            title="Add New User Account"
            description="Register a new LGU employee, configure role-based access, and set security credentials."
            icon={<UserPlus className="h-5 w-5" />}
            maxWidth="max-w-xl"
            formProps={{ onSubmit: handleSubmit }}
            footer={
                <>
                    <ModalSecondaryButton onClick={onClose} disabled={processing}>
                        Cancel
                    </ModalSecondaryButton>
                    <ModalPrimaryButton isLoading={processing} loadingText="Saving Account...">
                        <UserPlus className="h-4 w-4" /> Save User Account
                    </ModalPrimaryButton>
                </>
            }
        >
            <div className="space-y-6">
                {/* Section 1: User Information */}
                <ModalSection
                    title="User Information"
                    description="Enter the legal employee name for official records and audit trails."
                >
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <ModalField label="First Name" required error={errors.first_name}>
                            <input
                                type="text"
                                required
                                value={data.first_name}
                                onChange={(e) => setData('first_name', e.target.value)}
                                placeholder="e.g. Juan"
                                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                            />
                        </ModalField>

                        <ModalField label="Middle Name" error={errors.middle_name}>
                            <input
                                type="text"
                                value={data.middle_name}
                                onChange={(e) => setData('middle_name', e.target.value)}
                                placeholder="e.g. Santos"
                                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                            />
                        </ModalField>

                        <ModalField label="Last Name" required error={errors.last_name}>
                            <input
                                type="text"
                                required
                                value={data.last_name}
                                onChange={(e) => setData('last_name', e.target.value)}
                                placeholder="e.g. Dela Cruz"
                                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                            />
                        </ModalField>
                    </div>
                </ModalSection>

                {/* Section 2: Account Credentials */}
                <ModalSection
                    title="Account Credentials"
                    description="Authentication credentials used by the staff member to log in."
                >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <ModalField label="Email Address" required error={errors.email}>
                            <input
                                type="email"
                                required
                                value={data.email}
                                onChange={(e) => setData('email', e.target.value)}
                                placeholder="staff@maticity.gov.ph"
                                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                            />
                        </ModalField>

                        <ModalField label="Initial Password" required error={errors.password}>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    required
                                    value={data.password}
                                    onChange={(e) => setData('password', e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 pr-10 text-sm outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 font-mono"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                                >
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </ModalField>
                    </div>
                </ModalSection>

                {/* Section 3: Role & Department Assignment */}
                <ModalSection
                    title="Role & Department Assignment"
                    description="Assign system permissions tier and governing department unit."
                >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <ModalField label="System Role" required error={errors.role_id}>
                            <select
                                required
                                value={data.role_id}
                                onChange={(e) => setData('role_id', Number(e.target.value))}
                                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                            >
                                {roles.map((r) => (
                                    <option key={r.role_id} value={r.role_id}>
                                        {r.role_name}
                                    </option>
                                ))}
                            </select>
                        </ModalField>

                        <ModalField label="Assigned Department" required error={errors.department_id}>
                            <select
                                required
                                value={data.department_id}
                                onChange={(e) => setData('department_id', Number(e.target.value))}
                                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                            >
                                {departments.map((d) => (
                                    <option key={d.department_id} value={d.department_id}>
                                        {d.department_name}
                                    </option>
                                ))}
                            </select>
                        </ModalField>
                    </div>
                </ModalSection>

                {/* Section 4: Contact & Account Status */}
                <ModalSection
                    title="Contact & Status"
                    description="Mobile phone for automated SMS notifications and account availability."
                >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <ModalField label="Mobile Number" description="Used for urgent escalation alerts" error={errors.mobile_number}>
                            <input
                                type="text"
                                value={data.mobile_number}
                                onChange={(e) => setData('mobile_number', e.target.value)}
                                placeholder="09171234567"
                                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                            />
                        </ModalField>

                        <ModalField label="Account Status" required>
                            <select
                                value={data.is_active}
                                onChange={(e) => setData('is_active', Number(e.target.value))}
                                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                            >
                                <option value={1}>Active (Full System Access)</option>
                                <option value={0}>Inactive (Access Suspended)</option>
                            </select>
                        </ModalField>
                    </div>
                </ModalSection>
            </div>
        </BaseModal>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// MODAL: EDIT USER (Standardized)
// ─────────────────────────────────────────────────────────────────────────────
function EditUserModal({
    user,
    onClose,
    departments,
    roles,
    isHr = false,
}: {
    user: UserItem;
    onClose: () => void;
    departments: DepartmentItem[];
    roles: RoleItem[];
    isHr?: boolean;
}) {
    const { data, setData, put, processing, errors } = useForm({
        first_name: user.first_name || '',
        middle_name: user.middle_name || '',
        last_name: user.last_name || '',
        email: user.email || '',
        password: '',
        department_id: user.department_id || departments[0]?.department_id || '',
        role_id: user.role_id || roles[0]?.role_id || '',
        mobile_number: user.mobile_number || '',
        is_active: user.is_active ? 1 : 0,
    });

    const [showPassword, setShowPassword] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const targetUrl = isHr ? `/hr/users/${user.id}` : `/admin/users/${user.id}`;
        put(targetUrl, {
            onSuccess: () => {
                onClose();
            },
        });
    };

    return (
        <BaseModal
            isOpen={true}
            onClose={onClose}
            title={`Edit User: ${user.name}`}
            description="Modify staff profile details, reset credentials, and adjust department placement."
            icon={<Edit2 className="h-5 w-5" />}
            maxWidth="max-w-xl"
            formProps={{ onSubmit: handleSubmit }}
            footer={
                <>
                    <ModalSecondaryButton onClick={onClose} disabled={processing}>
                        Cancel
                    </ModalSecondaryButton>
                    <ModalPrimaryButton isLoading={processing} loadingText="Updating Account...">
                        <Edit2 className="h-4 w-4" /> Save Changes
                    </ModalPrimaryButton>
                </>
            }
        >
            <div className="space-y-6">
                {/* Section 1: Personal Information */}
                <ModalSection
                    title="User Information"
                    description="Update the employee's official name."
                >
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <ModalField label="First Name" required error={errors.first_name}>
                            <input
                                type="text"
                                required
                                value={data.first_name}
                                onChange={(e) => setData('first_name', e.target.value)}
                                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                            />
                        </ModalField>

                        <ModalField label="Middle Name" error={errors.middle_name}>
                            <input
                                type="text"
                                value={data.middle_name}
                                onChange={(e) => setData('middle_name', e.target.value)}
                                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                            />
                        </ModalField>

                        <ModalField label="Last Name" required error={errors.last_name}>
                            <input
                                type="text"
                                required
                                value={data.last_name}
                                onChange={(e) => setData('last_name', e.target.value)}
                                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                            />
                        </ModalField>
                    </div>
                </ModalSection>

                {/* Section 2: Account Credentials & Password Reset */}
                <ModalSection
                    title="Account Credentials"
                    description="Official email and security credentials. Leave password blank to retain current."
                >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <ModalField label="Email Address" required error={errors.email}>
                            <input
                                type="email"
                                required
                                value={data.email}
                                onChange={(e) => setData('email', e.target.value)}
                                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                            />
                        </ModalField>

                        <ModalField label="Reset Password" description="Leave blank to keep unchanged" error={errors.password}>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={data.password}
                                    onChange={(e) => setData('password', e.target.value)}
                                    placeholder="Enter new password..."
                                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 pr-10 text-sm outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 font-mono"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                                >
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </ModalField>
                    </div>
                </ModalSection>

                {/* Section 3: Role & Department Assignment */}
                <ModalSection
                    title="Role & Department Assignment"
                    description="System access tier and organizational department."
                >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <ModalField
                            label="System Role"
                            description={isHr ? "System role assignment is reserved for Administrator" : undefined}
                            required={!isHr}
                            error={errors.role_id}
                        >
                            {isHr ? (
                                <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-100 px-3.5 py-2.5 text-sm font-semibold text-slate-700">
                                    <span>{user.role?.role_name || 'Assigned Role'}</span>
                                    <span className="rounded bg-slate-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-700">
                                        Admin Managed
                                    </span>
                                </div>
                            ) : (
                                <select
                                    required
                                    value={data.role_id}
                                    onChange={(e) => setData('role_id', Number(e.target.value))}
                                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                                >
                                    {roles.map((r) => (
                                        <option key={r.role_id} value={r.role_id}>
                                            {r.role_name}
                                        </option>
                                    ))}
                                </select>
                            )}
                        </ModalField>

                        <ModalField label="Assigned Department" required error={errors.department_id}>
                            <select
                                required
                                value={data.department_id}
                                onChange={(e) => setData('department_id', Number(e.target.value))}
                                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                            >
                                {departments.map((d) => (
                                    <option key={d.department_id} value={d.department_id}>
                                        {d.department_name}
                                    </option>
                                ))}
                            </select>
                        </ModalField>
                    </div>
                </ModalSection>

                {/* Section 4: Contact & Status */}
                <ModalSection
                    title="Contact & Status"
                    description="Mobile phone for alerts and account authorization status."
                >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <ModalField label="Mobile Number" error={errors.mobile_number}>
                            <input
                                type="text"
                                value={data.mobile_number}
                                onChange={(e) => setData('mobile_number', e.target.value)}
                                placeholder="09171234567"
                                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                            />
                        </ModalField>

                        <ModalField label="Account Status" required>
                            <select
                                value={data.is_active}
                                onChange={(e) => setData('is_active', Number(e.target.value))}
                                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                            >
                                <option value={1}>Active (Full Permissions)</option>
                                <option value={0}>Inactive (Suspended)</option>
                            </select>
                        </ModalField>
                    </div>
                </ModalSection>
            </div>
        </BaseModal>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// MODAL: OVERRIDE ROLE & ACCESS (Standardized)
// ─────────────────────────────────────────────────────────────────────────────
function OverrideAccessModal({
    user,
    onClose,
    departments,
    roles,
    isHr = false,
}: {
    user: UserItem;
    onClose: () => void;
    departments: DepartmentItem[];
    roles: RoleItem[];
    isHr?: boolean;
}) {
    const { data, setData, post, processing, errors } = useForm({
        role_id: user.role_id || roles[0]?.role_id || '',
        department_id: user.department_id || departments[0]?.department_id || '',
        is_active: user.is_active ? 1 : 0,
    });

    const currentRoleName = user.role?.role_name || 'Unassigned';
    const currentDeptName = user.department?.department_name || 'Unassigned';

    const handleOverride = (e: React.FormEvent) => {
        e.preventDefault();
        const targetUrl = isHr ? `/hr/users/${user.id}/override-role` : `/admin/users/${user.id}/override-role`;
        post(targetUrl, {
            onSuccess: () => {
                onClose();
            },
        });
    };

    return (
        <BaseModal
            isOpen={true}
            onClose={onClose}
            title={isHr ? `Override Department: ${user.name}` : "Override Role & Access Rights"}
            description={
                isHr
                    ? "Reassign employee department placement and account status under Human Resources authorization."
                    : "Immediate administrative privilege elevation, role reallocation, or department reassignment."
            }
            icon={<KeyRound className="h-5 w-5" />}
            headerClassName="bg-purple-50 border-b border-purple-100"
            iconContainerClassName="bg-purple-600 text-white"
            maxWidth="max-w-lg"
            formProps={{ onSubmit: handleOverride }}
            footer={
                <>
                    <ModalSecondaryButton onClick={onClose} disabled={processing}>
                        Cancel
                    </ModalSecondaryButton>
                    <button
                        type="submit"
                        disabled={processing}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-purple-600/20 hover:bg-purple-700 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                    >
                        {processing ? (
                            'Applying...'
                        ) : (
                            <>
                                <KeyRound className="h-4 w-4" />
                                {isHr ? 'Save Department Override' : 'Apply Role Override'}
                            </>
                        )}
                    </button>
                </>
            }
        >
            <div className="space-y-5">
                {/* Section 1: Target Account Summary */}
                <ModalSection title="Target Account">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-1">
                        <p className="text-xs font-semibold uppercase text-slate-500">Employee Profile</p>
                        <p className="text-sm font-bold text-slate-900">{user.name}</p>
                        <p className="text-xs text-slate-600">{user.email}</p>
                        <div className="flex items-center gap-3 pt-2 text-xs text-slate-500 border-t border-slate-200/80 mt-2">
                            <span>Current Role: <strong className="text-purple-700">{currentRoleName}</strong></span>
                            <span>•</span>
                            <span>Current Dept: <strong className="text-slate-700">{currentDeptName}</strong></span>
                        </div>
                    </div>

                    <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 flex items-start gap-2.5 text-xs text-amber-800">
                        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                        <span className="leading-relaxed">
                            {isHr
                                ? "Updating this employee's department will immediately adjust their departmental document routing and queue assignments."
                                : "Overriding this user's role will immediately update their navigation sidebar, workflow approval authority, and module visibility across the entire TrackNGo system."}
                        </span>
                    </div>
                </ModalSection>

                {/* Section 2: Role & Department Override */}
                <ModalSection title={isHr ? "Department Reassignment" : "Elevated Permissions & Placement"}>
                    <div className="space-y-4">
                        {isHr ? (
                            <ModalField
                                label="System Role Access"
                                description="Role changes require Administrator authorization"
                            >
                                <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-100 px-3.5 py-2.5 text-sm font-semibold text-slate-700">
                                    <span>{currentRoleName}</span>
                                    <span className="rounded bg-slate-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-700">
                                        Fixed
                                    </span>
                                </div>
                            </ModalField>
                        ) : (
                            <ModalField label="New Role Access" required error={errors.role_id}>
                                <select
                                    value={data.role_id}
                                    onChange={(e) => setData('role_id', Number(e.target.value))}
                                    className="w-full rounded-xl border border-purple-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-purple-950 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/15"
                                >
                                    {roles.map((r) => (
                                        <option key={r.role_id} value={r.role_id}>
                                            {r.role_name}
                                        </option>
                                    ))}
                                </select>
                            </ModalField>
                        )}

                        <ModalField label="Assigned Department" required error={errors.department_id}>
                            <select
                                value={data.department_id}
                                onChange={(e) => setData('department_id', Number(e.target.value))}
                                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                            >
                                {departments.map((d) => (
                                    <option key={d.department_id} value={d.department_id}>
                                        {d.department_name}
                                    </option>
                                ))}
                            </select>
                        </ModalField>

                        <ModalField label="Account Authorization Status">
                            <select
                                value={data.is_active}
                                onChange={(e) => setData('is_active', Number(e.target.value))}
                                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                            >
                                <option value={1}>Active (Full Permissions)</option>
                                <option value={0}>Suspended / Inactive</option>
                            </select>
                        </ModalField>
                    </div>
                </ModalSection>
            </div>
        </BaseModal>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// MODAL: DELETE USER (Standardized)
// ─────────────────────────────────────────────────────────────────────────────
function DeleteUserModal({
    user,
    onClose,
    currentUserId,
}: {
    user: UserItem;
    onClose: () => void;
    currentUserId?: number;
}) {
    const isSelf = user.id === currentUserId;

    const handleDelete = () => {
        if (isSelf) return;
        router.delete(`/admin/users/${user.id}`, {
            onSuccess: () => {
                onClose();
            },
        });
    };

    return (
        <BaseModal
            isOpen={true}
            onClose={onClose}
            title="Delete User Account"
            description="Permanent removal of user account and system access."
            icon={<Trash2 className="h-5 w-5" />}
            headerClassName="bg-rose-50 border-b border-rose-100"
            iconContainerClassName="bg-rose-600 text-white"
            maxWidth="max-w-md"
            footer={
                <>
                    <ModalSecondaryButton onClick={onClose}>
                        Cancel
                    </ModalSecondaryButton>
                    {!isSelf && (
                        <button
                            type="button"
                            onClick={handleDelete}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-rose-600/20 hover:bg-rose-700 transition-all active:scale-[0.98] cursor-pointer"
                        >
                            <Trash2 className="h-4 w-4" />
                            Confirm & Delete
                        </button>
                    )}
                </>
            }
        >
            <div className="space-y-4">
                {isSelf ? (
                    <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800 space-y-1.5">
                        <p className="font-bold flex items-center gap-1.5">
                            <AlertTriangle className="h-4 w-4 text-amber-600" />
                            Action Prohibited
                        </p>
                        <p className="text-xs leading-relaxed">
                            You cannot delete your own logged-in Administrator account. Another Administrator must perform this action if required.
                        </p>
                    </div>
                ) : (
                    <>
                        <ModalSection title="Account Confirmation">
                            <p className="text-sm text-slate-700 leading-relaxed">
                                Are you sure you want to permanently delete the account for{' '}
                                <strong className="text-slate-900">{user.name}</strong> ({user.email})?
                            </p>
                        </ModalSection>

                        <div className="rounded-xl bg-rose-50 border border-rose-200 p-3.5 text-xs text-rose-800 leading-relaxed">
                            This action is recorded in the system Audit Trail. Historical documents, routing slips, and endorsements previously signed by this user will remain preserved.
                        </div>
                    </>
                )}
            </div>
        </BaseModal>
    );
}

