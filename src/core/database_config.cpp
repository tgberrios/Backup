#include "core/database_config.h"
#include <cctype>
#include <cstdlib>
#include <cstring>

std::string DatabaseConfig::postgres_host_ = "localhost";
std::string DatabaseConfig::postgres_db_ = "postgres";
std::string DatabaseConfig::postgres_user_ = "postgres";
std::string DatabaseConfig::postgres_password_;
std::string DatabaseConfig::postgres_port_ = "5432";
bool DatabaseConfig::initialized_ = false;
std::mutex DatabaseConfig::configMutex_;

namespace {
bool validateAndSetPort(const std::string& portStr, std::string& targetPort) {
  if (portStr.empty() || portStr.length() > 5) return false;
  for (char c : portStr) {
    if (!std::isdigit(static_cast<unsigned char>(c))) return false;
  }
  try {
    int portNum = std::stoi(portStr);
    if (portNum > 0 && portNum <= 65535) {
      targetPort = portStr;
      return true;
    }
  } catch (const std::exception&) {}
  return false;
}
}  // namespace

std::string DatabaseConfig::escapeConnectionParam(const std::string& param) {
  if (param.empty()) return param;
  bool needsQuoting = false;
  for (char c : param) {
    if (c == ' ' || c == '\'' || c == '\\' || c == '=') {
      needsQuoting = true;
      break;
    }
  }
  if (!needsQuoting) return param;
  std::string escaped;
  escaped.reserve(param.length() + 2);
  escaped += '\'';
  for (char c : param) {
    if (c == '\'' || c == '\\') escaped += '\\';
    escaped += c;
  }
  escaped += '\'';
  return escaped;
}

void DatabaseConfig::loadFromEnvUnlocked() {
  const char* host = std::getenv("POSTGRES_HOST");
  const char* port = std::getenv("POSTGRES_PORT");
  const char* db = std::getenv("POSTGRES_DB");
  const char* user = std::getenv("POSTGRES_USER");
  const char* password = std::getenv("POSTGRES_PASSWORD");
  if (host && strlen(host) > 0) postgres_host_ = host;
  if (port && strlen(port) > 0) {
    std::string portStr(port);
    validateAndSetPort(portStr, postgres_port_);
  }
  if (db && strlen(db) > 0) postgres_db_ = db;
  if (user && strlen(user) > 0) postgres_user_ = user;
  if (password) postgres_password_ = password;
  initialized_ = true;
}

void DatabaseConfig::loadFromEnv() {
  std::lock_guard<std::mutex> lock(configMutex_);
  loadFromEnvUnlocked();
}
