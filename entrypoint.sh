#!/bin/sh
set -eu

# Dokku injects PORT (defaults to 8000 locally / in the image).
exec deno serve -A --port "${PORT:-8000}" _fresh/server.js
