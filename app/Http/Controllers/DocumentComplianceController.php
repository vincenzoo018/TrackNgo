<?php

namespace App\Http\Controllers;

use App\Contracts\DocumentServiceInterface;
use App\Models\Document;
use App\Services\Document\DeemedApprovalService;
use App\Services\Document\ExtensionService;
use App\Services\Oic\OicService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Legal deadlines on a document: the one extension of the processing period and its written notice
 * (RA 11032 Sec. 9(b)), the Mayor's veto of an ordinance / resolution (LGC Sec. 54), and the Admin's manual run of
 * the deemed-approval check (RA 11032 Sec. 10 / LGC Sec. 54) that otherwise runs every five minutes.
 */
class DocumentComplianceController extends Controller
{
    public function __construct(
        protected ExtensionService $extensions,
        protected OicService $oic
    ) {}

    public function extend(Request $request, int $id): RedirectResponse
    {
        $validated = $request->validate([
            'reason' => 'required|string|min:10|max:1000',
        ], [
            'reason.required' => 'State the reason for the extension; it is written on the notice to the client.',
            'reason.min'      => 'Describe the reason in a few words (it is written on the notice to the client).',
        ]);

        $actor = $request->user();
        $document = Document::with(['type', 'extension'])->findOrFail($id);
        $extension = $this->oic->withActingContext($document, $actor, fn () => $this->extensions->grant($document, trim($validated['reason']), $actor, $request->ip()));

        return redirect()->back()->with(
            'success',
            'Processing period extended to ' . $extension->new_due_date->format('M d, Y') . '. Print the written notice for the client.'
        );
    }

    public function notice(Request $request, int $id): Response
    {
        $document = Document::findOrFail($id);
        abort_unless($document->contentsVisibleTo($request->user()), 403, 'Only the people handling this document can open its notice.');
        $notice = $this->extensions->notice($document);
        abort_if($notice === null, 404, 'This document has no extension.');

        return Inertia::render('documents/ExtensionNotice', [
            'notice'   => $notice,
            'document' => ['document_id' => $document->document_id, 'reference_number' => $document->reference_number],
        ]);
    }

    public function veto(Request $request, int $id, DocumentServiceInterface $documents): RedirectResponse
    {
        $validated = $request->validate([
            'reasons' => 'required|string|min:10|max:2000',
        ], [
            'reasons.required' => 'A veto must state the reasons (LGC Sec. 54).',
            'reasons.min'      => 'State the reasons for the veto in a few words.',
        ]);

        $documents->executeWorkflowAction($id, 'veto', ['reasons' => trim($validated['reasons'])], $request->user(), $request->ip());

        return redirect()->back()->with('success', 'Vetoed. The document was closed and returned to the filer with your reasons.');
    }

    public function runDeemedApprovals(DeemedApprovalService $service): RedirectResponse
    {
        $stats = $service->run();
        $total = $stats['arta'] + $stats['lgc'];

        return redirect()->back()->with('success', $total === 0
            ? 'Checked: no document has passed its period without action.'
            : "Checked: {$total} document(s) deemed approved ({$stats['arta']} under RA 11032, {$stats['lgc']} under LGC Sec. 54) and sent for release.");
    }
}
