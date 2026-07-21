import { Link } from '@inertiajs/react';
import { LucideIcon } from 'lucide-react';

interface QuickLinkItem {
    title: string;
    href: string;
    icon: LucideIcon;
    color: string; // e.g. 'text-blue-600 bg-blue-50'
}

interface QuickLinksProps {
    links: QuickLinkItem[];
    title?: string;
}

export function QuickLinks({ links, title = "Quick Links" }: QuickLinksProps) {
    return (
        <div className="rounded-2xl border border-[var(--tng-slate-200)] bg-white p-6 shadow-sm">
            <h3 className="mb-5 text-sm font-semibold text-[var(--tng-slate-800)] flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[var(--tng-blue-500)]" />
                {title}
            </h3>
            <div className="grid grid-cols-2 gap-4">
                {links.map((item) => {
                    const Icon = item.icon;
                    return (
                        <Link
                            key={item.title}
                            href={item.href}
                            className="group flex flex-col items-center justify-center rounded-xl border border-[var(--tng-slate-200)] p-5 text-center transition-all hover:border-[var(--tng-blue-300)] hover:bg-[var(--tng-blue-50)]/50 hover:shadow-md"
                        >
                            <div className={`mb-3 rounded-xl p-2.5 transition-transform group-hover:scale-110 ${item.color}`}>
                                <Icon className="h-6 w-6" />
                            </div>
                            <span className="text-sm font-medium text-[var(--tng-slate-800)]">{item.title}</span>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}
