<?php

namespace App\Console\Commands;

use App\Services\Document\DeemedApprovalService;
use Illuminate\Console\Command;

class DeemedApprovalCommand extends Command
{
    protected $signature = 'documents:deemed-approvals';

    protected $description = 'Mark documents whose processing period lapsed as deemed approved (RA 11032 Sec. 10, LGC Sec. 54) and send them for release';

    public function handle(DeemedApprovalService $service): int
    {
        $stats = $service->run();

        $this->info("Deemed approved: {$stats['arta']} under RA 11032, {$stats['lgc']} ordinance(s) / resolution(s) under LGC Sec. 54.");

        return self::SUCCESS;
    }
}
