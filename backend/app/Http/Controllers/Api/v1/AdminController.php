<?php

namespace App\Http\Controllers\Api\v1;

use App\Http\Controllers\Controller;
use App\Models\AccidentPhoto;
use App\Models\AccidentReport;
use App\Models\AuditLog;
use App\Models\OfficerAssignment;
use App\Rules\PhilippineMobile;
use App\Models\ReportStatusHistory;
use App\Models\SystemNotification;
use App\Models\User;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AdminController extends Controller
{
    /**
     * Maps the audit trail's coarse "Action" filter onto concrete action
     * slugs recorded by AuditLog::record() across the codebase.
     */
    public const AUDIT_ACTION_GROUPS = [
        'login' => ['user_login', 'user_logout'],
        'create' => [
            'user_register',
            'submit_report',
            'create_officer',
            'create_category',
        ],
        'update' => [
            'update_profile',
            'update_user_account',
            'update_user_role',
            'update_user_status',
            'assign_officer',
            'officer_update_status',
            'verify_report',
            'reject_report',
            'request_additional_info',
            'close_report',
            'update_category',
            'supplement_report',
        ],
        // Permanent deletion must remain filterable alongside historical
        // archive_report entries written before hard delete was introduced.
        'delete' => ['archive_report', 'delete_report', 'delete_category'],
    ];

    public function dashboardStats(): JsonResponse
    {
        $total = AccidentReport::count();
        $pending = AccidentReport::whereIn('status', ['submitted', 'under_review', 'additional_info_required'])->count();
        $verified = AccidentReport::where('status', 'verified')->count();
        $assigned = AccidentReport::where('status', 'assigned')->count();
        $inProgress = AccidentReport::where('status', 'in_progress')->count();
        $closed = AccidentReport::where('status', 'closed')->count();
        $rejected = AccidentReport::where('status', 'rejected')->count();

        // By Accident Type
        $byType = AccidentReport::select('accident_type', DB::raw('count(*) as count'))
            ->groupBy('accident_type')
            ->orderByDesc('count')
            ->get();

        // By Severity
        $bySeverity = AccidentReport::select('injury_severity', DB::raw('count(*) as count'))
            ->groupBy('injury_severity')
            ->get();

        // 7-day trend
        $sevenDays = AccidentReport::select(
            DB::raw('DATE(accident_date) as date'),
            DB::raw('count(*) as count')
        )
            ->where('accident_date', '>=', now()->subDays(6)->toDateString())
            ->groupBy('date')
            ->orderBy('date')
            ->get();

        // User stats
        $totalUsers = User::count();
        $officersCount = User::where('role', 'officer')->where('is_active', true)->count();

        return response()->json([
            'success' => true,
            'data' => [
                'counts' => [
                    'total' => $total,
                    'pending' => $pending,
                    'verified' => $verified,
                    'assigned' => $assigned,
                    'in_progress' => $inProgress,
                    'closed' => $closed,
                    'rejected' => $rejected,
                    'active_investigations' => $assigned + $inProgress,
                    'total_users' => $totalUsers,
                    'active_officers' => $officersCount,
                ],
                'by_type' => $byType,
                'by_severity' => $bySeverity,
                'weekly_trend' => $sevenDays,
            ],
        ]);
    }

    public function reports(Request $request): JsonResponse
    {
        $query = AccidentReport::with(['category', 'photos', 'assignedOfficer', 'verifiedBy'])
            ->orderByDesc('created_at');

        $query = $this->applyReportFilters($request, $query);

        $reports = $query->paginate($request->query('per_page', 10));

        return response()->json([
            'success' => true,
            'data' => $reports,
        ]);
    }

    /**
     * Apply the Admin Reports page filters (status, category, severity, date
     * range, free-text search) to a report query. Shared by the list endpoint
     * and both exports, so a download always matches what the admin is viewing.
     */
    private function applyReportFilters(Request $request, Builder $query): Builder
    {
        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
        }

        if ($request->filled('accident_type')) {
            $query->where('accident_type', $request->query('accident_type'));
        }

        if ($request->filled('severity')) {
            $query->where('injury_severity', $request->query('severity'));
        }

        if ($request->filled('date_from')) {
            $query->whereDate('accident_date', '>=', $request->query('date_from'));
        }

        if ($request->filled('date_to')) {
            $query->whereDate('accident_date', '<=', $request->query('date_to'));
        }

        if ($request->filled('search')) {
            $search = $request->query('search');
            $query->where(function ($q) use ($search) {
                $q->where('report_number', 'LIKE', "%{$search}%")
                  ->orWhere('reporter_name', 'LIKE', "%{$search}%")
                  ->orWhere('location_address', 'LIKE', "%{$search}%")
                  ->orWhere('description', 'LIKE', "%{$search}%");
            });
        }

        return $query;
    }

    /**
     * Reports awaiting administrative verification: the intake statuses that
     * have not yet been verified or rejected. Mirrors the officer queue, but
     * scoped to the admin's province-wide review duty rather than one officer's
     * caseload.
     */
    public function verificationQueue(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'status' => ['nullable', 'in:submitted,under_review,additional_info_required'],
            'search' => ['nullable', 'string', 'max:100'],
        ]);

        $query = AccidentReport::with(['category', 'assignedOfficer', 'verifiedBy'])
            ->whereIn('status', ['submitted', 'under_review', 'additional_info_required'])
            ->orderByDesc('created_at');

        if (!empty($validated['status'])) {
            $query->where('status', $validated['status']);
        }

        if (!empty($validated['search'])) {
            $search = $validated['search'];
            $query->where(function ($q) use ($search) {
                $q->where('report_number', 'LIKE', "%{$search}%")
                    ->orWhere('reporter_name', 'LIKE', "%{$search}%")
                    ->orWhere('location_address', 'LIKE', "%{$search}%")
                    ->orWhere('description', 'LIKE', "%{$search}%");
            });
        }

        return response()->json([
            'success' => true,
            'data' => $query->paginate($request->query('per_page', 10)),
        ]);
    }

    public function assignOfficer(Request $request, int $id): JsonResponse
    {
        $report = AccidentReport::findOrFail($id);
        $admin = $request->user();

        if (in_array($report->status, ['closed', 'rejected'], true)) {
            return response()->json([
                'success' => false,
                'message' => "A {$report->status} report can no longer be assigned.",
            ], 422);
        }

        $validated = $request->validate([
            'officer_id' => ['required', 'integer', 'exists:users,id'],
            'assignment_notes' => ['nullable', 'string', 'max:1000'],
        ]);

        $officer = User::where('id', $validated['officer_id'])
            ->where('role', 'officer')
            ->where('is_active', true)
            ->first();

        if (!$officer) {
            return response()->json([
                'success' => false,
                'message' => 'The selected user is not an active Traffic Officer.',
                'errors' => ['officer_id' => ['The selected user is not an active Traffic Officer.']],
            ], 422);
        }

        DB::transaction(function () use ($report, $officer, $admin, $validated) {
            $oldStatus = $report->status;
            $report->assigned_officer_id = $officer->id;
            $report->status = 'assigned';
            $report->save();

            OfficerAssignment::create([
                'accident_report_id' => $report->id,
                'officer_id' => $officer->id,
                'assigned_by' => $admin->id,
                'assignment_notes' => $validated['assignment_notes'] ?? null,
                'status' => 'active',
            ]);

            ReportStatusHistory::create([
                'accident_report_id' => $report->id,
                'user_id' => $admin->id,
                'from_status' => $oldStatus,
                'to_status' => 'assigned',
                'remarks' => "Assigned to {$officer->name} ({$officer->badge_number}). " . ($validated['assignment_notes'] ?? ''),
            ]);

            AuditLog::record(
                $admin->id,
                'assign_officer',
                'AccidentReport',
                $report->id,
                "Assigned report {$report->report_number} to officer {$officer->name}"
            );

            // Notify Officer
            SystemNotification::notify(
                $officer->id,
                "New Incident Assigned: {$report->report_number}",
                "You have been assigned to investigate an incident at {$report->location_address}",
                'assignment',
                "/officer/reports/{$report->id}"
            );

            // Notify Reporter
            if ($report->user_id) {
                SystemNotification::notify(
                    $report->user_id,
                    "Officer Assigned: {$report->report_number}",
                    "Traffic Officer {$officer->name} has been assigned to investigate your incident report.",
                    'status_change',
                    "/reports/{$report->id}"
                );
            }
        });

        $report->load(['assignedOfficer', 'assignments.officer', 'statusHistory']);

        return response()->json([
            'success' => true,
            'message' => "Report assigned to {$officer->name}.",
            'data' => $report,
        ]);
    }

    public function requestInfo(Request $request, int $id): JsonResponse
    {
        $report = AccidentReport::findOrFail($id);
        $admin = $request->user();

        $validated = $request->validate([
            'notes' => ['required', 'string', 'min:5', 'max:1000'],
        ]);

        DB::transaction(function () use ($report, $admin, $validated) {
            $oldStatus = $report->status;
            $report->status = 'additional_info_required';
            $report->additional_info_notes = $validated['notes'];
            $report->save();

            ReportStatusHistory::create([
                'accident_report_id' => $report->id,
                'user_id' => $admin->id,
                'from_status' => $oldStatus,
                'to_status' => 'additional_info_required',
                'remarks' => "Additional information requested: {$validated['notes']}",
            ]);

            AuditLog::record(
                $admin->id,
                'request_additional_info',
                'AccidentReport',
                $report->id,
                "Requested additional information for {$report->report_number}"
            );

            if ($report->user_id) {
                SystemNotification::notify(
                    $report->user_id,
                    "Information Required: {$report->report_number}",
                    "The review team requested more details: {$validated['notes']}",
                    'info',
                    "/reports/{$report->id}"
                );
            }
        });

        return response()->json([
            'success' => true,
            'message' => 'Additional information request sent to reporter.',
            'data' => $report,
        ]);
    }

    /**
     * Permanently delete a report and every report-specific record.
     *
     * The database work is transactional so a failure cannot leave a
     * half-deleted report. Photo files are removed only after the transaction
     * commits, and only when no other report still references the same path.
     */
    public function destroyReport(Request $request, int $id): JsonResponse
    {
        $report = AccidentReport::with('photos')->findOrFail($id);
        $admin = $request->user();

        $reportNumber = $report->report_number;
        $reportStatus = $report->status;
        $photoPaths = $report->photos
            ->pluck('file_path')
            ->filter()
            ->unique()
            ->values()
            ->all();
        $photoCount = $report->photos->count();

        try {
            DB::transaction(function () use ($report, $admin, $reportNumber, $reportStatus, $photoCount) {
                // Notification links point at a report screen that will no
                // longer exist; remove only this report's exact links.
                SystemNotification::whereIn('link', [
                    "/reports/{$report->id}",
                    "/admin/reports/{$report->id}",
                    "/officer/reports/{$report->id}",
                ])->delete();

                // Written before the delete (inside the same transaction) so
                // the security trail commits together with the deletion and
                // survives it. AuditLog has no foreign key to the report.
                AuditLog::record(
                    $admin->id,
                    'delete_report',
                    'AccidentReport',
                    $report->id,
                    "Permanently deleted accident report {$reportNumber}",
                    [
                        'report_number' => $reportNumber,
                        'status' => $reportStatus,
                        'photo_count' => $photoCount,
                    ]
                );

                // AccidentPhoto, ReportStatusHistory and OfficerAssignment
                // cascade at the database level for this report.
                $report->forceDelete();
            });
        } catch (\Throwable $exception) {
            report($exception);

            return response()->json([
                'success' => false,
                'message' => 'The report could not be deleted. No changes were made.',
            ], 500);
        }

        // Files go after the commit: a failed database delete must never leave
        // a live report without its evidence. The reference check protects a
        // file path that another report might still use.
        foreach ($photoPaths as $path) {
            try {
                if (!AccidentPhoto::where('file_path', $path)->exists()) {
                    Storage::disk('public')->delete($path);
                }
            } catch (\Throwable $exception) {
                report($exception);
            }
        }

        return response()->json([
            'success' => true,
            'message' => "Report {$reportNumber} has been permanently deleted.",
        ]);
    }

    public function users(Request $request): JsonResponse
    {
        $query = User::withCount(['accidentReports', 'officerAssignments'])->orderBy('name');

        if ($request->filled('role')) {
            $query->where('role', $request->query('role'));
        }

        if ($request->filled('search')) {
            $search = $request->query('search');
            $query->where(function ($q) use ($search) {
                $q->where('name', 'LIKE', "%{$search}%")
                  ->orWhere('email', 'LIKE', "%{$search}%")
                  ->orWhere('badge_number', 'LIKE', "%{$search}%");
            });
        }

        $users = $query->paginate(15);

        return response()->json([
            'success' => true,
            'data' => $users,
        ]);
    }

    /**
     * Full account details for a single user.
     */
    public function showUser(int $id): JsonResponse
    {
        $user = User::withCount(['accidentReports', 'officerAssignments', 'systemNotifications'])
            ->findOrFail($id);

        return response()->json([
            'success' => true,
            'data' => [
                'user' => $user,
                'reports_count' => $user->accident_reports_count,
                'assignments_count' => $user->officer_assignments_count,
                'notifications_count' => $user->system_notifications_count,
            ],
        ]);
    }

    /**
     * Edit account details: name, email, phone, address, badge and role.
     */
    public function updateUser(Request $request, int $id): JsonResponse
    {
        $targetUser = User::findOrFail($id);
        $actingAdmin = $request->user();

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', Rule::unique('users', 'email')->ignore($targetUser->id)],
            'phone' => ['nullable', 'string', new PhilippineMobile],
            'address' => ['nullable', 'string', 'max:255'],
            'role' => ['required', 'in:admin,officer,reporter'],
            'badge_number' => ['nullable', 'string', 'max:50'],
        ], [
            'email.unique' => 'That email address is already assigned to another account.',
            'phone.*' => 'Enter a valid 11-digit mobile number (e.g. 09171234567).',
        ]);

        // An administrator may not edit their own role or email.
        if ($targetUser->id === $actingAdmin->id) {
            if ($validated['role'] !== $actingAdmin->role) {
                return response()->json([
                    'success' => false,
                    'message' => 'You cannot change your own role.',
                ], 422);
            }

            if (strtolower($validated['email']) !== strtolower($actingAdmin->email)) {
                return response()->json([
                    'success' => false,
                    'message' => 'You cannot change your own email address.',
                ], 422);
            }
        }

        $changes = [];

        if ($targetUser->name !== $validated['name']) {
            $changes[] = "name from [{$targetUser->name}] to [{$validated['name']}]";
        }
        if (strtolower($targetUser->email) !== strtolower($validated['email'])) {
            $changes[] = "email from [{$targetUser->email}] to [{$validated['email']}]";
        }
        if ($targetUser->phone !== ($validated['phone'] ?? null)) {
            $changes[] = 'contact number';
        }
        if ($targetUser->address !== ($validated['address'] ?? null)) {
            $changes[] = 'address';
        }
        if ($targetUser->role !== $validated['role']) {
            $changes[] = "role from [{$targetUser->role}] to [{$validated['role']}]";
        }

        $targetUser->name = $validated['name'];
        $targetUser->email = strtolower($validated['email']);
        $targetUser->phone = $validated['phone'] ?? null;
        $targetUser->address = $validated['address'] ?? null;
        $targetUser->role = $validated['role'];

        // Badge only makes sense for officers.
        $targetUser->badge_number = $validated['role'] === 'officer'
            ? ($validated['badge_number'] ?? null)
            : null;

        $targetUser->save();

        if ($changes) {
            AuditLog::record(
                $actingAdmin->id,
                'update_user_account',
                'User',
                $targetUser->id,
                'Admin ' . $actingAdmin->name . ' updated account ' . $targetUser->email . ': ' . implode(', ', $changes)
            );
        }

        return response()->json([
            'success' => true,
            'message' => 'Account updated successfully.',
            'data' => $targetUser,
        ]);
    }

    public function updateUserRole(Request $request, int $id): JsonResponse
    {
        $targetUser = User::findOrFail($id);
        $actingAdmin = $request->user();

        $validated = $request->validate([
            'role' => ['required', 'in:admin,officer,reporter'],
            'badge_number' => ['nullable', 'string', 'max:50'],
            'is_active' => ['boolean'],
        ]);

        // Security check: Prevent admin from deactivating or demoting themselves
        if ($targetUser->id === $actingAdmin->id && ($validated['role'] !== 'admin' || (isset($validated['is_active']) && !$validated['is_active']))) {
            return response()->json([
                'success' => false,
                'message' => 'You cannot demote or deactivate your own administrator account.',
            ], 422);
        }

        $oldRole = $targetUser->role;
        $oldIsActive = (bool) $targetUser->is_active;
        $targetUser->role = $validated['role'];
        if (array_key_exists('badge_number', $validated)) {
            $targetUser->badge_number = $validated['badge_number'];
        }
        if (array_key_exists('is_active', $validated)) {
            $targetUser->is_active = $validated['is_active'];
        }
        $targetUser->save();

        // Note: tokens are deliberately left in place on deactivation so the
        // account.active middleware can return the clear inactive message.

        AuditLog::record(
            $actingAdmin->id,
            'update_user_role',
            'User',
            $targetUser->id,
            "Admin {$actingAdmin->name} updated user {$targetUser->email} role from [{$oldRole}] to [{$targetUser->role}]"
        );

        return response()->json([
            'success' => true,
            'message' => "User role updated successfully to {$targetUser->role}.",
            'data' => $targetUser,
        ]);
    }

    /**
     * Create a Traffic Officer account.
     *
     * Reuses the same credential rules as public registration, then forces the
     * officer role so this endpoint cannot create any other kind of account.
     */
    public function createOfficer(Request $request): JsonResponse
    {
        $admin = $request->user();

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', Rule::unique('users', 'email')],
            'phone' => ['nullable', 'string', new PhilippineMobile],
            'address' => ['nullable', 'string', 'max:255'],
            'badge_number' => ['required', 'string', 'max:50'],
            'password' => ['required', 'confirmed', Password::min(8)->letters()->numbers()],
        ], [
            'email.unique' => 'That email address is already assigned to another account.',
            'badge_number.required' => 'An official badge number is required for traffic officers.',
            'phone.*' => 'Enter a valid 11-digit mobile number (e.g. 09171234567).',
        ]);

        // Badge numbers identify officers on case assignments, so they must be
        // unique across the officer roster.
        $badgeTaken = User::where('role', 'officer')
            ->where('badge_number', $validated['badge_number'])
            ->exists();

        if ($badgeTaken) {
            return response()->json([
                'success' => false,
                'message' => "Badge number {$validated['badge_number']} is already assigned to another officer.",
            ], 422);
        }

        $officer = User::create([
            'name' => $validated['name'],
            'email' => strtolower($validated['email']),
            'phone' => $validated['phone'] ?? null,
            'address' => $validated['address'] ?? null,
            'badge_number' => $validated['badge_number'],
            'role' => 'officer', // Fixed: this endpoint only creates officers
            'is_active' => true,
            'password' => Hash::make($validated['password']),
        ]);

        AuditLog::record(
            $admin->id,
            'create_officer',
            'User',
            $officer->id,
            "Admin {$admin->name} created traffic officer account {$officer->email} (Badge: {$officer->badge_number})"
        );

        return response()->json([
            'success' => true,
            'message' => "Traffic officer account for {$officer->name} created successfully.",
            'data' => $officer,
        ], 201);
    }

    /**
     * Activate or deactivate an account.
     */
    public function updateUserStatus(Request $request, int $id): JsonResponse
    {
        $targetUser = User::findOrFail($id);
        $actingAdmin = $request->user();

        $validated = $request->validate([
            'is_active' => ['required', 'boolean'],
        ]);

        $isActive = (bool) $validated['is_active'];

        // Security check: an administrator cannot lock themselves out.
        if ($targetUser->id === $actingAdmin->id && !$isActive) {
            return response()->json([
                'success' => false,
                'message' => 'You cannot deactivate your own administrator account.',
            ], 422);
        }

        if ((bool) $targetUser->is_active === $isActive) {
            return response()->json([
                'success' => true,
                'message' => 'No changes were made to this account.',
                'data' => $targetUser,
            ]);
        }

        $targetUser->is_active = $isActive;
        $targetUser->save();

        // Tokens are intentionally NOT deleted here. Existing sessions stay
        // resolvable so the account.active middleware can answer with the
        // clear "account is inactive" message, rather than Sanctum failing
        // first with a generic 401 Unauthenticated.
        $action = $isActive ? 'activated' : 'deactivated';
        AuditLog::record(
            $actingAdmin->id,
            'update_user_status',
            'User',
            $targetUser->id,
            "Admin {$actingAdmin->name} {$action} account {$targetUser->email}"
        );

        return response()->json([
            'success' => true,
            'message' => $isActive
                ? "{$targetUser->name}'s account has been activated."
                : "{$targetUser->name}'s account has been deactivated.",
            'data' => $targetUser,
        ]);
    }

    public function officers(): JsonResponse
    {
        $officers = User::where('role', 'officer')
            ->where('is_active', true)
            ->withCount(['officerAssignments as active_assignments_count' => function ($q) {
                $q->where('status', 'active');
            }])
            ->get();

        return response()->json([
            'success' => true,
            'data' => $officers,
        ]);
    }

    /**
     * Audit trail with date range, user type, action group and free-text filters.
     */
    public function auditLogs(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'from_date' => ['nullable', 'date'],
            'to_date' => ['nullable', 'date'],
            'user_type' => ['nullable', 'in:admin,resident'],
            'action' => ['nullable', 'in:login,create,update,delete'],
            'search' => ['nullable', 'string', 'max:100'],
            'sort' => ['nullable', 'in:newest,oldest'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $fromDate = $validated['from_date'] ?? null;
        $toDate = $validated['to_date'] ?? null;

        // Reject an inverted range rather than silently returning nothing.
        if ($fromDate && $toDate && strtotime($fromDate) > strtotime($toDate)) {
            return response()->json([
                'success' => false,
                'message' => 'The "To Date" cannot be earlier than the "From Date".',
            ], 422);
        }

        $direction = ($validated['sort'] ?? 'newest') === 'oldest' ? 'asc' : 'desc';

        $query = AuditLog::with('user')
            ->orderBy('created_at', $direction)
            ->orderBy('id', $direction);

        // Both endpoints are inclusive; to_date covers the whole day.
        if ($fromDate) {
            $query->whereDate('created_at', '>=', $fromDate);
        }

        if ($toDate) {
            $query->whereDate('created_at', '<=', $toDate);
        }

        if (!empty($validated['user_type'])) {
            $query->whereHas('user', function ($q) use ($validated) {
                // "Resident" is the UI label for the reporter role.
                $q->where('role', $validated['user_type'] === 'resident' ? 'reporter' : 'admin');
            });
        }

        if (!empty($validated['action'])) {
            $query->whereIn('action', self::AUDIT_ACTION_GROUPS[$validated['action']]);
        }

        if (!empty($validated['search'])) {
            $search = $validated['search'];
            $query->where(function ($q) use ($search) {
                $q->where('description', 'LIKE', "%{$search}%")
                    ->orWhereHas('user', function ($uq) use ($search) {
                        $uq->where('name', 'LIKE', "%{$search}%")
                            ->orWhere('email', 'LIKE', "%{$search}%");
                    });
            });
        }

        $logs = $query->paginate($validated['per_page'] ?? 20);

        return response()->json([
            'success' => true,
            'data' => $logs,
        ]);
    }

    public function exportCsv(Request $request): StreamedResponse
    {
        $admin = $request->user();

        // Honour the same filters/search as the Admin Reports list.
        $reports = $this->applyReportFilters(
            $request,
            AccidentReport::with(['assignedOfficer', 'verifiedBy'])
        )->orderByDesc('created_at');

        $filename = 'accident_reports_' . date('Ymd_His') . '.csv';

        $headers = [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
            'Cache-Control' => 'no-store, no-cache, must-revalidate',
        ];

        AuditLog::record($admin->id, 'export_csv', 'AccidentReport', null, 'Exported accident reports to CSV');

        return response()->stream(function () use ($reports) {
            $handle = fopen('php://output', 'w');

            // UTF-8 BOM so Excel renders accented characters (e.g. "Peñabatan")
            // correctly instead of as mojibake.
            fwrite($handle, "\xEF\xBB\xBF");

            // Header Row
            fputcsv($handle, [
                'ID',
                'Report Number',
                'Status',
                'Accident Date',
                'Accident Time',
                'Incident Type',
                'Vehicles Involved',
                'Injury Severity',
                'Reporter Name',
                'Reporter Contact',
                'Location',
                'Description',
                'Assigned Officer',
                'Verified By',
                'Verified At',
                'Official Remarks',
                'Date Filed',
            ]);

            // Sanitize CSV injection (RFC 4180 + formula prevention).
            $sanitize = function ($val) {
                if ($val === null) return '';
                $str = (string) $val;
                // If starts with =, +, -, @, prefix with a single quote
                if (preg_match('/^[=+\-@]/', $str)) {
                    return "'" . $str;
                }
                return $str;
            };

            $reports->chunk(100, function ($chunk) use ($handle, $sanitize) {
                foreach ($chunk as $r) {
                    fputcsv($handle, [
                        $r->id,
                        $sanitize($r->report_number),
                        $sanitize(strtoupper($r->status)),
                        $sanitize($r->accident_date?->format('Y-m-d')),
                        $sanitize($r->accident_time),
                        $sanitize($r->accident_type),
                        $sanitize($r->vehicles_involved),
                        $sanitize(ucfirst((string) $r->injury_severity)),
                        $sanitize($r->reporter_name),
                        $sanitize($r->reporter_contact),
                        $sanitize($r->location_address),
                        $sanitize($r->description),
                        $sanitize($r->assignedOfficer?->name ?? 'Unassigned'),
                        $sanitize($r->verifiedBy?->name ?? 'Unverified'),
                        $sanitize($r->verified_at?->format('Y-m-d H:i') ?? ''),
                        $sanitize($r->official_remarks),
                        $sanitize($r->created_at?->format('Y-m-d H:i')),
                    ]);
                }
            });

            fclose($handle);
        }, 200, $headers);
    }

    public function exportPdf(Request $request)
    {
        $admin = $request->user();

        // Same filters/search as the list and CSV exports. No hard row cap:
        // the template paginates, so nothing is silently dropped.
        $reports = $this->applyReportFilters(
            $request,
            AccidentReport::with(['assignedOfficer', 'verifiedBy', 'category'])
        )->orderByDesc('accident_date')->get();

        AuditLog::record($admin->id, 'export_pdf', 'AccidentReport', null, 'Exported accident reports to PDF');

        $pdf = Pdf::loadView('exports.accident_reports_pdf', [
            'reports' => $reports,
            'generated_at' => now()->format('F d, Y h:i A'),
            'admin_name' => $admin->name,
            'filters' => [
                'status' => $request->query('status'),
                'severity' => $request->query('severity'),
                'accident_type' => $request->query('accident_type'),
                'search' => $request->query('search'),
                'date_from' => $request->query('date_from'),
                'date_to' => $request->query('date_to'),
            ],
        ]);

        // Enables the inline page-number script in the template.
        $pdf->setOption('enable_php', true);
        // Embed only the glyphs actually used, keeping the download small.
        $pdf->setOption('enable_font_subsetting', true);
        $pdf->setPaper('a4', 'landscape');

        return $pdf->download('accident_reports_summary_' . date('Ymd_His') . '.pdf');
    }
}
