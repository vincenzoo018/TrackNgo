<?php

namespace App\Http\Controllers;

use App\Http\Requests\UpdateDocumentMetadataRequest;
use App\Services\Document\DocumentMetadataService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;

/** Edit Metadata (PUT /documents/{id}/metadata); who may do it is decided by DocumentPolicy::editMetadata */
class DocumentMetadataController extends Controller
{
    public function __construct(
        protected DocumentMetadataService $metadataService
    ) {}

    public function update(UpdateDocumentMetadataRequest $request, $id): JsonResponse|RedirectResponse
    {
        $changes = $this->metadataService->update($request->document(), $request->validated(), $request->user(), $request->ip());
        $message = count($changes) === 1
            ? reset($changes)['label'] . ' updated.'
            : count($changes) . ' details updated.';

        if ($request->expectsJson()) {
            return response()->json(['message' => $message, 'changed' => array_keys($changes)]);
        }

        return redirect()->back()->with('success', $message);
    }
}
