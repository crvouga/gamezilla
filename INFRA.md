# Infrastructure

## Hard Requirements

1. **Everything is managed declaratively with OpenTofu (IaC).**
2. **Web scale** — credible path to GitHub / YouTube / Chess.com scale without changing the fundamental architecture.
3. **Zero ops** — no servers, clusters, replicas, shards, or capacity to manage.
4. **No scale events** — growth should increase usage/cost, not require architectural changes or migrations.

## Stack

| Need | Service | Why |
|---|---|---|
| API / compute | **Cloudflare Workers** | Globally distributed serverless compute with no instances, regions, load balancers, or autoscaling to manage. |
| CDN / frontend | **Cloudflare CDN** | Global edge delivery where traffic growth requires no frontend infrastructure changes. |
| Stateful realtime / games | **Cloudflare Durable Objects** | Games/rooms naturally partition by ID; Cloudflare handles placement and horizontal scaling without servers or shards. |
| Object storage | **Cloudflare R2** | Elastic object storage with no disks, replicas, capacity, or egress infrastructure to manage. |
| SQL | **PlanetScale Neki (PostgreSQL)** | Horizontally scalable PostgreSQL with managed routing and resharding instead of application-managed database infrastructure. |
| Global query invalidation | **AWS IoT Core (MQTT)** | Managed global pub/sub; AWS owns connections, subscription routing, fan-out, brokers, and scaling. |

## Principle

> **Application code owns logical partitioning. Providers own physical scaling.**

The application deals only with concepts such as `gameId`, `queryHash`, database partition keys, and object keys — never servers, replicas, broker nodes, or physical shards.

MQTT is a fast invalidation signal, **not a source of truth**. Missed invalidations are recovered by the sync engine.