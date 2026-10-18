
/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

CREATE DATABASE /*!32312 IF NOT EXISTS*/ `accident_reporting_db` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci */;

USE `accident_reporting_db`;
DROP TABLE IF EXISTS `accident_categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `accident_categories` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `slug` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `accident_categories_name_unique` (`name`),
  UNIQUE KEY `accident_categories_slug_unique` (`slug`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `accident_categories` WRITE;
/*!40000 ALTER TABLE `accident_categories` DISABLE KEYS */;
INSERT INTO `accident_categories` VALUES (1,'Rear-end Collision','rear-end-collision','Vehicle collides with the rear of the vehicle ahead of it.',1,'2026-10-18 03:45:36','2026-10-18 03:45:36'),(2,'Head-on Collision','head-on-collision','Front ends of two vehicles hit each other in opposite directions.',1,'2026-10-18 03:45:36','2026-10-18 03:45:36'),(3,'Side-impact / T-Bone','side-impact-t-bone','Vehicle is hit on its side by the front or rear of another vehicle.',1,'2026-10-18 03:45:36','2026-10-18 03:45:36'),(4,'Hit-and-Run Incident','hit-and-run','Driver collides with a vehicle, person, or property and flees the scene.',1,'2026-10-18 03:45:36','2026-10-18 03:45:36'),(5,'Rollover Accident','rollover','Vehicle overturns onto its side or roof, commonly due to high speed or sharp turn.',1,'2026-10-18 03:45:36','2026-10-18 03:45:36'),(6,'Pedestrian or Cyclist Accident','pedestrian-cyclist','Incident involving motorized vehicles and pedestrians or non-motorized bicycles.',1,'2026-10-18 03:45:36','2026-10-18 03:45:36'),(7,'Motorcycle Collision / Spill','motorcycle-collision','Accident involving two-wheel or three-wheel motorcycles or tricycles.',1,'2026-10-18 03:45:36','2026-10-18 03:45:36'),(8,'Single-Vehicle Run-off-Road','single-vehicle-runoff','Vehicle leaves the roadway and collides with guardrails, trees, or ditches.',1,'2026-10-18 03:45:36','2026-10-18 03:45:36');
/*!40000 ALTER TABLE `accident_categories` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `accident_photos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `accident_photos` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `accident_report_id` bigint(20) unsigned NOT NULL,
  `file_path` varchar(255) NOT NULL,
  `file_name` varchar(255) NOT NULL,
  `original_name` varchar(255) DEFAULT NULL,
  `file_size` bigint(20) unsigned NOT NULL,
  `mime_type` varchar(255) NOT NULL,
  `caption` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `accident_photos_accident_report_id_foreign` (`accident_report_id`),
  CONSTRAINT `accident_photos_accident_report_id_foreign` FOREIGN KEY (`accident_report_id`) REFERENCES `accident_reports` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `accident_photos` WRITE;
