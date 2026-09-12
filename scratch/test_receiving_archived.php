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
$content = $response->getContent();
$tag = 'data-page="app" type="application/json">';
$pos = strpos($content, $tag);
if ($pos !== false) {
    $start = $pos + strlen($tag);
    $end = strpos($content, '</script>', $start);
    echo substr($content, $start, $end - $start);
}
