<?php

namespace App\Services\RoutingSlip;

use App\DTOs\RoutingSlipItemDto;
use App\Models\RoutingSlip;
use App\Services\Document\DocumentConfidentiality;
use Carbon\Carbon;

class RoutingSlipDataTransformer
{
    /**
     * Standardize routing slip into presentation DTO for frontend table and modal consumption.
     */
    public function transform(RoutingSlip $slip): RoutingSlipItemDto
    {
        $doc = $slip->document;

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
            documentTitle: $doc ? $doc->visibleTitle() : 'Document #' . $slip->document_id,
            documentStatus: $doc ? $doc->status : 'Ongoing',
            documentClassification: $doc ? $doc->classification : 'normal',
            fromName: RoutingSlipLabels::senderName($slip, $doc),
            fromDepartment: RoutingSlipLabels::senderDepartment($slip, $doc),
            fromRole: $slip->fromUser && $slip->fromUser->role ? $slip->fromUser->role->role_name : 'Staff',
            toName: RoutingSlipLabels::recipientName($slip),
            toDepartment: RoutingSlipLabels::recipientDepartment($slip),
            action: RoutingSlipLabels::action($slip->action),
            instruction: $doc && !$doc->contentsVisibleTo()
                ? DocumentConfidentiality::HIDDEN_REMARKS
                : ($slip->instruction ?: 'For review and appropriate action.'),
            status: RoutingSlipLabels::status($slip->status),
            date: $createdAt->toIso8601String(),
            formattedDate: $createdAt->format('Y-m-d'),
            formattedDatetime: $createdAt->format('M d, Y h:i A'),
            stopNumber: 'Stop #1',
            qrData: $trackingNumber ?: ($doc ? $doc->reference_number : 'DOC')
        );
    }
}
