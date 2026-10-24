<?php

namespace App\Http\Controllers\Api\v1;

use App\Http\Controllers\Controller;
use App\Models\AccidentReport;
use App\Models\AuditLog;
use App\Models\OfficerAssignment;
use App\Models\ReportStatusHistory;
use App\Models\SystemNotification;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class OfficerController extends Controller
{
    public function dashboardStats(Request $request): JsonResponse
    {
        $officer = $request->user();

        $assigned = AccidentReport::where('assigned_officer_id', $officer->id)->where('status', 'assigned')->count();
        $inProgress = AccidentReport::where('assigned_officer_id', $officer->id)->where('status', 'in_progress')->count();
        $closed = AccidentReport::where('assigned_officer_id', $officer->id)->where('status', 'closed')->count();
        $total = AccidentReport::where('assigned_officer_id', $officer->id)->count();

        $recent = AccidentReport::where('assigned_officer_id', $officer->id)
            ->with(['category', 'photos'])
            ->orderByDesc('updated_at')
            ->limit(5)
            ->get();

        return response()->json([
            'success' => true,
            'data' => [
                'counts' => [
                    'assigned' => $assigned,
                    'in_progress' => $inProgress,
                    'closed' => $closed,
                    'total' => $total,
                ],
                'recent_cases' => $recent,
            ],
        ]);
    }

    public function assignedReports(Request $request): JsonResponse
    {
        $officer = $request->user();

        $query = AccidentReport::where('assigned_officer_id', $officer->id)
            ->with(['category', 'photos', 'statusHistory'])
            ->orderByDesc('updated_at');

        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
        }

        if ($request->filled('search')) {
            $search = $request->query('search');
            $query->where(function ($q) use ($search) {
                $q->where('report_number', 'LIKE', "%{$search}%")
                  ->orWhere('location_address', 'LIKE', "%{$search}%")
                  ->orWhere('accident_type', 'LIKE', "%{$search}%");
            });
        }

        $reports = $query->paginate(10);

        return response()->json([
            'success' => true,
            'data' => $reports,
        ]);
    }

    /**
     * Reports the Admin has dispatched to this officer that still need an
     * officer decision. Only the assigned officer's own caseload is returned.
     */
    public function verificationQueue(Request $request): JsonResponse
    {
        $officer = $request->user();

        $query = AccidentReport::where('assigned_officer_id', $officer->id)
            ->where('status', 'assigned')
            ->with(['category', 'photos', 'statusHistory', 'assignedOfficer'])
            ->orderByDesc('created_at');

        if ($request->filled('search')) {
            $search = $request->query('search');
            $query->where(function ($q) use ($search) {
                $q->where('report_number', 'LIKE', "%{$search}%")
                  ->orWhere('reporter_name', 'LIKE', "%{$search}%")
                  ->orWhere('location_address', 'LIKE', "%{$search}%")
                  ->orWhere('accident_type', 'LIKE', "%{$search}%");
            });
        }

        return response()->json([
            'success' => true,
            'data' => $query->paginate($request->query('per_page', 10)),
        ]);
    }

    /**
     * Officer verification. This is the officer's own decision on a case the
     * admin assigned to them. Verification records the decision but does not
     * resolve the case or change ownership.
     */
    public function verifyReport(Request $request, int $id): JsonResponse
    {
        $officer = $request->user();

        $report = AccidentReport::where('id', $id)
            ->where('assigned_officer_id', $officer->id)
            ->firstOrFail();

        if (!AccidentReport::canTransition($report->status, 'verified')) {
            return response()->json([
                'success' => false,
                'message' => "Cannot verify a report in '{$report->status}' status.",
            ], 422);
        }

        $validated = $request->validate([
            'official_remarks' => ['nullable', 'string', 'max:1000'],
        ]);

        DB::transaction(function () use ($report, $officer, $validated) {
            $oldStatus = $report->status;

            $report->status = 'verified';
            $report->verified_by = $officer->id;
            $report->verified_at = now();
            if (!empty($validated['official_remarks'])) {
                $report->official_remarks = $validated['official_remarks'];
            }
            // Ownership is intentionally preserved: verification is a review
            // decision, not a re-dispatch, and it never closes the case.
            $report->save();

            ReportStatusHistory::create([
                'accident_report_id' => $report->id,
                'user_id' => $officer->id,
                'from_status' => $oldStatus,
                'to_status' => 'verified',
                'remarks' => "Verified by assigned Officer {$officer->name}. "
                    . ($validated['official_remarks'] ?? ''),
            ]);

            AuditLog::record(
                $officer->id,
                'verify_report',
                'AccidentReport',
                $report->id,
                "Officer {$officer->name} verified report {$report->report_number}"
            );

            if ($report->user_id) {
                SystemNotification::notify(
                    $report->user_id,
                    "Report Verified: {$report->report_number}",
                    "Traffic Officer {$officer->name} has verified your report. Investigation continues.",
                    'status_change',
                    "/reports/{$report->id}"
                );
            }

            $admins = User::where('role', 'admin')->get();
            foreach ($admins as $admin) {
                SystemNotification::notify(
                    $admin->id,
                    "Officer Verified Report: {$report->report_number}",
                    "Officer {$officer->name} verified the assigned report.",
                    'status_change',
                    "/admin/reports/{$report->id}"
                );
            }
        });

        $report->load(['category', 'photos', 'assignedOfficer', 'verifiedBy', 'statusHistory']);

        return response()->json([
            'success' => true,
            'message' => 'Report verified successfully.',
            'data' => $report,
        ]);
    }

    /**
     * Officer rejection. A written reason is mandatory and is attached to the
     * report history so the reporter and admin can see why it was turned down.
     */
    public function rejectReport(Request $request, int $id): JsonResponse
    {
        $officer = $request->user();

        $report = AccidentReport::where('id', $id)
            ->where('assigned_officer_id', $officer->id)
            ->firstOrFail();

        if (!AccidentReport::canTransition($report->status, 'rejected')) {
            return response()->json([
                'success' => false,
                'message' => "Cannot reject a report in '{$report->status}' status.",
            ], 422);
        }

        $validated = $request->validate([
            'rejection_reason' => ['required', 'string', 'min:10', 'max:1000'],
        ]);

        DB::transaction(function () use ($report, $officer, $validated) {
            $oldStatus = $report->status;

            $report->status = 'rejected';
            $report->rejection_reason = $validated['rejection_reason'];
            $report->save();

            ReportStatusHistory::create([
                'accident_report_id' => $report->id,
                'user_id' => $officer->id,
                'from_status' => $oldStatus,
                'to_status' => 'rejected',
                'remarks' => "Rejected by assigned Officer {$officer->name}: {$validated['rejection_reason']}",
            ]);

            AuditLog::record(
                $officer->id,
                'reject_report',
                'AccidentReport',
                $report->id,
                "Officer {$officer->name} rejected report {$report->report_number}: {$validated['rejection_reason']}"
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

            $admins = User::where('role', 'admin')->get();
            foreach ($admins as $admin) {
                SystemNotification::notify(
                    $admin->id,
                    "Officer Rejected Report: {$report->report_number}",
                    "Officer {$officer->name} rejected the assigned report: {$validated['rejection_reason']}",
                    'rejection',
                    "/admin/reports/{$report->id}"
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

    public function updateStatus(Request $request, int $id): JsonResponse
    {
        $officer = $request->user();

        // Officers may only act on cases the Admin has assigned to them.
        // Verification, rejection and assignment are not officer-owned
        // actions here, so an officer must never reach an unassigned report.
        $report = AccidentReport::where('id', $id)
            ->where('assigned_officer_id', $officer->id)
            ->firstOrFail();

        // Investigation updates only make sense once the assigned officer has
        // verified the case. Verification itself uses the dedicated endpoint.
        if (!in_array($report->status, ['verified', 'in_progress'], true)) {
            return response()->json([
                'success' => false,
                'message' => 'Verify this report before recording investigation updates.',
            ], 422);
        }

        $validated = $request->validate([
            'status' => ['required', 'in:in_progress,closed'],
            'official_remarks' => ['nullable', 'string', 'max:1000'],
            'investigation_findings' => ['required_if:status,closed', 'nullable', 'string', 'max:2000'],
            'actions_taken' => ['required_if:status,closed', 'nullable', 'string', 'max:2000'],
        ]);

        if (!AccidentReport::canTransition($report->status, $validated['status'])) {
            return response()->json([
                'success' => false,
                'message' => "Invalid transition from current status '{$report->status}' to '{$validated['status']}'.",
            ], 422);
        }

        DB::transaction(function () use ($report, $officer, $validated) {
            $oldStatus = $report->status;
            $newStatus = $validated['status'];

            $report->status = $newStatus;
            if (!empty($validated['official_remarks'])) {
                $report->official_remarks = $validated['official_remarks'];
            }
            if (!empty($validated['investigation_findings'])) {
                $report->investigation_findings = $validated['investigation_findings'];
            }
            if (!empty($validated['actions_taken'])) {
                $report->actions_taken = $validated['actions_taken'];
            }
            if ($newStatus === 'closed') {
                $report->closed_at = now();
                OfficerAssignment::where('accident_report_id', $report->id)
                    ->where('officer_id', $officer->id)
                    ->update(['status' => 'completed']);
            }
            $report->save();

            ReportStatusHistory::create([
                'accident_report_id' => $report->id,
                'user_id' => $officer->id,
                'from_status' => $oldStatus,
                'to_status' => $newStatus,
                'remarks' => "Status updated by Officer {$officer->name}. " . ($validated['official_remarks'] ?? ''),
            ]);

            AuditLog::record(
                $officer->id,
                'officer_update_status',
                'AccidentReport',
                $report->id,
                "Officer {$officer->name} transitioned report {$report->report_number} to [{$newStatus}]"
            );

            // Notify Reporter
            if ($report->user_id) {
                if ($newStatus === 'closed') {
                    $title = "Case Resolved & Closed: {$report->report_number}";
                    $msg = "Investigation concluded: " . ($validated['actions_taken'] ?? $validated['investigation_findings'] ?? 'Report officially resolved and road cleared.');
                } else {
                    $title = "Investigation Underway: {$report->report_number}";
                    $msg = "Officer {$officer->name} has started field investigation." . (!empty($validated['official_remarks']) ? ' Remarks: ' . $validated['official_remarks'] : '');
                }

                SystemNotification::notify($report->user_id, $title, $msg, 'status_change', "/reports/{$report->id}");
            }

            // Notify Admins
            $admins = User::where('role', 'admin')->get();
            foreach ($admins as $admin) {
                SystemNotification::notify(
                    $admin->id,
                    "Officer Updated Report: {$report->report_number}",
                    "Officer {$officer->name} updated status to [{$newStatus}]",
                    'status_change',
                    "/admin/reports/{$report->id}"
                );
            }
        });

        $report->load(['category', 'photos', 'statusHistory']);

        return response()->json([
            'success' => true,
            'message' => "Report status successfully updated to {$validated['status']}.",
            'data' => $report,
        ]);
    }
}
