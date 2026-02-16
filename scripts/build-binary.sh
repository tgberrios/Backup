#!/usr/bin/env sh
# Build the C++ Backup binary. Run from project root. Requires: cmake, make, libpqxx, C++17.
# Skips build if build/Backup already exists (set BUILD_BINARY=1 to force rebuild).
set -e
cd "$(dirname "$0")/.."
if [ -f build/Backup ] && [ -z "$BUILD_BINARY" ]; then
  echo "Binary build/Backup exists, skipping build."
  exit 0
fi
mkdir -p build
cd build
cmake .. -DCMAKE_BUILD_TYPE=Release
cmake --build . -- -j$(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 2)
echo "Binary: $(pwd)/Backup"
