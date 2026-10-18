<?php

use App\Http\Controllers\Api\v1\AccidentReportController;
use App\Http\Controllers\Api\v1\AdminController;
use App\Http\Controllers\Api\v1\AuthController;
use App\Http\Controllers\Api\v1\CategoryController;
use App\Http\Controllers\Api\v1\NotificationController;
use App\Http\Controllers\Api\v1\OfficerController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {
    // ------------------------------------------------------------------------
    // Public Endpoints
    // ------------------------------------------------------------------------
    Route::post('/auth/register', [AuthController::class, 'register']);
    Route::post('/auth/login', [AuthController::class, 'login']);

    Route::get('/categories', [CategoryController::class, 'index']);
    Route::post('/reports', [AccidentReportController::class, 'store']);
    Route::get('/reports/public-map', [AccidentReportController::class, 'publicMap']);
    Route::get('/photos/{id}/file', [AccidentReportController::class, 'photoFile']);

    // ------------------------------------------------------------------------
    // Authenticated Endpoints (Sanctum)
    // ------------------------------------------------------------------------
    Route::middleware('auth:sanctum')->group(function () {
        // Auth & Profile
        Route::post('/auth/logout', [AuthController::class, 'logout']);
        Route::get('/auth/me', [AuthController::class, 'me']);
        Route::put('/auth/profile', [AuthController::class, 'updateProfile']);

        // Reporter / Common Reports
        Route::get('/my-reports', [AccidentReportController::class, 'myReports']);
        Route::get('/reports/{id}', [AccidentReportController::class, 'show']);
        Route::put('/reports/{id}/supplement', [AccidentReportController::class, 'supplement']);

        // Notifications
        Route::get('/notifications', [NotificationController::class, 'index']);
        Route::put('/notifications/{id}/read', [NotificationController::class, 'markAsRead']);
        Route::post('/notifications/mark-all-read', [NotificationController::class, 'markAllAsRead']);

        // --------------------------------------------------------------------
        // Administrator Portal (role:admin)
        // --------------------------------------------------------------------
        Route::middleware('role:admin')->prefix('admin')->group(function () {
            Route::get('/dashboard/stats', [AdminController::class, 'dashboardStats']);
            Route::get('/reports', [AdminController::class, 'reports']);
            Route::put('/reports/{id}/verify', [AdminController::class, 'verifyReport']);
            Route::put('/reports/{id}/reject', [AdminController::class, 'rejectReport']);
            Route::put('/reports/{id}/assign', [AdminController::class, 'assignOfficer']);
            Route::put('/reports/{id}/request-info', [AdminController::class, 'requestInfo']);
            Route::put('/reports/{id}/close', [AdminController::class, 'closeReport']);
            Route::delete('/reports/{id}', [AdminController::class, 'softDelete']);

            // User & Officer Management
            Route::get('/users', [AdminController::class, 'users']);
            Route::put('/users/{id}/role', [AdminController::class, 'updateUserRole']);
            Route::get('/officers', [AdminController::class, 'officers']);

            // Category Management
            Route::get('/categories', [CategoryController::class, 'all']);
            Route::post('/categories', [CategoryController::class, 'store']);
            Route::put('/categories/{id}', [CategoryController::class, 'update']);
            Route::delete('/categories/{id}', [CategoryController::class, 'destroy']);

            // Audit Logs & Exports
            Route::get('/audit-logs', [AdminController::class, 'auditLogs']);
            Route::get('/exports/csv', [AdminController::class, 'exportCsv']);
            Route::get('/exports/pdf', [AdminController::class, 'exportPdf']);
        });

        // --------------------------------------------------------------------
        // Traffic Officer Portal (role:officer)
        // --------------------------------------------------------------------
        Route::middleware('role:officer')->prefix('officer')->group(function () {
            Route::get('/dashboard/stats', [OfficerController::class, 'dashboardStats']);
            Route::get('/assigned-reports', [OfficerController::class, 'assignedReports']);
            Route::put('/reports/{id}/status', [OfficerController::class, 'updateStatus']);
        });
    });
});
