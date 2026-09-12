import {
    LayoutDashboard,
    ShieldAlert,
    FileText,
    Route,
    QrCode,
    Activity,
    Archive,
    MessageSquare,
    BarChart3,
    Users,
    FileCode2,
} from 'lucide-react';
import type { NavItem } from '@/types';

export const adminNav: NavItem[] = [
    { title: 'Dashboard', href: '/admin', icon: LayoutDashboard },
    { title: 'Escalated Docs (Unified with ARTA Monitoring)', href: '/admin/escalations', icon: ShieldAlert },
    { title: 'All Documents', href: '/admin/documents', icon: FileText },
    { title: 'Routing Slips', href: '/admin/routing-slips', icon: Route },
    { title: 'QR Codes', href: '/admin/qr', icon: QrCode },
    { title: 'Audit Trail', href: '/admin/audit-trail', icon: Activity },
    { title: 'Archived', href: '/admin/archived', icon: Archive },
    { title: 'SMS Dashboard', href: '/admin/notifications/sms', icon: MessageSquare },
    { title: 'Compliance Reports', href: '/admin/compliance-reports', icon: BarChart3 },
    { title: 'Reports', href: '/admin/reports', icon: BarChart3 },
    { title: 'User Accounts', href: '/admin/users', icon: Users },
    { title: 'Document Templates', href: '/admin/templates', icon: FileCode2 },
];
