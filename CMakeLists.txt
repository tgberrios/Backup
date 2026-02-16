cmake_minimum_required(VERSION 3.16)
project(Backup CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

include_directories(
  ${CMAKE_SOURCE_DIR}/include
  ${CMAKE_SOURCE_DIR}/third_party
)

add_executable(Backup
  src/main.cpp
  src/core/logger.cpp
  src/core/database_config.cpp
  src/core/env_loader.cpp
  src/backup/backup_manager.cpp
  src/backup/backup_scheduler.cpp
)

target_link_libraries(Backup PRIVATE pqxx)

set_target_properties(Backup PROPERTIES
  RUNTIME_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}
)
