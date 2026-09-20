<?php

namespace App\Http\Controllers;

use App\Contracts\QrCodeServiceInterface;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class QrCodeController extends Controller
{
    public function __construct(
        protected QrCodeServiceInterface $qrCodeService
    ) {}

    /**
     * Display the QR Codes traceability index page.
     */
    public function index(Request $request): Response
    {
        $actor = $request->user() ?: auth()->user();
        $payload = $this->qrCodeService->getQrCodesPayload($actor);

        return Inertia::render('qr-codes/Index', $payload);
    }
}
