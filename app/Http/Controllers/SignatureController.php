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
            // PDFs and photos are stamped into a PDF; Word files stay Word files with the signatures added
            'file'       => 'required|file|mimes:pdf,docx|max:' . (StoreDocumentRequest::APP_MAX_UPLOAD_KB * 2),
            // How many signatures the uploaded copy carries (defaults to all recorded so far)
            'signatures' => 'nullable|integer|min:1',
            // The version of the document file the signatures were stamped on
            'version'    => 'nullable|integer|min:1',
        ]);

        $actor = $request->user() ?: auth()->user();
        $document = $this->signatureService->storeSignedCopy(
            (int) $id, $request->file('file'), $actor, $request->ip(),
            $request->filled('signatures') ? (int) $request->input('signatures') : null,
            $request->filled('version') ? (int) $request->input('version') : null
        );

        return response()->json([
            'message'                => $document->hasFinalSignedCopy() ? 'Final signed copy attached to the document.' : 'Signed copy updated.',
            'signed_file_path'       => $document->signed_file_path,
            'signed_copy_signatures' => $document->signed_copy_signatures,
        ]);
    }
}
