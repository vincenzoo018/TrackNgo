import {
    LayoutDashboard,
    FileText,
    Route,
    Activity,
    Archive,
    ScanLine,
    QrCode,
    BarChart3,
} from 'lucide-react';
import type { NavItem } from '@/types';

export const receivingNav: NavItem[] = [
    { title: 'Dashboard', href: '/receiving', icon: LayoutDashboard },
    { title: 'My Documents', href: '/receiving/documents', icon: FileText },
    { title: 'Routing Slips', href: '/receiving/routing-slips', icon: Route },
    { title: 'Audit Trail', href: '/receiving/audit-trail', icon: Activity },
    { title: 'OCR Scan', href: '/receiving/ocr', icon: ScanLine },
    { title: 'QR Codes', href: '/receiving/qr', icon: QrCode },
    { title: 'Archived', href: '/receiving/archived', icon: Archive },
    { title: 'Reports', href: '/receiving/reports', icon: BarChart3 },
];
