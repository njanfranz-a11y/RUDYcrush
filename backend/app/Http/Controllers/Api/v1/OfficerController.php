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

    public function updateStatus(Request $request, int $id): JsonResponse
    {
        $officer = $request->user();
        $report = AccidentReport::where('id', $id)
            ->where(function ($q) use ($officer) {
                $q->where('assigned_officer_id', $officer->id)
                  ->orWhereNull('assigned_officer_id');
            })
            ->firstOrFail();

        $validated = $request->validate([
            'status' => ['required', 'in:verified,in_progress,closed'],
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

            if (empty($report->assigned_officer_id)) {
                $report->assigned_officer_id = $officer->id;
            }

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
            if ($newStatus === 'verified') {
                $report->verified_by = $officer->id;
                $report->verified_at = now();
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
                } elseif ($newStatus === 'verified') {
                    $title = "Report Verified: {$report->report_number}";
                    $msg = "Officer {$officer->name} has verified your incident report." . (!empty($validated['official_remarks']) ? ' Remarks: ' . $validated['official_remarks'] : '');
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
