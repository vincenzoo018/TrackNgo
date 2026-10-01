<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Philippine provinces, cities / municipalities and barangays (PSA PSGC) for the
     * Receiving Clerk's client address dropdowns. Data ships in database/data/psgc.json
     * so the lookup works offline. Metro Manila cities are grouped under "Metro Manila".
     */
    public function up(): void
    {
        Schema::create('ph_provinces', function (Blueprint $table) {
            $table->string('code', 9)->primary();
            $table->string('name', 100)->index();
        });

        Schema::create('ph_cities', function (Blueprint $table) {
            $table->string('code', 9)->primary();
            $table->string('name', 100);
            $table->string('province_code', 9)->index();
            $table->boolean('is_city')->default(false);
        });

        Schema::create('ph_barangays', function (Blueprint $table) {
            $table->string('code', 10)->primary();
            $table->string('name', 100);
            $table->string('city_code', 9)->index();
        });

        $data = json_decode(file_get_contents(database_path('data/psgc.json')), true);

        $insert = function (string $table, array $rows, callable $map) {
            foreach (array_chunk($rows, 1000) as $chunk) {
                DB::table($table)->insert(array_map($map, $chunk));
            }
        };

        $insert('ph_provinces', $data['provinces'], fn ($r) => ['code' => $r[0], 'name' => $r[1]]);
        $insert('ph_cities', $data['cities'], fn ($r) => ['code' => $r[0], 'name' => $r[1], 'province_code' => $r[2], 'is_city' => (bool) $r[3]]);
        $insert('ph_barangays', $data['barangays'], fn ($r) => ['code' => $r[0], 'name' => $r[1], 'city_code' => $r[2]]);
    }

    public function down(): void
    {
        Schema::dropIfExists('ph_barangays');
        Schema::dropIfExists('ph_cities');
        Schema::dropIfExists('ph_provinces');
    }
};
