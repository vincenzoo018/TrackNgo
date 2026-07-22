<?php

namespace Database\Seeders;

use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // ── Create Roles ────────────────────────────────────────
        $roles = [
            ['role_name' => 'Admin',           'position' => 'System Administrator'],
            ['role_name' => 'Mayor',           'position' => 'City Mayor'],
            ['role_name' => 'Department Head', 'position' => 'Department Head'],
            ['role_name' => 'CART',            'position' => 'CART Personnel'],
            ['role_name' => 'Receiving Clerk', 'position' => 'Receiving Clerk'],
            ['role_name' => 'HR',              'position' => 'HR Manager'],
        ];

        foreach ($roles as $roleData) {
            Role::firstOrCreate(
                ['role_name' => $roleData['role_name']],
                $roleData
            );
        }

        // ── Create Users ────────────────────────────────────────
        $users = [
            [
                'name'     => 'System Admin',
                'email'    => 'admin@mati.com',
                'password' => 'password123',
                'role'     => 'Admin',
            ],
            [
                'name'     => 'Hon. Mayor',
                'email'    => 'mayor@mati.com',
                'password' => 'password123',
                'role'     => 'Mayor',
            ],
            [
                'name'     => 'Department Head',
                'email'    => 'departmenthead@mati.com',
                'password' => 'password123',
                'role'     => 'Department Head',
            ],
            [
                'name'     => 'CART Officer',
                'email'    => 'cart@mati.com',
                'password' => 'password123',
                'role'     => 'CART',
            ],
            [
                'name'     => 'Receiving Clerk',
                'email'    => 'receivingclerk@mati.com',
                'password' => 'password123',
                'role'     => 'Receiving Clerk',
            ],
            [
                'name'     => 'HR Manager',
                'email'    => 'hr@mati.com',
                'password' => 'password123',
                'role'     => 'HR',
            ],
        ];

        foreach ($users as $userData) {
            $role = Role::where('role_name', $userData['role'])->first();

            User::firstOrCreate(
                ['email' => $userData['email']],
                [
                    'name'     => $userData['name'],
                    'email'    => $userData['email'],
                    'password' => Hash::make($userData['password']),
                    'role_id'  => $role->role_id,
                ]
            );
        }

        // ── Create Document Types ────────────────────────────────
        $docTypes = [
            ['type_name' => 'Executive Order', 'description' => 'Directives from the Mayor', 'arta_processing_days' => 3],
            ['type_name' => 'Memorandum', 'description' => 'Internal office memo', 'arta_processing_days' => 5],
            ['type_name' => 'Travel Order', 'description' => 'Official travel request', 'arta_processing_days' => 7],
            ['type_name' => 'Voucher', 'description' => 'Financial disbursement', 'arta_processing_days' => 5],
        ];

        foreach ($docTypes as $docData) {
            \App\Models\DocumentType::firstOrCreate(
                ['type_name' => $docData['type_name']],
                $docData
            );
        }

        // ── Create Departments ────────────────────────────────
        $deptHeadUser = User::where('email', 'departmenthead@mati.com')->first();
        
        $departments = [
            ['department_name' => 'Receiving Office', 'code' => 'REC', 'description' => 'Central Receiving Area', 'head_id' => null],
            ['department_name' => 'Admin Office', 'code' => 'ADMIN', 'description' => 'City Administrator Office', 'head_id' => $deptHeadUser->id],
            ['department_name' => 'HR Department', 'code' => 'HR', 'description' => 'Human Resources', 'head_id' => null],
            ['department_name' => 'Office of the Mayor', 'code' => 'MAYOR', 'description' => 'Chief Executive Office', 'head_id' => null],
            ['department_name' => 'City Engineering Office', 'code' => 'ENG', 'description' => 'Infrastructure & Planning', 'head_id' => null],
        ];

        foreach ($departments as $deptData) {
            \App\Models\Department::firstOrCreate(
                ['department_name' => $deptData['department_name']],
                $deptData
            );
        }
    }
}
