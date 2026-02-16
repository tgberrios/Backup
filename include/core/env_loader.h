#ifndef BACKUP_CORE_ENV_LOADER_H
#define BACKUP_CORE_ENV_LOADER_H

#include <string>

// Loads KEY=value lines from a file and sets them in the environment (setenv).
// Used before DatabaseConfig so POSTGRES_* etc. are available.
namespace EnvLoader {

// Load from the given path. Lines: KEY=value; # comment; empty lines skipped.
// Returns true if the file was opened and read (even if no valid lines).
bool loadFromFile(const std::string& path);

// Try backup.env then .env in the current directory. Stops at first found and loaded.
void loadDefault();

}  // namespace EnvLoader

#endif
