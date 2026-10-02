<?php

namespace App\Http\Controllers;

use App\Contracts\SignatureServiceInterface;
use App\Http\Requests\StoreDocumentRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SignatureController extends Controller
{
    public function __construct(
        protected SignatureServiceInterface $signatureService
    ) {}

    /**
     * Upload the final copy with every signature stamped on it. Signatures themselves are stamped
     * automatically when each signatory forwards / approves the document (see DocumentService).
     */
    public function storeSignedCopy(Request $request, $id): JsonResponse
    {
        $request->validate([
            'file' => 'required|file|mimes:pdf|max:' . (StoreDocumentRequest::APP_MAX_UPLOAD_KB * 2),
        ]);

        $actor = $request->user() ?: auth()->user();
        $document = $this->signatureService->storeSignedCopy((int) $id, $request->file('file'), $actor, $request->ip());

        return response()->json([
            'message'          => 'Final signed copy attached to the document.',
            'signed_file_path' => $document->signed_file_path,
        ]);
    }
}
