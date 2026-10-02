<?php

namespace App\Console\Commands;

use App\Services\Cart\ArtaMonitor;
use Illuminate\Console\Command;

class ArtaMonitorCommand extends Command
{
    protected $signature = 'arta:monitor';

    protected $description = 'Evaluate active documents against their ARTA processing period and record escalations / CART alerts';

    public function handle(ArtaMonitor $monitor): int
    {
        $stats = $monitor->run();

        $this->info("Escalations recorded: {$stats['escalated']}, alerts raised: {$stats['alerts']}, escalations closed: {$stats['closed']}.");

        return self::SUCCESS;
    }
}
