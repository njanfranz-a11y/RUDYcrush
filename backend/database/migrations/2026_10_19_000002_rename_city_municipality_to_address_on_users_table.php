<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The citizen's location field is a free-text address rather than a
     * fixed city/municipality pick, so rename and widen it.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->renameColumn('city_municipality', 'address');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->string('address', 255)->nullable()->after('phone')->change();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('address', 100)->nullable()->after('phone')->change();
        });

        Schema::table('users', function (Blueprint $table) {
            $table->renameColumn('address', 'city_municipality');
        });
    }
};