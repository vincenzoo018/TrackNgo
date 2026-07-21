import {
    LayoutDashboard,
    FileText,
    Route,
    Activity,
    Users,
    BarChart3,
    FileCode2,
} from 'lucide-react';
import type { NavItem } from '@/types';

export const adminNav: NavItem[] = [
    { title: 'Dashboard', href: '/admin', icon: LayoutDashboard },
    { title: 'All Documents', href: '/admin/documents', icon: FileText },
    { title: 'Routing Slips', href: '/admin/routing-slips', icon: Route },
    { title: 'User Accounts', href: '/admin/users', icon: Users },
    { title: 'Document Templates', href: '/admin/templates', icon: FileCode2 },
    { title: 'Reports', href: '/admin/reports', icon: BarChart3 },
    { title: 'Audit Trail', href: '/admin/audit-trail', icon: Activity },
];
