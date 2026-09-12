import {
    LayoutDashboard,
    FileText,
    Route,
    Activity,
    BarChart3,
    Archive,
    QrCode,
} from 'lucide-react';
import type { NavItem } from '@/types';

export const departmentHeadNav: NavItem[] = [
    { title: 'Dashboard', href: '/department-head', icon: LayoutDashboard },
    { title: 'Endorsements', href: '/department-head/documents', icon: FileText },
    { title: 'Routing Slips', href: '/department-head/routing-slips', icon: Route },
    { title: 'QR Codes', href: '/department-head/qr', icon: QrCode },
    { title: 'Audit Trail', href: '/department-head/audit-trail', icon: Activity },
    { title: 'Reports', href: '/department-head/reports', icon: BarChart3 },
    { title: 'Archived', href: '/department-head/archived', icon: Archive },
];
