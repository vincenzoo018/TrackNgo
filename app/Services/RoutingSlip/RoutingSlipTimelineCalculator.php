<?php

namespace App\Services\RoutingSlip;

use App\Contracts\RoutingSlipTimelineCalculatorInterface;
use App\DTOs\DocumentTimelineGroupDto;
use App\DTOs\RoutingHopDto;
use App\Models\RoutingSlip;
use App\Services\Document\DocumentConfidentiality;
use Carbon\Carbon;
use Illuminate\Support\Collection;

class RoutingSlipTimelineCalculator implements RoutingSlipTimelineCalculatorInterface
{
    /**
     * Compute document timeline groups with chronological hops,
     * time spent per hop, and SLA bottleneck evaluation.
     *
     * @param Collection<RoutingSlip> $slips
     * @return array
     */
    public function computeTimelineGroups(Collection $slips): array
    {
        if ($slips->isEmpty()) {
            return [];
        }

        // Group routing slips by document identifier
        $grouped = $slips->groupBy(function (RoutingSlip $slip) {
            return $slip->document_id ?: ($slip->tracking_number ?: $slip->slip_id);
        });

        $timelineGroups = [];

        foreach ($grouped as $docKey => $groupSlips) {
            // Sort hops in chronological sequence (oldest hop to latest hop)
            $sortedSlips = $groupSlips->sortBy(function (RoutingSlip $s) {
                $dt = $s->date_received ?: $s->created_at;
                return $dt ? Carbon::parse($dt)->timestamp : 0;
            })->values();

            $firstSlip = $sortedSlips->first();
            $doc = $firstSlip->document;

            $docId = $doc?->document_id ?? (int) $docKey;
            $trackingNumber = $doc?->tracking_number ?? ($firstSlip->tracking_number ?: 'RS-' . str_pad($firstSlip->slip_id, 4, '0', STR_PAD_LEFT));
            $referenceNumber = $doc?->reference_number ?? ('DOC-' . $docId);
            $documentTitle = $doc ? $doc->visibleTitle() : ('Document #' . $referenceNumber);
            $contentsVisible = !$doc || $doc->contentsVisibleTo();
            $documentStatus = $doc?->status ?? 'Ongoing';
            $classification = $doc?->classification ?? 'normal';
            $slaDays = (int) ($doc?->type?->arta_processing_days ?? 3);

            $hops = [];
            $bottlenecksCount = 0;
            $totalCount = $sortedSlips->count();
            $now = Carbon::now();

            for ($i = 0; $i < $totalCount; $i++) {
                /** @var RoutingSlip $slip */
                $slip = $sortedSlips[$i];
                $nextSlip = ($i < $totalCount - 1) ? $sortedSlips[$i + 1] : null;

                $slipDate = $slip->date_received 
                    ? Carbon::parse($slip->date_received) 
                    : ($slip->created_at ? Carbon::parse($slip->created_at) : (clone $now));

                if ($nextSlip) {
                    $nextDate = $nextSlip->date_received 
                        ? Carbon::parse($nextSlip->date_received) 
                        : ($nextSlip->created_at ? Carbon::parse($nextSlip->created_at) : (clone $now));
                    $diffHours = max(0, $slipDate->diffInHours($nextDate));
                } else {
                    $diffHours = max(0, $slipDate->diffInHours($now));
                }

                $timeSpentDays = round($diffHours / 24, 1);
                $timeSpentFormatted = $this->formatTimeSpent($diffHours, $timeSpentDays);
                $isBottleneck = ($timeSpentDays > $slaDays);

                if ($isBottleneck) {
                    $bottlenecksCount++;
                    $bottleneckMessage = "Sat in queue for {$timeSpentDays} days (SLA: {$slaDays} days)";
                } else {
                    $bottleneckMessage = "Processed in {$timeSpentFormatted}";
                }

                $fromName = RoutingSlipLabels::senderName($slip, $doc);

                $receiverName = $slip->receiver
                    ? $slip->receiver->name
                    : ($slip->toUser ? $slip->toUser->name : 'Pending Acknowledgement');

                $hops[] = new RoutingHopDto(
                    slipId: $slip->slip_id,
                    trackingNumber: $slip->tracking_number ?: $trackingNumber,
                    fromName: $fromName,
                    fromDepartment: RoutingSlipLabels::senderDepartment($slip, $doc),
                    toName: RoutingSlipLabels::recipientName($slip),
                    targetDepartment: RoutingSlipLabels::recipientDepartment($slip),
                    action: RoutingSlipLabels::action($slip->action),
                    instruction: !$contentsVisible ? DocumentConfidentiality::HIDDEN_REMARKS : ($slip->instruction ?: 'For review and appropriate action.'),
                    status: RoutingSlipLabels::status($slip->status),
                    dateReceived: $slipDate->toIso8601String(),
                    formattedDate: $slipDate->format('M d, Y H:i'),
                    timeSpentDays: $timeSpentDays,
                    timeSpentFormatted: $timeSpentFormatted,
                    slaDays: $slaDays,
                    isBottleneck: $isBottleneck,
                    bottleneckMessage: $bottleneckMessage,
                    receiverName: $receiverName,
                    senderName: $fromName,
                    documentId: $docId,
                    documentRef: $referenceNumber,
                    documentTitle: $documentTitle,
                    documentClassification: $classification,
                    qrData: $slip->tracking_number ?: $referenceNumber
                );
            }

            $groupDto = new DocumentTimelineGroupDto(
                documentId: $docId,
                trackingNumber: $trackingNumber,
                referenceNumber: $referenceNumber,
                documentTitle: $documentTitle,
                documentStatus: $documentStatus,
                classification: $classification,
                hopsCount: count($hops),
                hasBottlenecks: $bottlenecksCount > 0,
                bottlenecksCount: $bottlenecksCount,
                hops: $hops,
                slaDays: $slaDays
            );

            $timelineGroups[] = $groupDto->toArray();
        }

        return $timelineGroups;
    }

    /**
     * Format duration into human-readable label.
     */
    private function formatTimeSpent(float $hours, float $days): string
    {
        if ($days >= 1.0) {
            return $days . ' ' . ($days == 1.0 ? 'day' : 'days');
        }

        $intHours = max(1, (int) round($hours));
        return $intHours . ' ' . ($intHours === 1 ? 'hour' : 'hours');
    }
}
