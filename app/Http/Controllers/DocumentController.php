<?php

namespace App\Http\Controllers;

use App\Contracts\DocumentServiceInterface;
use App\Http\Requests\StoreDocumentRequest;
use App\Models\Document;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;

class DocumentController extends Controller
{
    public function __construct(
        protected DocumentServiceInterface $documentService
    ) {}

    public function index(Request $request): JsonResponse
    {
        $documents = $this->documentService->getDocumentsForUser($request->user() ?: auth()->user());
        return response()->json($documents);
    }

    public function show(Request $request, $id): JsonResponse
    {
        $document = $this->documentService->getDocumentWithConfidentialityGuard((int) $id, $request->user() ?: auth()->user());
        return response()->json($document);
    }

    public function store(StoreDocumentRequest $request)
    {
        $actor = $request->user() ?: auth()->user();
        $file = $request->file('file');

        $document = $this->documentService->createDocument($request->validated(), $file, $actor, $request->ip());

        if ($request->wantsJson()) {
            return response()->json([
                'message'  => 'Document submitted successfully.',
                'document' => $document,
            ], 201);
        }

        return redirect()->back()->with('success', 'Document submitted successfully. Tracking: ' . $document->tracking_number);
    }

    public function accept(Request $request, $id)
    {
        $actor = $request->user() ?: auth()->user();
        $document = $this->documentService->executeWorkflowAction((int) $id, 'accept', $request->all(), $actor, $request->ip());

        if ($request->wantsJson()) {
            return response()->json(['message' => 'Document accepted successfully.', 'document' => $document]);
        }

        return redirect()->back()->with('success', 'Document accepted successfully');
    }

    public function review(Request $request, $id)
    {
        $actor = $request->user() ?: auth()->user();
        $document = $this->documentService->executeWorkflowAction((int) $id, 'review', $request->all(), $actor, $request->ip());

        if ($request->wantsJson()) {
            return response()->json(['message' => 'Document reviewed successfully.', 'document' => $document]);
        }

        return redirect()->back()->with('success', 'Document reviewed successfully');
    }

    public function endorse(Request $request, $id)
    {
        $request->validate([
            'destination_type' => 'required|in:department,user',
            'destination_id'   => 'required',
            'remarks'          => 'nullable|string',
        ]);

        $actor = $request->user() ?: auth()->user();
        $document = $this->documentService->executeWorkflowAction((int) $id, 'endorse', $request->all(), $actor, $request->ip());

        if ($request->wantsJson()) {
            return response()->json(['message' => 'Document endorsed successfully.', 'document' => $document]);
        }

        return redirect()->back()->with('success', 'Document endorsed successfully');
    }

    public function escalate(Request $request, $id)
    {
        $request->validate([
            'justification' => 'required|string',
        ]);

        $actor = $request->user() ?: auth()->user();
        $this->documentService->executeWorkflowAction((int) $id, 'escalate', $request->all(), $actor, $request->ip());

        return redirect()->back()->with('success', 'Document escalated to CART');
    }

    public function link(Request $request, $id)
    {
        $request->validate([
            'tracking_number' => 'required|string|exists:documents,tracking_number',
        ]);

        $actor = $request->user() ?: auth()->user();
        $this->documentService->executeWorkflowAction((int) $id, 'link', $request->all(), $actor, $request->ip());

        return redirect()->back()->with('success', 'Document linked successfully');
    }

    public function approveAndRouteToReceiving(Request $request, $id)
    {
        $actor = $request->user() ?: auth()->user();
        $document = $this->documentService->executeWorkflowAction((int) $id, 'approveAndRouteToReceiving', $request->all(), $actor, $request->ip());

        if ($request->wantsJson()) {
            return response()->json(['message' => 'Document approved successfully.', 'document' => $document]);
        }

        return redirect()->back()->with('success', 'Document approved and routed to Receiving Clerk.');
    }

    public function releaseToApplicant(Request $request, $id)
    {
        $actor = $request->user() ?: auth()->user();
        $document = $this->documentService->executeWorkflowAction((int) $id, 'releaseToApplicant', $request->all(), $actor, $request->ip());

        if ($request->wantsJson()) {
            return response()->json(['message' => 'Document released successfully.', 'document' => $document]);
        }

        return redirect()->back()->with('success', 'Document successfully released to the applicant.');
    }

    public function archiveDocument(Request $request, $id)
    {
        $actor = $request->user() ?: auth()->user();
        $document = $this->documentService->executeWorkflowAction((int) $id, 'archive', $request->all(), $actor, $request->ip());

        if ($request->wantsJson()) {
            return response()->json(['message' => 'Document archived successfully.', 'document' => $document]);
        }

        return redirect()->back()->with('success', 'Document moved to Archived module.');
    }

    public function returnDocument(Request $request, $id)
    {
        $request->validate([
            'reason' => 'required|string',
        ]);

        $actor = $request->user() ?: auth()->user();
        $this->documentService->executeWorkflowAction((int) $id, 'return', $request->all(), $actor, $request->ip());

        return redirect()->back()->with('success', 'Document returned for revision.');
    }

    public function forward(Request $request, $id)
    {
        $request->validate([
            'forward_to_department' => 'required|exists:departments,department_id',
            'forward_to_user'       => 'nullable|exists:users,id',
            'instruction'           => 'nullable|string',
        ]);

        $actor = $request->user() ?: auth()->user();
        $this->documentService->executeWorkflowAction((int) $id, 'forward', $request->all(), $actor, $request->ip());

        return redirect()->back()->with('success', 'Document forwarded successfully');
    }

    public function addComment(Request $request, $id)
    {
        $request->validate([
            'comment' => 'required|string',
        ]);

        $actor = $request->user() ?: auth()->user();
        $comment = $this->documentService->addComment((int) $id, $request->comment, $actor, $request->ip());

        return redirect()->back()->with('success', 'Note added successfully');
    }

    public function addAttachment(Request $request, $id)
    {
        $request->validate([
            'file'        => 'required|file|max:10240',
            'description' => 'required|string',
        ]);

        $actor = $request->user() ?: auth()->user();
        $this->documentService->addAttachment((int) $id, $request->file('file'), $request->description, $actor, $request->ip());

        return redirect()->back()->with('success', 'Attachment added successfully');
    }

    public function export($id, Request $request)
    {
        $request->validate([
            'password' => 'required|string',
        ]);

        $user = $request->user() ?: auth()->user();
        if (!Hash::check($request->password, $user->password)) {
            return response()->json(['message' => 'Invalid password verification.'], 403);
        }

        $document = Document::findOrFail($id);
        if (!$document->attachment_path || !Storage::disk('public')->exists($document->attachment_path)) {
            return response()->json(['message' => 'Original document file is not found on disk.'], 404);
        }

        $filePath = Storage::disk('public')->path($document->attachment_path);
        return response()->download($filePath, "Document_{$document->reference_number}.pdf");
    }

    public function update(Request $request, $id): RedirectResponse
    {
        $request->validate([
            'title'          => 'sometimes|required|string',
            'classification' => 'sometimes|required|string',
        ]);

        $actor = $request->user() ?: auth()->user();
        $this->documentService->updateDocument((int) $id, $request->only(['title', 'classification']), $actor, $request->ip());

        return redirect()->back()->with('success', 'Document updated successfully.');
    }

    public function destroy(Request $request, $id): RedirectResponse
    {
        $actor = $request->user() ?: auth()->user();
        $this->documentService->deleteDocument((int) $id, $actor, $request->ip());

        return redirect()->back()->with('success', 'Document deleted successfully.');
    }
}
