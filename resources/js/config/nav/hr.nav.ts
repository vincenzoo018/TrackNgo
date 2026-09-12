import {
    LayoutDashboard,
    FileText,
    Route,
    Users,
    CalendarDays,
    BarChart3,
    Building2,
    Activity,
    Archive,
    QrCode,
} from 'lucide-react';
import type { NavItem } from '@/types';

export const hrNav: NavItem[] = [
    { title: 'Dashboard', href: '/hr', icon: LayoutDashboard },
    { title: 'HR Documents', href: '/hr/documents', icon: FileText },
    { title: 'Departments', href: '/hr/departments', icon: Building2 },
    { title: 'User Accounts', href: '/hr/users', icon: Users },
    { title: 'Employee Records', href: '/hr/employees', icon: Users },
    { title: 'Leave Management', href: '/hr/leave', icon: CalendarDays },
    { title: 'Routing Slips', href: '/hr/routing-slips', icon: Route },
    { title: 'QR Codes', href: '/hr/qr', icon: QrCode },
    { title: 'Audit Trail', href: '/hr/audit-trail', icon: Activity },
    { title: 'Archived', href: '/hr/archived', icon: Archive },
    { title: 'Reports', href: '/hr/reports', icon: BarChart3 },
];

