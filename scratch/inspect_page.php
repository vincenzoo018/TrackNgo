<?php
require 'vendor/autoload.php';
$app = require 'bootstrap/app.php';
$k = $app->make(Illuminate\Contracts\Http\Kernel::class);
$request = \Illuminate\Http\Request::create('/receiving/archived', 'GET');
$app->instance('request', $request);

$user = \App\Models\User::whereHas('role', fn($q)=>$q->where('role_name','like','%Receiving%'))->first();
\Illuminate\Support\Facades\Auth::login($user);

$k->bootstrap();
$res = $k->handle($request);
preg_match('/data-page="([^"]+)"/', $res->getContent(), $m);
$data = json_decode(htmlspecialchars_decode($m[1]), true);
echo "Component: " . $data['component'] . PHP_EOL;
echo "Props keys: " . implode(', ', array_keys($data['props'])) . PHP_EOL;
echo "dbDocuments count: " . count($data['props']['dbDocuments']) . PHP_EOL;
echo "role: " . ($data['props']['role'] ?? 'none') . PHP_EOL;
