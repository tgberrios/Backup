#ifndef BACKUP_CORE_LOGGER_H
#define BACKUP_CORE_LOGGER_H

#include <chrono>
#include <iomanip>
#include <iostream>
#include <mutex>
#include <sstream>
#include <string>

enum class LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARNING = 2,
  ERROR = 3,
  CRITICAL = 4
};

enum class LogCategory {
  SYSTEM = 0,
  DATABASE = 1,
  CONFIG = 2,
  UNKNOWN = 99
};

class Logger {
public:
  static void initialize();
  static void shutdown();

  static void info(LogCategory category, const std::string& function,
                  const std::string& message);
  static void warning(LogCategory category, const std::string& function,
                     const std::string& message);
  static void error(LogCategory category, const std::string& function,
                   const std::string& message);

private:
  static std::mutex logMutex_;
  static LogLevel currentLogLevel_;

  static const char* levelString(LogLevel level);
  static const char* categoryString(LogCategory category);
  static void writeLog(LogLevel level, LogCategory category,
                       const std::string& function,
                       const std::string& message);
};

#endif
