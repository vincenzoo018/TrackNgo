<?php

namespace App\Services\Document;

use App\Models\AuditTrail;
use App\Models\Document;
use App\Models\DocumentRouteStop;
use App\Models\MayoralAction;
use App\Models\RoutingSlip;
use App\Models\User;
use App\Services\Oic\OicService;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

/**
 * Flexible routes (route_based documents). The people chosen at filing are visited in order; each one
 * approves (and signs when their stop `signs`) and the document moves to the next automatically.
 *
 * The progress bar has a fixed set of steps that never grows:
 *   external: Submitted → one step per person → Release (by the Receiving Clerk)
 *   internal: Submitted (registered automatically) → one step per person → Completion (back to the sender)
 *             (documents the Receiving Clerk registered by hand, before that, keep their "Registered" step)
 * Returns and corrections do not add steps: the step that is waiting shows what is happening right now
 * (Forwarded · awaiting receipt, Under review, Returned to … for correction, Corrected · back for review, …) and
 * every step shows how many times that person returned the document. The public tracking page shows the same steps.
 */
class DocumentRoute
{
    public const DONE = 'done';
    public const CURRENT = 'current';
    public const PENDING = 'pending';
    /** Not reached: the document was deemed approved or vetoed before this person acted */
    public const SKIPPED = 'skipped';

    /** Live status tones of the current step */
    public const TONE_NORMAL = 'normal';
    public const TONE_WARNING = 'warning';
    public const TONE_DANGER = 'danger';
    public const TONE_SUCCESS = 'success';

    public function __construct(
        protected OicService $oic
    ) {}

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
     * The progress bar: every step with who handles it (or will), when, and — for the step that is waiting — what
     * is happening now.
     *
     * @return list<array{label: string, actor: string, office: ?string, status: string, at: ?string, detail: ?string, tone: string, returns: int, acting: ?string}>
     */
    public function steps(Document $document): array
    {
        // Fresh: the same request may just have moved the document
        $document->load(['submitter.department', 'currentHolder.department', 'heldFor', 'routeStops.user.department', 'mayoralActions']);
        $office = fn (?User $user) => $user?->department?->department_name;
        $clerk = User::with('department')->where('is_active', true)->whereHas('role', fn ($q) => $q->where('role_name', 'Receiving Clerk'))->first();
        $slips = RoutingSlip::with(['fromUser.department', 'actingFor'])->where('document_id', $document->document_id)->orderBy('slip_id')->get();
        $status = strtolower((string) $document->status);
        $closed = $document->isClosed();
        $vetoed = $status === Document::STATUS_VETOED;
        $stopped = $vetoed || $document->isDeemedApproved();
        $clerkIds = User::whereHas('role', fn ($q) => $q->where('role_name', 'Receiving Clerk'))->pluck('id')->map(fn ($id) => (int) $id)->all();

        // Returns made from each place on the route (an OIC returns from the official's place)
        $returnsBy = $slips->where('action', 'return')
            ->countBy(fn (RoutingSlip $slip) => (int) ($slip->acting_for_user_id ?? $slip->from_user_id))
            ->all();
        $clerkReturns = array_sum(array_intersect_key($returnsBy, array_flip($clerkIds)));
        // Who actually approved each official's stop when an Officer-in-Charge did it
        $actedBy = $slips->filter(fn (RoutingSlip $slip) => $slip->acting_for_user_id && in_array($slip->action, ['route', 'forward', 'approve', 'veto'], true))
            ->mapWithKeys(fn (RoutingSlip $slip) => [(int) $slip->acting_for_user_id => $slip->fromUser?->name])
            ->all();
        $veto = $document->mayoralActions->firstWhere('action', MayoralAction::VETOED);

        $steps = [$this->step('Submitted', $document->submitter?->name ?? $document->sender ?? 'Sender', self::DONE, $document->date_filed ?? $document->created_at, $office($document->submitter))];

        // Only internal documents registered by hand by the clerk (before registration became automatic) show it
        $registerSlip = $document->is_internal ? $slips->firstWhere('action', 'register') : null;
        $registrationStep = $registerSlip
            ? $this->step('Registered', $registerSlip->fromUser?->name ?? 'Receiving Clerk', self::DONE, $registerSlip->created_at, $office($registerSlip->fromUser))
            : null;
        if ($registrationStep) {
            $registrationStep['returns'] = $clerkReturns;
        }
        $registrationAdded = $registrationStep === null;

        foreach ($document->routeStops as $stop) {
            // Those were registered after the sender's own signature (when the sender heads the route)
            if (!$registrationAdded && (int) $stop->user_id !== (int) $document->submitted_by) {
                $steps[] = $registrationStep;
                $registrationAdded = true;
            }

            $user = $stop->user;
            $isVetoStop = $veto && $stop->approved_at === null && $user?->hasRole('Mayor');
            $step = match (true) {
                $stop->approved_at !== null => $this->step($stop->signs ? 'Signed' : 'Approved', $user?->name ?? 'Unassigned', self::DONE, $stop->approved_at, $office($user)),
                $isVetoStop                 => $this->step('Vetoed', $user?->name ?? 'Mayor', self::DONE, $veto->action_date, $office($user)),
                $stopped || $closed         => $this->step('Skipped', $user?->name ?? 'Unassigned', self::SKIPPED, null, $office($user)),
                default                     => $this->step($stop->signs ? 'Signature' : 'Approval', $user?->name ?? 'Unassigned', self::PENDING, null, $office($user)),
            };
            if ($isVetoStop) {
                $step['tone'] = self::TONE_DANGER;
                $step['detail'] = 'Vetoed — returned to the filer';
            }
            if (isset($actedBy[(int) $stop->user_id]) && $step['status'] === self::DONE) {
                $step['acting'] = "{$step['label']} by {$actedBy[(int) $stop->user_id]} (Officer-in-Charge)";
            }
            $step['returns'] = $returnsBy[(int) $stop->user_id] ?? 0;
            $steps[] = $step;
        }
        if (!$registrationAdded) {
            $steps[] = $registrationStep;
        }

        $steps[] = match (true) {
            $vetoed                 => $this->step('Closed', $document->submitter?->name ?? 'Filer', self::DONE, $document->completed_at, $office($document->submitter)),
            (bool) $document->is_internal => $closed
                ? $this->step('Completed', $document->submitter?->name ?? 'Sender', self::DONE, $document->completed_at, $office($document->submitter))
                : $this->step('Completion', $document->submitter?->name ?? 'Sender', self::PENDING, null, $office($document->submitter)),
            default                 => $closed
                ? $this->step('Released', $this->releasedBy($document), self::DONE, $document->completed_at, $office($clerk))
                : $this->step('Release', $clerk?->name ?? 'Receiving Clerk', self::PENDING, null, $office($clerk)),
        };
        if (!$document->is_internal && !$vetoed) {
            $steps[array_key_last($steps)]['returns'] = $clerkReturns;
        }

        // The first step still to do is the current one; it shows what is happening now
        if (!$closed) {
            foreach ($steps as $i => $step) {
                if ($step['status'] === self::PENDING) {
                    $steps[$i]['status'] = self::CURRENT;
                    [$steps[$i]['detail'], $steps[$i]['tone']] = $this->liveStatus($document, $slips, $steps[$i]);
                    if ($document->held_for_user_id && $document->currentHolder) {
                        $designation = $this->oic->activeFor($document->held_for_user_id);
                        $steps[$i]['acting'] = 'With ' . $document->currentHolder->name . ($designation ? ", {$designation->reference()}" : ' (Officer-in-Charge)');
                    }
                    break;
                }
            }
        }

        return array_values($steps);
    }

