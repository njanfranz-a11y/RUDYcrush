<?php

namespace Tests\Feature;

use App\Models\AccidentCategory;
use App\Models\AccidentPhoto;
use App\Models\AccidentReport;
use App\Models\AuditLog;
use App\Models\OfficerAssignment;
use App\Models\ReportStatusHistory;
use App\Models\SystemNotification;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AccidentReportingApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        // Seed categories if not already present
        if (AccidentCategory::count() === 0) {
            AccidentCategory::create([
                'name' => 'Collision',
                'slug' => 'collision',
                'is_active' => true,
            ]);
        }
    }

    public function test_user_can_register_as_citizen_reporter(): void
    {
        $response = $this->postJson('/api/v1/auth/register', [
            'name' => 'Testing Citizen',
            'email' => 'citizen.test@roadwatch.gov',
            'phone' => '09123456789',
            'address' => '123 Rizal St, Brgy. Catmon, Malolos, Bulacan',
            'password' => 'SecurePass123!',
            'password_confirmation' => 'SecurePass123!',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.user.role', 'reporter')
            ->assertJsonPath('data.user.address', '123 Rizal St, Brgy. Catmon, Malolos, Bulacan');

        $this->assertDatabaseHas('users', [
            'email' => 'citizen.test@roadwatch.gov',
            'role' => 'reporter',
            'address' => '123 Rizal St, Brgy. Catmon, Malolos, Bulacan',
        ]);
    }

    public function test_registration_requires_address(): void
    {
        $response = $this->postJson('/api/v1/auth/register', [
            'name' => 'No Address Citizen',
            'email' => 'noaddress.test@roadwatch.gov',
            'password' => 'SecurePass123!',
            'password_confirmation' => 'SecurePass123!',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['address']);

        $this->assertDatabaseMissing('users', ['email' => 'noaddress.test@roadwatch.gov']);
    }

    /**
     * @dataProvider validPhilippineMobileNumbers
     */
    public function test_registration_accepts_exactly_11_digit_mobile_numbers(string $phone): void
    {
        $response = $this->postJson('/api/v1/auth/register', [
            'name' => 'Mobile Tester',
            'email' => 'mobile.' . md5($phone) . '@roadwatch.gov',
            'phone' => $phone,
            'address' => '456 Mabini St, Baliwag, Bulacan',
            'password' => 'SecurePass123!',
            'password_confirmation' => 'SecurePass123!',
        ]);

        $response->assertStatus(201);
    }

    public static function validPhilippineMobileNumbers(): array
    {
        return [
            'globe' => ['09171234567'],
            'smart' => ['09991234567'],
            'zero heavy' => ['09170000000'],
        ];
    }

    /**
     * @dataProvider invalidPhilippineMobileNumbers
     */
    public function test_registration_rejects_invalid_mobile_numbers(string $phone): void
    {
        $response = $this->postJson('/api/v1/auth/register', [
            'name' => 'Bad Mobile',
            'email' => 'badmobile.' . md5($phone) . '@roadwatch.gov',
            'phone' => $phone,
            'address' => '789 Roxas St, Meycauayan, Bulacan',
            'password' => 'SecurePass123!',
            'password_confirmation' => 'SecurePass123!',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['phone']);
    }

    public static function invalidPhilippineMobileNumbers(): array
    {
        return [
            'too short' => ['0917123'],
            'missing a digit' => ['0917123456'],
            'too long' => ['091712345678'],
            'international format' => ['+639171234567'],
            'spaces' => ['0917 123 4567'],
            'dashes' => ['0917-123-4567'],
            'parentheses' => ['(0917) 1234567'],
            'landline' => ['0441234567'],
            'wrong mobile prefix' => ['08171234567'],
            'letters' => ['not a phone'],
        ];
    }

    public function test_registration_rejects_duplicate_email(): void
    {
        User::create([
            'name' => 'Existing User',
            'email' => 'duplicate.check@roadwatch.gov',
            'role' => 'reporter',
            'is_active' => true,
            'password' => bcrypt('Password123!'),
        ]);

        $response = $this->postJson('/api/v1/auth/register', [
            'name' => 'Another User',
            'email' => 'duplicate.check@roadwatch.gov',
            'address' => '123 Rizal St, Malolos, Bulacan',
            'password' => 'Password123!',
            'password_confirmation' => 'Password123!',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['email']);
    }

    public function test_existing_account_without_address_can_still_log_in(): void
    {
        // Guards the nullable column: accounts created before the migration
        // have no address and must keep authenticating untouched.
        $user = User::create([
            'name' => 'Legacy Citizen',
            'email' => 'legacy.citizen@roadwatch.gov',
            'phone' => '+63 917 000 0000',
            'address' => null,
            'role' => 'reporter',
            'is_active' => true,
            'password' => bcrypt('LegacyPass123!'),
        ]);

        $response = $this->postJson('/api/v1/auth/login', [
            'email' => 'legacy.citizen@roadwatch.gov',
            'password' => 'LegacyPass123!',
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('success', true);

        $this->assertNull($user->fresh()->address);
    }

    public function test_user_can_update_their_address(): void
    {
        $user = User::factory()->create([
            'role' => 'reporter',
            'is_active' => true,
            'address' => 'Old Address, Malolos',
        ]);
        Sanctum::actingAs($user);

        $response = $this->putJson('/api/v1/auth/profile', [
            'address' => 'New Address, Baliwag, Bulacan',
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('data.user.address', 'New Address, Baliwag, Bulacan');

        $this->assertDatabaseHas('users', [
            'id' => $user->id,
            'address' => 'New Address, Baliwag, Bulacan',
        ]);
    }

    // -------------------------------------------------------------------------
// Admin account management
// -------------------------------------------------------------------------

    private function adminToken(): array
    {
        $admin = User::factory()->create(['role' => 'admin', 'is_active' => true]);
        $token = $admin->createToken('auth-token', ['role:admin'])->plainTextToken;

        return [$admin, $token];
    }

    public function test_admin_can_view_account_details(): void
    {
        [$admin, $token] = $this->adminToken();
        $target = User::factory()->create([
            'name' => 'Officer Detail',
            'email' => 'officer.detail@traffic.gov',
            'role' => 'officer',
            'badge_number' => 'PO3-1234',
            'address' => '123 Rizal St, Malolos, Bulacan',
            'is_active' => true,
        ]);

        $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson("/api/v1/admin/users/{$target->id}")
            ->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.user.name', 'Officer Detail')
            ->assertJsonPath('data.user.badge_number', 'PO3-1234')
            ->assertJsonPath('data.user.address', '123 Rizal St, Malolos, Bulacan');
    }

    public function test_non_admin_cannot_view_account_details(): void
    {
        $officer = User::factory()->create(['role' => 'officer', 'is_active' => true]);
        $token = $officer->createToken('auth-token', ['role:officer'])->plainTextToken;
        $target = User::factory()->create(['role' => 'reporter', 'is_active' => true]);

        $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson("/api/v1/admin/users/{$target->id}")
            ->assertStatus(403);
    }

    public function test_admin_can_edit_account_details(): void
    {
        [$admin, $token] = $this->adminToken();
        $target = User::factory()->create([
            'name' => 'Before Name',
            'email' => 'before.edit@traffic.gov',
            'role' => 'reporter',
            'is_active' => true,
        ]);

        $this->withHeader('Authorization', "Bearer {$token}")
            ->putJson("/api/v1/admin/users/{$target->id}", [
                'name' => 'After Name',
                'email' => 'after.edit@traffic.gov',
                'phone' => '09171234567',
                'address' => '456 Mabini St, Baliwag, Bulacan',
                'role' => 'officer',
                'badge_number' => 'PO2-9999',
            ])
            ->assertStatus(200)
            ->assertJsonPath('success', true);

        $this->assertDatabaseHas('users', [
            'id' => $target->id,
            'name' => 'After Name',
            'email' => 'after.edit@traffic.gov',
            'phone' => '09171234567',
            'role' => 'officer',
            'badge_number' => 'PO2-9999',
        ]);
    }

    public function test_admin_edit_rejects_duplicate_email(): void
    {
        [$admin, $token] = $this->adminToken();
        User::factory()->create(['email' => 'taken@traffic.gov', 'is_active' => true]);
        $target = User::factory()->create([
            'email' => 'unique.one@traffic.gov',
            'role' => 'reporter',
            'is_active' => true,
        ]);

        $this->withHeader('Authorization', "Bearer {$token}")
            ->putJson("/api/v1/admin/users/{$target->id}", [
                'name' => 'Clash',
                'email' => 'taken@traffic.gov',
                'role' => 'reporter',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['email']);

        $this->assertDatabaseHas('users', ['id' => $target->id, 'email' => 'unique.one@traffic.gov']);
    }

    public function test_admin_edit_validates_email_format_and_required_fields(): void
    {
        [$admin, $token] = $this->adminToken();
        $target = User::factory()->create(['email' => 'validate@traffic.gov', 'is_active' => true]);

        $this->withHeader('Authorization', "Bearer {$token}")
            ->putJson("/api/v1/admin/users/{$target->id}", [
                'name' => '',
                'email' => 'not-an-email',
                'role' => 'reporter',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['name', 'email']);
    }

    public function test_admin_edit_rejects_a_phone_that_is_not_exactly_11_digits(): void
    {
        [$admin, $token] = $this->adminToken();
        $target = User::factory()->create(['email' => 'phone.edit@traffic.gov', 'is_active' => true]);

        foreach (['+639171234567', '0917 123 4567', '0917123456', '091712345678', 'abcdefghijk'] as $badPhone) {
            $this->withHeader('Authorization', "Bearer {$token}")
                ->putJson("/api/v1/admin/users/{$target->id}", [
                    'name' => 'Phone Edit',
                    'email' => 'phone.edit@traffic.gov',
                    'phone' => $badPhone,
                    'role' => 'reporter',
                ])
                ->assertStatus(422)
                ->assertJsonValidationErrors(['phone']);
        }

        // A clean 11-digit number is accepted and stored verbatim.
        $this->withHeader('Authorization', "Bearer {$token}")
            ->putJson("/api/v1/admin/users/{$target->id}", [
                'name' => 'Phone Edit',
                'email' => 'phone.edit@traffic.gov',
                'phone' => '09171234567',
                'role' => 'reporter',
            ])
            ->assertStatus(200);

        $this->assertDatabaseHas('users', ['id' => $target->id, 'phone' => '09171234567']);
    }

    public function test_admin_can_keep_their_own_email_while_editing_other_fields(): void
    {
        [$admin, $token] = $this->adminToken();

        // Re-submitting the admin's own unchanged email must be allowed.
        $this->withHeader('Authorization', "Bearer {$token}")
            ->putJson("/api/v1/admin/users/{$admin->id}", [
                'name' => 'Chief Admin Renamed',
                'email' => $admin->email,
                'role' => 'admin',
            ])
            ->assertStatus(200);

        $this->assertDatabaseHas('users', ['id' => $admin->id, 'name' => 'Chief Admin Renamed']);
    }

    public function test_admin_cannot_change_their_own_role(): void
    {
        [$admin, $token] = $this->adminToken();

        $this->withHeader('Authorization', "Bearer {$token}")
            ->putJson("/api/v1/admin/users/{$admin->id}", [
                'name' => $admin->name,
                'email' => $admin->email,
                'role' => 'reporter',
            ])
            ->assertStatus(422)
            ->assertJsonPath('message', 'You cannot change your own role.');

        $this->assertDatabaseHas('users', ['id' => $admin->id, 'role' => 'admin']);
    }

    // ---- Activation / deactivation ----------------------------------------

    public function test_admin_can_deactivate_an_account(): void
    {
        [$admin, $token] = $this->adminToken();
        $target = User::factory()->create(['role' => 'officer', 'is_active' => true]);

        $this->withHeader('Authorization', "Bearer {$token}")
            ->putJson("/api/v1/admin/users/{$target->id}/status", ['is_active' => false])
            ->assertStatus(200)
            ->assertJsonPath('success', true);

        $this->assertDatabaseHas('users', ['id' => $target->id, 'is_active' => false]);
    }

    public function test_admin_can_reactivate_an_account(): void
    {
        [$admin, $token] = $this->adminToken();
        $target = User::factory()->create(['role' => 'officer', 'is_active' => false]);

        $this->withHeader('Authorization', "Bearer {$token}")
            ->putJson("/api/v1/admin/users/{$target->id}/status", ['is_active' => true])
            ->assertStatus(200);

        $this->assertDatabaseHas('users', ['id' => $target->id, 'is_active' => true]);
    }

    public function test_admin_cannot_deactivate_their_own_account(): void
    {
        [$admin, $token] = $this->adminToken();

        $this->withHeader('Authorization', "Bearer {$token}")
            ->putJson("/api/v1/admin/users/{$admin->id}/status", ['is_active' => false])
            ->assertStatus(422);

        $this->assertDatabaseHas('users', ['id' => $admin->id, 'is_active' => true]);
    }

    public function test_inactive_officer_cannot_log_in(): void
    {
        $officer = User::factory()->create([
            'email' => 'inactive.officer@traffic.gov',
            'role' => 'officer',
            'is_active' => false,
            'password' => bcrypt('OfficerPass123!'),
        ]);

        $this->postJson('/api/v1/auth/login', [
            'email' => $officer->email,
            'password' => 'OfficerPass123!',
        ])
            ->assertStatus(403)
            ->assertJsonPath(
                'message',
                'Your account is inactive. Please contact the administrator for assistance.'
            );
    }

    public function test_inactive_citizen_cannot_log_in(): void
    {
        $citizen = User::factory()->create([
            'email' => 'inactive.citizen@gmail.com',
            'role' => 'reporter',
            'is_active' => false,
            'password' => bcrypt('CitizenPass123!'),
        ]);

        $this->postJson('/api/v1/auth/login', [
            'email' => $citizen->email,
            'password' => 'CitizenPass123!',
        ])
            ->assertStatus(403)
            ->assertJsonPath(
                'message',
                'Your account is inactive. Please contact the administrator for assistance.'
            );
    }

    /**
     * An officer's token is accepted while the account is active.
     */
    public function test_active_account_can_use_its_token(): void
    {
        $officer = User::factory()->create(['role' => 'officer', 'is_active' => true]);
        $token = $officer->createToken('auth-token', ['role:officer'])->plainTextToken;

        $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/v1/auth/me')
            ->assertStatus(200)
            ->assertJsonPath('data.user.email', $officer->email);
    }

    /**
     * The core security guarantee: a token minted before deactivation must
     * stop working the moment the account is switched off.
     *
     * Deactivation happens first via actingAs, because Sanctum resolves and
     * caches the bearer user for the whole test lifecycle, which would
     * otherwise mask the behaviour under test.
     */
    public function test_admin_deactivation_marks_the_account_inactive(): void
    {
        [$admin, $token] = $this->adminToken();
        $officer = User::factory()->create(['role' => 'officer', 'is_active' => true]);
        $staleToken = $officer->createToken('auth-token', ['role:officer'])->plainTextToken;

        $this->withHeader('Authorization', "Bearer {$token}")
            ->putJson("/api/v1/admin/users/{$officer->id}/status", ['is_active' => false])
            ->assertStatus(200)
            ->assertJsonPath('data.is_active', false);

        $this->assertDatabaseHas('users', ['id' => $officer->id, 'is_active' => false]);
    }

    /**
     * The token is deliberately left in place after deactivation, so the
     * replay must be refused by middleware with the clear message rather than
     * rejected earlier by Sanctum as an unknown token.
     */
    public function test_token_replay_after_deactivation_returns_the_inactive_message(): void
    {
        $officer = User::factory()->create(['role' => 'officer', 'is_active' => true]);

        // A live session established while the account was active.
        $staleToken = $officer->createToken('auth-token', ['role:officer'])->plainTextToken;

        // Flip the flag the same way the admin endpoint would.
        $officer->forceFill(['is_active' => false])->save();

        $response = $this->withHeader('Authorization', "Bearer {$staleToken}")
            ->getJson('/api/v1/auth/me');

        $response->assertStatus(403)
            ->assertJsonPath(
                'message',
                'Your account is inactive. Please contact the administrator for assistance.'
            );
    }

    /**
     * Even if a revoked token were somehow replayed, the account-status
     * middleware must still refuse it on every protected route.
     */
    public function test_inactive_account_is_blocked_on_protected_routes(): void
    {
        $officer = User::factory()->create(['role' => 'officer', 'is_active' => false]);
        $token = $officer->createToken('auth-token', ['role:officer'])->plainTextToken;

        foreach (['/api/v1/auth/me', '/api/v1/officer/assigned-reports', '/api/v1/my-reports'] as $route) {
            $this->withHeader('Authorization', "Bearer {$token}")
                ->getJson($route)
                ->assertStatus(403)
                ->assertJsonPath(
                    'message',
                    'Your account is inactive. Please contact the administrator for assistance.'
                );
        }
    }

    public function test_non_admin_cannot_change_account_status(): void
    {
        $reporter = User::factory()->create(['role' => 'reporter', 'is_active' => true]);
        $token = $reporter->createToken('auth-token', ['role:reporter'])->plainTextToken;
        $target = User::factory()->create(['role' => 'reporter', 'is_active' => true]);

        $this->withHeader('Authorization', "Bearer {$token}")
            ->putJson("/api/v1/admin/users/{$target->id}/status", ['is_active' => false])
            ->assertStatus(403);

        $this->assertDatabaseHas('users', ['id' => $target->id, 'is_active' => true]);
    }

    public function test_citizen_cannot_edit_other_accounts(): void
    {
        $reporter = User::factory()->create(['role' => 'reporter', 'is_active' => true]);
        $token = $reporter->createToken('auth-token', ['role:reporter'])->plainTextToken;
        $target = User::factory()->create([
            'name' => 'Untouchable',
            'email' => 'untouchable@traffic.gov',
            'role' => 'officer',
            'is_active' => true,
        ]);

        $this->withHeader('Authorization', "Bearer {$token}")
            ->putJson("/api/v1/admin/users/{$target->id}", [
                'name' => 'Hacked',
                'email' => 'hacked@traffic.gov',
                'role' => 'admin',
            ])
            ->assertStatus(403);

        $this->assertDatabaseHas('users', [
            'id' => $target->id,
            'name' => 'Untouchable',
            'role' => 'officer',
        ]);
    }

    // -------------------------------------------------------------------------
// Officer module screens
// -------------------------------------------------------------------------

    private function seedReport(array $overrides = []): AccidentReport
    {
        $category = AccidentCategory::firstOrCreate(
            ['slug' => 'collision'],
            ['name' => 'Collision', 'is_active' => true]
        );

        return AccidentReport::create(array_merge([
            'report_number' => 'AR-TEST-' . uniqid(),
            'reporter_name' => 'Test Reporter',
            'reporter_contact' => '09123334444',
            'category_id' => $category->id,
            'accident_date' => now()->subDay()->toDateString(),
            'accident_time' => '10:30',
            'location_address' => 'MacArthur Highway, Malolos, Bulacan',
            'latitude' => 14.8587,
            'longitude' => 120.8143,
            'accident_type' => 'Rear-end Collision',
            'vehicles_involved' => 2,
            'injury_severity' => 'minor',
            'description' => 'Two passenger vehicles collided along the inner lane.',
            'status' => 'submitted',
        ], $overrides));
    }

    public function test_officer_dashboard_stats_are_scoped_to_their_own_cases(): void
    {
        $officer = User::factory()->create(['role' => 'officer', 'is_active' => true]);
        $other = User::factory()->create(['role' => 'officer', 'is_active' => true]);

        $this->seedReport(['assigned_officer_id' => $officer->id, 'status' => 'assigned']);
        $this->seedReport(['assigned_officer_id' => $officer->id, 'status' => 'in_progress']);
        $this->seedReport(['assigned_officer_id' => $officer->id, 'status' => 'closed']);
        // Belongs to a different officer: must not appear in the counts.
        $this->seedReport(['assigned_officer_id' => $other->id, 'status' => 'assigned']);

        Sanctum::actingAs($officer);

        $this->getJson('/api/v1/officer/dashboard/stats')
            ->assertStatus(200)
            ->assertJsonPath('data.counts.assigned', 1)
            ->assertJsonPath('data.counts.in_progress', 1)
            ->assertJsonPath('data.counts.closed', 1)
            ->assertJsonPath('data.counts.total', 3);
    }

    public function test_officer_reports_only_list_their_own_assigned_cases(): void
    {
        $officer = User::factory()->create(['role' => 'officer', 'is_active' => true]);
        $other = User::factory()->create(['role' => 'officer', 'is_active' => true]);

        $mine = $this->seedReport(['assigned_officer_id' => $officer->id, 'status' => 'assigned']);
        $this->seedReport(['assigned_officer_id' => $other->id, 'status' => 'assigned']);
        // Unassigned: belongs to nobody, so not in the officer's own list.
        $this->seedReport(['assigned_officer_id' => null, 'status' => 'assigned']);

        Sanctum::actingAs($officer);

        $response = $this->getJson('/api/v1/officer/assigned-reports')->assertStatus(200);

        $ids = collect($response->json('data.data'))->pluck('id');

        $this->assertTrue($ids->contains($mine->id));
        $this->assertCount(1, $ids);
    }

    public function test_officer_reports_can_filter_by_status(): void
    {
        $officer = User::factory()->create(['role' => 'officer', 'is_active' => true]);

        $inProgress = $this->seedReport(['assigned_officer_id' => $officer->id, 'status' => 'in_progress']);
        $this->seedReport(['assigned_officer_id' => $officer->id, 'status' => 'closed']);

        Sanctum::actingAs($officer);

        $response = $this->getJson('/api/v1/officer/assigned-reports?status=in_progress')
            ->assertStatus(200);

        $ids = collect($response->json('data.data'))->pluck('id');

        $this->assertTrue($ids->contains($inProgress->id));
        $this->assertCount(1, $ids);
    }

    /**
     * The officer Verification Queue lists only cases the admin has assigned
     * to the logged-in officer and that still need an officer decision.
     */
    public function test_officer_verification_queue_lists_only_own_assigned_cases(): void
    {
        $officer = User::factory()->create(['role' => 'officer', 'is_active' => true]);
        $other = User::factory()->create(['role' => 'officer', 'is_active' => true]);

        $mine = $this->seedReport(['assigned_officer_id' => $officer->id, 'status' => 'assigned']);
        $this->seedReport(['assigned_officer_id' => $other->id, 'status' => 'assigned']);
        // Already decided or not dispatched yet: not awaiting verification.
        $this->seedReport(['assigned_officer_id' => $officer->id, 'status' => 'verified']);
        $this->seedReport(['assigned_officer_id' => $officer->id, 'status' => 'in_progress']);
        $this->seedReport(['assigned_officer_id' => null, 'status' => 'submitted']);

        Sanctum::actingAs($officer);

        $response = $this->getJson('/api/v1/officer/verification-queue')->assertStatus(200);

        $ids = collect($response->json('data.data'))->pluck('id');

        $this->assertTrue($ids->contains($mine->id));
        $this->assertCount(1, $ids);
    }

    public function test_officer_verification_queue_supports_search(): void
    {
        $officer = User::factory()->create(['role' => 'officer', 'is_active' => true]);

        $matching = $this->seedReport([
            'assigned_officer_id' => $officer->id,
            'status' => 'assigned',
            'location_address' => 'Baliuag Public Market, Bulacan',
        ]);
        $other = $this->seedReport([
            'assigned_officer_id' => $officer->id,
            'status' => 'assigned',
        ]);

        Sanctum::actingAs($officer);

        $response = $this->getJson('/api/v1/officer/verification-queue?search=Baliuag')->assertStatus(200);

        $ids = collect($response->json('data.data'))->pluck('id');

        $this->assertTrue($ids->contains($matching->id));
        $this->assertFalse($ids->contains($other->id));
    }

    public function test_officer_verification_queue_is_officer_only(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'is_active' => true]);
        Sanctum::actingAs($admin);

        $this->getJson('/api/v1/officer/verification-queue')->assertStatus(403);

        $this->app['auth']->forgetGuards();

        $reporter = User::factory()->create(['role' => 'reporter', 'is_active' => true]);
        Sanctum::actingAs($reporter);

        $this->getJson('/api/v1/officer/verification-queue')->assertStatus(403);
    }

    public function test_assigned_officer_can_verify_a_report_without_resolving_it(): void
    {
        $officer = User::factory()->create(['role' => 'officer', 'is_active' => true]);
        $report = $this->seedReport(['assigned_officer_id' => $officer->id, 'status' => 'assigned']);

        Sanctum::actingAs($officer);

        $this->putJson("/api/v1/officer/reports/{$report->id}/verify", [
            'official_remarks' => 'Confirmed on site.',
        ])
            ->assertStatus(200)
            ->assertJsonPath('data.status', 'verified')
            ->assertJsonPath('data.assigned_officer_id', $officer->id);

        $this->assertDatabaseHas('accident_reports', [
            'id' => $report->id,
            'status' => 'verified',
            'assigned_officer_id' => $officer->id,
            'verified_by' => $officer->id,
            'closed_at' => null,
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'verify_report',
            'target_id' => $report->id,
        ]);

        // Verification must not re-dispatch the case to someone else.
        $this->assertDatabaseCount('officer_assignments', 0);
    }

    public function test_assigned_officer_can_reject_a_report_with_a_reason(): void
    {
        $officer = User::factory()->create(['role' => 'officer', 'is_active' => true]);
        $report = $this->seedReport(['assigned_officer_id' => $officer->id, 'status' => 'assigned']);

        Sanctum::actingAs($officer);

        $this->putJson("/api/v1/officer/reports/{$report->id}/reject", [
            'rejection_reason' => 'Duplicate report already under investigation.',
        ])
            ->assertStatus(200)
            ->assertJsonPath('data.status', 'rejected');

        $this->assertDatabaseHas('accident_reports', [
            'id' => $report->id,
            'status' => 'rejected',
            'rejection_reason' => 'Duplicate report already under investigation.',
            'assigned_officer_id' => $officer->id,
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'reject_report',
            'target_id' => $report->id,
        ]);
    }

    /**
     * Officers cannot claim or touch an unassigned intake report: those are
     * Admin-owned until they are verified and dispatched.
     */
    public function test_officer_cannot_act_on_an_unassigned_intake_report(): void
    {
        $officer = User::factory()->create(['role' => 'officer', 'is_active' => true]);
        $report = $this->seedReport(['assigned_officer_id' => null, 'status' => 'submitted']);

        Sanctum::actingAs($officer);

        $this->putJson("/api/v1/officer/reports/{$report->id}/status", [
            'status' => 'in_progress',
            'official_remarks' => 'Attempting to claim an unassigned report.',
        ])->assertStatus(404);

        $this->assertDatabaseHas('accident_reports', [
            'id' => $report->id,
            'status' => 'submitted',
            'assigned_officer_id' => null,
        ]);
    }

    /**
     * The investigation status endpoint still refuses 'verified': officer
     * verification has its own dedicated endpoint with an ownership check.
     */
    public function test_officer_cannot_verify_through_the_status_endpoint(): void
    {
        $officer = User::factory()->create(['role' => 'officer', 'is_active' => true]);
        $report = $this->seedReport(['assigned_officer_id' => $officer->id, 'status' => 'assigned']);

        Sanctum::actingAs($officer);

        $this->putJson("/api/v1/officer/reports/{$report->id}/status", [
            'status' => 'verified',
            'official_remarks' => 'Trying to self-verify through the status route.',
        ])
            ->assertStatus(422)
            ->assertJsonPath('success', false);

        $this->assertDatabaseHas('accident_reports', [
            'id' => $report->id,
            'status' => 'assigned',
        ]);
    }

    public function test_admin_verification_queue_lists_only_unverified_intake_reports(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'is_active' => true]);

        $submitted = $this->seedReport(['status' => 'submitted']);
        $underReview = $this->seedReport(['status' => 'under_review']);
        $needsInfo = $this->seedReport(['status' => 'additional_info_required']);
        // Already decided: must not appear in a verification queue.
        $verified = $this->seedReport(['status' => 'verified']);
        $rejected = $this->seedReport(['status' => 'rejected']);
        $closed = $this->seedReport(['status' => 'closed']);

        Sanctum::actingAs($admin);

        $response = $this->getJson('/api/v1/admin/verification-queue')->assertStatus(200);

        $ids = collect($response->json('data.data'))->pluck('id');

        $this->assertTrue($ids->contains($submitted->id));
        $this->assertTrue($ids->contains($underReview->id));
        $this->assertTrue($ids->contains($needsInfo->id));
        $this->assertFalse($ids->contains($verified->id), 'Verified reports are not awaiting verification.');
        $this->assertFalse($ids->contains($rejected->id), 'Rejected reports are not awaiting verification.');
        $this->assertFalse($ids->contains($closed->id), 'Closed reports are not awaiting verification.');
        $this->assertCount(3, $ids);
    }

    public function test_admin_verification_queue_filters_by_status(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'is_active' => true]);

        $submitted = $this->seedReport(['status' => 'submitted']);
        $underReview = $this->seedReport(['status' => 'under_review']);

        Sanctum::actingAs($admin);

        $response = $this->getJson('/api/v1/admin/verification-queue?status=submitted')->assertStatus(200);

        $ids = collect($response->json('data.data'))->pluck('id');

        $this->assertTrue($ids->contains($submitted->id));
        $this->assertFalse($ids->contains($underReview->id));
        $this->assertCount(1, $ids);
    }

    public function test_admin_verification_queue_rejects_an_unknown_status_filter(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'is_active' => true]);
        Sanctum::actingAs($admin);

        $this->getJson('/api/v1/admin/verification-queue?status=verified')
            ->assertStatus(422)
            ->assertJsonValidationErrors('status');
    }

    public function test_admin_verification_queue_supports_search(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'is_active' => true]);

        $matching = $this->seedReport([
            'status' => 'submitted',
            'location_address' => 'Guiguinto Public Market, Bulacan',
        ]);
        $other = $this->seedReport(['status' => 'submitted']);

        Sanctum::actingAs($admin);

        $response = $this->getJson('/api/v1/admin/verification-queue?search=Guiguinto')->assertStatus(200);

        $ids = collect($response->json('data.data'))->pluck('id');

        $this->assertTrue($ids->contains($matching->id));
        $this->assertFalse($ids->contains($other->id));
    }

    public function test_admin_verification_queue_is_admin_only(): void
    {
        $officer = User::factory()->create(['role' => 'officer', 'is_active' => true]);
        Sanctum::actingAs($officer);

        $this->getJson('/api/v1/admin/verification-queue')->assertStatus(403);

        $this->app['auth']->forgetGuards();

        $reporter = User::factory()->create(['role' => 'reporter', 'is_active' => true]);
        Sanctum::actingAs($reporter);

        $this->getJson('/api/v1/admin/verification-queue')->assertStatus(403);
    }

    /**
     * The legitimate officer workflow begins with an Admin-assigned case: the
     * officer verifies it, then marks it in progress and later closes it.
     * Investigation updates are refused until the case is verified.
     */
    public function test_officer_must_verify_before_investigating_and_closing(): void
    {
        $officer = User::factory()->create(['role' => 'officer', 'is_active' => true]);
        $report = $this->seedReport(['assigned_officer_id' => $officer->id, 'status' => 'assigned']);

        Sanctum::actingAs($officer);

        $this->putJson("/api/v1/officer/reports/{$report->id}/status", [
            'status' => 'in_progress',
            'official_remarks' => 'Trying to skip verification.',
        ])->assertStatus(422);

        $this->putJson("/api/v1/officer/reports/{$report->id}/verify", [
            'official_remarks' => 'Verified after field check.',
        ])->assertStatus(200);

        $this->putJson("/api/v1/officer/reports/{$report->id}/status", [
            'status' => 'in_progress',
            'official_remarks' => 'En route to the scene.',
        ])->assertStatus(200);

        $this->assertDatabaseHas('accident_reports', [
            'id' => $report->id,
            'status' => 'in_progress',
            'assigned_officer_id' => $officer->id,
            'verified_by' => $officer->id,
        ]);

        $this->putJson("/api/v1/officer/reports/{$report->id}/status", [
            'status' => 'closed',
            'investigation_findings' => 'Brake failure confirmed on inspection.',
            'actions_taken' => 'Road cleared and vehicles towed.',
        ])->assertStatus(200);

        $this->assertDatabaseHas('accident_reports', [
            'id' => $report->id,
            'status' => 'closed',
        ]);
    }

    public function test_officer_cannot_touch_another_officers_case(): void
    {
        $officer = User::factory()->create(['role' => 'officer', 'is_active' => true]);
        $other = User::factory()->create(['role' => 'officer', 'is_active' => true]);
        $report = $this->seedReport(['assigned_officer_id' => $other->id, 'status' => 'assigned']);

        Sanctum::actingAs($officer);

        // Another officer cannot verify, reject, or update the case.
        $this->putJson("/api/v1/officer/reports/{$report->id}/verify", [
            'official_remarks' => 'Attempted unauthorised verification.',
        ])->assertStatus(404);

        $this->putJson("/api/v1/officer/reports/{$report->id}/reject", [
            'rejection_reason' => 'Attempted unauthorised rejection.',
        ])->assertStatus(404);

        $this->putJson("/api/v1/officer/reports/{$report->id}/status", [
            'status' => 'closed',
            'investigation_findings' => 'Attempted unauthorised edit.',
            'actions_taken' => 'None.',
        ])->assertStatus(404);

        $this->assertDatabaseHas('accident_reports', [
            'id' => $report->id,
            'status' => 'assigned',
        ]);
    }

    public function test_closing_a_report_still_requires_findings_and_actions(): void
    {
        $officer = User::factory()->create(['role' => 'officer', 'is_active' => true]);
        $report = $this->seedReport(['assigned_officer_id' => $officer->id, 'status' => 'in_progress']);

        Sanctum::actingAs($officer);

        $this->putJson("/api/v1/officer/reports/{$report->id}/status", [
            'status' => 'closed',
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['investigation_findings', 'actions_taken']);

        $this->assertDatabaseHas('accident_reports', ['id' => $report->id, 'status' => 'in_progress']);
    }

    // -------------------------------------------------------------------------
// Admin audit trail filters
// -------------------------------------------------------------------------

    private function seedAuditLog(?User $actor, string $action, string $description, string $createdAt): AuditLog
    {
        $log = AuditLog::create([
            'user_id' => $actor?->id,
            'action' => $action,
            'target_type' => 'User',
            'target_id' => $actor?->id,
            'description' => $description,
            'ip_address' => '127.0.0.1',
            'user_agent' => 'phpunit',
        ]);

        // Force a specific timestamp so date-range filtering is deterministic.
        $log->forceFill(['created_at' => $createdAt, 'updated_at' => $createdAt])->save();

        return $log;
    }

    public function test_audit_trail_filters_by_date_range_inclusively(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'is_active' => true]);

        $before = $this->seedAuditLog($admin, 'user_login', 'Login on the boundary day', '2026-01-10 09:00:00');
        $inside = $this->seedAuditLog($admin, 'user_logout', 'Logout inside range', '2026-01-15 12:00:00');
        $after = $this->seedAuditLog($admin, 'user_login', 'Login after range', '2026-01-20 09:00:00');

        Sanctum::actingAs($admin);

        $response = $this->getJson('/api/v1/admin/audit-logs?from_date=2026-01-10&to_date=2026-01-15')
            ->assertStatus(200);

        $ids = collect($response->json('data.data'))->pluck('id');

        // Both boundary days must be included.
        $this->assertTrue($ids->contains($before->id), 'From-date boundary should be included.');
        $this->assertTrue($ids->contains($inside->id));
        $this->assertFalse($ids->contains($after->id), 'After-range record must be excluded.');
    }

    public function test_audit_trail_filters_by_user_type(): void
    {
        $adminUser = User::factory()->create(['role' => 'admin', 'is_active' => true]);
        $resident = User::factory()->create(['role' => 'reporter', 'is_active' => true]);

        $adminLog = $this->seedAuditLog($adminUser, 'verify_report', 'Admin verified a report', '2026-02-01 10:00:00');
        $residentLog = $this->seedAuditLog($resident, 'submit_report', 'Resident submitted a report', '2026-02-01 11:00:00');

        Sanctum::actingAs($adminUser);

        $adminOnly = $this->getJson('/api/v1/admin/audit-logs?user_type=admin')->assertStatus(200);
        $adminIds = collect($adminOnly->json('data.data'))->pluck('id');
        $this->assertTrue($adminIds->contains($adminLog->id));
        $this->assertFalse($adminIds->contains($residentLog->id));

        // "Resident" maps onto the reporter role.
        $residentOnly = $this->getJson('/api/v1/admin/audit-logs?user_type=resident')->assertStatus(200);
        $residentIds = collect($residentOnly->json('data.data'))->pluck('id');
        $this->assertTrue($residentIds->contains($residentLog->id));
        $this->assertFalse($residentIds->contains($adminLog->id));
    }

    public function test_audit_trail_filters_by_action_group(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'is_active' => true]);

        $login = $this->seedAuditLog($admin, 'user_login', 'Signed in', '2026-03-01 10:00:00');
        $logout = $this->seedAuditLog($admin, 'user_logout', 'Signed out', '2026-03-01 11:00:00');
        $update = $this->seedAuditLog($admin, 'update_user_status', 'Deactivated an account', '2026-03-01 12:00:00');

        Sanctum::actingAs($admin);

        $loginGroup = $this->getJson('/api/v1/admin/audit-logs?action=login')->assertStatus(200);
        $ids = collect($loginGroup->json('data.data'))->pluck('id');
        $this->assertTrue($ids->contains($login->id));
        $this->assertTrue($ids->contains($logout->id), 'Logout belongs to the Login/Logout group.');
        $this->assertFalse($ids->contains($update->id));

        $updateGroup = $this->getJson('/api/v1/admin/audit-logs?action=update')->assertStatus(200);
        $updateIds = collect($updateGroup->json('data.data'))->pluck('id');
        $this->assertTrue($updateIds->contains($update->id));
        $this->assertFalse($updateIds->contains($login->id));
    }

    public function test_audit_trail_searches_description_and_acting_user(): void
    {
        $chief = User::factory()->create([
            'name' => 'Chief Admin Bautista',
            'role' => 'admin',
            'is_active' => true,
        ]);
        $other = User::factory()->create([
            'name' => 'Officer Marco Santos',
            'role' => 'officer',
            'is_active' => true,
        ]);

        $byChief = $this->seedAuditLog($chief, 'verify_report', 'Approved the Malolos collision', '2026-04-01 10:00:00');
        $byOther = $this->seedAuditLog($other, 'officer_update_status', 'Updated Bocaue case', '2026-04-01 11:00:00');

        Sanctum::actingAs($chief);

        // By description text
        $byDesc = $this->getJson('/api/v1/admin/audit-logs?search=Malolos')->assertStatus(200);
        $descIds = collect($byDesc->json('data.data'))->pluck('id');
        $this->assertTrue($descIds->contains($byChief->id));
        $this->assertFalse($descIds->contains($byOther->id));

        // By acting user name
        $byUser = $this->getJson('/api/v1/admin/audit-logs?search=Marco')->assertStatus(200);
        $userIds = collect($byUser->json('data.data'))->pluck('id');
        $this->assertTrue($userIds->contains($byOther->id));
        $this->assertFalse($userIds->contains($byChief->id));
    }

    public function test_audit_trail_combines_all_filters(): void
    {
        $chief = User::factory()->create(['name' => 'Chief Admin Bautista', 'role' => 'admin', 'is_active' => true]);
        $resident = User::factory()->create(['name' => 'Maria Dela Cruz', 'role' => 'reporter', 'is_active' => true]);

        $match = $this->seedAuditLog($chief, 'verify_report', 'Verified the Malolos expressway case', '2026-05-10 10:00:00');
        // Fails each filter individually.
        $wrongAction = $this->seedAuditLog($chief, 'user_login', 'Verified nothing at all', '2026-05-10 11:00:00');
        $wrongType = $this->seedAuditLog($resident, 'verify_report', 'Verified the Baliwag corner', '2026-05-11 11:00:00');
        $wrongDate = $this->seedAuditLog($chief, 'verify_report', 'Verified the Meycauayan flyover', '2026-06-01 11:00:00');
        $wrongSearch = $this->seedAuditLog($chief, 'verify_report', 'Verified an unrelated incident', '2026-05-10 12:00:00');

        Sanctum::actingAs($chief);

        $response = $this->getJson(
            '/api/v1/admin/audit-logs'
            . '?from_date=2026-05-01&to_date=2026-05-31'
            . '&user_type=admin&action=update&search=Malolos'
        )->assertStatus(200);

        $ids = collect($response->json('data.data'))->pluck('id');

        $this->assertTrue($ids->contains($match->id));
        $this->assertFalse($ids->contains($wrongAction->id), 'Wrong action group excluded.');
        $this->assertFalse($ids->contains($wrongType->id), 'Wrong user type excluded.');
        $this->assertFalse($ids->contains($wrongDate->id), 'Outside date range excluded.');
        $this->assertFalse($ids->contains($wrongSearch->id), 'Non-matching search excluded.');
        $this->assertCount(1, $ids);
    }

    public function test_audit_trail_rejects_inverted_date_range(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'is_active' => true]);
        Sanctum::actingAs($admin);

        $this->getJson('/api/v1/admin/audit-logs?from_date=2026-05-31&to_date=2026-05-01')
            ->assertStatus(422)
            ->assertJsonPath(
                'message',
                'The "To Date" cannot be earlier than the "From Date".'
            );
    }

    public function test_audit_trail_rejects_unknown_filter_values(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'is_active' => true]);
        Sanctum::actingAs($admin);

        $this->getJson('/api/v1/admin/audit-logs?user_type=wizard')
            ->assertStatus(422)
            ->assertJsonValidationErrors(['user_type']);

        $this->getJson('/api/v1/admin/audit-logs?action=nuke')
            ->assertStatus(422)
            ->assertJsonValidationErrors(['action']);
    }

    public function test_audit_trail_is_admin_only(): void
    {
        $reporter = User::factory()->create(['role' => 'reporter', 'is_active' => true]);
        Sanctum::actingAs($reporter);

        $this->getJson('/api/v1/admin/audit-logs')->assertStatus(403);
    }

    public function test_audit_trail_does_not_expose_ip_address(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'is_active' => true]);
        $this->seedAuditLog($admin, 'user_login', 'Login entry', '2026-07-01 10:00:00');

        Sanctum::actingAs($admin);

        $row = $this->getJson('/api/v1/admin/audit-logs')->assertStatus(200)->json('data.data.0');

        // Records are preserved, but the column is no longer surfaced.
        $this->assertArrayNotHasKey('ip_address', $row);
        $this->assertDatabaseHas('audit_logs', ['description' => 'Login entry']);
    }

    /**
     * Hiding the IP column must not accidentally hide the acting user, which
     * the "Acting User" column depends on.
     */
    public function test_audit_trail_still_returns_the_acting_user(): void
    {
        $admin = User::factory()->create([
            'name' => 'Chief Admin Bautista',
            'role' => 'admin',
            'is_active' => true,
        ]);
        $this->seedAuditLog($admin, 'user_login', 'Login entry', '2026-09-01 10:00:00');

        Sanctum::actingAs($admin);

        $row = $this->getJson('/api/v1/admin/audit-logs')->assertStatus(200)->json('data.data.0');

        $this->assertArrayHasKey('user', $row);
        $this->assertSame('Chief Admin Bautista', $row['user']['name']);
        $this->assertSame('admin', $row['user']['role']);
        // The nested user must not leak its own password either.
        $this->assertArrayNotHasKey('password', $row['user']);
    }

    public function test_audit_trail_pagination_is_preserved(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'is_active' => true]);

        for ($i = 0; $i < 25; $i++) {
            $this->seedAuditLog($admin, 'user_login', "Login event {$i}", '2026-08-01 10:00:00');
        }

        Sanctum::actingAs($admin);

        $response = $this->getJson('/api/v1/admin/audit-logs')->assertStatus(200);

        $this->assertCount(20, $response->json('data.data'));
        $this->assertEquals(25, $response->json('data.total'));
        $this->assertEquals(2, $response->json('data.last_page'));
    }

    public function test_audit_trail_sorts_newest_first_by_default(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'is_active' => true]);

        $oldest = $this->seedAuditLog($admin, 'user_login', 'Oldest event', '2026-04-01 08:00:00');
        $middle = $this->seedAuditLog($admin, 'user_login', 'Middle event', '2026-04-02 08:00:00');
        $newest = $this->seedAuditLog($admin, 'user_login', 'Newest event', '2026-04-03 08:00:00');

        Sanctum::actingAs($admin);

        $default = $this->getJson('/api/v1/admin/audit-logs')->assertStatus(200);
        $this->assertSame(
            [$newest->id, $middle->id, $oldest->id],
            collect($default->json('data.data'))->pluck('id')->all()
        );

        $ascending = $this->getJson('/api/v1/admin/audit-logs?sort=oldest')->assertStatus(200);
        $this->assertSame(
            [$oldest->id, $middle->id, $newest->id],
            collect($ascending->json('data.data'))->pluck('id')->all()
        );
    }

    public function test_audit_trail_rejects_an_unknown_sort_value(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'is_active' => true]);

        Sanctum::actingAs($admin);

        $this->getJson('/api/v1/admin/audit-logs?sort=sideways')
            ->assertStatus(422)
            ->assertJsonValidationErrors(['sort']);
    }

    /**
     * Regression guard: these slugs were missing from (or misspelled in) the
     * action groups, which silently hid records from the Action filter.
     */
    public function test_audit_action_groups_cover_the_slugs_the_app_records(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'is_active' => true]);

        $expectedGroups = [
            'request_additional_info' => 'update',
            'archive_report' => 'delete',
            'delete_report' => 'delete',
            'update_category' => 'update',
            'delete_category' => 'delete',
            'create_category' => 'create',
            'create_officer' => 'create',
            'supplement_report' => 'update',
        ];

        $seeded = [];
        foreach (array_keys($expectedGroups) as $slug) {
            $seeded[$slug] = $this->seedAuditLog($admin, $slug, "Event for {$slug}", '2026-05-01 09:00:00');
        }

        Sanctum::actingAs($admin);

        foreach ($expectedGroups as $slug => $group) {
            $response = $this->getJson("/api/v1/admin/audit-logs?action={$group}")->assertStatus(200);
            $ids = collect($response->json('data.data'))->pluck('id');

            $this->assertTrue(
                $ids->contains($seeded[$slug]->id),
                "Action '{$slug}' should be reachable through the '{$group}' filter group."
            );
        }
    }

    // -------------------------------------------------------------------------
