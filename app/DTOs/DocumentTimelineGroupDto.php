<?php

namespace App\DTOs;

class DocumentTimelineGroupDto
{
    /**
     * @param int $documentId
     * @param string $trackingNumber
     * @param string $referenceNumber
     * @param string $documentTitle
     * @param string $documentStatus
     * @param string $classification
     * @param int $hopsCount
     * @param bool $hasBottlenecks
     * @param int $bottlenecksCount
     * @param RoutingHopDto[] $hops
     * @param int $slaDays
     */
    public function __construct(
        public int $documentId,
        public string $trackingNumber,
        public string $referenceNumber,
        public string $documentTitle,
        public string $documentStatus,
        public string $classification,
        public int $hopsCount,
        public bool $hasBottlenecks,
        public int $bottlenecksCount,
        public array $hops,
        public int $slaDays
    ) {}

    public function toArray(): array
    {
        return [
            'document_id'       => $this->documentId,
            'tracking_number'   => $this->trackingNumber,
            'reference_number'  => $this->referenceNumber,
            'document_title'    => $this->documentTitle,
            'document_status'   => $this->documentStatus,
            'classification'    => $this->classification,
            'hops_count'        => $this->hopsCount,
            'has_bottlenecks'   => $this->hasBottlenecks,
            'bottlenecks_count' => $this->bottlenecksCount,
            'sla_days'          => $this->slaDays,
            'hops'              => array_map(fn (RoutingHopDto $h) => $h->toArray(), $this->hops),
        ];
    }
}
