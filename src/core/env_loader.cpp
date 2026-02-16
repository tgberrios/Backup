#include "core/env_loader.h"
#include <cstdlib>
#include <fstream>
#include <sstream>
#include <string>

namespace EnvLoader {

static void trim(std::string& s) {
  auto start = s.find_first_not_of(" \t\r\n");
  if (start == std::string::npos) {
    s.clear();
    return;
  }
  auto end = s.find_last_not_of(" \t\r\n");
  s = s.substr(start, end == std::string::npos ? std::string::npos : end - start + 1);
}

static bool setEnvVar(const std::string& key, const std::string& value) {
  if (key.empty()) return false;
#ifdef _WIN32
  std::string pair = key + "=" + value;
  return _putenv(pair.c_str()) == 0;
#else
  return setenv(key.c_str(), value.c_str(), 1) == 0;
#endif
}

bool loadFromFile(const std::string& path) {
  std::ifstream f(path);
  if (!f.is_open()) return false;
  std::string line;
  while (std::getline(f, line)) {
    trim(line);
    if (line.empty() || line[0] == '#') continue;
    size_t eq = line.find('=');
    if (eq == 0 || eq == std::string::npos) continue;
    std::string key = line.substr(0, eq);
    std::string value = line.substr(eq + 1);
    trim(key);
    trim(value);
    if (key.size() >= 7 && key.compare(0, 7, "export ") == 0) {
      key = key.substr(7);
      trim(key);
    }
    if (!key.empty()) setEnvVar(key, value);
  }
  return true;
}

void loadDefault() {
  if (loadFromFile("backup.env")) return;
  loadFromFile(".env");
}

}  // namespace EnvLoader
