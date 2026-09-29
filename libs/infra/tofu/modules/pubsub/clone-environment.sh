#!/usr/bin/env bash
# Creates or deletes a Railway environment by duplicating another one. Run by
# `terraform_data.clone` in main.tf and by nothing else.
#
# Why this exists: the Railway provider's `railway_environment` (v0.6) can only
# create an EMPTY environment, which holds no instance of the shared `emqx`
# service — every later `customDomainCreate` fails with "ServiceInstance not
# found". Railway's own `environmentCreate` mutation takes a
# `sourceEnvironmentId`, and a duplicate does carry the service's instances
# (build, region, volume). Drop this file once the provider can clone.
#
#   clone-environment.sh create   duplicate $SOURCE as $NAME; a no-op when
#                                 $NAME already exists AND holds a service
#                                 instance; an EMPTY $NAME (what the provider
#                                 left behind) is deleted and cloned afresh —
#                                 it holds nothing to lose
#   clone-environment.sh delete   delete $NAME (never $SOURCE); a no-op when
#                                 it is gone
#
# Inputs (environment): RAILWAY_TOKEN (injected by `secrets-run`), PROJECT_ID,
# NAME, SOURCE; RAILWAY_GRAPHQL_URL overrides the endpoint (the test's fake).
set -euo pipefail

action="${1:?usage: clone-environment.sh create|delete}"
: "${RAILWAY_TOKEN:?RAILWAY_TOKEN is not set}"
: "${PROJECT_ID:?PROJECT_ID is not set}"
: "${NAME:?NAME is not set}"
: "${SOURCE:?SOURCE is not set}"
endpoint="${RAILWAY_GRAPHQL_URL:-https://backboard.railway.com/graphql/v2}"

# One GraphQL call: $1 = query, $2 = variables (JSON). Railway answers HTTP 200
# with an `errors` array on failure, so both are checked.
gql() {
  local body response
  body="$(jq -cn --arg q "$1" --argjson v "$2" '{query: $q, variables: $v}')"
  response="$(curl -fsS --max-time 60 --retry 3 --retry-all-errors \
    -H "Authorization: Bearer ${RAILWAY_TOKEN}" \
    -H 'Content-Type: application/json' \
    --data "$body" "$endpoint")"
  if [ "$(jq -r '(.errors // []) | length' <<<"$response")" != "0" ]; then
    echo "Railway API error: $(jq -c '.errors' <<<"$response")" >&2
    return 1
  fi
  printf '%s' "$response"
}

environment_id() {
  local response
  response="$(gql \
    'query($id: String!) { project(id: $id) { environments { edges { node { id name } } } } }' \
    "$(jq -cn --arg id "$PROJECT_ID" '{id: $id}')")"
  jq -r --arg n "$1" \
    '.data.project.environments.edges[].node | select(.name == $n) | .id' \
    <<<"$response" | head -n1
}

instance_count() {
  local response
  response="$(gql \
    'query($id: String!) { environment(id: $id) { serviceInstances { edges { node { serviceId } } } } }' \
    "$(jq -cn --arg id "$1" '{id: $id}')")"
  jq -r '.data.environment.serviceInstances.edges | length' <<<"$response"
}

refuse_protected() {
  if [ "$NAME" = "$SOURCE" ] || [ "$NAME" = "production" ]; then
    echo "refusing to $1 the Railway environment ${NAME}" >&2
    exit 1
  fi
}

delete_environment() {
  gql 'mutation($id: String!) { environmentDelete(id: $id) }' \
    "$(jq -cn --arg id "$1" '{id: $id}')" >/dev/null
}

case "$action" in
  create)
    refuse_protected replace
    existing="$(environment_id "$NAME")"
    if [ -n "$existing" ]; then
      count="$(instance_count "$existing")"
      if [ "$count" -gt 0 ]; then
        echo "railway environment ${NAME} already exists with ${count} service instance(s)"
        exit 0
      fi
      delete_environment "$existing"
      echo "railway environment ${NAME} (${existing}) held no service instance; deleted it to clone afresh"
    fi
    source_id="$(environment_id "$SOURCE")"
    if [ -z "$source_id" ]; then
      echo "Railway environment ${SOURCE} (the clone source) not found in project ${PROJECT_ID}" >&2
      exit 1
    fi
    gql \
      'mutation($input: EnvironmentCreateInput!) { environmentCreate(input: $input) { id name } }' \
      "$(jq -cn --arg p "$PROJECT_ID" --arg n "$NAME" --arg s "$source_id" \
        '{input: {projectId: $p, name: $n, sourceEnvironmentId: $s}}')" >/dev/null
    echo "railway environment ${NAME} cloned from ${SOURCE}"
    ;;
  delete)
    refuse_protected delete
    existing="$(environment_id "$NAME")"
    if [ -z "$existing" ]; then
      echo "railway environment ${NAME} is already gone"
      exit 0
    fi
    delete_environment "$existing"
    echo "railway environment ${NAME} deleted"
    ;;
  *)
    echo "unknown action: ${action}" >&2
    exit 2
    ;;
esac
