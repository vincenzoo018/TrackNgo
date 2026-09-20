<?php

namespace App\DTOs;

class RoutingHopDto
{
    public function __construct(
        public int $slipId,
        public string $trackingNumber,
        public string $fromName,
        public string $fromDepartment,
        public string $toName,
        public string $targetDepartment,
        public string $action,
        public string $instruction,
        public string $status,
        public string $dateReceived,
        public string $formattedDate,
        public float $timeSpentDays,
        public string $timeSpentFormatted,
        public int $slaDays,
        public bool $isBottleneck,
        public string $bottleneckMessage,
        public string $receiverName,
        public string $senderName,
        public int $documentId,
        public string $documentRef,
        public string $documentTitle,
        public string $documentClassification,
        public string $qrData
    ) {}

    public function toArray(): array
    {
        return [
            'slip_id'                 => $this->slipId,
            'tracking_number'         => $this->trackingNumber,
            'from_name'               => $this->fromName,
            'from_department'         => $this->fromDepartment,
            'to_name'                 => $this->toName,
            'target_department'       => $this->targetDepartment,
            'action'                  => $this->action,
            'instruction'             => $this->instruction,
            'status'                  => $this->status,
            'date_received'           => $this->dateReceived,
            'formatted_date'          => $this->formattedDate,
            'time_spent_days'         => $this->timeSpentDays,
            'time_spent_formatted'    => $this->timeSpentFormatted,
            'sla_days'                => $this->slaDays,
            'is_bottleneck'           => $this->isBottleneck,
            'bottleneck_message'      => $this->bottleneckMessage,
            'receiver_name'           => $this->receiverName,
            'sender_name'             => $this->senderName,
            'document_id'             => $this->documentId,
            'document_ref'            => $this->documentRef,
            'document_title'          => $this->documentTitle,
            'document_classification' => $this->documentClassification,
            'qr_data'                 => $this->qrData,
        ];
    }
}