    /**
     * What is happening at the waiting step, in plain words, and how urgent it looks.
     *
     * @return array{0: string, 1: string}
     */
    private function liveStatus(Document $document, Collection $slips, array $step): array
    {
        $status = strtolower((string) $document->status);
        $holder = $document->currentHolder?->name ?? $document->currentHolderDepartment?->department_name ?? 'the previous office';
        $lastSlip = $slips->reject(fn (RoutingSlip $slip) => in_array($slip->action, DocumentWorkflowService::SYSTEM_SLIP_ACTIONS, true))->last();

        return match (true) {
            $status === 'returned'                       => ["Returned to {$holder} for correction", self::TONE_DANGER],
            $document->isDeemedApproved()                => ['Deemed approved (' . $document->deemed_approval_basis . ') · for release', self::TONE_SUCCESS],
            $status === 'approved'                       => ['Approved · ready for release', self::TONE_SUCCESS],
            $lastSlip?->action === 'resubmit' && in_array($status, ['sent', 'submitted', 'pending'], true)
                                                         => ['Corrected · back for review', self::TONE_WARNING],
            in_array($status, ['accepted', 'ongoing', 'received', 'in_review', 'reviewed'], true)
                                                         => ['Under review', self::TONE_NORMAL],
            default                                      => ['Forwarded · awaiting receipt', self::TONE_NORMAL],
        };
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
            'label' => "{$step['label']} — {$step['actor']}" . (!empty($step['detail']) ? " ({$step['detail']})" : ''),
            'step'  => $index === false ? count($steps) : $index + 1,
            'total' => count($steps),
        ];
    }

    /** What the document page needs: the steps, and where approving sends it next for the current holder. */
    public function present(Document $document): array
    {
        $holder = $document->current_holder_id ? User::find($document->current_holder_id) : null;
        // An Officer-in-Charge holds it in the absent official's place on the route
        $actingAs = $holder ? ($this->oic->actingFor($document, $holder) ?? $holder) : null;
        $holderStop = $actingAs ? $this->pendingStopFor($document, $actingAs) : null;
        $next = $actingAs ? $this->nextAfter($document, $actingAs) : $this->nextStop($document);
        $designation = $document->held_for_user_id ? $this->oic->activeFor($document->held_for_user_id) : null;
        $steps = $this->steps($document);

        return [
            'steps'        => $steps,
            'holder_signs' => (bool) $holderStop?->signs,
            'next_name'    => $next?->user?->name,
            'next_signs'   => (bool) $next?->signs,
            // After the last person: the Receiving Clerk releases external documents; internal ones are completed
            'ends_with'    => $document->is_internal ? 'complete' : 'release',
            'returns'      => (int) array_sum(array_column($steps, 'returns')),
            'acting'       => $designation && $holder ? [
                'officer'   => $holder->name,
                'official'  => $designation->official?->name,
                'title'     => $designation->title(),
                'order'     => $designation->designation_order_number,
                'reference' => $designation->reference(),
            ] : null,
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
            'label'   => $label,
            'actor'   => $actor,
            // The office is shown apart from the person ("City Engineer's Office" / "Engr. Dela Cruz")
            'office'  => $office,
            'status'  => $status,
            'at'      => $at ? Carbon::parse($at)->toIso8601String() : null,
            'detail'  => null,
            'tone'    => self::TONE_NORMAL,
            'returns' => 0,
            'acting'  => null,
        ];
    }
}
