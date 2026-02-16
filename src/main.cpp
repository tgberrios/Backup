#include "backup/backup_manager.h"
#include "backup/backup_scheduler.h"
#include "core/database_config.h"
#include "core/env_loader.h"
#include "core/logger.h"
#include "json.hpp"
#include <chrono>
#include <csignal>
#include <fstream>
#include <iostream>
#include <thread>

int main(int argc, char* argv[]) {
  EnvLoader::loadDefault();

  if (argc < 2) {
    std::cerr << "Usage: Backup backup <create|schedule> [config_json]\n";
    return 1;
  }
  if (std::string(argv[1]) != "backup") {
    std::cerr << "Usage: Backup backup <create|schedule> [config_json]\n";
    return 1;
  }
  if (argc < 3) {
    std::cerr << "Usage: Backup backup <create|schedule>\n";
    return 1;
  }

  std::string command = argv[2];

  if (command == "create") {
    if (argc < 4) {
      std::cerr << "Usage: Backup backup create <config_json>\n";
      return 1;
    }
    try {
      std::ifstream config_file(argv[3]);
      if (!config_file.is_open()) {
        std::cerr << "Error: Cannot open config file: " << argv[3] << "\n";
        return 1;
      }
      nlohmann::json config_json;
      config_file >> config_json;

      BackupConfig config;
      config.backup_name = config_json["backup_name"];
      config.db_engine = config_json["db_engine"];
      config.connection_string = config_json["connection_string"];
      config.database_name = config_json["database_name"];
      config.backup_type =
          BackupManager::parseBackupType(config_json["backup_type"]);
      config.file_path = config_json["file_path"];

      auto start_time = std::chrono::steady_clock::now();
      BackupResult result = BackupManager::createBackup(config);
      auto end_time = std::chrono::steady_clock::now();
      int duration = std::chrono::duration_cast<std::chrono::seconds>(
                         end_time - start_time)
                         .count();

      nlohmann::json output;
      output["success"] = result.success;
      output["file_path"] = result.file_path;
      output["file_size"] = result.file_size;
      output["duration_seconds"] = duration;
      if (!result.success) {
        output["error_message"] = result.error_message;
      }
      std::cout << output.dump(2) << "\n";
      return result.success ? 0 : 1;
    } catch (const std::exception& e) {
      std::cerr << "Error: " << e.what() << "\n";
      return 1;
    }
  }

  if (command == "schedule") {
    DatabaseConfig::loadFromEnv();
    if (!DatabaseConfig::isInitialized()) {
      std::cerr << "Error: Database configuration failed to initialize. Set POSTGRES_* or use backup.env / .env\n";
      return 1;
    }
    Logger::initialize();
    BackupScheduler::start();

    std::signal(SIGINT, [](int) {
      BackupScheduler::stop();
      std::exit(0);
    });
    std::signal(SIGTERM, [](int) {
      BackupScheduler::stop();
      std::exit(0);
    });

    while (BackupScheduler::isRunning()) {
      std::this_thread::sleep_for(std::chrono::seconds(1));
    }
    Logger::shutdown();
    return 0;
  }

  std::cerr << "Unknown backup command: " << command << "\n";
  return 1;
}
