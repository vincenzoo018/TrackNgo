import { Link, usePage } from '@inertiajs/react';
import {
    LogOut,
    Menu,
    X,
    Bell,
    Search,
    ChevronDown,
} from 'lucide-react';
import { type ReactNode, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { adminNav } from '@/config/nav/admin.nav';
import { receivingNav } from '@/config/nav/receiving.nav';
import { departmentHeadNav } from '@/config/nav/departmentHead.nav';
import { mayorNav } from '@/config/nav/mayor.nav';
import { cartNav } from '@/config/nav/cart.nav';
import { hrNav } from '@/config/nav/hr.nav';
import type { NavItem } from '@/types';
import type { UserRole } from '@/types/trackngo';
import { ROLE_LABELS } from '@/types/trackngo';

// ── Role → Nav mapping ─────────────────────────────────────────────
const NAV_MAP: Record<string, NavItem[]> = {
    admin: adminNav,
    receiving: receivingNav,
    department_head: departmentHeadNav,
    mayor: mayorNav,
    cart: cartNav,
    hr: hrNav,
};

// ── Role avatar colors ──────────────────────────────────────────────
const ROLE_COLORS: Record<string, string> = {
    admin: 'bg-purple-600',
    receiving: 'bg-blue-600',
    department_head: 'bg-emerald-600',
    mayor: 'bg-amber-600',
    cart: 'bg-rose-600',
    hr: 'bg-teal-600',
};

const ROLE_INITIALS: Record<string, string> = {
    admin: 'A',
    receiving: 'R',
    department_head: 'DH',
    mayor: 'M',
    cart: 'C',
    hr: 'HR',
};

type TrackngoLayoutProps = {
    children: ReactNode;
    breadcrumbs?: { title: string; href: string }[];
    role?: string;
};

export default function TrackngoLayout({ children, breadcrumbs, role }: TrackngoLayoutProps) {
    const { url, props } = usePage<{
        auth: { user: { name: string; email: string; role: UserRole } };
    }>();

    // Infer role from URL for frontend mocking
    const urlSegment = url.split('/')[1] || 'receiving';
    const mappedSegment = urlSegment === 'department-head' ? 'department_head' : urlSegment;
    const isValidRole = ['admin', 'receiving', 'department_head', 'mayor', 'cart', 'hr'].includes(mappedSegment);
    const inferredRole = isValidRole ? (mappedSegment as UserRole) : 'receiving';

    const userRole = (role as UserRole) ?? props.auth?.user?.role ?? inferredRole;
    
    // Mock user names based on inferred role
    const mockNames: Record<string, string> = {
        admin: 'System Admin',
        receiving: 'Receiving Clerk',
        department_head: 'Engr. John Doe',
        mayor: 'Hon. Mayor',
        cart: 'CART Officer',
        hr: 'HR Manager'
    };
    const userName = props.auth?.user?.name ?? mockNames[userRole] ?? 'User';
    
    const navItems = NAV_MAP[userRole] ?? receivingNav;
    const roleLabel = ROLE_LABELS[userRole] ?? 'User';

    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

    // Close mobile sidebar on route change
    useEffect(() => {
        setMobileOpen(false);
    }, [url]);

    const isActive = (href: string) => {
        if (href === `/${userRole}` || href === '/admin' || href === '/receiving' || href === '/mayor' || href === '/cart' || href === '/department-head' || href === '/hr') {
            return url === href;
        }
        return url.startsWith(href);
    };

    return (
        <div className="flex h-screen overflow-hidden bg-[var(--tng-slate-50)]">
            {/* ── Mobile Overlay ─────────────────────────────────── */}
            {mobileOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
                    onClick={() => setMobileOpen(false)}
                />
            )}

            {/* ── Sidebar ────────────────────────────────────────── */}
            <aside
                className={cn(
                    'fixed inset-y-0 left-0 z-50 flex flex-col border-r border-[var(--tng-slate-200)] bg-white transition-all duration-300 ease-in-out lg:relative lg:z-0',
                    sidebarOpen ? 'w-64' : 'w-[70px]',
                    mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
                )}
            >
                {/* Sidebar Header Image (200px x 60px, centered horizontally, 10px padding above & below) */}
                <div className="flex items-center justify-center border-b border-[var(--tng-slate-200)] py-[10px] px-2">
                    {sidebarOpen ? (
                        <div className="flex h-[60px] w-[200px] items-center justify-center">
                            <img
                                src="/image/sidebar-banner-transparent.png"
                                alt="TrackNGo Mati"
                                className="h-[60px] w-[200px] object-contain"
                            />
                        </div>
                    ) : (
                        <div className="flex h-[40px] w-[40px] items-center justify-center overflow-hidden">
                            <img
                                src="/image/sidebar-banner-transparent.png"
                                alt="TrackNGo"
                                className="h-[40px] w-auto max-w-none -translate-x-[6px] object-contain"
                            />
                        </div>
                    )}
                </div>

                {/* Sidebar Role Label */}
                {sidebarOpen && (
                    <div className="px-4 pt-3 pb-1 flex items-center justify-between">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--tng-slate-400)]">
                            {roleLabel}
                        </p>
                        <span className={cn(
                            'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold text-white shadow-2xs',
                            ROLE_COLORS[userRole] ?? 'bg-blue-600'
                        )}>
                            {ROLE_INITIALS[userRole] ?? 'U'}
                        </span>
                    </div>
                )}

                {/* Navigation Items */}
                <nav className="tng-scrollbar flex-1 space-y-1 overflow-y-auto px-3 py-2">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const active = isActive(typeof item.href === 'string' ? item.href : item.href.url);

                        return (
                            <Link
                                key={item.title}
                                href={item.href}
                                className={cn(
                                    'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-medium transition-all duration-200',
                                    active
                                        ? 'bg-[var(--tng-blue-600)] text-white shadow-md shadow-blue-600/25 font-semibold'
                                        : 'text-[var(--tng-slate-600)] hover:bg-[var(--tng-blue-50)] hover:text-[var(--tng-blue-700)]',
                                    !sidebarOpen && 'justify-center px-0',
                                )}
                            >
                                {Icon && (
                                    <Icon
                                        className={cn(
                                            'h-5 w-5 shrink-0 transition-colors',
                                            active
                                                ? 'text-white'
                                                : 'text-[var(--tng-slate-400)] group-hover:text-[var(--tng-blue-600)]',
                                        )}
                                    />
                                )}
                                {sidebarOpen && <span>{item.title}</span>}
                            </Link>
                        );
                    })}
                </nav>

                {/* Sign Out */}
                <div className="border-t border-[var(--tng-slate-200)] p-3">
                    <Link
                        href="/logout"
                        method="post"
                        as="button"
                        className={cn(
                            'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-medium text-red-500 transition-colors hover:bg-red-50',
                            !sidebarOpen && 'justify-center px-0',
                        )}
                    >
                        <LogOut className="h-5 w-5 shrink-0" />
                        {sidebarOpen && <span>Sign Out</span>}
                    </Link>
                </div>
            </aside>

            {/* ── Main Content ────────────────────────────────────── */}
            <div className="flex flex-1 flex-col overflow-hidden">
                {/* Top Bar */}
                <header className="flex h-16 items-center justify-between border-b border-[var(--tng-slate-200)] bg-white px-4 lg:px-6">
                    <div className="flex items-center gap-3">
                        {/* Mobile Menu Toggle */}
                        <button
                            onClick={() => setMobileOpen(!mobileOpen)}
                            className="rounded-lg p-2 text-[var(--tng-slate-500)] hover:bg-[var(--tng-slate-100)] lg:hidden"
                        >
                            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                        </button>

                        {/* Desktop Sidebar Toggle */}
                        <button
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            className="hidden rounded-lg p-2 text-[var(--tng-slate-500)] hover:bg-[var(--tng-slate-100)] lg:block"
                        >
                            <Menu className="h-5 w-5" />
                        </button>

                        {/* Search Bar */}
                        <div className="relative hidden md:block">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--tng-slate-400)]" />
                            <input
                                type="text"
                                placeholder="Search by tracking number or keyword..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="h-9 w-72 rounded-lg border border-[var(--tng-slate-200)] bg-[var(--tng-slate-50)] pl-9 pr-4 text-sm text-[var(--tng-slate-700)] placeholder:text-[var(--tng-slate-400)] focus:border-[var(--tng-blue-500)] focus:outline-none focus:ring-2 focus:ring-[var(--tng-blue-500)]/20 lg:w-80"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Notification Bell */}
                        <button className="relative rounded-lg p-2 text-[var(--tng-slate-500)] transition-colors hover:bg-[var(--tng-slate-100)]">
                            <Bell className="h-5 w-5" />
                            <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                                3
                            </span>
                        </button>

                        {/* User Menu */}
                        <div className="relative">
                            <button
                                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                                className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-[var(--tng-slate-100)] focus:outline-none focus:ring-2 focus:ring-[var(--tng-blue-500)]/20"
                            >
                                <div className={cn(
                                    'flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white',
                                    ROLE_COLORS[userRole] ?? 'bg-blue-600',
                                )}>
                                    {userName.charAt(0).toUpperCase()}
                                </div>
                                <div className="hidden text-left md:block">
                                    <p className="text-sm font-medium text-[var(--tng-slate-800)]">{userName}</p>
                                    <p className="text-xs text-[var(--tng-slate-500)]">{roleLabel}</p>
                                </div>
                                <ChevronDown className={cn(
                                    "hidden h-4 w-4 text-[var(--tng-slate-400)] md:block transition-transform duration-200",
                                    profileDropdownOpen ? "rotate-180" : ""
                                )} />
                            </button>

                            {/* Dropdown Menu */}
                            {profileDropdownOpen && (
                                <>
                                    <div 
                                        className="fixed inset-0 z-40" 
                                        onClick={() => setProfileDropdownOpen(false)} 
                                    />
                                    <div className="absolute right-0 top-full mt-2 w-56 z-50 rounded-xl border border-[var(--tng-slate-200)] bg-white shadow-xl py-2 animate-in fade-in slide-in-from-top-2 duration-200">
                                        <div className="px-4 py-3 border-b border-[var(--tng-slate-100)] mb-1">
                                            <p className="text-[18px] font-bold text-[var(--tng-slate-900)] truncate">
                                                {userName}
                                            </p>
                                            <p className="text-xs text-[var(--tng-slate-500)] truncate">
                                                {props.auth?.user?.email ?? 'user@example.com'}
                                            </p>
                                        </div>
                                        <Link
                                            href="/profile"
                                            onClick={() => setProfileDropdownOpen(false)}
                                            className="flex items-center gap-3 px-4 py-2 text-sm text-[var(--tng-slate-700)] hover:bg-[var(--tng-slate-50)] hover:text-[var(--tng-blue-700)] transition-colors"
                                        >
                                            My Profile
                                        </Link>
                                        <Link
                                            href="/logout"
                                            method="post"
                                            as="button"
                                            onClick={() => setProfileDropdownOpen(false)}
                                            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors text-left"
                                        >
                                            Sign Out
                                        </Link>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </header>

                {/* Breadcrumbs */}
                {breadcrumbs && breadcrumbs.length > 0 && (
                    <div className="border-b border-[var(--tng-slate-200)] bg-white px-4 py-2.5 lg:px-6">
                        <nav className="flex items-center gap-1.5 text-sm">
                            {breadcrumbs.map((crumb, idx) => (
                                <span key={crumb.href} className="flex items-center gap-1.5">
                                    {idx > 0 && <span className="text-[var(--tng-slate-400)]">›</span>}
                                    {idx < breadcrumbs.length - 1 ? (
                                        <Link
                                            href={crumb.href}
                                            className="text-[var(--tng-blue-600)] hover:underline"
                                        >
                                            {crumb.title}
                                        </Link>
                                    ) : (
                                        <span className="text-[var(--tng-slate-600)]">{crumb.title}</span>
                                    )}
                                </span>
                            ))}
                        </nav>
                    </div>
                )}

                {/* Page Content */}
                <main className="tng-scrollbar flex-1 overflow-y-auto p-4 lg:p-6 w-full">
                    <div className="tng-fade-in w-full">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
