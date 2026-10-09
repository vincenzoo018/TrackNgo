import {
    LayoutDashboard,
    FileText,
    Route,
    Activity,
    Archive,
    QrCode,
    BarChart3,
    CalendarClock,
    MapPin,
} from 'lucide-react';
import type { NavItem } from '@/types';

export const receivingNav: NavItem[] = [
    { title: 'Dashboard', href: '/receiving', icon: LayoutDashboard },
    { title: 'My Documents', href: '/receiving/documents', icon: FileText },
    { title: 'Routing Slips', href: '/receiving/routing-slips', icon: Route },
    { title: 'ARTA Timeline', href: '/receiving/arta-timeline', icon: CalendarClock },
    { title: 'Location Map', href: '/receiving/location-map', icon: MapPin },
    { title: 'QR Codes', href: '/receiving/qr', icon: QrCode },
    { title: 'Audit Trail', href: '/receiving/audit-trail', icon: Activity },
    { title: 'Archived', href: '/receiving/archived', icon: Archive },
    { title: 'Reports', href: '/receiving/reports', icon: BarChart3 },
];
