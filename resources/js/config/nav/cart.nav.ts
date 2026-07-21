import {
    LayoutDashboard,
    FileText,
    Route,
    Activity,
    ShieldAlert,
    MessageSquare,
    Bell,
    BarChart3,
} from 'lucide-react';
import type { NavItem } from '@/types';

export const cartNav: NavItem[] = [
    { title: 'Dashboard', href: '/cart', icon: LayoutDashboard },
    { title: 'ARTA Monitoring', href: '/cart/escalations', icon: ShieldAlert },
    { title: 'Escalated Docs', href: '/cart/escalations/documents', icon: FileText },
    { title: 'All Documents', href: '/cart/documents', icon: FileText },
    { title: 'Routing Slips', href: '/cart/routing-slips', icon: Route },
    { title: 'Audit Trail', href: '/cart/audit-trail', icon: Activity },
    { title: 'SMS Dashboard', href: '/cart/notifications/sms', icon: MessageSquare },
    { title: 'In-App Alerts', href: '/cart/notifications/alerts', icon: Bell },
    { title: 'Compliance Reports', href: '/cart/reports', icon: BarChart3 },
];
