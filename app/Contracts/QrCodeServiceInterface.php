<?php

namespace App\Contracts;

use App\Models\User;

interface QrCodeServiceInterface
{
    /**
     * Build the QR Codes payload for the given user.
     */
    public function getQrCodesPayload(User $user): array;
}
