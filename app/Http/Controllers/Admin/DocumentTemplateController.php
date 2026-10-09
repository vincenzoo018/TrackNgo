<?php

namespace App\Http\Controllers\Admin;

use App\Contracts\AuditTrailServiceInterface;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreDocumentRequest;
use App\Models\Document;
use App\Models\DocumentTemplate;
use App\Models\DocumentType;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Admin → Document Templates: blank forms and letter templates (PDF / Word) kept as private files. Staff download
 * them from the "Template" link of the filing form for the selected document type.
 */
class DocumentTemplateController extends Controller
{
    private const DIRECTORY = 'templates';

    public function __construct(
        protected AuditTrailServiceInterface $auditTrail
    ) {}

    public function index(): Response
    {
        return Inertia::render('admin/templates/Index', [
            'templates'     => DocumentTemplate::with(['type', 'creator', 'updater'])->orderBy('name')->get()->map(fn (DocumentTemplate $t) => [
                'id'          => $t->id,
                'name'        => $t->name,
                'description' => $t->description,
                'type_id'     => $t->type_id,
                'type_name'   => $t->type?->type_name,
                'file_name'   => $t->file_name,
                'file_size'   => $t->file_size,
                'is_active'   => $t->is_active,
                'updated_by'  => $t->updater?->name ?? $t->creator?->name,
                'updated_at'  => $t->updated_at?->toIso8601String(),
            ]),
            'documentTypes' => DocumentType::where('is_active', true)->orderBy('type_name')->get(['type_id', 'type_name']),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $this->validated($request, true);
        $file = $request->file('file');
        $template = DocumentTemplate::create($data + $this->storeFile($file) + ['created_by' => $request->user()->id, 'is_active' => true]);

        $this->auditTrail->logUserAction('Template Created', "Document template \"{$template->name}\" uploaded ({$template->file_name}).", $request->user(), $request->ip());

        return redirect()->back()->with('success', "Template \"{$template->name}\" added.");
    }

    /** Details, and optionally a replacement file (the old file is removed once the new one is saved) */
    public function update(Request $request, int $id): RedirectResponse
    {
        $template = DocumentTemplate::findOrFail($id);
        $data = $this->validated($request, false) + $request->validate(['is_active' => 'required|boolean']);
        $previous = null;
        if ($request->hasFile('file')) {
            $previous = $template->file_path;
            $data += $this->storeFile($request->file('file'));
        }
        $template->update($data + ['updated_by' => $request->user()->id]);
        if ($previous && $previous !== $template->file_path) {
            Storage::disk(Document::FILE_DISK)->delete($previous);
        }

        $this->auditTrail->logUserAction('Template Updated', "Document template \"{$template->name}\" updated" . ($previous ? ' with a new file' : '') . '.', $request->user(), $request->ip());

        return redirect()->back()->with('success', "Template \"{$template->name}\" saved.");
    }

    public function destroy(Request $request, int $id): RedirectResponse
    {
        $template = DocumentTemplate::findOrFail($id);
        $template->delete();
        Storage::disk(Document::FILE_DISK)->delete($template->file_path);

        $this->auditTrail->logUserAction('Template Deleted', "Document template \"{$template->name}\" deleted.", $request->user(), $request->ip());

        return redirect()->back()->with('success', "Template \"{$template->name}\" deleted.");
    }

    /** Any signed-in staff member may download an active template (the Admin also inactive ones) */
    public function download(Request $request, int $id): StreamedResponse
    {
        $template = DocumentTemplate::findOrFail($id);
        abort_unless($template->is_active || $request->user()->hasRole('Admin'), 404);
        abort_unless(Storage::disk(Document::FILE_DISK)->exists($template->file_path), 404, 'The template file is missing from storage.');

        return Storage::disk(Document::FILE_DISK)->download($template->file_path, $template->file_name);
    }

    private function validated(Request $request, bool $fileRequired): array
    {
        $request->validate([
            'name'        => 'required|string|max:150',
            'description' => 'nullable|string|max:500',
            'type_id'     => 'nullable|integer|exists:document_types,type_id',
            'file'        => [$fileRequired ? 'required' : 'nullable', 'file', 'mimes:pdf,docx', 'max:' . StoreDocumentRequest::APP_MAX_UPLOAD_KB],
        ], [
            'file.required' => 'Upload the template file (PDF or Word .docx).',
            'file.mimes'    => 'Templates must be PDF or Word (.docx) files.',
            'file.max'      => 'The file must not be larger than ' . (StoreDocumentRequest::APP_MAX_UPLOAD_KB / 1024) . ' MB.',
        ]);

        return [
            'name'        => trim((string) $request->input('name')),
            'description' => $request->filled('description') ? trim((string) $request->input('description')) : null,
            'type_id'     => $request->filled('type_id') ? (int) $request->input('type_id') : null,
        ];
    }

    private function storeFile(UploadedFile $file): array
    {
        return [
            'file_path' => $file->store(self::DIRECTORY, Document::FILE_DISK),
            'file_name' => $file->getClientOriginalName(),
            'file_size' => $file->getSize(),
            'mime_type' => $file->getClientMimeType(),
        ];
    }
}
