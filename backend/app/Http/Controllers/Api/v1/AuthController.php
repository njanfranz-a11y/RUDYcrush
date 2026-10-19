<?php

namespace App\Http\Controllers\Api\v1;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\User;
use App\Rules\PhilippineMobile;
use Illuminate\Validation\Rule;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function register(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users,email'],
            'phone' => ['nullable', 'string', new PhilippineMobile],
            'address' => ['required', 'string', 'min:5', 'max:255'],
            'password' => ['required', 'confirmed', Password::min(8)->letters()->numbers()],
        ], [
            'address.required' => 'Please enter your address.',
            'address.min' => 'Please enter a more complete address.',
        ]);

        $user = User::create([
            'name' => $validated['name'],
            'email' => strtolower($validated['email']),
            'phone' => $validated['phone'] ?? null,
            'address' => $validated['address'],
            'role' => 'reporter', // Strict public default
            'is_active' => true,
            'password' => Hash::make($validated['password']),
        ]);

        $token = $user->createToken('auth-token', ['role:reporter'])->plainTextToken;

        AuditLog::record($user->id, 'user_register', 'User', $user->id, "Citizen user registered: {$user->email}");

        return response()->json([
            'success' => true,
            'message' => 'Registration successful. Welcome to the Road Accident Reporting System.',
            'data' => [
                'user' => $user,
                'token' => $token,
            ],
        ], 201);
    }

    public function login(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $user = User::where('email', strtolower($validated['email']))->first();

        if (!$user || !Hash::check($validated['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['The provided credentials do not match our records.'],
            ]);
        }

        if (!$user->is_active) {
            // Clear any stale tokens so the block holds even if one was issued
            // before the account was deactivated.
            $user->tokens()->delete();

            return response()->json([
                'success' => false,
                'message' => 'Your account is inactive. Please contact the administrator for assistance.',
            ], 403);
        }

        // Revoke older tokens if any to keep session clean
        $user->tokens()->delete();

        $token = $user->createToken('auth-token', ["role:{$user->role}"])->plainTextToken;

        AuditLog::record($user->id, 'user_login', 'User', $user->id, "User logged in with role [{$user->role}]");

        return response()->json([
            'success' => true,
            'message' => 'Login successful.',
            'data' => [
                'user' => $user,
                'token' => $token,
            ],
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $user = $request->user();
        if ($user) {
            $user->currentAccessToken()->delete();
            AuditLog::record($user->id, 'user_logout', 'User', $user->id, 'User logged out');
        }

        return response()->json([
            'success' => true,
            'message' => 'Logged out successfully.',
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'success' => true,
            'data' => [
                'user' => $user,
                'unread_notifications' => $user->systemNotifications()->where('is_read', false)->count(),
            ],
        ]);
    }

    public function updateProfile(Request $request): JsonResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'phone' => ['nullable', 'string', new PhilippineMobile],
            'address' => ['sometimes', 'nullable', 'string', 'min:5', 'max:255'],
            'current_password' => ['required_with:new_password', 'nullable', 'string'],
            'new_password' => ['nullable', 'confirmed', Password::min(8)->letters()->numbers()],
        ]);

        if (!empty($validated['new_password'])) {
            if (!Hash::check($validated['current_password'], $user->password)) {
                throw ValidationException::withMessages([
                    'current_password' => ['Your current password does not match.'],
                ]);
            }
            $user->password = Hash::make($validated['new_password']);
        }

        if (isset($validated['name'])) {
            $user->name = $validated['name'];
        }
        if (array_key_exists('phone', $validated)) {
            $user->phone = $validated['phone'];
        }
        if (array_key_exists('address', $validated)) {
            $user->address = $validated['address'];
        }

        $user->save();

        AuditLog::record($user->id, 'update_profile', 'User', $user->id, 'User updated profile information');

        return response()->json([
            'success' => true,
            'message' => 'Profile updated successfully.',
            'data' => ['user' => $user],
        ]);
    }
}
