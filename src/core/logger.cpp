#include "core/logger.h"
#include <ctime>

std::mutex Logger::logMutex_;
LogLevel Logger::currentLogLevel_ = LogLevel::INFO;

void Logger::initialize() {
  currentLogLevel_ = LogLevel::INFO;
}

void Logger::shutdown() {}

const char* Logger::levelString(LogLevel level) {
  switch (level) {
    case LogLevel::DEBUG: return "DEBUG";
    case LogLevel::INFO: return "INFO";
    case LogLevel::WARNING: return "WARNING";
    case LogLevel::ERROR: return "ERROR";
    case LogLevel::CRITICAL: return "CRITICAL";
    default: return "UNKNOWN";
  }
}

const char* Logger::categoryString(LogCategory category) {
  switch (category) {
    case LogCategory::SYSTEM: return "SYSTEM";
    case LogCategory::DATABASE: return "DATABASE";
    case LogCategory::CONFIG: return "CONFIG";
    default: return "UNKNOWN";
  }
}

void Logger::writeLog(LogLevel level, LogCategory category,
                     const std::string& function,
                     const std::string& message) {
  if (level < currentLogLevel_) return;
  std::lock_guard<std::mutex> lock(logMutex_);
  auto now = std::chrono::system_clock::now();
  auto t = std::chrono::system_clock::to_time_t(now);
  std::tm tm_buf;
  localtime_r(&t, &tm_buf);
  std::ostringstream oss;
  oss << "[" << std::put_time(&tm_buf, "%Y-%m-%d %H:%M:%S") << "] "
      << "[" << levelString(level) << "] [" << categoryString(category) << "]";
  if (!function.empty()) oss << " [" << function << "]";
  oss << " " << message << "\n";
  std::cerr << oss.str();
}

void Logger::info(LogCategory category, const std::string& function,
                  const std::string& message) {
  writeLog(LogLevel::INFO, category, function, message);
}

void Logger::warning(LogCategory category, const std::string& function,
                     const std::string& message) {
  writeLog(LogLevel::WARNING, category, function, message);
}

void Logger::error(LogCategory category, const std::string& function,
                   const std::string& message) {
  writeLog(LogLevel::ERROR, category, function, message);
}
