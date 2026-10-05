<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreDocumentRevisionRequest;
use App\Models\Document;
use App\Services\Document\DocumentRevisionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;

/**
 * Document versions: upload a corrected file as a new version (POST /documents/{id}/revisions) and the
 * Version History page ({role}/documents/{id}/versions). Earlier versions are downloaded through the
 * password-checked export (DocumentController::export, revision_id).
 */
class DocumentRevisionController extends Controller
{
    public function __construct(
        protected DocumentRevisionService $revisionService
    ) {}

    public function store(StoreDocumentRevisionRequest $request, $id): JsonResponse|RedirectResponse
    {
        $document = $request->document();
        $hadSignatures = $document->hasSignaturesOnCurrentVersion();
        $revision = $this->revisionService->create(
            $document, $request->file('file'), $request->input('reason'), $request->user(), $request->ip(), $request->input('ocr_text')
        );

        $message = "Version {$revision->version_number} is now the current file."
            . ($hadSignatures ? ' The signatories sign this version again as it reaches them.' : '');

        if ($request->expectsJson()) {
            return response()->json(['message' => $message, 'version_number' => $revision->version_number]);
        }

        return redirect()->back()->with('success', $message);
    }

    public function index(Request $request, $id)
    {
        $document = Document::findOrFail($id);
        Gate::authorize('viewRevisions', $document);

        return Inertia::render('receiving/documents/VersionHistory', [
            'dbDocument' => $document->only(['document_id', 'reference_number', 'tracking_number', 'title', 'status', 'version']),
            'revisions'  => $this->revisionService->present($document),
        ]);
    }
}
