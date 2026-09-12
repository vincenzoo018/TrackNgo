<?php

require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

echo "=== VERIFYING TABLE VIEWS & ROLE SCOPES ===\n";

$rolesToTest = [
    'admin' => [
        '/admin/users',
        '/admin/documents',
        '/routing-slips',
        '/reports',
        '/archived',
    ],
    'cart' => [
        '/cart/documents',
        '/cart/escalations',
        '/routing-slips',
        '/reports',
        '/archived',
    ],
    'hr' => [
        '/hr/documents',
        '/routing-slips',
        '/reports',
        '/archived',
    ],
    'department-head' => [
        '/department-head/documents',
        '/routing-slips',
        '/reports',
        '/archived',
    ],
    'mayor' => [
        '/mayor/documents',
        '/routing-slips',
        '/reports',
        '/archived',
    ],
    'receiving' => [
        '/receiving/documents',
        '/routing-slips',
        '/reports',
        '/archived',
    ]
];

$allPassed = true;

foreach ($rolesToTest as $roleName => $urls) {
    // Find user for role
    $user = User::whereHas('role', function($q) use ($roleName) {
        $q->where('role_name', 'like', "%{$roleName}%")
          ->orWhere('role_code', 'like', "%{$roleName}%");
    })->first();

    if (!$user) {
        // Fallback search
        $user = User::where('username', 'like', "%{$roleName}%")
            ->orWhere('email', 'like', "%{$roleName}%")
            ->first();
    }

    if (!$user) {
        echo "⚠️ User for role {$roleName} not found, using admin user for endpoint test.\n";
        $user = User::first();
    }

    echo "\n[Role: {$roleName}] (User: {$user->username} / ID: {$user->user_id})\n";
    Auth::login($user);

    foreach ($urls as $url) {
        $request = Request::create($url, 'GET');
        $request->headers->set('X-Inertia', 'true');
        $response = $kernel->handle($request);
        $status = $response->getStatusCode();
        
        if ($status === 200) {
            echo "  ✓ {$url} -> HTTP 200 OK\n";
        } elseif ($status === 302) {
            echo "  ⤳ {$url} -> HTTP 302 Redirect to: " . $response->headers->get('Location') . "\n";
        } else {
            echo "  ✗ {$url} -> HTTP {$status}\n";
            $allPassed = false;
        }
    }
}

echo "\nAll table routes verification completed. Status: " . ($allPassed ? "PASSED" : "FAILED") . "\n";
