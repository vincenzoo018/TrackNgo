<?php

namespace App\Http\Controllers;

use App\Contracts\SignatureServiceInterface;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SignatureController extends Controller
{
    public function __construct(
        protected SignatureServiceInterface $signatureService
    ) {}

    /**
     * Apply Digital Signature with SHA-256 Cryptographic Hash Attestation.
     */
    public function applySignature(Request $request, $document_id): JsonResponse
    {
        $validated = $request->validate([
            'signature_hash'  => 'required|string',
            'action_type'     => 'required|string',
            'signature_image' => 'nullable|string',
        ]);

        $actor = $request->user() ?: auth()->user();
        $signature = $this->signatureService->applySignature((int) $document_id, $validated, $actor, $request->ip());

        return response()->json([
            'success'   => true,
            'message'   => 'Digital signature successfully applied and cryptographically sealed with SHA-256 hash.',
            'signature' => $signature,
        ]);
    }

    /**
     * Verify PIN for digital signature authorization.
     */
    public function verifyPin(Request $request): JsonResponse
    {
        $request->validate([
            'pin' => 'required|string',
        ]);

        $actor = $request->user() ?: auth()->user();
        $isValid = $this->signatureService->verifyPin($actor, $request->pin);

        return response()->json([
            'valid' => $isValid,
        ]);
    }
}
