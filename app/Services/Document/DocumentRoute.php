<?php

namespace App\Services\Document;

use App\Models\AuditTrail;
use App\Models\DigitalSignature;
use App\Models\Document;
use App\Models\DocumentRouteStop;
use App\Models\RoutingSlip;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

/**
 * Flexible routes (route_based documents). The people chosen at filing are visited in order; each one
 * approves (and signs when their stop `signs`) and the document moves to the next automatically.
 *
 * The progress bar is the document's history (its routing slips) followed by what is still to come:
 *   external: Submitted → one step per person → Released (by the Receiving Clerk)
 *   internal: Submitted → Registered (Receiving Clerk) → one step per person → Completed (back to the sender)
 * A return adds two steps, "Returned" and "Corrected", before the route continues, so the bar always
 * shows every action that made the cycle longer.
 */
class DocumentRoute
{
    public const DONE = 'done';
    public const CURRENT = 'current';
    public const PENDING = 'pending';

    private const CLOSED_STATUSES = ['completed', 'released', 'archived'];

    /** Stops still to approve, in route order. */
    public function remainingStops(Document $document): Collection
    {
        return $document->routeStops()->with('user')->whereNull('approved_at')->get();
    }

    public function nextStop(Document $document): ?DocumentRouteStop
    {
        return $this->remainingStops($document)->first();
    }

    /** The user's own stop that still awaits their approval. */
    public function pendingStopFor(Document $document, User $user): ?DocumentRouteStop
    {
        return $document->routeStops()->where('user_id', $user->id)->whereNull('approved_at')->first();
    }

    public function isOnRoute(Document $document, User $user): bool
    {
        return $document->routeStops()->where('user_id', $user->id)->exists();
    }

    /** Whom the document goes to when $user approves it now (null: the route ends with them). */
    public function nextAfter(Document $document, User $user): ?DocumentRouteStop
    {
        return $this->remainingStops($document)->first(fn (DocumentRouteStop $stop) => (int) $stop->user_id !== (int) $user->id);
    }

    /**
     * The progress bar: every step with who handled it (or will) and when.
     *
     * @return list<array{label: string, actor: string, office: ?string, status: string, at: ?string}>
     */
    public function steps(Document $document): array
    {
        // Fresh: the same request may just have moved the document
        $document->load(['submitter.department', 'currentHolder.department', 'routeStops.user.department']);
        $office = fn (?User $user) => $user?->department?->department_name;
        $clerk = User::with('department')->whereHas('role', fn ($q) => $q->where('role_name', 'Receiving Clerk'))->first();
        $stops = $document->routeStops;
        // An approval that stamped a signature shows as "Signed"; each signature counts once, so a signer who
        // signs again (a new version of the file) shows as "Signed" again
        $signatureTimes = DigitalSignature::where('document_id', $document->document_id)->orderBy('signed_at')->get(['signed_by_user_id', 'signed_at'])
            ->groupBy('signed_by_user_id')->map(fn ($group) => $group->pluck('signed_at')->all())->all();
        $signedWith = function (int $userId, $at) use (&$signatureTimes): bool {
            $next = $signatureTimes[$userId][0] ?? null;
            // Stamped in the same request, just before the approval was recorded
            if ($next && $at && Carbon::parse($next)->lte(Carbon::parse($at)->addSeconds(5))) {
                array_shift($signatureTimes[$userId]);

                return true;
            }

            return false;
        };
        $approvalLabel = fn (int $userId, $at): string => $signedWith($userId, $at) ? 'Signed' : 'Approved';

        $history = [$this->step('Submitted', $document->submitter?->name ?? $document->sender ?? 'Sender', self::DONE, $document->date_filed ?? $document->created_at, $office($document->submitter))];

        // The sender may head their own route to sign as they submit
        $first = $stops->first();
        if ($first && $first->approved_at && (int) $first->user_id === (int) $document->submitted_by) {
            $history[] = $this->step($approvalLabel((int) $first->user_id, $first->approved_at), $first->user?->name ?? 'Sender', self::DONE, $first->approved_at, $office($first->user));
        }

        $registered = false;
        $slips = RoutingSlip::with('fromUser.department')->where('document_id', $document->document_id)->orderBy('slip_id')->get();
        foreach ($slips->slice(1) as $slip) { // the first slip is the filing itself
            $actor = $slip->fromUser?->name ?? $slip->sender_name ?? 'Staff';
            $at = $slip->created_at;
            $from = $office($slip->fromUser);
            $history[] = match ($slip->action) {
                'register' => $this->step('Registered', $actor, self::DONE, $at, $from),
                'return'   => $this->step('Returned', $actor, self::DONE, $at, $from),
                // A signatory who sends back a corrected version signs it as they do
                'resubmit' => $this->step($signedWith((int) $slip->from_user_id, $at) ? 'Corrected & Signed' : 'Corrected', $actor, self::DONE, $at, $from),
                // route (next person), forward (to the clerk for release) or approve (internal completion)
                default    => $this->step($approvalLabel((int) $slip->from_user_id, $at), $actor, self::DONE, $at, $from),
            };
            $registered = $registered || $slip->action === 'register';
        }

        $status = strtolower((string) $document->status);
        $closed = in_array($status, self::CLOSED_STATUSES, true);
        $upcoming = [];
        if (!$closed) {
            if ($document->is_internal && !$registered) {
                $upcoming[] = $this->step('Registration', 'Receiving Clerk', self::PENDING, null, $office($clerk));
            }
            if ($status === 'returned') {
                $upcoming[] = $this->step('Correction', $document->currentHolder?->name ?? 'Previous handler', self::PENDING, null, $office($document->currentHolder));
            }
            foreach ($stops->whereNull('approved_at') as $stop) {
                $upcoming[] = $this->step($stop->signs ? 'Signature' : 'Approval', $stop->user?->name ?? 'Unassigned', self::PENDING, null, $office($stop->user));
            }
        }

        if ($document->is_internal) {
            $upcoming[] = $closed
                ? $this->step('Completed', $document->submitter?->name ?? 'Sender', self::DONE, $document->completed_at, $office($document->submitter))
                : $this->step('Completion', $document->submitter?->name ?? 'Sender', self::PENDING, null, $office($document->submitter));
        } else {
            $upcoming[] = $closed
                ? $this->step('Released', $this->releasedBy($document), self::DONE, $document->completed_at, $office($clerk))
                : $this->step('Release', 'Receiving Clerk', self::PENDING, null, $office($clerk));
        }

        // The first step still to do is the current one
        foreach ($upcoming as $i => $step) {
            if ($step['status'] === self::PENDING) {
                $upcoming[$i]['status'] = self::CURRENT;
                break;
            }
        }

        return array_values(array_merge($history, $upcoming));
    }

