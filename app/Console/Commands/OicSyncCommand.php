<?php

namespace App\Console\Commands;

use App\Services\Oic\OicService;
use Illuminate\Console\Command;

class OicSyncCommand extends Command
{
    protected $signature = 'oic:sync';

    protected $description = 'Hand documents over to Officers-in-Charge whose designation started, and give them back when it ended (LGC Sec. 46)';

    public function handle(OicService $oic): int
    {
        $stats = $oic->sync();

        $this->info("Handed over to an OIC: {$stats['handed_over']}, given back to the official: {$stats['given_back']}.");

        return self::SUCCESS;
    }
}
