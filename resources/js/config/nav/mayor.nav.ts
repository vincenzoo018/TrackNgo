import {
    LayoutDashboard,
    FileCheck,
    Route,
    PenTool,
    Activity,
    BarChart3,
    Archive,
    QrCode,
} from 'lucide-react';
import type { NavItem } from '@/types';

export const mayorNav: NavItem[] = [
    { title: 'Dashboard', href: '/mayor', icon: LayoutDashboard },
    { title: 'Final Approval', href: '/mayor/documents', icon: FileCheck },
    { title: 'Routing Slips', href: '/mayor/routing-slips', icon: Route },
    { title: 'QR Codes', href: '/mayor/qr', icon: QrCode },
    { title: 'Signature Setup', href: '/mayor/signature', icon: PenTool },
    { title: 'Audit Trail', href: '/mayor/audit-trail', icon: Activity },
    { title: 'Reports', href: '/mayor/reports', icon: BarChart3 },
    { title: 'Archived', href: '/mayor/archived', icon: Archive },
];

