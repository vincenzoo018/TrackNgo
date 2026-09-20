<?php

namespace App\DTOs;

class RoutingSlipItemDto
{
    public function __construct(
        public int $slipId,
        public string $formattedSlipId,
        public string $trackingNumber,
        public int $documentId,
        public string $documentRef,
        public string $documentTitle,
        public string $documentStatus,
        public string $documentClassification,
        public string $fromName,
        public string $fromDepartment,
        public string $fromRole,
        public string $toName,
        public string $toDepartment,
        public string $action,
        public string $instruction,
        public string $status,
        public string $date,
        public string $formattedDate,
        public string $formattedDatetime,
        public string $stopNumber,
        public string $qrData
    ) {}

    public function toArray(): array
    {
        return [
            'slip_id'                 => $this->slipId,
            'formatted_slip_id'       => $this->formattedSlipId,
            'tracking_number'         => $this->trackingNumber,
            'document_id'             => $this->documentId,
            'document_ref'            => $this->documentRef,
            'document_title'          => $this->documentTitle,
            'document_status'         => $this->documentStatus,
            'document_classification' => $this->documentClassification,
            'from_name'               => $this->fromName,
            'from_department'         => $this->fromDepartment,
            'from_role'               => $this->fromRole,
            'to_name'                 => $this->toName,
            'to_department'           => $this->toDepartment,
            'action'                  => $this->action,
            'instruction'             => $this->instruction,
            'status'                  => $this->status,
            'date'                    => $this->date,
            'formatted_date'          => $this->formattedDate,
            'formatted_datetime'      => $this->formattedDatetime,
            'stop_number'             => $this->stopNumber,
            'qr_data'                 => $this->qrData,
        ];
    }
}