// Admin-created officer accounts
// -------------------------------------------------------------------------

    public function test_admin_can_create_a_traffic_officer_account(): void
    {
        [$admin, $token] = $this->adminToken();

        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/v1/admin/users/officers', [
                'name' => 'Officer Juan Dela Cruz',
                'email' => 'officer.delacruz@traffic.gov',
                'phone' => '09171234567',
                'address' => '12 Rizal St, Malolos, Bulacan',
                'badge_number' => 'PO3-5150',
                'password' => 'OfficerPass123!',
                'password_confirmation' => 'OfficerPass123!',
            ])
            ->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.role', 'officer')
            ->assertJsonPath('data.is_active', true)
            ->assertJsonPath('data.badge_number', 'PO3-5150');

        $officerId = $response->json('data.id');

        $this->assertDatabaseHas('users', [
            'id' => $officerId,
            'email' => 'officer.delacruz@traffic.gov',
            'role' => 'officer',
            'badge_number' => 'PO3-5150',
            'is_active' => true,
        ]);
    }

    public function test_newly_created_officer_can_log_in_and_reach_officer_pages(): void
    {
        [$admin, $token] = $this->adminToken();

        $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/v1/admin/users/officers', [
                'name' => 'Officer Login Flow',
                'email' => 'officer.flow@traffic.gov',
                'phone' => '09172223344',
                'address' => '45 Mabini St, Baliwag, Bulacan',
                'badge_number' => 'PO2-7788',
                'password' => 'OfficerPass123!',
                'password_confirmation' => 'OfficerPass123!',
            ])
            ->assertStatus(201);

        // The officer authenticates with the credentials the admin entered.
        $login = $this->postJson('/api/v1/auth/login', [
            'email' => 'officer.flow@traffic.gov',
            'password' => 'OfficerPass123!',
        ])->assertStatus(200)->assertJsonPath('success', true);

        // Role drives the front-end redirect to the Officer module.
        $this->assertSame('officer', $login->json('data.user.role'));
        $this->assertSame('PO2-7788', $login->json('data.user.badge_number'));

        // The two remaining officer screens are reachable with this account.
        // Sanctum::actingAs avoids the bearer-token guard caching that would
        // otherwise leak the admin identity from the creation request above.
        $officerUser = User::where('email', 'officer.flow@traffic.gov')->firstOrFail();
        Sanctum::actingAs($officerUser, ['role:officer']);

        foreach ([
            '/api/v1/officer/dashboard/stats',
            '/api/v1/officer/assigned-reports',
            '/api/v1/officer/verification-queue',
        ] as $route) {
            $this->getJson($route)
                ->assertStatus(200)
                ->assertJsonPath('success', true);
        }

        // Officer-only investigation write action still works on a case the
        // Admin has assigned to them and the officer has verified.
        $report = $this->seedReport(['assigned_officer_id' => $officerUser->id, 'status' => 'verified']);
        $this->putJson("/api/v1/officer/reports/{$report->id}/status", [
            'status' => 'in_progress',
            'official_remarks' => 'Investigating on duty.',
        ])->assertStatus(200);

        // But admin routes stay closed to them.
        $this->getJson('/api/v1/admin/users')->assertStatus(403);
        $this->postJson('/api/v1/admin/users/officers', [
            'name' => 'Backdoor Officer',
            'email' => 'backdoor@traffic.gov',
            'badge_number' => 'PO9-9999',
            'password' => 'BackdoorPass123!',
            'password_confirmation' => 'BackdoorPass123!',
        ])->assertStatus(403);

        $this->assertDatabaseMissing('users', ['email' => 'backdoor@traffic.gov']);
    }

    /**
     * The token issued by login must itself work on a real request, not just
     * via actingAs.
     */
    public function test_login_token_from_created_officer_authenticates(): void
    {
        [$admin, $token] = $this->adminToken();

        $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/v1/admin/users/officers', [
                'name' => 'Officer Token Check',
                'email' => 'officer.tokencheck@traffic.gov',
                'badge_number' => 'PO3-6161',
                'password' => 'OfficerPass123!',
                'password_confirmation' => 'OfficerPass123!',
            ])->assertStatus(201);

        $officerToken = $this->postJson('/api/v1/auth/login', [
            'email' => 'officer.tokencheck@traffic.gov',
            'password' => 'OfficerPass123!',
        ])->assertStatus(200)->json('data.token');

        // Clear the cached guard so the new bearer token is resolved from
        // scratch rather than reusing the admin identity.
        $this->app['auth']->forgetGuards();

        $this->withHeader('Authorization', "Bearer {$officerToken}")
            ->getJson('/api/v1/officer/dashboard/stats')
            ->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.counts.total', 0);
    }

    public function test_created_officer_password_is_hashed(): void
    {
        [$admin, $token] = $this->adminToken();

        $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/v1/admin/users/officers', [
                'name' => 'Officer Hash Check',
                'email' => 'officer.hash@traffic.gov',
                'badge_number' => 'PO1-4321',
                'password' => 'OfficerPass123!',
                'password_confirmation' => 'OfficerPass123!',
            ])
            ->assertStatus(201)
            // The response must never echo the plaintext password.
            ->assertJsonMissing(['password' => 'OfficerPass123!']);

        $officer = User::where('email', 'officer.hash@traffic.gov')->firstOrFail();

        $this->assertNotSame('OfficerPass123!', $officer->password);
        $this->assertTrue(Hash::check('OfficerPass123!', $officer->password));
    }

    public function test_creating_officer_rejects_duplicate_email(): void
    {
        [$admin, $token] = $this->adminToken();

        $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/v1/admin/users/officers', [
                'name' => 'Officer First',
                'email' => 'officer.dupe@traffic.gov',
                'badge_number' => 'PO3-0001',
                'password' => 'OfficerPass123!',
                'password_confirmation' => 'OfficerPass123!',
            ])->assertStatus(201);

        $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/v1/admin/users/officers', [
                'name' => 'Officer Second',
                'email' => 'officer.dupe@traffic.gov',
                'badge_number' => 'PO3-0002',
                'password' => 'OfficerPass123!',
                'password_confirmation' => 'OfficerPass123!',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['email'])
            ->assertJsonPath(
                'message',
                'That email address is already assigned to another account.'
            );

        $this->assertSame(1, User::where('email', 'officer.dupe@traffic.gov')->count());
    }

    public function test_creating_officer_rejects_duplicate_badge_number(): void
    {
        [$admin, $token] = $this->adminToken();

        User::factory()->create([
            'role' => 'officer',
            'badge_number' => 'PO3-8821',
            'is_active' => true,
        ]);

        $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/v1/admin/users/officers', [
                'name' => 'Officer Badge Clash',
                'email' => 'officer.badgeclash@traffic.gov',
                'badge_number' => 'PO3-8821',
                'password' => 'OfficerPass123!',
                'password_confirmation' => 'OfficerPass123!',
            ])
            ->assertStatus(422)
            ->assertJsonPath(
                'message',
                'Badge number PO3-8821 is already assigned to another officer.'
            );

        $this->assertDatabaseMissing('users', ['email' => 'officer.badgeclash@traffic.gov']);
    }

    public function test_creating_officer_validates_all_fields(): void
    {
        [$admin, $token] = $this->adminToken();

        $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/v1/admin/users/officers', [
                'name' => '',
                'email' => 'not-an-email',
                'phone' => '12345',
                'badge_number' => '',
                'password' => 'weak',
                'password_confirmation' => 'different',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors([
                'name', 'email', 'phone', 'badge_number', 'password',
            ]);

        // Note: `confirmed` reports under the `password` key, not
        // `password_confirmation` - see the mismatch test below.
    }

    /**
     * Mismatched confirmation is rejected on its own, with a valid password.
     */
    public function test_creating_officer_rejects_mismatched_password_confirmation(): void
    {
        [$admin, $token] = $this->adminToken();

        $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/v1/admin/users/officers', [
                'name' => 'Officer Mismatch',
                'email' => 'officer.mismatch@traffic.gov',
                'badge_number' => 'PO3-3131',
                'password' => 'OfficerPass123!',
                'password_confirmation' => 'DifferentPass123!',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['password']);

        $this->assertDatabaseMissing('users', ['email' => 'officer.mismatch@traffic.gov']);
    }

    public function test_creating_officer_requires_strong_password(): void
    {
        [$admin, $token] = $this->adminToken();

        // Letters only, no digits.
        $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/v1/admin/users/officers', [
                'name' => 'Officer Weak Pass',
                'email' => 'officer.weak@traffic.gov',
                'badge_number' => 'PO3-3001',
                'password' => 'onlylettershere',
                'password_confirmation' => 'onlylettershere',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['password']);

        // Too short.
        $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/v1/admin/users/officers', [
                'name' => 'Officer Short Pass',
                'email' => 'officer.short@traffic.gov',
                'badge_number' => 'PO3-3002',
                'password' => 'Ab1',
                'password_confirmation' => 'Ab1',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['password']);

        $this->assertDatabaseMissing('users', ['email' => 'officer.weak@traffic.gov']);
        $this->assertDatabaseMissing('users', ['email' => 'officer.short@traffic.gov']);
    }

    public function test_only_admins_can_create_officer_accounts(): void
    {
        $reporter = User::factory()->create(['role' => 'reporter', 'is_active' => true]);
        $reporterToken = $reporter->createToken('auth-token', ['role:reporter'])->plainTextToken;

        $officer = User::factory()->create(['role' => 'officer', 'is_active' => true]);
        $officerToken = $officer->createToken('auth-token', ['role:officer'])->plainTextToken;

        $payload = [
            'name' => 'Unauthorised Creator',
            'email' => 'unauthorised@traffic.gov',
            'badge_number' => 'PO9-1111',
            'password' => 'OfficerPass123!',
            'password_confirmation' => 'OfficerPass123!',
        ];

        $this->withHeader('Authorization', "Bearer {$reporterToken}")
            ->postJson('/api/v1/admin/users/officers', $payload)
            ->assertStatus(403);

        $this->withHeader('Authorization', "Bearer {$officerToken}")
            ->postJson('/api/v1/admin/users/officers', $payload)
            ->assertStatus(403);

        $this->assertDatabaseMissing('users', ['email' => 'unauthorised@traffic.gov']);
    }

    /**
     * A bogus bearer token is rejected at authentication, before any role
     * check runs.
     */
    public function test_bogus_token_cannot_create_officer_accounts(): void
    {
        $this->withHeader('Authorization', 'Bearer bogus-token')
            ->postJson('/api/v1/admin/users/officers', [
                'name' => 'No Token Officer',
                'email' => 'notoken@traffic.gov',
                'badge_number' => 'PO9-2222',
                'password' => 'OfficerPass123!',
                'password_confirmation' => 'OfficerPass123!',
            ])
            ->assertStatus(401);

        $this->assertDatabaseMissing('users', ['email' => 'notoken@traffic.gov']);
    }

    public function test_created_officer_is_active_and_appears_in_the_officer_roster(): void
    {
        [$admin, $token] = $this->adminToken();

        $created = $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/v1/admin/users/officers', [
                'name' => 'Officer Roster',
                'email' => 'officer.roster@traffic.gov',
                'badge_number' => 'PO2-9090',
                'password' => 'OfficerPass123!',
                'password_confirmation' => 'OfficerPass123!',
            ])->assertStatus(201)->json('data');

        // The roster endpoint only returns active officers.
        $roster = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/v1/admin/officers')
            ->assertStatus(200);

        $this->assertContains(
            $created['id'],
            array_column($roster->json('data'), 'id')
        );
    }

    public function test_can_submit_accident_report(): void
    {
        $user = User::factory()->create(['role' => 'reporter', 'is_active' => true]);
        Sanctum::actingAs($user);

        $response = $this->postJson('/api/v1/reports', [
            'reporter_name' => 'Testing Reporter',
            'reporter_contact' => '09123334444',
            'accident_date' => now()->subDay()->toDateString(),
            'accident_time' => '10:30',
            'location_address' => 'MacArthur Highway, Malolos, Bulacan',
            'latitude' => 14.8587,
            'longitude' => 120.8143,
            'accident_type' => 'Rear-end Collision',
            'vehicles_involved' => 2,
            'injury_severity' => 'minor',
            'description' => 'Two passenger vehicles collided along inner lane during rain.',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.status', 'submitted');

        $this->assertDatabaseHas('accident_reports', [
            'reporter_name' => 'Testing Reporter',
            'status' => 'submitted',
        ]);
    }

    public function test_report_submission_rejects_future_dates(): void
    {
        $response = $this->postJson('/api/v1/reports', [
            'reporter_name' => 'Invalid Date Tester',
            'accident_date' => now()->addDays(5)->toDateString(),
            'accident_time' => '10:00',
            'location_address' => 'Some address here in Bulacan',
            'accident_type' => 'Collision',
            'vehicles_involved' => 1,
            'injury_severity' => 'none',
            'description' => 'Testing future date rejection.',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['accident_date']);
    }

    public function test_report_submission_rejects_an_invalid_reporter_contact(): void
    {
        $user = User::factory()->create(['role' => 'reporter', 'is_active' => true]);
        Sanctum::actingAs($user);

        $baseReport = [
            'reporter_name' => 'Contact Check',
            'accident_date' => now()->subDay()->toDateString(),
            'accident_time' => '10:30',
            'location_address' => 'MacArthur Highway, Malolos, Bulacan',
            'accident_type' => 'Rear-end Collision',
            'vehicles_involved' => 2,
            'injury_severity' => 'minor',
            'description' => 'Testing reporter contact validation.',
        ];

        foreach (['+63 917 123 4567', '0917 123 4567', '0917123456', '091712345678', 'not a phone'] as $badContact) {
            $this->postJson('/api/v1/reports', array_merge($baseReport, ['reporter_contact' => $badContact]))
                ->assertStatus(422)
                ->assertJsonValidationErrors(['reporter_contact']);
        }

        // A clean 11-digit number is accepted.
        $this->postJson('/api/v1/reports', array_merge($baseReport, ['reporter_contact' => '09171234567']))
            ->assertStatus(201);

        // The field stays optional: omitting it is still allowed. Use a
        // separate incident so this is not treated as a duplicate of the
        // report created just above.
        $this->postJson('/api/v1/reports', array_merge($baseReport, [
            'accident_date' => now()->subDays(2)->toDateString(),
            'accident_time' => '16:00',
            'location_address' => 'Iglesia Street, Guiguinto, Bulacan',
            'description' => 'A separate incident report for optional contact validation.',
        ]))->assertStatus(201);
    }

    public function test_duplicate_report_submission_is_blocked_and_returns_a_safe_summary(): void
    {
        Storage::fake('public');

        $otherResident = User::factory()->create(['role' => 'reporter', 'is_active' => true]);
        $resident = User::factory()->create(['role' => 'reporter', 'is_active' => true]);

        $existing = $this->seedReport([
            'user_id' => $otherResident->id,
            'report_number' => 'AR-EXISTING-0001',
            'status' => 'under_review',
        ]);

        $photo = UploadedFile::fake()->create('duplicate_scene.jpg', 100, 'image/jpeg');

        Sanctum::actingAs($resident);

        $response = $this->postJson('/api/v1/reports', [
            'reporter_name' => 'Second Resident',
            'reporter_contact' => '09124445555',
            'accident_date' => now()->subDay()->toDateString(),
            'accident_time' => '10:40',
            'location_address' => 'MacArthur Highway, Malolos, Bulacan',
            'latitude' => 14.8588,
            'longitude' => 120.8144,
            'accident_type' => 'Vehicle Collision',
            'vehicles_involved' => 2,
            'injury_severity' => 'minor',
            'description' => 'A delivery van bumped a tricycle and traffic slowed down for a while.',
            'photos' => [$photo],
        ]);

        $response->assertStatus(409)
            ->assertJsonPath('success', false)
            ->assertJsonPath('duplicate.report_number', 'AR-EXISTING-0001')
            ->assertJsonPath('duplicate.accident_type', 'Rear-end Collision')
            ->assertJsonPath('duplicate.accident_time', '10:30')
            ->assertJsonPath('duplicate.status', 'under_review');

        // Only non-sensitive summary fields are exposed.
        $response->assertJsonMissingPath('duplicate.user_id')
            ->assertJsonMissingPath('duplicate.reporter_name')
            ->assertJsonMissingPath('duplicate.reporter_contact')
            ->assertJsonMissingPath('duplicate.description');

        $this->assertSame(1, AccidentReport::count());
        $this->assertSame(0, AccidentPhoto::count());
        $this->assertSame([], Storage::disk('public')->allFiles());
        $this->assertDatabaseHas('accident_reports', ['id' => $existing->id]);
    }

    public function test_same_location_at_a_different_time_is_not_a_duplicate(): void
    {
        $this->seedReport(['report_number' => 'AR-TIME-0001']);

        $resident = User::factory()->create(['role' => 'reporter', 'is_active' => true]);
        Sanctum::actingAs($resident);

        $this->postJson('/api/v1/reports', [
            'reporter_name' => 'Later Reporter',
            'accident_date' => now()->subDay()->toDateString(),
            'accident_time' => '14:30',
            'location_address' => 'MacArthur Highway, Malolos, Bulacan',
            'latitude' => 14.8587,
            'longitude' => 120.8143,
            'accident_type' => 'Rear-end Collision',
            'vehicles_involved' => 2,
            'injury_severity' => 'minor',
            'description' => 'Two passenger vehicles collided along the inner lane.',
        ])
            ->assertStatus(201)
            ->assertJsonPath('duplicate_check.status', 'checked');

        $this->assertSame(2, AccidentReport::count());
    }

    public function test_same_gps_outside_the_radius_is_not_a_duplicate(): void
    {
        $this->seedReport(['report_number' => 'AR-RADIUS-0001']);

        $resident = User::factory()->create(['role' => 'reporter', 'is_active' => true]);
        Sanctum::actingAs($resident);

        // Roughly 1.1 km away but using the same written address: when both
        // reports have GPS, distance is what decides.
        $this->postJson('/api/v1/reports', [
            'reporter_name' => 'Far Reporter',
            'accident_date' => now()->subDay()->toDateString(),
            'accident_time' => '10:30',
            'location_address' => 'MacArthur Highway, Malolos, Bulacan',
            'latitude' => 14.8687,
            'longitude' => 120.8143,
            'accident_type' => 'Collision',
            'vehicles_involved' => 1,
            'injury_severity' => 'none',
            'description' => 'A completely separate incident farther down the road.',
        ])->assertStatus(201);

        $this->assertSame(2, AccidentReport::count());
    }

    public function test_duplicate_radius_is_configurable(): void
    {
        config(['roadwatch.duplicate_detection.radius_meters' => 50]);

        $this->seedReport(['report_number' => 'AR-CONFIG-0001']);

        $resident = User::factory()->create(['role' => 'reporter', 'is_active' => true]);
        Sanctum::actingAs($resident);

        // About 110 m away: outside the overridden 50 m radius but inside the
        // default 300 m radius.
        $this->postJson('/api/v1/reports', [
            'reporter_name' => 'Configured Radius Reporter',
            'accident_date' => now()->subDay()->toDateString(),
            'accident_time' => '10:30',
            'location_address' => 'MacArthur Highway, Malolos, Bulacan',
            'latitude' => 14.8587,
            'longitude' => 120.8153,
            'accident_type' => 'Collision',
            'vehicles_involved' => 1,
            'injury_severity' => 'none',
            'description' => 'Testing the configured duplicate radius.',
        ])->assertStatus(201);

        $this->assertSame(2, AccidentReport::count());
    }

    public function test_duplicate_time_window_is_configurable(): void
    {
        config(['roadwatch.duplicate_detection.time_window_minutes' => 30]);

        $this->seedReport(['report_number' => 'AR-WINDOW-0001']);

        $resident = User::factory()->create(['role' => 'reporter', 'is_active' => true]);
        Sanctum::actingAs($resident);

        // 45 minutes later: inside the default 2-hour window, but outside the
        // overridden 30-minute window.
        $this->postJson('/api/v1/reports', [
            'reporter_name' => 'Configured Window Reporter',
            'accident_date' => now()->subDay()->toDateString(),
            'accident_time' => '11:15',
            'location_address' => 'MacArthur Highway, Malolos, Bulacan',
            'latitude' => 14.8587,
            'longitude' => 120.8143,
            'accident_type' => 'Collision',
            'vehicles_involved' => 1,
            'injury_severity' => 'none',
            'description' => 'Testing the configured duplicate time window.',
        ])->assertStatus(201);

        $this->assertSame(2, AccidentReport::count());
    }

    public function test_verified_reports_are_checked_for_duplicates(): void
    {
        $this->seedReport([
            'report_number' => 'AR-VERIFIED-0001',
            'status' => 'verified',
        ]);

        $resident = User::factory()->create(['role' => 'reporter', 'is_active' => true]);
        Sanctum::actingAs($resident);

        $this->postJson('/api/v1/reports', [
            'reporter_name' => 'Duplicate Reporter',
            'accident_date' => now()->subDay()->toDateString(),
            'accident_time' => '11:15',
            'location_address' => 'MacArthur Highway, Malolos, Bulacan',
            'latitude' => 14.8588,
            'longitude' => 120.8144,
            'accident_type' => 'Collision',
            'vehicles_involved' => 1,
            'injury_severity' => 'none',
            'description' => 'Different wording for the same verified accident.',
        ])
            ->assertStatus(409)
            ->assertJsonPath('duplicate.status', 'verified');

        $this->assertSame(1, AccidentReport::count());
    }

    public function test_missing_gps_falls_back_to_the_written_address(): void
    {
        $this->seedReport([
            'report_number' => 'AR-NOGPS-0001',
            'latitude' => null,
            'longitude' => null,
        ]);

        $resident = User::factory()->create(['role' => 'reporter', 'is_active' => true]);
        Sanctum::actingAs($resident);

        $response = $this->postJson('/api/v1/reports', [
            'reporter_name' => 'No GPS Reporter',
            'accident_date' => now()->subDay()->toDateString(),
            'accident_time' => '11:00',
            'location_address' => 'MacArthur Highway, Malolos, Bulacan',
            'accident_type' => 'Collision',
            'vehicles_involved' => 1,
            'injury_severity' => 'none',
            'description' => 'The same accident described without GPS coordinates.',
        ]);

        $response->assertStatus(409)
            ->assertJsonPath('duplicate.report_number', 'AR-NOGPS-0001');

        $this->assertSame(1, AccidentReport::count());
    }

    public function test_successful_submission_without_gps_explains_the_inconclusive_check(): void
    {
        $this->seedReport(['report_number' => 'AR-OTHER-PLACE-0001']);

        $resident = User::factory()->create(['role' => 'reporter', 'is_active' => true]);
        Sanctum::actingAs($resident);

        $this->postJson('/api/v1/reports', [
            'reporter_name' => 'No GPS Reporter',
            'accident_date' => now()->subDay()->toDateString(),
            'accident_time' => '10:30',
            'location_address' => 'Iglesia Street, Guiguinto, Bulacan',
            'accident_type' => 'Collision',
            'vehicles_involved' => 1,
            'injury_severity' => 'none',
            'description' => 'A separate incident reported without GPS coordinates.',
        ])
            ->assertStatus(201)
            ->assertJsonPath('duplicate_check.status', 'inconclusive')
            ->assertJsonPath(
                'duplicate_check.message',
                'No GPS coordinates were provided, so duplicate detection used the written location and time. A nearby report may not have been detected.'
            );

        $this->assertSame(2, AccidentReport::count());
    }

    public function test_two_residents_submitting_the_same_accident_create_only_one_report(): void
    {
        $first = User::factory()->create(['role' => 'reporter', 'is_active' => true]);
        $second = User::factory()->create(['role' => 'reporter', 'is_active' => true]);

        $payload = [
            'accident_date' => now()->subDay()->toDateString(),
            'accident_time' => '10:30',
            'location_address' => 'MacArthur Highway, Malolos, Bulacan',
            'latitude' => 14.8587,
            'longitude' => 120.8143,
            'accident_type' => 'Collision',
            'vehicles_involved' => 1,
            'injury_severity' => 'none',
        ];

        Sanctum::actingAs($first);
        $this->postJson('/api/v1/reports', array_merge($payload, [
            'reporter_name' => 'First Resident',
            'description' => 'A blue sedan hit the guardrail near the intersection.',
        ]))->assertStatus(201);

        // The advisory lock serializes real concurrent requests; this call
        // verifies the second Resident is checked against the first report.
        $this->app['auth']->forgetGuards();
        Sanctum::actingAs($second);
        $this->postJson('/api/v1/reports', array_merge($payload, [
            'reporter_name' => 'Second Resident',
            'description' => 'A car crashed by the roadside, according to another witness.',
        ]))
            ->assertStatus(409)
            ->assertJsonPath('success', false);

        $this->assertSame(1, AccidentReport::count());
    }

    public function test_rejected_reports_do_not_block_a_new_report(): void
    {
        $this->seedReport([
            'report_number' => 'AR-REJECTED-0001',
            'status' => 'rejected',
        ]);

        $resident = User::factory()->create(['role' => 'reporter', 'is_active' => true]);
        Sanctum::actingAs($resident);

        $this->postJson('/api/v1/reports', [
            'reporter_name' => 'Resubmitting Resident',
            'accident_date' => now()->subDay()->toDateString(),
            'accident_time' => '10:30',
            'location_address' => 'MacArthur Highway, Malolos, Bulacan',
            'latitude' => 14.8587,
            'longitude' => 120.8143,
            'accident_type' => 'Rear-end Collision',
            'vehicles_involved' => 2,
            'injury_severity' => 'minor',
            'description' => 'Two passenger vehicles collided along the inner lane.',
        ])->assertStatus(201);

        $this->assertSame(2, AccidentReport::count());
    }

    public function test_ordinary_reporter_cannot_access_admin_stats(): void
    {
        $reporter = User::factory()->create(['role' => 'reporter', 'is_active' => true]);
        Sanctum::actingAs($reporter);

        $response = $this->getJson('/api/v1/admin/dashboard/stats');

        $response->assertStatus(403)
            ->assertJsonPath('success', false);
    }

    public function test_each_resident_only_receives_their_own_reports(): void
    {
        $alice = User::factory()->create(['role' => 'reporter', 'is_active' => true]);
        $bob = User::factory()->create(['role' => 'reporter', 'is_active' => true]);

        $aliceReport = $this->seedReport([
            'user_id' => $alice->id,
            'report_number' => 'AR-ALICE-0001',
            'reporter_name' => 'Alice Resident',
        ]);
        $bobReport = $this->seedReport([
            'user_id' => $bob->id,
            'report_number' => 'AR-BOB-0001',
            'reporter_name' => 'Bob Resident',
        ]);
        // A report with no owner must never leak into a resident's inbox.
        $this->seedReport(['user_id' => null, 'report_number' => 'AR-ORPHAN-0001']);

        Sanctum::actingAs($alice);
        $aliceIds = collect($this->getJson('/api/v1/my-reports')->assertOk()->json('data.data'))
            ->pluck('id');
        $this->assertTrue($aliceIds->contains($aliceReport->id));
        $this->assertFalse($aliceIds->contains($bobReport->id));
        $this->assertCount(1, $aliceIds);

        Sanctum::actingAs($bob);
        $bobIds = collect($this->getJson('/api/v1/my-reports')->assertOk()->json('data.data'))
            ->pluck('id');
        $this->assertTrue($bobIds->contains($bobReport->id));
        $this->assertFalse($bobIds->contains($aliceReport->id));
        $this->assertCount(1, $bobIds);
    }

    public function test_resident_dashboard_chart_data_is_real_and_owner_scoped(): void
    {
        $alice = User::factory()->create(['role' => 'reporter', 'is_active' => true]);
        $bob = User::factory()->create(['role' => 'reporter', 'is_active' => true]);
        $flooding = AccidentCategory::create([
            'name' => 'Flooding',
            'slug' => 'flooding',
            'is_active' => true,
        ]);

        $submitted = $this->seedReport([
            'user_id' => $alice->id,
            'report_number' => 'AR-DASH-ALICE-1',
            'status' => 'submitted',
        ]);

        $closed = $this->seedReport([
            'user_id' => $alice->id,
            'report_number' => 'AR-DASH-ALICE-2',
            'category_id' => $flooding->id,
            'status' => 'closed',
            'closed_at' => now()->subWeek(),
        ]);
        // Place the filing two weeks back so the bucket and average resolution
        // time are derived from timestamps, not from the current date.
        $closed->created_at = now()->subWeeks(2);
        $closed->save();

        $bobReport = $this->seedReport([
            'user_id' => $bob->id,
            'report_number' => 'AR-DASH-BOB-1',
            'status' => 'submitted',
        ]);

        Sanctum::actingAs($alice);

        $response = $this->getJson('/api/v1/my-reports/dashboard?weeks=12')
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.counts.total', 2)
            ->assertJsonPath('data.counts.awaiting_review', 1)
            ->assertJsonPath('data.counts.in_progress_and_resolved', 1)
            ->assertJsonPath('data.counts.resolved', 1)
            ->assertJsonPath('data.trend.weeks', 12);

        $payload = $response->json('data');
        $this->assertCount(12, $payload['trend']['buckets']);
        $this->assertSame(2, collect($payload['trend']['buckets'])->sum('filed'));
        $this->assertSame(1, collect($payload['trend']['buckets'])->sum('resolved'));
        $this->assertNotNull($payload['average_resolution_hours']);
        $this->assertGreaterThan(0, $payload['average_resolution_hours']);

        $categories = collect($payload['by_category'])->keyBy('name');
        $this->assertSame(1, $categories['Collision']['count']);
        $this->assertSame(1, $categories['Flooding']['count']);
        $this->assertEquals(50, $categories['Collision']['percentage']);
        $this->assertEquals(50, $categories['Flooding']['percentage']);

        $recentIds = collect($payload['recent_reports'])->pluck('id');
        $this->assertTrue($recentIds->contains($submitted->id));
        $this->assertTrue($recentIds->contains($closed->id));
        $this->assertFalse($recentIds->contains($bobReport->id));

        // The filter requests shorter ranges and the backend returns exactly
        // that many weekly buckets.
        $this->getJson('/api/v1/my-reports/dashboard?weeks=4')
            ->assertOk()
            ->assertJsonPath('data.trend.weeks', 4)
            ->assertJsonCount(4, 'data.trend.buckets');

        $this->getJson('/api/v1/my-reports/dashboard?weeks=5')
            ->assertStatus(422)
            ->assertJsonValidationErrors(['weeks']);
    }

    public function test_resident_dashboard_returns_an_empty_series_when_there_are_no_reports(): void
    {
        $resident = User::factory()->create(['role' => 'reporter', 'is_active' => true]);
        Sanctum::actingAs($resident);

        $response = $this->getJson('/api/v1/my-reports/dashboard?weeks=6')
            ->assertOk()
            ->assertJsonPath('data.counts.total', 0)
            ->assertJsonPath('data.counts.awaiting_review', 0)
            ->assertJsonPath('data.counts.in_progress_and_resolved', 0)
            ->assertJsonPath('data.counts.resolved', 0)
            ->assertJsonPath('data.average_resolution_hours', null)
            ->assertJsonCount(6, 'data.trend.buckets')
            ->assertJsonCount(0, 'data.by_category')
            ->assertJsonCount(0, 'data.recent_reports');

        $buckets = collect($response->json('data.trend.buckets'));
        $this->assertSame(0, $buckets->sum('filed'));
        $this->assertSame(0, $buckets->sum('resolved'));
    }

    public function test_admin_dashboard_stats_match_database_records(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'is_active' => true]);

        $this->seedReport([
            'accident_type' => 'Collision',
            'injury_severity' => 'minor',
            'status' => 'submitted',
            'accident_date' => now()->subDay()->toDateString(),
        ]);
        $this->seedReport([
            'accident_type' => 'Collision',
            'injury_severity' => 'severe',
            'status' => 'closed',
            'accident_date' => now()->subDay()->toDateString(),
        ]);
        $this->seedReport([
            'accident_type' => 'Rollover',
            'injury_severity' => 'none',
            'status' => 'verified',
            'accident_date' => now()->subDay()->toDateString(),
        ]);
        $this->seedReport([
            'accident_type' => 'Hit-and-run',
            'injury_severity' => 'fatal',
            'status' => 'rejected',
            'accident_date' => now()->subDay()->toDateString(),
        ]);
        $this->seedReport([
            'accident_type' => 'Collision',
            'injury_severity' => 'minor',
            'status' => 'assigned',
            'accident_date' => now()->subDay()->toDateString(),
        ]);
        $this->seedReport([
            'accident_type' => 'Rollover',
            'injury_severity' => 'severe',
            'status' => 'in_progress',
            'accident_date' => now()->subDay()->toDateString(),
        ]);

        Sanctum::actingAs($admin);

        $response = $this->getJson('/api/v1/admin/dashboard/stats')
            ->assertOk()
            ->assertJsonPath('data.counts.total', 6)
            ->assertJsonPath('data.counts.pending', 1)
            ->assertJsonPath('data.counts.verified', 1)
            ->assertJsonPath('data.counts.assigned', 1)
            ->assertJsonPath('data.counts.in_progress', 1)
            ->assertJsonPath('data.counts.closed', 1)
            ->assertJsonPath('data.counts.rejected', 1)
            ->assertJsonPath('data.counts.active_investigations', 2);

        $payload = $response->json('data');
        $byType = collect($payload['by_type'])->pluck('count', 'accident_type');
        $this->assertSame(3, (int) $byType['Collision']);
        $this->assertSame(2, (int) $byType['Rollover']);
        $this->assertSame(1, (int) $byType['Hit-and-run']);

        $bySeverity = collect($payload['by_severity'])->pluck('count', 'injury_severity');
        $this->assertSame(2, (int) $bySeverity['minor']);
        $this->assertSame(2, (int) $bySeverity['severe']);
        $this->assertSame(1, (int) $bySeverity['none']);
        $this->assertSame(1, (int) $bySeverity['fatal']);

        // The 7-day trend is also derived from the same reports.
        $this->assertSame(6, (int) collect($payload['weekly_trend'])->sum('count'));
    }

    public function test_resident_cannot_open_another_residents_report_by_id(): void
    {
        $owner = User::factory()->create(['role' => 'reporter', 'is_active' => true]);
        $intruder = User::factory()->create(['role' => 'reporter', 'is_active' => true]);

        $report = $this->seedReport([
            'user_id' => $owner->id,
            'report_number' => 'AR-PRIVATE-0001',
        ]);

        Sanctum::actingAs($owner);
        $this->getJson("/api/v1/reports/{$report->id}")
            ->assertOk()
            ->assertJsonPath('data.id', $report->id);

        Sanctum::actingAs($intruder);
        $this->getJson("/api/v1/reports/{$report->id}")
            ->assertStatus(403)
            ->assertJsonPath('success', false)
            ->assertJsonPath('message', 'Unauthorized access to this report.');
    }

    public function test_admin_can_access_stats(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'is_active' => true]);
        Sanctum::actingAs($admin);

        $response = $this->getJson('/api/v1/admin/dashboard/stats');

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonStructure(['data' => ['counts', 'by_type', 'by_severity', 'weekly_trend']]);
    }

    public function test_officer_rejection_requires_reason(): void
    {
        $officer = User::factory()->create(['role' => 'officer', 'is_active' => true]);
        $report = $this->seedReport(['assigned_officer_id' => $officer->id, 'status' => 'assigned']);

        Sanctum::actingAs($officer);

        $response = $this->putJson("/api/v1/officer/reports/{$report->id}/reject", []);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['rejection_reason']);

        $this->assertDatabaseHas('accident_reports', [
            'id' => $report->id,
            'status' => 'assigned',
        ]);
    }

    public function test_admin_can_assign_a_submitted_report_to_an_officer(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'is_active' => true]);
        $officer = User::factory()->create(['role' => 'officer', 'is_active' => true, 'badge_number' => 'PO-9001']);
        Sanctum::actingAs($admin);

        $report = $this->seedReport(['status' => 'submitted']);

        $response = $this->putJson("/api/v1/admin/reports/{$report->id}/assign", [
            'officer_id' => $officer->id,
            'assignment_notes' => 'Coordinate with Guiguinto traffic enforcers.',
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.status', 'assigned')
            ->assertJsonPath('data.assigned_officer_id', $officer->id);

        $this->assertDatabaseHas('accident_reports', [
            'id' => $report->id,
            'status' => 'assigned',
            'assigned_officer_id' => $officer->id,
        ]);

        $this->assertDatabaseHas('officer_assignments', [
            'accident_report_id' => $report->id,
            'officer_id' => $officer->id,
            'assigned_by' => $admin->id,
            'status' => 'active',
        ]);

        // Assignment is audited, but the admin has not verified the report.
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'assign_officer',
            'target_id' => $report->id,
        ]);
        $this->assertDatabaseMissing('audit_logs', [
            'action' => 'verify_report',
            'target_id' => $report->id,
        ]);

        $this->assertDatabaseHas('accident_reports', [
            'id' => $report->id,
            'verified_by' => null,
        ]);
    }

    /**
     * Verification and rejection were removed from the admin API entirely.
     * Admin tokens must be refused by the absence of the routes, not merely
     * by hidden buttons.
     */
    public function test_admin_cannot_verify_or_reject_reports(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'is_active' => true]);
        $officer = User::factory()->create(['role' => 'officer', 'is_active' => true]);
        $report = $this->seedReport(['status' => 'submitted']);

        Sanctum::actingAs($admin);

        $this->putJson("/api/v1/admin/reports/{$report->id}/verify", [
            'officer_id' => $officer->id,
        ])->assertStatus(404);

        $this->putJson("/api/v1/admin/reports/{$report->id}/reject", [
            'rejection_reason' => 'Admin attempting to reject.',
        ])->assertStatus(404);

        $this->assertDatabaseHas('accident_reports', [
            'id' => $report->id,
            'status' => 'submitted',
        ]);
    }

    public function test_assigning_a_report_requires_an_officer(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'is_active' => true]);
        Sanctum::actingAs($admin);

        $report = $this->seedReport(['status' => 'submitted']);

        $this->putJson("/api/v1/admin/reports/{$report->id}/assign", [])
            ->assertStatus(422)
            ->assertJsonValidationErrors('officer_id');

        // The report must be untouched when dispatch is missing.
        $this->assertDatabaseHas('accident_reports', [
            'id' => $report->id,
            'status' => 'submitted',
            'assigned_officer_id' => null,
        ]);
    }

    public function test_assigning_a_report_rejects_a_non_officer_assignee(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'is_active' => true]);
        $reporter = User::factory()->create(['role' => 'reporter', 'is_active' => true]);
        Sanctum::actingAs($admin);

        $report = $this->seedReport(['status' => 'submitted']);

        $this->putJson("/api/v1/admin/reports/{$report->id}/assign", [
            'officer_id' => $reporter->id,
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('officer_id');
    }

    public function test_assigning_a_report_rejects_an_inactive_officer(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'is_active' => true]);
        $officer = User::factory()->create(['role' => 'officer', 'is_active' => false]);
        Sanctum::actingAs($admin);

        $report = $this->seedReport(['status' => 'submitted']);

        $this->putJson("/api/v1/admin/reports/{$report->id}/assign", [
            'officer_id' => $officer->id,
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('officer_id');
    }

    public function test_admin_cannot_assign_a_closed_or_rejected_report(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'is_active' => true]);
        $officer = User::factory()->create(['role' => 'officer', 'is_active' => true]);
        Sanctum::actingAs($admin);

        foreach (['closed', 'rejected'] as $status) {
            $report = $this->seedReport(['status' => $status]);

            $this->putJson("/api/v1/admin/reports/{$report->id}/assign", [
                'officer_id' => $officer->id,
            ])->assertStatus(422);

            $this->assertDatabaseHas('accident_reports', [
                'id' => $report->id,
                'status' => $status,
            ]);
        }
    }

    public function test_admin_cannot_resolve_or_close_reports(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'is_active' => true]);
        Sanctum::actingAs($admin);

        $report = $this->seedReport(['status' => 'in_progress']);

        // The admin close/resolve endpoint no longer exists in any form.
        $this->putJson("/api/v1/admin/reports/{$report->id}/close", [])
            ->assertStatus(404);

        $this->assertDatabaseHas('accident_reports', [
            'id' => $report->id,
            'status' => 'in_progress',
        ]);
    }

    /**
     * The whole hand-off: admin assigns, the assigned officer verifies,
     * investigates and closes the case. Only the assigned officer performs
     * verification and resolution.
     */
    public function test_full_assignment_verification_and_officer_resolution_workflow(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'is_active' => true]);
        $officer = User::factory()->create([
            'role' => 'officer',
            'is_active' => true,
            'badge_number' => 'PO-9100',
        ]);

        $report = $this->seedReport(['status' => 'submitted']);

        // 1. Admin dispatches the report to an officer without verifying it.
        Sanctum::actingAs($admin);
        $this->putJson("/api/v1/admin/reports/{$report->id}/assign", [
            'officer_id' => $officer->id,
            'assignment_notes' => 'Please verify and investigate.',
        ])
            ->assertStatus(200)
            ->assertJsonPath('data.status', 'assigned')
            ->assertJsonPath('data.assigned_officer_id', $officer->id);

        $this->app['auth']->forgetGuards();

        // 2. The officer sees the case in their own verification queue.
        Sanctum::actingAs($officer);

        $queue = $this->getJson('/api/v1/officer/verification-queue')->assertStatus(200);
        $this->assertTrue(
            collect($queue->json('data.data'))->pluck('id')->contains($report->id),
            'Assigned officer should see the case in their verification queue.'
        );

        // 3. The officer verifies the case.
        $this->putJson("/api/v1/officer/reports/{$report->id}/verify", [
            'official_remarks' => 'Verified on site.',
        ])
            ->assertStatus(200)
            ->assertJsonPath('data.status', 'verified');

        // 4. The officer begins the investigation.
        $this->putJson("/api/v1/officer/reports/{$report->id}/status", [
            'status' => 'in_progress',
            'official_remarks' => 'En route to the incident site.',
        ])
            ->assertStatus(200)
            ->assertJsonPath('data.status', 'in_progress');

        // 5. The officer resolves and closes the case.
        $this->putJson("/api/v1/officer/reports/{$report->id}/status", [
            'status' => 'closed',
            'investigation_findings' => 'Measured skid marks and interviewed witnesses.',
            'actions_taken' => 'Lane cleared and citation issued.',
        ])
            ->assertStatus(200)
            ->assertJsonPath('data.status', 'closed');

        $this->assertDatabaseHas('accident_reports', [
            'id' => $report->id,
            'status' => 'closed',
            'assigned_officer_id' => $officer->id,
            'verified_by' => $officer->id,
        ]);
    }

    public function test_can_submit_report_with_photo_evidence(): void
    {
        Storage::fake('public');

        $user = User::factory()->create(['role' => 'reporter', 'is_active' => true]);
        Sanctum::actingAs($user);

        $file = UploadedFile::fake()->create('accident_scene.jpg', 200, 'image/jpeg');

        $response = $this->postJson('/api/v1/reports', [
            'reporter_name' => 'Photo Reporter',
            'reporter_contact' => '09123334444',
            'accident_date' => now()->subDay()->toDateString(),
            'accident_time' => '14:30',
            'location_address' => 'MacArthur Highway, Malolos, Bulacan',
            'accident_type' => 'Rear-end Collision',
            'vehicles_involved' => 2,
            'injury_severity' => 'minor',
            'description' => 'Collision with photo evidence attached.',
            'photos' => [$file],
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('success', true);

        $reportId = $response->json('data.id');
        $photo = AccidentPhoto::where('accident_report_id', $reportId)->first();

        $this->assertNotNull($photo);
        $this->assertEquals('accident_scene.jpg', $photo->original_name);
        Storage::disk('public')->assertExists($photo->file_path);

        // Verify photo file endpoint
        $fileResponse = $this->get("/api/v1/photos/{$photo->id}/file");
        $fileResponse->assertStatus(200);
    }

    public function test_multiple_reports_with_identical_filenames_are_stored_distinctly(): void
    {
        Storage::fake('public');

        $user = User::factory()->create(['role' => 'reporter', 'is_active' => true]);
        Sanctum::actingAs($user);

        // First report with filename evidence.jpg
        $file1 = UploadedFile::fake()->create('evidence.jpg', 300, 'image/jpeg');
        $response1 = $this->postJson('/api/v1/reports', [
            'reporter_name' => 'Reporter One',
            'accident_date' => now()->subDay()->toDateString(),
            'accident_time' => '10:00',
            'location_address' => 'Location Alpha, Bulacan',
            'accident_type' => 'Collision',
            'vehicles_involved' => 1,
            'injury_severity' => 'none',
            'description' => 'First incident report description.',
            'photos' => [$file1],
        ]);
        $response1->assertStatus(201);
        $report1Id = $response1->json('data.id');

        // Second report also with filename evidence.jpg
        $file2 = UploadedFile::fake()->create('evidence.jpg', 400, 'image/jpeg');
        $response2 = $this->postJson('/api/v1/reports', [
            'reporter_name' => 'Reporter Two',
            'accident_date' => now()->subDay()->toDateString(),
            'accident_time' => '13:00',
            'location_address' => 'Location Beta, Bulacan',
            'accident_type' => 'Collision',
            'vehicles_involved' => 2,
            'injury_severity' => 'minor',
            'description' => 'Second incident report description.',
            'photos' => [$file2],
        ]);
        $response2->assertStatus(201);
        $report2Id = $response2->json('data.id');

        $photo1 = AccidentPhoto::where('accident_report_id', $report1Id)->first();
        $photo2 = AccidentPhoto::where('accident_report_id', $report2Id)->first();

        $this->assertNotNull($photo1);
        $this->assertNotNull($photo2);
        // Original names are both evidence.jpg
        $this->assertEquals('evidence.jpg', $photo1->original_name);
        $this->assertEquals('evidence.jpg', $photo2->original_name);

        // Stored file paths must be distinct (no collision/overwriting)
        $this->assertNotEquals($photo1->file_path, $photo2->file_path);
        $this->assertNotEquals($photo1->file_name, $photo2->file_name);

        // Both distinct files must exist in storage
        Storage::disk('public')->assertExists($photo1->file_path);
        Storage::disk('public')->assertExists($photo2->file_path);

        // Each report displays its own correct photo via API
        $show1 = $this->getJson("/api/v1/reports/{$report1Id}");
        $show1->assertStatus(200);
        $this->assertEquals($photo1->id, $show1->json('data.photos.0.id'));
        $this->assertEquals($photo1->file_path, $show1->json('data.photos.0.file_path'));

        $show2 = $this->getJson("/api/v1/reports/{$report2Id}");
        $show2->assertStatus(200);
        $this->assertEquals($photo2->id, $show2->json('data.photos.0.id'));
        $this->assertEquals($photo2->file_path, $show2->json('data.photos.0.file_path'));
    }

    // -------------------------------------------------------------------------
    // Admin exports (CSV & PDF)
    // -------------------------------------------------------------------------

    public function test_export_csv_streams_real_report_rows_with_all_columns(): void
    {
        [$admin] = $this->adminToken();

        $officer = User::factory()->create([
            'role' => 'officer',
            'is_active' => true,
            'name' => 'Officer CSV Check',
            'badge_number' => 'PO-CSV-1',
        ]);

        $this->seedReport([
            'report_number' => 'AR-CSV-0001',
            'reporter_name' => 'Juana Dela Cruz',
            'reporter_contact' => '09171112222',
            'location_address' => 'Guiguinto, Bulacan',
            'accident_type' => 'Rear-end Collision',
            'injury_severity' => 'minor',
            'description' => 'A rear-end collision near the toll plaza.',
            'status' => 'assigned',
            'assigned_officer_id' => $officer->id,
        ]);

        Sanctum::actingAs($admin);

        $response = $this->get('/api/v1/admin/exports/csv');

        $response->assertStatus(200);
        $this->assertStringContainsString('text/csv', (string) $response->headers->get('content-type'));
        $this->assertStringContainsString('attachment', (string) $response->headers->get('content-disposition'));

        $csv = $response->streamedContent();

        // Required columns are present.
        foreach (['ID', 'Report Number', 'Status', 'Incident Type', 'Reporter Name', 'Location', 'Description', 'Assigned Officer', 'Accident Date'] as $column) {
            $this->assertStringContainsString($column, $csv, "CSV header should contain {$column}");
        }

        // Real values from the record, not placeholders.
        $this->assertStringContainsString('AR-CSV-0001', $csv);
        $this->assertStringContainsString('Juana Dela Cruz', $csv);
        $this->assertStringContainsString('09171112222', $csv);
        $this->assertStringContainsString('A rear-end collision near the toll plaza.', $csv);
        $this->assertStringContainsString('Officer CSV Check', $csv);
        $this->assertStringContainsString('ASSIGNED', $csv);
        $this->assertStringContainsString('Guiguinto, Bulacan', $csv);
    }

    public function test_export_csv_respects_active_status_and_search_filters(): void
    {
        [$admin] = $this->adminToken();

        $this->seedReport(['report_number' => 'AR-CSV-OPEN', 'status' => 'submitted']);
        $this->seedReport(['report_number' => 'AR-CSV-CLOSED', 'status' => 'closed']);
        $match = $this->seedReport([
            'report_number' => 'AR-CSV-MATCH',
            'status' => 'closed',
            'location_address' => 'Guiguinto Public Market, Bulacan',
        ]);

        Sanctum::actingAs($admin);

        // Status filter: only the closed rows.
        $byStatus = $this->get('/api/v1/admin/exports/csv?status=closed')->streamedContent();
        $this->assertStringContainsString('AR-CSV-CLOSED', $byStatus);
        $this->assertStringContainsString('AR-CSV-MATCH', $byStatus);
        $this->assertStringNotContainsString('AR-CSV-OPEN', $byStatus);

        // Search filter narrows it to the matching row only.
        $bySearch = $this->get('/api/v1/admin/exports/csv?search=Guiguinto')->streamedContent();
        $this->assertStringContainsString($match->report_number, $bySearch);
        $this->assertStringNotContainsString('AR-CSV-OPEN', $bySearch);
        $this->assertStringNotContainsString('AR-CSV-CLOSED', $bySearch);
    }

    public function test_export_csv_is_admin_only(): void
    {
        $officer = User::factory()->create(['role' => 'officer', 'is_active' => true]);
        Sanctum::actingAs($officer);

        $this->get('/api/v1/admin/exports/csv')->assertStatus(403);
    }

    public function test_export_pdf_returns_a_real_pdf_with_report_content(): void
    {
        [$admin] = $this->adminToken();

        $this->seedReport([
            'report_number' => 'AR-PDF-0001',
            'status' => 'closed',
            'description' => 'Long narrative: ' . str_repeat('slippery pavement and scattered debris ', 20),
        ]);

        Sanctum::actingAs($admin);

        $response = $this->get('/api/v1/admin/exports/pdf');

        $response->assertStatus(200);
        $this->assertSame('application/pdf', $response->headers->get('content-type'));
        $this->assertStringContainsString('attachment', (string) $response->headers->get('content-disposition'));

        $body = $response->getContent();
        $this->assertStringStartsWith('%PDF-', $body, 'Response body must be a real PDF document.');
        $this->assertGreaterThan(1000, strlen($body), 'PDF must not be an empty file.');
    }

    public function test_export_pdf_handles_empty_results_and_is_admin_only(): void
    {
        [$admin] = $this->adminToken();
        Sanctum::actingAs($admin);

        // No matching reports: still a valid, downloadable PDF.
        $empty = $this->get('/api/v1/admin/exports/pdf?status=rejected');
        $empty->assertStatus(200);
        $this->assertStringStartsWith('%PDF-', $empty->getContent());

        $this->app['auth']->forgetGuards();

        $reporter = User::factory()->create(['role' => 'reporter', 'is_active' => true]);
        Sanctum::actingAs($reporter);
        $this->get('/api/v1/admin/exports/pdf')->assertStatus(403);
    }

    public function test_export_pdf_paginates_large_result_sets(): void
    {
        [$admin] = $this->adminToken();

        for ($i = 0; $i < 40; $i++) {
            $this->seedReport([
                'report_number' => 'AR-PDF-PAGE-' . str_pad((string) $i, 3, '0', STR_PAD_LEFT),
                'status' => 'closed',
                'description' => 'Narrative line for pagination testing: ' . str_repeat('debris and skid marks ', 12),
            ]);
        }

        Sanctum::actingAs($admin);

        $body = $this->get('/api/v1/admin/exports/pdf')->getContent();

        $this->assertStringStartsWith('%PDF-', $body);
        $pages = preg_match_all('#/Type\s*/Page[^s]#', $body);
        $this->assertGreaterThanOrEqual(2, $pages, 'A 40-row report should span multiple PDF pages.');
    }

    // -------------------------------------------------------------------------
    // Permanent report deletion
    // -------------------------------------------------------------------------

    public function test_admin_can_permanently_delete_a_report_and_all_associated_records(): void
    {
        Storage::fake('public');
        [$admin] = $this->adminToken();

        $reporter = User::factory()->create(['role' => 'reporter', 'is_active' => true]);
        $officer = User::factory()->create(['role' => 'officer', 'is_active' => true]);

        $report = $this->seedReport([
            'user_id' => $reporter->id,
            'report_number' => 'AR-DELETE-0001',
            'status' => 'assigned',
            'assigned_officer_id' => $officer->id,
        ]);

        $photoPath = 'accidents/2026/10/report-photo.jpg';
        Storage::disk('public')->put($photoPath, 'photo-bytes');

        $photo = AccidentPhoto::create([
            'accident_report_id' => $report->id,
            'file_path' => $photoPath,
            'file_name' => 'report-photo.jpg',
            'original_name' => 'report-photo.jpg',
            'file_size' => 11,
            'mime_type' => 'image/jpeg',
        ]);

        ReportStatusHistory::create([
            'accident_report_id' => $report->id,
            'user_id' => $reporter->id,
            'from_status' => 'verified',
            'to_status' => 'assigned',
            'remarks' => 'Assigned for deletion test.',
        ]);

        OfficerAssignment::create([
            'accident_report_id' => $report->id,
            'officer_id' => $officer->id,
            'assigned_by' => $admin->id,
            'status' => 'active',
        ]);

        SystemNotification::create([
            'user_id' => $reporter->id,
            'title' => 'Report update',
            'message' => 'Your report was assigned.',
            'type' => 'status_change',
            'link' => "/reports/{$report->id}",
        ]);

        Sanctum::actingAs($admin);

        $this->deleteJson("/api/v1/admin/reports/{$report->id}")
            ->assertOk()
            ->assertJsonPath('success', true);

        $this->assertDatabaseMissing('accident_reports', ['id' => $report->id]);
        $this->assertDatabaseMissing('accident_photos', ['id' => $photo->id]);
        $this->assertDatabaseMissing('report_status_history', ['accident_report_id' => $report->id]);
        $this->assertDatabaseMissing('officer_assignments', ['accident_report_id' => $report->id]);
        $this->assertDatabaseMissing('system_notifications', ['link' => "/reports/{$report->id}"]);
        Storage::disk('public')->assertMissing($photoPath);

        $audit = AuditLog::where('action', 'delete_report')
            ->where('target_type', 'AccidentReport')
            ->where('target_id', $report->id)
            ->first();

        $this->assertNotNull($audit);
        $this->assertSame($admin->id, $audit->user_id);
        $this->assertNotNull($audit->created_at);
        $this->assertStringContainsString('AR-DELETE-0001', $audit->description);

        // The report disappears from the admin list, dashboard counts and the
        // assigned officer's verification queue.
        $adminIds = collect($this->getJson('/api/v1/admin/reports')->json('data.data'))->pluck('id');
        $this->assertFalse($adminIds->contains($report->id));

        $this->getJson('/api/v1/admin/dashboard/stats')
            ->assertOk()
            ->assertJsonPath('data.counts.total', 0);

        $this->app['auth']->forgetGuards();
        Sanctum::actingAs($officer);

        $queueIds = collect($this->getJson('/api/v1/officer/verification-queue')->json('data.data'))->pluck('id');
        $this->assertFalse($queueIds->contains($report->id));
    }

    public function test_permanent_delete_removes_only_the_selected_report(): void
    {
        Storage::fake('public');
        [$admin] = $this->adminToken();

        $deletedReport = $this->seedReport(['report_number' => 'AR-DELETE-0002']);
        $keptReport = $this->seedReport(['report_number' => 'AR-KEEP-0001']);

        $deletedPath = 'accidents/2026/10/deleted.jpg';
        $keptPath = 'accidents/2026/10/kept.jpg';
        Storage::disk('public')->put($deletedPath, 'deleted-photo');
        Storage::disk('public')->put($keptPath, 'kept-photo');

        AccidentPhoto::create([
            'accident_report_id' => $deletedReport->id,
            'file_path' => $deletedPath,
            'file_name' => 'deleted.jpg',
            'original_name' => 'deleted.jpg',
            'file_size' => 13,
            'mime_type' => 'image/jpeg',
        ]);
        $keptPhoto = AccidentPhoto::create([
            'accident_report_id' => $keptReport->id,
            'file_path' => $keptPath,
            'file_name' => 'kept.jpg',
            'original_name' => 'kept.jpg',
            'file_size' => 11,
            'mime_type' => 'image/jpeg',
        ]);

        Sanctum::actingAs($admin);
        $this->deleteJson("/api/v1/admin/reports/{$deletedReport->id}")->assertOk();

        $this->assertDatabaseMissing('accident_reports', ['id' => $deletedReport->id]);
        $this->assertDatabaseHas('accident_reports', ['id' => $keptReport->id]);
        $this->assertDatabaseHas('accident_photos', ['id' => $keptPhoto->id]);
        Storage::disk('public')->assertMissing($deletedPath);
        Storage::disk('public')->assertExists($keptPath);
    }

    public function test_photo_file_shared_with_another_report_is_not_deleted(): void
    {
        Storage::fake('public');
        [$admin] = $this->adminToken();

        $deletedReport = $this->seedReport(['report_number' => 'AR-DELETE-0003']);
        $otherReport = $this->seedReport(['report_number' => 'AR-OTHER-0001']);

        $sharedPath = 'accidents/2026/10/shared.jpg';
        Storage::disk('public')->put($sharedPath, 'shared-photo');

        AccidentPhoto::create([
            'accident_report_id' => $deletedReport->id,
            'file_path' => $sharedPath,
            'file_name' => 'shared.jpg',
            'original_name' => 'shared.jpg',
            'file_size' => 11,
            'mime_type' => 'image/jpeg',
        ]);
        $otherPhoto = AccidentPhoto::create([
            'accident_report_id' => $otherReport->id,
            'file_path' => $sharedPath,
            'file_name' => 'shared.jpg',
            'original_name' => 'shared.jpg',
            'file_size' => 11,
            'mime_type' => 'image/jpeg',
        ]);

        Sanctum::actingAs($admin);
        $this->deleteJson("/api/v1/admin/reports/{$deletedReport->id}")->assertOk();

        $this->assertDatabaseMissing('accident_reports', ['id' => $deletedReport->id]);
        $this->assertDatabaseHas('accident_photos', ['id' => $otherPhoto->id]);
        Storage::disk('public')->assertExists($sharedPath);
    }

    public function test_only_admins_can_permanently_delete_reports(): void
    {
        $report = $this->seedReport(['report_number' => 'AR-DELETE-PROTECTED']);

        foreach (['reporter', 'officer'] as $role) {
            $this->app['auth']->forgetGuards();
            $user = User::factory()->create(['role' => $role, 'is_active' => true]);
            Sanctum::actingAs($user);

            $this->deleteJson("/api/v1/admin/reports/{$report->id}")->assertStatus(403);

            $this->assertDatabaseHas('accident_reports', ['id' => $report->id]);
            $this->assertDatabaseMissing('audit_logs', [
                'action' => 'delete_report',
                'target_id' => $report->id,
            ]);
        }
    }
}
