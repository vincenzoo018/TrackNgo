<?php

namespace App\Http\Controllers;

use App\Models\Document;
use Illuminate\Http\Request;

class DocumentController extends Controller
{
    public function index()
    {
        $documents = Document::with(['submitter', 'department', 'type'])->get();
        return response()->json($documents);
    }

    public function show($id)
    {
        $document = Document::with(['submitter', 'department', 'type', 'routingSlips', 'auditTrails', 'signatures'])->findOrFail($id);
        return response()->json($document);
    }
}
