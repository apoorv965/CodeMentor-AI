#!/bin/bash
# Builds the three sandboxed execution images used by dockerExecutor.js.
# Run this once before starting the backend (and again whenever you
# change a Dockerfile under docker/<language>/).
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Building online-compiler-python..."
docker build -t online-compiler-python:latest "$SCRIPT_DIR/python"

echo "Building online-compiler-cpp..."
docker build -t online-compiler-cpp:latest "$SCRIPT_DIR/cpp"

echo "Building online-compiler-java..."
docker build -t online-compiler-java:latest "$SCRIPT_DIR/java"

echo "All execution images built successfully:"
docker images | grep online-compiler
