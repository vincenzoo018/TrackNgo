<?php

namespace App\Http\Controllers;

use App\Models\Document;
use App\Models\DigitalSignature;
use App\Models\ArtaEscalation;
use Illuminate\Http\Request;
use Carbon\Carbon;

class SignatureController extends Controller
{
    // Feature 3: Auto-Resolution of ARTA Escalations
    public function applySignature(Request $request, $document_id)
    {
        $request->validate([
            'user_id' => 'required|integer',
            'signature_hash' => 'required|string',
            'action_type' => 'required|string'
        ]);

        $signature = DigitalSignature::create([
            'document_id' => $document_id,
            'signed_by_user_id' => $request->user_id,
            'signature_hash' => $request->signature_hash,
            'action_type' => $request->action_type,
            'signed_at' => Carbon::now()
        ]);

        // Auto-resolve any pending escalations for this document
        ArtaEscalation::where('document_id', $document_id)
            ->where('resolved', false)
            ->update([
                'resolved' => true,
                'resolved_at' => Carbon::now()
            ]);

        return response()->json(['message' => 'Signature applied and escalations automatically resolved']);
    }

    // Feature 2: Public Document Authenticator
    public function verifySignature(Request $request)
    {
        $request->validate([
            'reference_number' => 'required|string',
            'signature_hash' => 'required|string'
        ]);

        $document = Document::where('reference_number', $request->reference_number)->first();
        
        if (!$document) {
            return response()->json(['valid' => false, 'message' => 'Document not found']);
        }

        $signature = DigitalSignature::where('document_id', $document->document_id)
            ->where('signature_hash', $request->signature_hash)
            ->with('signer')
            ->first();

        if ($signature) {
            return response()->json([
                'valid' => true, 
                'message' => 'Document is authentic',
                'signed_by' => $signature->signer->name,
                'signed_at' => $signature->signed_at
            ]);
        }

        return response()->json(['valid' => false, 'message' => 'Invalid signature or tampered document']);
    }
}