/*!40000 ALTER TABLE `accident_photos` DISABLE KEYS */;
/*!40000 ALTER TABLE `accident_photos` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `accident_reports`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `accident_reports` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `report_number` varchar(255) NOT NULL,
  `user_id` bigint(20) unsigned DEFAULT NULL,
  `category_id` bigint(20) unsigned DEFAULT NULL,
  `reporter_name` varchar(255) NOT NULL,
  `reporter_contact` varchar(255) DEFAULT NULL,
  `accident_date` date NOT NULL,
  `accident_time` time NOT NULL,
  `location_address` varchar(255) NOT NULL,
  `latitude` decimal(10,7) DEFAULT NULL,
  `longitude` decimal(10,7) DEFAULT NULL,
  `accident_type` varchar(255) NOT NULL,
  `vehicles_involved` int(10) unsigned NOT NULL DEFAULT 1,
  `injury_severity` enum('none','minor','severe','fatal','unknown') NOT NULL DEFAULT 'unknown',
  `description` text NOT NULL,
  `status` enum('submitted','under_review','additional_info_required','verified','assigned','in_progress','closed','rejected') NOT NULL DEFAULT 'submitted',
  `rejection_reason` text DEFAULT NULL,
  `additional_info_notes` text DEFAULT NULL,
  `assigned_officer_id` bigint(20) unsigned DEFAULT NULL,
  `verified_by` bigint(20) unsigned DEFAULT NULL,
  `verified_at` timestamp NULL DEFAULT NULL,
  `official_remarks` text DEFAULT NULL,
  `investigation_findings` text DEFAULT NULL,
  `actions_taken` text DEFAULT NULL,
  `closed_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `accident_reports_report_number_unique` (`report_number`),
  KEY `accident_reports_user_id_foreign` (`user_id`),
  KEY `accident_reports_category_id_foreign` (`category_id`),
  KEY `accident_reports_assigned_officer_id_foreign` (`assigned_officer_id`),
  KEY `accident_reports_verified_by_foreign` (`verified_by`),
  KEY `accident_reports_accident_date_index` (`accident_date`),
  KEY `accident_reports_accident_type_index` (`accident_type`),
  KEY `accident_reports_status_index` (`status`),
  CONSTRAINT `accident_reports_assigned_officer_id_foreign` FOREIGN KEY (`assigned_officer_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `accident_reports_category_id_foreign` FOREIGN KEY (`category_id`) REFERENCES `accident_categories` (`id`) ON DELETE SET NULL,
  CONSTRAINT `accident_reports_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `accident_reports_verified_by_foreign` FOREIGN KEY (`verified_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `accident_reports` WRITE;
/*!40000 ALTER TABLE `accident_reports` DISABLE KEYS */;
INSERT INTO `accident_reports` VALUES (1,'AR-202610-0001',4,1,'Maria Dela Cruz','+63 918 777 8899','2026-10-14','08:30:00','MacArthur Highway, Barangay Dakila, Malolos, Bulacan (Near BSU Gate 3)',14.8587120,120.8143890,'Rear-end Collision',2,'minor','White Toyota Vios was rear-ended by a passenger jeepney while stopping for pedestrian crossing. Minor bumper and headlight damage.','closed',NULL,NULL,2,1,'2026-10-14 01:15:00','Cleared by Traffic Enforcer Unit. Parties agreed on amicable settlement for repair damages.','Brake failure on the trailing vehicle due to wet road conditions.','Towed vehicle to shoulder, traffic resumed smoothly after 20 minutes.','2026-10-14 03:30:00',NULL,'2026-10-18 03:45:37','2026-10-18 03:45:37'),(2,'AR-202610-0002',5,7,'Juan Luna','+63 929 112 3344','2026-10-15','14:20:00','Plaridel Bypass Road, Barangay Tiaong, Guiguinto, Bulacan',14.8321040,120.8791550,'Motorcycle Collision / Spill',1,'minor','Motorcycle slipped on gravel along outer lane. Rider wearing helmet sustained abrasions on knees and elbows.','in_progress',NULL,NULL,2,1,'2026-10-15 07:00:00','Assigned to Officer Santos for roadside debris inspection and report validation.','Loose aggregate from nearby construction without warning markers.','Barangay patrol contacted DPWH sub-district to sweep lane.',NULL,NULL,'2026-10-18 03:45:37','2026-10-18 03:45:37'),(3,'AR-202610-0003',4,4,'Maria Dela Cruz','+63 918 777 8899','2026-10-16','19:45:00','Bocaue Flyover, Barangay Wakas, Bocaue, Bulacan',14.7989300,120.9284100,'Hit-and-Run Incident',2,'severe','Dark gray pickup truck side-swiped a delivery motorcycle and sped towards NLEX entry without stopping. Rider transported to Bulacan Medical Center.','assigned',NULL,NULL,3,1,'2026-10-16 12:10:00','High-priority hit-and-run. CCTV footage requested from Bocaue Command Center.',NULL,'Flash alarm sent to toll plaza security.',NULL,NULL,'2026-10-18 03:45:37','2026-10-18 03:45:37'),(4,'AR-202610-0004',5,3,'Juan Luna','+63 929 112 3344','2026-10-17','07:15:00','Crossing Intersection, Barangay Poblacion, Pulilan, Bulacan',14.9023400,120.8512100,'Side-impact / T-Bone',2,'none','Delivery van beat the yellow light and struck side door of sedan. Both drivers safe, vehicle doors dented.','verified',NULL,NULL,NULL,1,'2026-10-16 23:45:00','Verified via traffic camera footage. Pending officer deployment.',NULL,NULL,NULL,NULL,'2026-10-18 03:45:37','2026-10-18 03:45:37'),(5,'AR-202610-0005',4,6,'Maria Dela Cruz','+63 918 777 8899','2026-10-17','08:50:00','Paseo del Congreso, Barangay Catmon, Malolos, Bulacan',14.8511200,120.8174500,'Pedestrian or Cyclist Accident',1,'minor','Bicycle struck curb avoiding oncoming tricycle on narrow shoulder. Cyclist received first aid from nearby pharmacy.','submitted',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-18 03:45:37','2026-10-18 03:45:37'),(6,'AR-202610-0006',NULL,1,'Anonymous Citizen','09150001122','2026-10-16','23:10:00','Near Marilao Exit, NLEX northbound',14.7645000,120.9612000,'Rear-end Collision',2,'unknown','Saw two cars collided on shoulder lane with hazards blinking. One tow truck arriving.','under_review',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-18 03:45:37','2026-10-18 03:45:37'),(7,'AR-202610-0007',5,8,'Juan Luna','+63 929 112 3344','2026-10-13','12:00:00','Old bridge road',14.8400000,120.8200000,'Single-Vehicle Run-off-Road',1,'none','Test submission with incomplete information.','rejected','Report was identified as a test entry with duplicate coordinates and insufficient incident evidence.',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-10-18 03:45:37','2026-10-18 03:45:37');
/*!40000 ALTER TABLE `accident_reports` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `audit_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `audit_logs` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned DEFAULT NULL,
  `action` varchar(255) NOT NULL,
  `target_type` varchar(255) DEFAULT NULL,
  `target_id` bigint(20) unsigned DEFAULT NULL,
  `description` text DEFAULT NULL,
  `changes_payload` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`changes_payload`)),
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `audit_logs_user_id_foreign` (`user_id`),
  KEY `audit_logs_action_index` (`action`),
  KEY `audit_logs_target_type_index` (`target_type`),
  KEY `audit_logs_target_id_index` (`target_id`),
  CONSTRAINT `audit_logs_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `audit_logs` WRITE;
/*!40000 ALTER TABLE `audit_logs` DISABLE KEYS */;
INSERT INTO `audit_logs` VALUES (1,1,'verify_report','AccidentReport',1,'Verified accident report AR-202610-0001',NULL,'127.0.0.1','Symfony','2026-10-18 03:45:37','2026-10-18 03:45:37'),(2,1,'verify_report','AccidentReport',2,'Verified accident report AR-202610-0002',NULL,'127.0.0.1','Symfony','2026-10-18 03:45:37','2026-10-18 03:45:37'),(3,1,'verify_report','AccidentReport',3,'Verified accident report AR-202610-0003',NULL,'127.0.0.1','Symfony','2026-10-18 03:45:37','2026-10-18 03:45:37'),(4,1,'verify_report','AccidentReport',4,'Verified accident report AR-202610-0004',NULL,'127.0.0.1','Symfony','2026-10-18 03:45:37','2026-10-18 03:45:37');
/*!40000 ALTER TABLE `audit_logs` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `cache`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cache` (
  `key` varchar(255) NOT NULL,
  `value` mediumtext NOT NULL,
  `expiration` int(11) NOT NULL,
  PRIMARY KEY (`key`),
  KEY `cache_expiration_index` (`expiration`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `cache` WRITE;
/*!40000 ALTER TABLE `cache` DISABLE KEYS */;
/*!40000 ALTER TABLE `cache` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `cache_locks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cache_locks` (
  `key` varchar(255) NOT NULL,
  `owner` varchar(255) NOT NULL,
  `expiration` int(11) NOT NULL,
  PRIMARY KEY (`key`),
  KEY `cache_locks_expiration_index` (`expiration`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `cache_locks` WRITE;
/*!40000 ALTER TABLE `cache_locks` DISABLE KEYS */;
/*!40000 ALTER TABLE `cache_locks` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `failed_jobs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `failed_jobs` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `uuid` varchar(255) NOT NULL,
  `connection` text NOT NULL,
  `queue` text NOT NULL,
  `payload` longtext NOT NULL,
  `exception` longtext NOT NULL,
  `failed_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `failed_jobs_uuid_unique` (`uuid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `failed_jobs` WRITE;
/*!40000 ALTER TABLE `failed_jobs` DISABLE KEYS */;
/*!40000 ALTER TABLE `failed_jobs` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `job_batches`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `job_batches` (
  `id` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `total_jobs` int(11) NOT NULL,
  `pending_jobs` int(11) NOT NULL,
  `failed_jobs` int(11) NOT NULL,
  `failed_job_ids` longtext NOT NULL,
  `options` mediumtext DEFAULT NULL,
  `cancelled_at` int(11) DEFAULT NULL,
  `created_at` int(11) NOT NULL,
  `finished_at` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `job_batches` WRITE;
/*!40000 ALTER TABLE `job_batches` DISABLE KEYS */;
/*!40000 ALTER TABLE `job_batches` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `jobs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `jobs` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `queue` varchar(255) NOT NULL,
  `payload` longtext NOT NULL,
  `attempts` tinyint(3) unsigned NOT NULL,
  `reserved_at` int(10) unsigned DEFAULT NULL,
  `available_at` int(10) unsigned NOT NULL,
  `created_at` int(10) unsigned NOT NULL,
  PRIMARY KEY (`id`),
  KEY `jobs_queue_index` (`queue`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `jobs` WRITE;
/*!40000 ALTER TABLE `jobs` DISABLE KEYS */;
/*!40000 ALTER TABLE `jobs` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `migrations` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `migration` varchar(255) NOT NULL,
  `batch` int(11) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `migrations` WRITE;
/*!40000 ALTER TABLE `migrations` DISABLE KEYS */;
INSERT INTO `migrations` VALUES (1,'0001_01_01_000000_create_users_table',1),(2,'0001_01_01_000001_create_cache_table',1),(3,'0001_01_01_000002_create_jobs_table',1),(4,'2026_10_17_000001_create_accident_categories_table',1),(5,'2026_10_17_000002_create_accident_reports_table',1),(6,'2026_10_17_000003_create_accident_photos_table',1),(7,'2026_10_17_000004_create_report_status_history_table',1),(8,'2026_10_17_000005_create_officer_assignments_table',1),(9,'2026_10_17_000006_create_audit_logs_table',1),(10,'2026_10_17_000007_create_system_notifications_table',1),(11,'2026_10_17_021201_create_personal_access_tokens_table',1);
/*!40000 ALTER TABLE `migrations` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `officer_assignments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `officer_assignments` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `accident_report_id` bigint(20) unsigned NOT NULL,
  `officer_id` bigint(20) unsigned NOT NULL,
  `assigned_by` bigint(20) unsigned DEFAULT NULL,
  `assignment_notes` text DEFAULT NULL,
  `status` enum('active','completed','reassigned') NOT NULL DEFAULT 'active',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `officer_assignments_accident_report_id_foreign` (`accident_report_id`),
  KEY `officer_assignments_officer_id_foreign` (`officer_id`),
  KEY `officer_assignments_assigned_by_foreign` (`assigned_by`),
  CONSTRAINT `officer_assignments_accident_report_id_foreign` FOREIGN KEY (`accident_report_id`) REFERENCES `accident_reports` (`id`) ON DELETE CASCADE,
  CONSTRAINT `officer_assignments_assigned_by_foreign` FOREIGN KEY (`assigned_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `officer_assignments_officer_id_foreign` FOREIGN KEY (`officer_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `officer_assignments` WRITE;
/*!40000 ALTER TABLE `officer_assignments` DISABLE KEYS */;
INSERT INTO `officer_assignments` VALUES (1,1,2,1,'Investigate incident location and contact parties involved.','completed','2026-10-18 03:45:37','2026-10-18 03:45:37'),(2,2,2,1,'Investigate incident location and contact parties involved.','active','2026-10-18 03:45:37','2026-10-18 03:45:37'),(3,3,3,1,'Investigate incident location and contact parties involved.','active','2026-10-18 03:45:37','2026-10-18 03:45:37');
/*!40000 ALTER TABLE `officer_assignments` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `password_reset_tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `password_reset_tokens` (
  `email` varchar(255) NOT NULL,
  `token` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `password_reset_tokens` WRITE;
/*!40000 ALTER TABLE `password_reset_tokens` DISABLE KEYS */;
/*!40000 ALTER TABLE `password_reset_tokens` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `personal_access_tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `personal_access_tokens` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `tokenable_type` varchar(255) NOT NULL,
  `tokenable_id` bigint(20) unsigned NOT NULL,
  `name` text NOT NULL,
  `token` varchar(64) NOT NULL,
  `abilities` text DEFAULT NULL,
  `last_used_at` timestamp NULL DEFAULT NULL,
  `expires_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `personal_access_tokens_token_unique` (`token`),
  KEY `personal_access_tokens_tokenable_type_tokenable_id_index` (`tokenable_type`,`tokenable_id`),
  KEY `personal_access_tokens_expires_at_index` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `personal_access_tokens` WRITE;
/*!40000 ALTER TABLE `personal_access_tokens` DISABLE KEYS */;
/*!40000 ALTER TABLE `personal_access_tokens` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `report_status_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `report_status_history` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `accident_report_id` bigint(20) unsigned NOT NULL,
  `user_id` bigint(20) unsigned DEFAULT NULL,
  `from_status` varchar(255) NOT NULL,
  `to_status` varchar(255) NOT NULL,
  `remarks` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `report_status_history_accident_report_id_foreign` (`accident_report_id`),
  KEY `report_status_history_user_id_foreign` (`user_id`),
  CONSTRAINT `report_status_history_accident_report_id_foreign` FOREIGN KEY (`accident_report_id`) REFERENCES `accident_reports` (`id`) ON DELETE CASCADE,
  CONSTRAINT `report_status_history_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `report_status_history` WRITE;
/*!40000 ALTER TABLE `report_status_history` DISABLE KEYS */;
INSERT INTO `report_status_history` VALUES (1,1,4,'none','submitted','Initial incident report submitted.','2026-10-18 03:45:37','2026-10-18 03:45:37'),(2,1,1,'submitted','closed','Cleared by Traffic Enforcer Unit. Parties agreed on amicable settlement for repair damages.','2026-10-18 03:45:37','2026-10-18 03:45:37'),(3,2,5,'none','submitted','Initial incident report submitted.','2026-10-18 03:45:37','2026-10-18 03:45:37'),(4,2,1,'submitted','in_progress','Assigned to Officer Santos for roadside debris inspection and report validation.','2026-10-18 03:45:37','2026-10-18 03:45:37'),(5,3,4,'none','submitted','Initial incident report submitted.','2026-10-18 03:45:37','2026-10-18 03:45:37'),(6,3,1,'submitted','assigned','High-priority hit-and-run. CCTV footage requested from Bocaue Command Center.','2026-10-18 03:45:37','2026-10-18 03:45:37'),(7,4,5,'none','submitted','Initial incident report submitted.','2026-10-18 03:45:37','2026-10-18 03:45:37'),(8,4,1,'submitted','verified','Verified via traffic camera footage. Pending officer deployment.','2026-10-18 03:45:37','2026-10-18 03:45:37'),(9,5,4,'none','submitted','Initial incident report submitted.','2026-10-18 03:45:37','2026-10-18 03:45:37'),(10,6,1,'none','submitted','Initial incident report submitted.','2026-10-18 03:45:37','2026-10-18 03:45:37'),(11,6,1,'submitted','under_review','Administrative status progression.','2026-10-18 03:45:37','2026-10-18 03:45:37'),(12,7,5,'none','submitted','Initial incident report submitted.','2026-10-18 03:45:37','2026-10-18 03:45:37'),(13,7,1,'submitted','rejected','Report was identified as a test entry with duplicate coordinates and insufficient incident evidence.','2026-10-18 03:45:37','2026-10-18 03:45:37');
/*!40000 ALTER TABLE `report_status_history` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sessions` (
  `id` varchar(255) NOT NULL,
  `user_id` bigint(20) unsigned DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `payload` longtext NOT NULL,
  `last_activity` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `sessions_user_id_index` (`user_id`),
  KEY `sessions_last_activity_index` (`last_activity`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `sessions` WRITE;
/*!40000 ALTER TABLE `sessions` DISABLE KEYS */;
/*!40000 ALTER TABLE `sessions` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `system_notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `system_notifications` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NOT NULL,
  `title` varchar(255) NOT NULL,
  `message` text NOT NULL,
  `type` varchar(255) NOT NULL DEFAULT 'info',
  `link` varchar(255) DEFAULT NULL,
  `is_read` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `system_notifications_user_id_foreign` (`user_id`),
  KEY `system_notifications_is_read_index` (`is_read`),
  CONSTRAINT `system_notifications_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `system_notifications` WRITE;
/*!40000 ALTER TABLE `system_notifications` DISABLE KEYS */;
INSERT INTO `system_notifications` VALUES (1,4,'Report Closed: AR-202610-0001','Your reported incident at MacArthur Highway has been resolved and closed.','status_change','/reports/1',0,'2026-10-18 03:45:37','2026-10-18 03:45:37'),(2,2,'New Assignment: AR-202610-0002','You have been assigned to investigate an incident at Plaridel Bypass Road.','assignment','/officer/reports/2',0,'2026-10-18 03:45:37','2026-10-18 03:45:37'),(3,1,'New Incident Submitted: AR-202610-0005','Maria Dela Cruz submitted a new incident in Barangay Catmon, Malolos.','info','/admin/reports/5',0,'2026-10-18 03:45:37','2026-10-18 03:45:37');
/*!40000 ALTER TABLE `system_notifications` ENABLE KEYS */;
UNLOCK TABLES;
DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `users` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `phone` varchar(255) DEFAULT NULL,
  `role` enum('admin','officer','reporter') NOT NULL DEFAULT 'reporter',
  `badge_number` varchar(255) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `email_verified_at` timestamp NULL DEFAULT NULL,
  `password` varchar(255) NOT NULL,
  `remember_token` varchar(100) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_email_unique` (`email`),
  KEY `users_role_index` (`role`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'Chief Admin Bautista','admin@roadwatch.gov','+63 917 111 2233','admin',NULL,1,NULL,'$2y$12$cXsg2QG4qjL0NYEcBEnGMutw43mtPfNW815qWYEiPgs3pkBX/tDui',NULL,'2026-10-18 03:45:36','2026-10-18 03:45:36'),(2,'Officer Marco Santos','officer.santos@traffic.gov','+63 920 333 4455','officer','PO3-8821',1,NULL,'$2y$12$lLDdTjQNmpKwmhUAVs/5TuMcmAWYu9cbUQ8tNPpgeIBktLs8UILtu',NULL,'2026-10-18 03:45:36','2026-10-18 03:45:36'),(3,'Officer Elena Reyes','officer.reyes@traffic.gov','+63 922 555 6677','officer','PO2-4912',1,NULL,'$2y$12$zqs9socvVJXFYPPsmONQmuBXDtBm0oDNCG51wy0jmQa6xfsUA22nq',NULL,'2026-10-18 03:45:36','2026-10-18 03:45:36'),(4,'Maria Dela Cruz','maria.delacruz@gmail.com','+63 918 777 8899','reporter',NULL,1,NULL,'$2y$12$CaBtiprAnNPK72GxITn2de/0CfNhZHlsD2352E15iGalujQfPACkO',NULL,'2026-10-18 03:45:37','2026-10-18 03:45:37'),(5,'Juan Luna','juan.luna@gmail.com','+63 929 112 3344','reporter',NULL,1,NULL,'$2y$12$AF.08.pRVm46I5xJdkBcA.xHOrqVZueBQIQqmFG/Q4lc5sWjMCF/.',NULL,'2026-10-18 03:45:37','2026-10-18 03:45:37');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

