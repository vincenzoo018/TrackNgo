<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

/**
 * Philippine address lookup (PSA PSGC) for the client address dropdowns:
 * province → city / municipality → barangay.
 */
class LocationController extends Controller
{
    public function provinces(): JsonResponse
    {
        return response()->json(
            DB::table('ph_provinces')->orderBy('name')->get(['code', 'name'])
        );
    }

    public function cities(string $provinceCode): JsonResponse
    {
        return response()->json(
            DB::table('ph_cities')->where('province_code', $provinceCode)->orderBy('name')->get(['code', 'name'])
        );
    }

    public function barangays(string $cityCode): JsonResponse
    {
        return response()->json(
            DB::table('ph_barangays')->where('city_code', $cityCode)->orderBy('name')->get(['code', 'name'])
        );
    }
}
