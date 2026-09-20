<?php

namespace App\Contracts;

use Illuminate\Support\Collection;

interface RoutingSlipTimelineCalculatorInterface
{
    /**
     * Compute document timeline groups with chronological hops,
     * time spent per hop, and SLA bottleneck evaluation.
     *
     * @param Collection $slips
     * @return array
     */
    public function computeTimelineGroups(Collection $slips): array;
}