    /** Store the step position on the document (lists, CART and public tracking read these columns). */
    public function sync(Document $document): void
    {
        $steps = $this->steps($document);
        $current = collect($steps)->search(fn ($step) => $step['status'] === self::CURRENT);

        $document->forceFill([
            'total_steps'        => count($steps),
            'current_step_index' => $current === false ? count($steps) : $current + 1,
        ])->saveQuietly();
    }

    /** Current stage in plain words for CART, e.g. "Signature — Hon. Mayor". */
    public function stage(Document $document): array
    {
        $steps = $this->steps($document);
        $index = collect($steps)->search(fn ($step) => $step['status'] === self::CURRENT);
        $step = $index === false ? end($steps) : $steps[$index];

        return [
            'label' => "{$step['label']} — {$step['actor']}",
            'step'  => $index === false ? count($steps) : $index + 1,
            'total' => count($steps),
        ];
    }

    /** What the document page needs: the steps, and where approving sends it next for the current holder. */
    public function present(Document $document): array
    {
        $holder = $document->current_holder_id ? User::find($document->current_holder_id) : null;
        $holderStop = $holder ? $this->pendingStopFor($document, $holder) : null;
        $next = $holder ? $this->nextAfter($document, $holder) : $this->nextStop($document);

        return [
            'steps'        => $this->steps($document),
            'holder_signs' => (bool) $holderStop?->signs,
            'next_name'    => $next?->user?->name,
            'next_signs'   => (bool) $next?->signs,
            // After the last person: the Receiving Clerk releases external documents; internal ones are completed
            'ends_with'    => $document->is_internal ? 'complete' : 'release',
            'stops'        => $document->routeStops->map(fn (DocumentRouteStop $stop) => [
                'user_id'     => $stop->user_id,
                'name'        => $stop->user?->name,
                'signs'       => $stop->signs,
                'approved_at' => $stop->approved_at?->toIso8601String(),
            ])->values()->all(),
        ];
    }

    private function releasedBy(Document $document): string
    {
        return AuditTrail::with('user')->where('document_id', $document->document_id)->where('action', 'Release')
            ->orderByDesc('audit_id')->first()?->user?->name ?? 'Receiving Clerk';
    }

    private function step(string $label, string $actor, string $status, $at = null, ?string $office = null): array
    {
        return [
            'label'  => $label,
            'actor'  => $actor,
            // The office is shown apart from the person ("City Engineer's Office" / "Engr. Dela Cruz")
            'office' => $office,
            'status' => $status,
            'at'     => $at ? \Illuminate\Support\Carbon::parse($at)->toIso8601String() : null,
        ];
    }
}
