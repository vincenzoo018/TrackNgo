<?php

namespace App\Services\QrCode;

use App\Contracts\QrCodeServiceInterface;
use App\Models\Department;
use App\Models\RoutingSlip;
use App\Models\User;
use Carbon\Carbon;

class QrCodeService implements QrCodeServiceInterface
{
    public function getQrCodesPayload(User $user): array
    {
        $userRole = strtolower($user->role->role_name ?? '');
        $isFullAccess = in_array($userRole, ['admin', 'cart']);

        $currentRole = match ($userRole) {
            'admin'           => 'admin',
            'cart'            => 'cart',
            'receiving clerk' => 'receiving',
            'department head' => 'department-head',
            'mayor'           => 'mayor',
            'hr'              => 'hr',
            default           => 'receiving',
        };

        $query = RoutingSlip::with([
            'document.department',
            'document.type',
            'document.submitter.role',
            'fromUser.role',
            'fromUser.department',
            'toUser.role',
            'toUser.department',
            'fromDepartment',
            'targetDepartment',
            'receiver',
        ]);

        if (!$isFullAccess) {
            $query->where(function ($q) use ($user) {
                $q->where('from_user_id', $user->id)
                  ->orWhere('to_user_id', $user->id);

                if ($user->department_id) {
                    $q->orWhere('from_department_id', $user->department_id)
                      ->orWhere('target_department_id', $user->department_id);
                }

                $q->orWhereHas('document', function ($docQuery) use ($user) {
                    $docQuery->where('submitted_by', $user->id)
                             ->orWhere('current_holder_id', $user->id);

                    if ($user->department_id) {
                        $docQuery->orWhere('department_id', $user->department_id)
                                 ->orWhere('current_holder_department_id', $user->department_id);
                    }
                });
            });
        }

        $slips = $query->orderBy('slip_id', 'desc')->get();

        $qrItems = $slips->map(function ($slip) {
            $doc = $slip->document;
            $trackingNum = $slip->tracking_number ?: ($doc ? $doc->tracking_number : 'RS-' . str_pad($slip->slip_id, 4, '0', STR_PAD_LEFT));
            $createdAt = $slip->created_at ? Carbon::parse($slip->created_at) : now();

            $fromDept = $slip->fromDepartment
                ? $slip->fromDepartment->department_name
                : ($slip->fromUser && $slip->fromUser->department
                    ? $slip->fromUser->department->department_name
                    : ($doc && $doc->department ? $doc->department->department_name : 'General Office'));

            $toDept = $slip->targetDepartment
                ? $slip->targetDepartment->department_name
                : ($slip->toUser && $slip->toUser->department
                    ? $slip->toUser->department->department_name
                    : 'Department Pool');

            return [
                'qr_id'           => 'QR-' . str_pad($slip->slip_id, 4, '0', STR_PAD_LEFT),
                'slip_id'         => $slip->slip_id,
                'document_id'     => $slip->document_id,
                'tracking_number' => $trackingNum,
                'document_ref'    => $doc ? $doc->reference_number : 'DOC-' . $slip->document_id,
                'document_title'  => $doc ? $doc->title : 'Document #' . $slip->document_id,
                'document_status' => $doc ? $doc->status : 'Ongoing',
                'classification'  => $doc ? $doc->classification : 'normal',
                'qr_value'        => $trackingNum,
                'from_department' => $fromDept,
                'to_department'   => $toDept,
                'from_name'       => $slip->sender_name ?: ($slip->fromUser ? $slip->fromUser->name : 'Staff Submitter'),
                'to_name'         => $slip->toUser ? $slip->toUser->name : 'Department Pool',
                'action'          => ucfirst(strtolower($slip->action ?? 'forward')),
                'status'          => ucfirst(strtolower($slip->status ?? 'active')),
                'date_generated'  => $createdAt->toIso8601String(),
                'formatted_date'  => $createdAt->format('M d, Y h:i A'),
            ];
        })->toArray();

        $activeCodes = count(array_filter($qrItems, fn($i) => strtolower($i['status']) !== 'completed'));

        $departments = Department::where('is_active', true)->orderBy('department_name')->get(['department_id', 'department_name', 'code']);

        return [
            'qrCodes'      => $qrItems,
            'departments'  => $departments,
            'isFullAccess' => $isFullAccess,
            'currentRole'  => $currentRole,
            'userRoleName' => $user->role->role_name ?? 'User',
            'userName'     => $user->name,
            'metrics'      => [
                'total_generated' => count($qrItems),
                'active_codes'    => $activeCodes,
                'scanned_today'   => count($qrItems),
            ],
        ];
    }
}
