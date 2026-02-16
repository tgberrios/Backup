#ifndef BACKUP_UTILS_STRING_UTILS_H
#define BACKUP_UTILS_STRING_UTILS_H

#include <algorithm>
#include <cctype>
#include <string>
#include <string_view>

namespace StringUtils {

inline std::string toLower(std::string_view str) {
  std::string result{str};
  std::transform(result.begin(), result.end(), result.begin(),
                 [](unsigned char c) { return std::tolower(c); });
  return result;
}

inline std::string trim(std::string_view str) {
  const auto start =
      std::find_if_not(str.begin(), str.end(),
                       [](unsigned char c) { return std::isspace(c); });
  const auto end =
      std::find_if_not(str.rbegin(), str.rend(),
                       [](unsigned char c) { return std::isspace(c); })
          .base();
  return (start < end) ? std::string(start, end) : std::string{};
}

}  // namespace StringUtils

#endif
