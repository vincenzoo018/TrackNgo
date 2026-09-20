<?php

namespace App\Services\RoutingSlip;

use App\DTOs\RoutingSlipItemDto;
use App\Models\RoutingSlip;
use Carbon\Carbon;

class RoutingSlipDataTransformer
{
    /**
     * Standardize routing slip into presentation DTO for frontend table and modal consumption.
     */
    public function transform(RoutingSlip $slip): RoutingSlipItemDto
    {
        $doc = $slip->document;

        // Determine sender name and department
        $fromName = $slip->sender_name
            ?: ($slip->fromUser ? $slip->fromUser->name : ($doc && $doc->submitter ? $doc->submitter->name : 'Staff Submitter'));

        $fromDept = $slip->fromDepartment
            ? $slip->fromDepartment->department_name
            : ($slip->fromUser && $slip->fromUser->department
                ? $slip->fromUser->department->department_name
                : ($doc && $doc->department ? $doc->department->department_name : 'General Office'));

        // Determine recipient name and department
        $toDept = $slip->targetDepartment
            ? $slip->targetDepartment->department_name
            : ($slip->toUser && $slip->toUser->department
                ? $slip->toUser->department->department_name
                : 'Department Pool');

        $toName = $slip->toUser
            ? $slip->toUser->name
            : 'Department Pool';

        // Standardize action type
        $rawAction = strtolower($slip->action ?? 'forward');
        $action = match ($rawAction) {
            'endorse', 'endorsed' => 'Endorse',
            'return', 'returned'   => 'Return',
            'approve', 'approved' => 'Approve',
            default               => 'Forward',
        };

        // Standardize status: Active, Completed, Returned
        $rawStatus = strtolower($slip->status ?? 'pending');
        $status = match ($rawStatus) {
            'completed' => 'Completed',
            'returned'  => 'Returned',
            default     => 'Active', // pending, active, received
        };

        // Tracking number fallback
        $trackingNumber = $slip->tracking_number
            ?: ($doc ? $doc->tracking_number : 'RS-' . str_pad($slip->slip_id, 4, '0', STR_PAD_LEFT));

        $createdAt = $slip->created_at ? Carbon::parse($slip->created_at) : Carbon::now();

        return new RoutingSlipItemDto(
            slipId: $slip->slip_id,
            formattedSlipId: 'RS-' . str_pad($slip->slip_id, 4, '0', STR_PAD_LEFT),
            trackingNumber: $trackingNumber,
            documentId: $slip->document_id,
            documentRef: $doc ? $doc->reference_number : 'DOC-' . $slip->document_id,
            documentTitle: $doc ? $doc->title : 'Document #' . $slip->document_id,
            documentStatus: $doc ? $doc->status : 'Ongoing',
            documentClassification: $doc ? $doc->classification : 'normal',
            fromName: $fromName,
            fromDepartment: $fromDept,
            fromRole: $slip->fromUser && $slip->fromUser->role ? $slip->fromUser->role->role_name : 'Staff',
            toName: $toName,
            toDepartment: $toDept,
            action: $action,
            instruction: $slip->instruction ?: 'For review and appropriate action.',
            status: $status,
            date: $createdAt->toIso8601String(),
            formattedDate: $createdAt->format('Y-m-d'),
            formattedDatetime: $createdAt->format('M d, Y h:i A'),
            stopNumber: 'Stop #1',
            qrData: $trackingNumber ?: ($doc ? $doc->reference_number : 'DOC')
        );
    }
}
