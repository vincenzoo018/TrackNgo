import {
    LayoutDashboard,
    FileText,
    Route,
    Activity,
    ShieldAlert,
    MessageSquare,
    BarChart3,
    Archive,
    QrCode,
} from 'lucide-react';
import type { NavItem } from '@/types';

export const cartNav: NavItem[] = [
    { title: 'Dashboard', href: '/cart', icon: LayoutDashboard },
    { title: 'Escalated Docs', href: '/cart/escalations', icon: ShieldAlert },
    { title: 'All Documents', href: '/cart/documents', icon: FileText },
    { title: 'Routing Slips', href: '/cart/routing-slips', icon: Route },
    { title: 'QR Codes', href: '/cart/qr', icon: QrCode },
    { title: 'Audit Trail', href: '/cart/audit-trail', icon: Activity },
    { title: 'Archived', href: '/cart/archived', icon: Archive },
    { title: 'SMS Dashboard', href: '/cart/notifications/sms', icon: MessageSquare },
    { title: 'Compliance Reports', href: '/cart/reports', icon: BarChart3 },
];
