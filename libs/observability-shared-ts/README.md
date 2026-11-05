# Shared observability contracts

Domain-event pseudonyms, telemetry secret names, service identity and HTTP route
groups used by product runtime live here. SLO evaluation, alert generation and
operational runbooks are owned by
[`observability-slo-shared-ts`](../observability-slo-shared-ts/README.md).

Keeping the operational code separate prevents alert edits from invalidating
every domain package that emits telemetry.
