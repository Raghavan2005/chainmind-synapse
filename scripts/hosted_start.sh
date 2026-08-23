#!/bin/sh
# Single-box host. Ingest runs in-process when HOSTED_INGEST=1 (see API lifespan).
# Do not fork a second interpreter — that OOMs App Runner and fails health.
set -eu
export HOSTED_INGEST="${HOSTED_INGEST:-1}"
exec uvicorn services.api.main:app --host 0.0.0.0 --port 8000
