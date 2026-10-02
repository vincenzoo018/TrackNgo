import { Activity, BarChart3, Bell, FileSearch, LayoutDashboard, MonitorCheck, ShieldAlert } from 'lucide-react';
import type { NavItem } from '@/types';

// CART is a monitoring layer over the workflow: it observes and escalates, it does not process documents
export const cartNav: NavItem[] = [
    { title: 'Dashboard', href: '/cart', icon: LayoutDashboard },
    { title: 'Document Monitoring', href: '/cart/monitoring', icon: MonitorCheck },
    { title: 'ARTA / Escalations', href: '/cart/escalations', icon: ShieldAlert },
    { title: 'Alerts', href: '/cart/alerts', icon: Bell },
    { title: 'Audit Trail', href: '/cart/audit-trail', icon: Activity },
    { title: 'Reports', href: '/cart/reports', icon: BarChart3 },
    { title: 'Search Documents', href: '/cart/search', icon: FileSearch },
];
