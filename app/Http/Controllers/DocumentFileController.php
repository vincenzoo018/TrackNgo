<?php

namespace App\Http\Controllers;

use App\Models\Document;
use App\Models\DocumentAttachment;
use App\Models\DocumentRevision;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\Response;

/**
 * The only way to open a document's files, which are private (Document::FILE_DISK): shown in the browser to the
 * people who may open the document (DocumentConfidentiality). Viewing is not PIN-gated; downloading through Export
 * is (DocumentController::export). The URL ends with the stored file name so the viewer knows the file type.
 *
 *   /documents/{id}/files/main/{name}                   current main file
 *   /documents/{id}/files/signed/{name}                 copy with the signatures stamped
 *   /documents/{id}/files/attachment/{fileId}/{name}    correction / supporting file
 *   /documents/{id}/files/revision/{fileId}/{name}      earlier version of the main file
 *   /documents/{id}/files/revision-signed/{fileId}/{name} signed copy of an earlier version
 */
class DocumentFileController extends Controller
{
    /** main / signed */
    public function show(Request $request, int $id, string $kind, string $name): Response
    {
        return $this->serve($request, $id, $kind, null);
    }

    /** attachment / revision / revision-signed */
    public function item(Request $request, int $id, string $kind, int $fileId, string $name): Response
    {
        return $this->serve($request, $id, $kind, $fileId);
    }

    private function serve(Request $request, int $id, string $kind, ?int $fileId): Response
    {
        $document = Document::findOrFail($id);
        abort_unless($document->contentsVisibleTo($request->user()), 403, 'Only the people handling this document can open its files.');

        $path = match ($kind) {
            'main'            => $document->attachment_path,
            'signed'          => $document->signed_file_path,
            'attachment'      => DocumentAttachment::where('document_id', $id)->findOrFail($fileId)->file_path,
            'revision'        => DocumentRevision::where('document_id', $id)->findOrFail($fileId)->file_path,
            'revision-signed' => DocumentRevision::where('document_id', $id)->findOrFail($fileId)->signed_file_path,
            default           => null,
        };

        $disk = Storage::disk(Document::FILE_DISK);
        abort_if(!$path || !$disk->exists($path), 404, 'The file is missing from storage.');

        return $disk->response($path, basename($path), [
            // Never kept by shared caches or proxies
            'Cache-Control'          => 'private, no-store',
            'X-Content-Type-Options' => 'nosniff',
        ], 'inline');
    }
}
