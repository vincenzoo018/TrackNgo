<?php
require 'vendor/autoload.php';
$app = require 'bootstrap/app.php';
$app->make(Illuminate\Contracts\Http\Kernel::class)->bootstrap();
$u = \App\Models\User::where('email', 'receivingclerk@mati.com')->first();
echo "User: {$u->name}, verify('password'): " . (password_verify('password', $u->password) ? 'YES' : 'NO') . "\n";
echo "verify('admin123'): " . (password_verify('admin123', $u->password) ? 'YES' : 'NO') . "\n";
echo "verify('12345678'): " . (password_verify('12345678', $u->password) ? 'YES' : 'NO') . "\n";
