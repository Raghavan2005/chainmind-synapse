#!/bin/sh
# Bind the API first so the load balancer health check can pass, then
# rebuild overlay from recent logs. Writer stays off unless a key is set.
set -eu
python -m services.ingest.watch &
exec uvicorn services.api.main:app --host 0.0.0.0 --port 8000
