<?php

namespace App\Services\RoutingSlip;

use App\Models\Document;
use App\Models\RoutingSlip;

/**
 * Display labels for a routing slip's sender, recipient, action and status, shared by the
 * routing slip table, the hop timeline and the QR code registry so they always agree.
 */
final class RoutingSlipLabels
{
    public const DEPARTMENT_POOL = 'Department Pool';

    public static function senderName(RoutingSlip $slip, ?Document $doc): string
    {
        return $slip->sender_name
            ?: ($slip->fromUser ? $slip->fromUser->name : ($doc && $doc->submitter ? $doc->submitter->name : 'Staff Submitter'));
    }

    public static function senderDepartment(RoutingSlip $slip, ?Document $doc): string
    {
        return $slip->fromDepartment
            ? $slip->fromDepartment->department_name
            : ($slip->fromUser && $slip->fromUser->department
                ? $slip->fromUser->department->department_name
                : ($doc && $doc->department ? $doc->department->department_name : 'General Office'));
    }

    public static function recipientDepartment(RoutingSlip $slip): string
    {
        return $slip->targetDepartment
            ? $slip->targetDepartment->department_name
            : ($slip->toUser && $slip->toUser->department
                ? $slip->toUser->department->department_name
                : self::DEPARTMENT_POOL);
    }

    public static function recipientName(RoutingSlip $slip): string
    {
        return $slip->toUser ? $slip->toUser->name : self::DEPARTMENT_POOL;
    }

    /** Endorse / Return / Approve / Forward. */
    public static function action(?string $action): string
    {
        return match (strtolower($action ?? 'forward')) {
            'endorse', 'endorsed' => 'Endorse',
            'return', 'returned'  => 'Return',
            'approve', 'approved' => 'Approve',
            default               => 'Forward',
        };
    }

    /** Completed / Returned / Active (pending, active and received slips are all still active). */
    public static function status(?string $status): string
    {
        return match (strtolower($status ?? 'pending')) {
            'completed' => 'Completed',
            'returned'  => 'Returned',
            default     => 'Active',
        };
    }
}
