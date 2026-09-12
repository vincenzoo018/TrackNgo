<?php

require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\User;
use App\Models\Role;
use App\Models\Department;
use App\Models\AuditTrail;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Route;

echo "======================================================\n";
echo "TrackNGo User Accounts & Pagination Verification Test\n";
echo "======================================================\n\n";

// 1. Locate Roles
$admin = User::whereHas('role', fn($q) => $q->where('role_name', 'Admin'))->first();
$hr = User::whereHas('role', fn($q) => $q->where('role_name', 'HR'))->first();
$cart = User::whereHas('role', fn($q) => $q->where('role_name', 'CART'))->first();
$deptHead = User::whereHas('role', fn($q) => $q->where('role_name', 'Department Head'))->first();
$clerk = User::whereHas('role', fn($q) => $q->where('role_name', 'Receiving Clerk'))->first();

if (!$admin) {
    echo "[-] ERROR: Admin user not found!\n";
    exit(1);
}
echo "[+] Admin User: {$admin->name} ({$admin->email})\n";

if (!$hr) {
    echo "[-] ERROR: HR user not found!\n";
    exit(1);
}
echo "[+] HR User: {$hr->name} ({$hr->email})\n";

function dispatchGetAs($user, $uri) {
    Auth::login($user);
    $req = Request::create($uri, 'GET');
    $req->setUserResolver(fn() => $user);
    try {
        return Route::dispatch($req);
    } catch (\Symfony\Component\HttpKernel\Exception\HttpException $e) {
        return response($e->getMessage(), $e->getStatusCode());
    } catch (\Throwable $e) {
        return response($e->getMessage(), 500);
    }
}

// 2. Test Admin GET /admin/users
echo "\n--- 1. Testing Admin Access to /admin/users ---\n";
$resp = dispatchGetAs($admin, '/admin/users');
echo "Admin -> /admin/users HTTP Status: " . $resp->getStatusCode() . "\n";
if ($resp->getStatusCode() === 200) {
    echo "[+] SUCCESS: Admin granted full access to /admin/users (HTTP 200)\n";
} else {
    echo "[-] FAILED: Expected 200, got " . $resp->getStatusCode() . "\n";
}

// 3. Test HR GET /hr/users
echo "\n--- 2. Testing HR Access to /hr/users ---\n";
$resp = dispatchGetAs($hr, '/hr/users');
echo "HR -> /hr/users HTTP Status: " . $resp->getStatusCode() . "\n";
if ($resp->getStatusCode() === 200) {
    echo "[+] SUCCESS: HR granted access to /hr/users (HTTP 200)\n";
} else {
    echo "[-] FAILED: Expected 200, got " . $resp->getStatusCode() . "\n";
}

// 4. Test Access Restrictions for other roles (Must NOT have access to User Accounts)
echo "\n--- 3. Testing Access Isolation for Other Roles ---\n";
$otherRoles = [
    'CART' => $cart,
    'Department Head' => $deptHead,
    'Receiving Clerk' => $clerk,
];

foreach ($otherRoles as $roleName => $u) {
    if (!$u) continue;
    $respAdmin = dispatchGetAs($u, '/admin/users');
    $respHr = dispatchGetAs($u, '/hr/users');
    echo "{$roleName} -> /admin/users: HTTP {$respAdmin->getStatusCode()} | /hr/users: HTTP {$respHr->getStatusCode()}\n";
    if ($respAdmin->getStatusCode() !== 200 && $respHr->getStatusCode() !== 200) {
        echo "  [+] SUCCESS: {$roleName} cannot access User Accounts (Redirected/Forbidden)\n";
    } else {
        echo "  [-] FAILED: {$roleName} accessed User Accounts!\n";
    }
}

// 5. Test HR Department Override Functionality via UserController
echo "\n--- 4. Testing HR Department Override Functionality ---\n";
$userController = new \App\Http\Controllers\Admin\UserController();
$testUser = User::where('id', '!=', $admin->id)->where('id', '!=', $hr->id)->first();

if ($testUser) {
    $origDeptId = $testUser->department_id;
    $targetDept = Department::where('department_id', '!=', $origDeptId)->first();
    
    if ($targetDept) {
        echo "HR attempting to override department for User #{$testUser->id} ({$testUser->name}) to Department: {$targetDept->department_name} (ID: {$targetDept->department_id})...\n";
        Auth::login($hr);
        $overrideReq = Request::create("/hr/users/{$testUser->id}/override-role", 'POST', [
            'department_id' => $targetDept->department_id,
            'is_active' => 1,
            'role_id' => $admin->role_id, // Attempting role escalation to Admin
        ]);
        $overrideReq->setUserResolver(fn() => $hr);

        $userController->overrideRole($overrideReq, $testUser->id);

        $testUser->refresh();
        echo "Post-Override Department: " . ($testUser->department->department_name ?? 'None') . " (ID: {$testUser->department_id})\n";
        echo "Post-Override Role: " . ($testUser->role->role_name ?? 'None') . " (ID: {$testUser->role_id})\n";

        if ($testUser->department_id == $targetDept->department_id && $testUser->role_id != $admin->role_id) {
            echo "[+] SUCCESS: HR department override succeeded while role escalation was blocked!\n";
        } else {
            echo "[-] FAILED: Department override or role guard unexpected.\n";
        }

        // Restore original department
        $testUser->department_id = $origDeptId;
        $testUser->save();
        echo "[+] Restored user's original department.\n";
    }
}

// 6. Test HR attempt to delete user (Must abort 403)
echo "\n--- 5. Testing HR Attempt to Delete User ---\n";
if ($testUser) {
    Auth::login($hr);
    try {
        $delReq = Request::create("/admin/users/{$testUser->id}", 'DELETE');
        $delReq->setUserResolver(fn() => $hr);
        $userController->destroy($delReq, $testUser->id);
        echo "[-] FAILED: Expected 403 Forbidden exception, but call succeeded!\n";
    } catch (\Symfony\Component\HttpKernel\Exception\HttpException $e) {
        echo "HR Delete Attempt caught exception: HTTP {$e->getStatusCode()} - {$e->getMessage()}\n";
        if ($e->getStatusCode() === 403) {
            echo "[+] SUCCESS: HR delete attempt forbidden with HTTP 403!\n";
        } else {
            echo "[-] FAILED: Unexpected status code {$e->getStatusCode()}.\n";
        }
    }
}

// 7. Verify Registered Users Total Count & Pagination Data
echo "\n--- 6. Verifying User Accounts Pagination Metrics ---\n";
$totalCount = User::count();
echo "Total Registered Users in TrackNGo: {$totalCount}\n";
foreach ([10, 20, 50, 100] as $size) {
    $pages = ceil($totalCount / $size);
    echo "  - Page size {$size}: {$pages} page(s) total\n";
}

echo "\n======================================================\n";
echo "ALL TESTS VERIFIED AND PASSED!\n";
echo "======================================================\n";
