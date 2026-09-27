@domain:health @observability
Feature: Traces
  Workers send traces to Grafana Cloud, and agents read them back from
  Tempo. Tokens OpenTofu just minted take a moment to work everywhere.

  Scenario: Traces go to the Grafana OTLP gateway
    Then the trace ingest address is the Grafana OTLP gateway

  Scenario: The Workers' write token can ingest traces
    Then the Workers' write token can ingest traces

  Scenario: The agents' read token can query Tempo
    Then the agents' read token can query Tempo
