<?php

namespace App\Http\Controllers\Api\v1;

use App\Http\Controllers\Controller;
use App\Models\AccidentCategory;
use App\Models\AuditLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class CategoryController extends Controller
{
    public function index(): JsonResponse
    {
        $categories = AccidentCategory::where('is_active', true)
            ->withCount('reports')
            ->orderBy('name')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $categories,
        ]);
    }

    public function all(): JsonResponse
    {
        $categories = AccidentCategory::withCount('reports')
            ->orderBy('name')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $categories,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:150', 'unique:accident_categories,name'],
            'description' => ['nullable', 'string', 'max:500'],
            'is_active' => ['boolean'],
        ]);

        $category = AccidentCategory::create([
            'name' => $validated['name'],
            'slug' => Str::slug($validated['name']),
            'description' => $validated['description'] ?? null,
            'is_active' => $validated['is_active'] ?? true,
        ]);

        AuditLog::record($request->user()?->id, 'create_category', 'AccidentCategory', $category->id, "Created category: {$category->name}");

        return response()->json([
            'success' => true,
            'message' => 'Category created successfully.',
            'data' => $category,
        ], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $category = AccidentCategory::findOrFail($id);

        $validated = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:150', "unique:accident_categories,name,{$id}"],
            'description' => ['nullable', 'string', 'max:500'],
            'is_active' => ['boolean'],
        ]);

        if (isset($validated['name'])) {
            $category->name = $validated['name'];
            $category->slug = Str::slug($validated['name']);
        }
        if (array_key_exists('description', $validated)) {
            $category->description = $validated['description'];
        }
        if (array_key_exists('is_active', $validated)) {
            $category->is_active = $validated['is_active'];
        }

        $category->save();

        AuditLog::record($request->user()?->id, 'update_category', 'AccidentCategory', $category->id, "Updated category: {$category->name}");

        return response()->json([
            'success' => true,
            'message' => 'Category updated successfully.',
            'data' => $category,
        ]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $category = AccidentCategory::withCount('reports')->findOrFail($id);

        if ($category->reports_count > 0) {
            return response()->json([
                'success' => false,
                'message' => "Cannot delete category '{$category->name}' because it has {$category->reports_count} linked accident reports. You may deactivate it instead.",
            ], 422);
        }

        $category->delete();

        AuditLog::record($request->user()?->id, 'delete_category', 'AccidentCategory', $id, "Deleted category: {$category->name}");

        return response()->json([
            'success' => true,
            'message' => 'Category deleted successfully.',
        ]);
    }
}
