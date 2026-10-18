<?php

namespace App\Http\Controllers\Api\v1;

use App\Http\Controllers\Controller;
use App\Models\AccidentReport;
use App\Models\AuditLog;
use App\Models\OfficerAssignment;
use App\Models\ReportStatusHistory;
use App\Models\SystemNotification;
use App\Models\User;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AdminController extends Controller
{
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

        $reports = $query->paginate($request->query('per_page', 10));

        return response()->json([
            'success' => true,
            'data' => $reports,
        ]);
    }

    public function verifyReport(Request $request, int $id): JsonResponse
    {
        $report = AccidentReport::findOrFail($id);
        $admin = $request->user();

        if (!AccidentReport::canTransition($report->status, 'verified')) {
            return response()->json([
                'success' => false,
                'message' => "Cannot transition report from '{$report->status}' to 'verified'.",
            ], 422);
        }

        $validated = $request->validate([
            'official_remarks' => ['nullable', 'string', 'max:1000'],
        ]);

        DB::transaction(function () use ($report, $admin, $validated) {
            $oldStatus = $report->status;
            $report->status = 'verified';
            $report->verified_by = $admin->id;
            $report->verified_at = now();
            if (!empty($validated['official_remarks'])) {
                $report->official_remarks = $validated['official_remarks'];
            }
            $report->save();

            ReportStatusHistory::create([
                'accident_report_id' => $report->id,
                'user_id' => $admin->id,
                'from_status' => $oldStatus,
                'to_status' => 'verified',
                'remarks' => $validated['official_remarks'] ?? 'Report verified by administrator.',
            ]);

            AuditLog::record(
                $admin->id,
                'verify_report',
                'AccidentReport',
                $report->id,
                "Admin {$admin->name} officially verified report {$report->report_number}"
            );

            if ($report->user_id) {
                SystemNotification::notify(
                    $report->user_id,
                    "Report Verified: {$report->report_number}",
                    'Your reported accident has been reviewed and officially verified by authorities.',
                    'status_change',
                    "/reports/{$report->id}"
                );
            }
        });

        $report->load(['category', 'photos', 'verifiedBy', 'statusHistory']);

        return response()->json([
            'success' => true,
            'message' => 'Report verified successfully.',
            'data' => $report,
        ]);
    }

    public function rejectReport(Request $request, int $id): JsonResponse
    {
        $report = AccidentReport::findOrFail($id);
        $admin = $request->user();

        if (!AccidentReport::canTransition($report->status, 'rejected')) {
            return response()->json([
                'success' => false,
                'message' => "Cannot transition report from '{$report->status}' to 'rejected'.",
            ], 422);
        }

        // Section 7 Requirement: Require rejection reason when rejecting reports
        $validated = $request->validate([
            'rejection_reason' => ['required', 'string', 'min:10', 'max:1000'],
        ]);

        DB::transaction(function () use ($report, $admin, $validated) {
            $oldStatus = $report->status;
            $report->status = 'rejected';
            $report->rejection_reason = $validated['rejection_reason'];
            $report->save();

            ReportStatusHistory::create([
                'accident_report_id' => $report->id,
                'user_id' => $admin->id,
                'from_status' => $oldStatus,
                'to_status' => 'rejected',
                'remarks' => $validated['rejection_reason'],
            ]);

            AuditLog::record(
                $admin->id,
                'reject_report',
                'AccidentReport',
                $report->id,
                "Admin {$admin->name} rejected report {$report->report_number}: {$validated['rejection_reason']}"
            );

            if ($report->user_id) {
                SystemNotification::notify(
                    $report->user_id,
                    "Report Rejected: {$report->report_number}",
                    "Your report was rejected. Reason: {$validated['rejection_reason']}",
                    'rejection',
                    "/reports/{$report->id}"
                );
            }
        });

        $report->load(['category', 'photos', 'statusHistory']);

        return response()->json([
            'success' => true,
            'message' => 'Report rejected and reason recorded.',
            'data' => $report,
        ]);
    }

    public function assignOfficer(Request $request, int $id): JsonResponse
    {
        $report = AccidentReport::findOrFail($id);
        $admin = $request->user();

        $validated = $request->validate([
            'officer_id' => ['required', 'exists:users,id'],
            'assignment_notes' => ['nullable', 'string', 'max:1000'],
        ]);

        $officer = User::where('id', $validated['officer_id'])->where('role', 'officer')->firstOrFail();

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

    public function softDelete(Request $request, int $id): JsonResponse
    {
        $report = AccidentReport::findOrFail($id);
        $admin = $request->user();

        $report->delete(); // Soft delete as required in spec section 3

        AuditLog::record(
            $admin->id,
            'archive_report',
            'AccidentReport',
            $id,
            "Soft-deleted/archived accident report {$report->report_number}"
        );

        return response()->json([
            'success' => true,
            'message' => "Report {$report->report_number} has been archived.",
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
        $targetUser->role = $validated['role'];
        if (array_key_exists('badge_number', $validated)) {
            $targetUser->badge_number = $validated['badge_number'];
        }
        if (array_key_exists('is_active', $validated)) {
            $targetUser->is_active = $validated['is_active'];
        }
        $targetUser->save();

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

    public function auditLogs(Request $request): JsonResponse
    {
        $query = AuditLog::with('user')->orderByDesc('created_at');

        if ($request->filled('action')) {
            $query->where('action', $request->query('action'));
        }

        if ($request->filled('search')) {
            $search = $request->query('search');
            $query->where(function ($q) use ($search) {
                $q->where('description', 'LIKE', "%{$search}%")
                  ->orWhere('ip_address', 'LIKE', "%{$search}%");
            });
        }

        $logs = $query->paginate(20);

        return response()->json([
            'success' => true,
            'data' => $logs,
        ]);
    }

    public function exportCsv(Request $request): StreamedResponse
    {
        $admin = $request->user();
        AuditLog::record($admin->id, 'export_csv', 'AccidentReport', null, 'Exported accident reports to CSV');

        $headers = [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => 'attachment; filename="accident_reports_' . date('Ymd_His') . '.csv"',
        ];

        return response()->stream(function () use ($request) {
            $handle = fopen('php://output', 'w');

            // Header Row
            fputcsv($handle, [
                'Report Number',
                'Status',
                'Accident Date',
                'Accident Time',
                'Location Address',
                'Accident Type',
                'Vehicles Involved',
                'Injury Severity',
                'Reporter Name',
                'Reporter Contact',
                'Assigned Officer',
                'Verified By',
                'Verified At',
                'Official Remarks',
            ]);

            // Query with same filters as admin
            $query = AccidentReport::with(['assignedOfficer', 'verifiedBy'])->orderByDesc('created_at');

            if ($request->filled('status')) {
                $query->where('status', $request->query('status'));
            }
            if ($request->filled('date_from')) {
                $query->whereDate('accident_date', '>=', $request->query('date_from'));
            }
            if ($request->filled('date_to')) {
                $query->whereDate('accident_date', '<=', $request->query('date_to'));
            }

            // Function to sanitize CSV injection (RFC 4180 + formula prevention)
            $sanitize = function ($val) {
                if ($val === null) return '';
                $str = (string) $val;
                // If starts with =, +, -, @, prefix with a single quote
                if (preg_match('/^[=+\-@]/', $str)) {
                    return "'" . $str;
                }
                return $str;
            };

            $query->chunk(100, function ($reports) use ($handle, $sanitize) {
                foreach ($reports as $r) {
                    fputcsv($handle, [
                        $sanitize($r->report_number),
                        $sanitize(strtoupper($r->status)),
                        $sanitize($r->accident_date?->format('Y-m-d')),
                        $sanitize($r->accident_time),
                        $sanitize($r->location_address),
                        $sanitize($r->accident_type),
                        $sanitize($r->vehicles_involved),
                        $sanitize(ucfirst($r->injury_severity)),
                        $sanitize($r->reporter_name),
                        $sanitize($r->reporter_contact),
                        $sanitize($r->assignedOfficer?->name ?? 'Unassigned'),
                        $sanitize($r->verifiedBy?->name ?? 'Unverified'),
                        $sanitize($r->verified_at?->format('Y-m-d H:i') ?? ''),
                        $sanitize($r->official_remarks),
                    ]);
                }
            });

            fclose($handle);
        }, 200, $headers);
    }

    public function exportPdf(Request $request)
    {
        $admin = $request->user();
        AuditLog::record($admin->id, 'export_pdf', 'AccidentReport', null, 'Exported accident reports to PDF');

        $query = AccidentReport::with(['assignedOfficer', 'verifiedBy', 'category'])
            ->orderByDesc('accident_date');

        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
        }
        if ($request->filled('date_from')) {
            $query->whereDate('accident_date', '>=', $request->query('date_from'));
        }
        if ($request->filled('date_to')) {
            $query->whereDate('accident_date', '<=', $request->query('date_to'));
        }

        $reports = $query->limit(150)->get();

        $pdf = Pdf::loadView('exports.accident_reports_pdf', [
            'reports' => $reports,
            'generated_at' => now()->format('F d, Y h:i A'),
            'admin_name' => $admin->name,
            'filters' => [
                'status' => $request->query('status', 'All'),
                'date_from' => $request->query('date_from', 'Start'),
                'date_to' => $request->query('date_to', 'End'),
            ],
        ]);

        return $pdf->download('accident_reports_summary_' . date('Ymd_His') . '.pdf');
    }

    public function closeReport(Request $request, int $id): JsonResponse
    {
        $report = AccidentReport::findOrFail($id);
        $admin = $request->user();

        $validated = $request->validate([
            'actions_taken' => ['nullable', 'string', 'max:2000'],
            'official_remarks' => ['nullable', 'string', 'max:1000'],
        ]);

        DB::transaction(function () use ($report, $admin, $validated) {
            $oldStatus = $report->status;
            $report->status = 'closed';
            $report->closed_at = now();
            if (!empty($validated['official_remarks'])) {
                $report->official_remarks = $validated['official_remarks'];
            }
            if (!empty($validated['actions_taken'])) {
                $report->actions_taken = $validated['actions_taken'];
            }
            $report->save();

            ReportStatusHistory::create([
                'accident_report_id' => $report->id,
                'user_id' => $admin->id,
                'from_status' => $oldStatus,
                'to_status' => 'closed',
                'remarks' => 'Case closed and resolved by administrator. ' . ($validated['official_remarks'] ?? ''),
            ]);

            AuditLog::record(
                $admin->id,
                'close_report',
                'AccidentReport',
                $report->id,
                "Admin {$admin->name} closed report {$report->report_number}"
            );

            if ($report->user_id) {
                SystemNotification::notify(
                    $report->user_id,
                    "Case Resolved & Closed: {$report->report_number}",
                    "Your incident report has been officially resolved and closed: " . ($validated['actions_taken'] ?? $validated['official_remarks'] ?? 'Incident resolved by traffic management authorities.'),
                    'status_change',
                    "/reports/{$report->id}"
                );
            }
        });

        $report->load(['category', 'photos', 'assignedOfficer', 'verifiedBy', 'statusHistory']);

        return response()->json([
            'success' => true,
            'message' => 'Report closed and resolved successfully.',
            'data' => $report,
        ]);
    }
}
