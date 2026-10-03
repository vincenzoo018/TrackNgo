<?php

namespace App\Services\QrCode;

use App\Contracts\QrCodeServiceInterface;
use App\Models\Department;
use App\Models\User;
use App\Services\RoutingSlip\RoutingSlipLabels;
use App\Services\RoutingSlip\RoutingSlipRepository;
use Carbon\Carbon;

class QrCodeService implements QrCodeServiceInterface
{
    public function __construct(
        protected RoutingSlipRepository $repository
    ) {}

    public function getQrCodesPayload(User $user): array
    {
        $isFullAccess = $user->hasFullAccess();

        $slips = $this->repository->getSlipsForUser($user);

        $qrItems = $slips->map(function ($slip) {
            $doc = $slip->document;
            $trackingNum = $slip->tracking_number ?: ($doc ? $doc->tracking_number : 'RS-' . str_pad($slip->slip_id, 4, '0', STR_PAD_LEFT));
            $createdAt = $slip->created_at ? Carbon::parse($slip->created_at) : now();

            return [
                'qr_id'           => 'QR-' . str_pad($slip->slip_id, 4, '0', STR_PAD_LEFT),
                'slip_id'         => $slip->slip_id,
                'document_id'     => $slip->document_id,
                'tracking_number' => $trackingNum,
                'document_ref'    => $doc ? $doc->reference_number : 'DOC-' . $slip->document_id,
                'document_title'  => $doc ? $doc->visibleTitle() : 'Document #' . $slip->document_id,
                'document_status' => $doc ? $doc->status : 'Ongoing',
                'classification'  => $doc ? $doc->classification : 'normal',
                'qr_value'        => $trackingNum,
                'from_department' => RoutingSlipLabels::senderDepartment($slip, $doc),
                'to_department'   => RoutingSlipLabels::recipientDepartment($slip),
                'from_name'       => $slip->sender_name ?: ($slip->fromUser ? $slip->fromUser->name : 'Staff Submitter'),
                'to_name'         => RoutingSlipLabels::recipientName($slip),
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
            'currentRole'  => $user->roleSlug(),
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
