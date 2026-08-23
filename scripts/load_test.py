#!/usr/bin/env python3
"""Concurrent GET load test against the running API. hey/wrk-equivalent, no binary needed."""

from __future__ import annotations

import argparse
import asyncio
import statistics
import time

import httpx


async def _worker(client: httpx.AsyncClient, url: str, n: int, latencies: list[float], errors: list[str]) -> None:
    for _ in range(n):
        start = time.perf_counter()
        try:
            resp = await client.get(url)
            latencies.append(time.perf_counter() - start)
            if resp.status_code != 200:
                errors.append(f"status={resp.status_code}")
        except Exception as exc:  # noqa: BLE001
            errors.append(str(exc))


async def run(url: str, concurrency: int, requests_per_worker: int) -> None:
    latencies: list[float] = []
    errors: list[str] = []
    async with httpx.AsyncClient(timeout=30.0) as client:
        started = time.perf_counter()
        await asyncio.gather(
            *(_worker(client, url, requests_per_worker, latencies, errors) for _ in range(concurrency))
        )
        wall = time.perf_counter() - started

    total = concurrency * requests_per_worker
    ok = len(latencies)
    print(f"url={url}")
    print(f"total_requests={total} ok={ok} errors={len(errors)} wall_seconds={wall:.3f}")
    if latencies:
        latencies.sort()
        p50 = statistics.median(latencies)
        p95 = latencies[int(len(latencies) * 0.95) - 1]
        p99 = latencies[int(len(latencies) * 0.99) - 1]
        print(f"req_per_sec={ok / wall:.2f}")
        print(f"latency_ms min={min(latencies)*1000:.1f} p50={p50*1000:.1f} p95={p95*1000:.1f} p99={p99*1000:.1f} max={max(latencies)*1000:.1f}")
    if errors:
        print(f"sample_errors={errors[:5]}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("url")
    parser.add_argument("--concurrency", type=int, default=20)
    parser.add_argument("--requests-per-worker", type=int, default=25)
    args = parser.parse_args()
    asyncio.run(run(args.url, args.concurrency, args.requests_per_worker))


if __name__ == "__main__":
    main()
