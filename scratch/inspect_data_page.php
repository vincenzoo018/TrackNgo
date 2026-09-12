<?php
require_once __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);
$kernel->bootstrap();

$request = \Illuminate\Http\Request::create('/receiving/archived', 'GET');
$app->instance('request', $request);

$user = \App\Models\User::whereHas('role', function($q) {
    $q->where('role_name', 'like', '%Receiving%');
})->first();

\Illuminate\Support\Facades\Auth::login($user);

$response = $kernel->handle($request);
$html = $response->getContent();

$pos = strpos($html, 'data-page');
if ($pos !== false) {
    echo "Found data-page at pos: $pos\n";
    $snippet = substr($html, $pos, 400);
    echo "Snippet:\n$snippet\n";
    // Inertia uses data-page="..." or data-page='...' with html entities
    if (preg_match('/data-page=([\'"])(.*?)\1/s', substr($html, $pos, 200000), $m)) {
        $json = html_entity_decode($m[2], ENT_QUOTES | ENT_HTML5, 'UTF-8');
        file_put_contents(__DIR__ . '/page_data.json', $json);
        $page = json_decode($json, true);
        echo "Valid JSON: " . ($page ? "YES" : "NO: " . json_last_error_msg()) . "\n";
        if ($page) {
            echo "Component: " . $page['component'] . "\n";
            echo "URL: " . $page['url'] . "\n";
            echo "Props: " . implode(', ', array_keys($page['props'])) . "\n";
        }
    }
} else {
    echo "NO data-page found in HTML!\n";
}
