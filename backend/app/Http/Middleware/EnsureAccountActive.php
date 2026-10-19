<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Blocks every authenticated request from an account an administrator has
 * deactivated.
 *
 * This runs on the whole auth:sanctum group, not just role-gated routes, so a
 * token issued before deactivation cannot keep working.
 *
 * Tokens are deliberately NOT revoked here. Leaving them resolvable is what
 * lets this middleware answer with the clear inactive message, instead of
 * Sanctum failing first with a generic 401 Unauthenticated.
 */
class EnsureAccountActive
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user && !$user->is_active) {
            return response()->json([
                'success' => false,
                'message' => 'Your account is inactive. Please contact the administrator for assistance.',
            ], 403);
        }

        return $next($request);
    }
}