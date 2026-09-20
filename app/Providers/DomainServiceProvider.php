<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;

class DomainServiceProvider extends ServiceProvider
{
    /**
     * All domain interface to implementation bindings.
     */
    public array $bindings = [
        // Routing Slip & Timeline
        \App\Contracts\RoutingSlipServiceInterface::class             => \App\Services\RoutingSlip\RoutingSlipService::class,
        \App\Contracts\RoutingSlipTimelineCalculatorInterface::class => \App\Services\RoutingSlip\RoutingSlipTimelineCalculator::class,

        // Centralized Audit Trail & Logging
        \App\Contracts\AuditTrailServiceInterface::class             => \App\Services\Audit\AuditTrailService::class,

        // User & Identity Management
        \App\Contracts\UserServiceInterface::class                   => \App\Services\User\UserService::class,

        // Documents & Workflow Lifecycle
        \App\Contracts\DocumentServiceInterface::class               => \App\Services\Document\DocumentService::class,

        // CART Compliance & Escalations
        \App\Contracts\EscalationServiceInterface::class             => \App\Services\Escalation\EscalationService::class,

        // Dashboard Analytics
        \App\Contracts\DashboardServiceInterface::class              => \App\Services\Dashboard\DashboardService::class,

        // Compliance Reporting
        \App\Contracts\ReportServiceInterface::class                 => \App\Services\Report\ReportService::class,

        // Digital Signatures
        \App\Contracts\SignatureServiceInterface::class              => \App\Services\Signature\SignatureService::class,

        // QR Code Traceability
        \App\Contracts\QrCodeServiceInterface::class                 => \App\Services\QrCode\QrCodeService::class,
    ];

    /**
     * Register services.
     */
    public function register(): void
    {
        // Bindings are automatically registered via $bindings property
    }

    /**
     * Bootstrap services.
     */
    public function boot(): void
    {
        //
    }
}
