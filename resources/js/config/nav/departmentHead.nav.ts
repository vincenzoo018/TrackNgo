import {
    LayoutDashboard,
    FileText,
    Route,
    PenTool,
    GitBranch,
    BarChart3,
    Archive,
} from 'lucide-react';
import type { NavItem } from '@/types';

export const departmentHeadNav: NavItem[] = [
    { title: 'Dashboard', href: '/department-head', icon: LayoutDashboard },
    { title: 'Endorsements', href: '/department-head/documents', icon: FileText },
    { title: 'Routing Slips', href: '/department-head/routing-slips', icon: Route },
    { title: 'Signature Setup', href: '/department-head/signature', icon: PenTool },
    { title: 'Workflow Tracker', href: '/department-head/workflow', icon: GitBranch },
    { title: 'Reports', href: '/department-head/reports', icon: BarChart3 },
    { title: 'Archived', href: '/department-head/archived', icon: Archive },
];

