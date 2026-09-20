import React from 'react';
import { Link } from '@inertiajs/react';
import { Edit, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TableActionButtonsProps {
    /** Optional click handler for Edit */
    onEdit?: () => void;
    /** Optional link URL for Edit */
    editHref?: string;
    /** Tooltip & accessible label for Edit button (defaults to "Edit Record") */
    editTitle?: string;
    /** Disable Edit action */
    editDisabled?: boolean;
    /** Show Edit action (defaults to true) */
    showEdit?: boolean;

    /** Optional click handler for Delete */
    onDelete?: () => void;
    /** Tooltip & accessible label for Delete button (defaults to "Delete Record") */
    deleteTitle?: string;
    /** Disable Delete action */
    deleteDisabled?: boolean;
    /** Show Delete action (defaults to true) */
    showDelete?: boolean;

    /** Optional slot for additional actions (e.g., View Eye icon, etc.) */
    extraActions?: React.ReactNode;
    /** Extra wrapper classes */
    className?: string;
}

export const TableActionButtons: React.FC<TableActionButtonsProps> = ({
    onEdit,
    editHref,
    editTitle = 'Edit Record',
    editDisabled = false,
    showEdit = true,

    onDelete,
    deleteTitle = 'Delete Record',
    deleteDisabled = false,
    showDelete = true,

    extraActions,
    className,
}) => {
    // Standard button styling: neutral gray default, system blue (#0066cc) hover, 16-20px uniform sizing
    const buttonBaseClasses =
        'p-1 text-slate-400 hover:text-[#0066cc] transition-colors rounded hover:bg-slate-100/70 focus:outline-none focus:ring-2 focus:ring-[#0066cc]/40 active:scale-95 disabled:opacity-40 disabled:pointer-events-none cursor-pointer';

    return (
        <div className={cn('flex items-center justify-end gap-4 shrink-0', className)}>
            {extraActions}

            {showEdit && (
                editHref ? (
                    <Link
                        href={editHref}
                        title={editTitle}
                        aria-label={editTitle}
                        className={buttonBaseClasses}
                    >
                        <Edit className="h-[18px] w-[18px]" />
                    </Link>
                ) : (
                    <button
                        type="button"
                        onClick={onEdit}
                        disabled={editDisabled}
                        title={editTitle}
                        aria-label={editTitle}
                        className={buttonBaseClasses}
                    >
                        <Edit className="h-[18px] w-[18px]" />
                    </button>
                )
            )}

            {showDelete && (
                <button
                    type="button"
                    onClick={onDelete}
                    disabled={deleteDisabled}
                    title={deleteTitle}
                    aria-label={deleteTitle}
                    className={buttonBaseClasses}
                >
                    <Trash2 className="h-[18px] w-[18px]" />
                </button>
            )}
        </div>
    );
};

export default TableActionButtons;
