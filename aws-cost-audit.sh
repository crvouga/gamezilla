#!/usr/bin/env bash
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
RESET='\033[0m'

header() { printf "\n${BOLD}${CYAN}═══════════════════════════════════════════════════════════════${RESET}\n  ${BOLD}$1${RESET}\n${BOLD}${CYAN}═══════════════════════════════════════════════════════════════${RESET}\n\n"; }
section() { printf "${YELLOW}── $1 ──${RESET}\n"; }
ok() { printf "  ${GREEN}✓${RESET} $1\n"; }
warn() { printf "  ${RED}✗${RESET} ${RED}$1${RESET}\n"; }
info() { printf "  ${DIM}$1${RESET}\n"; }
cost_line() { printf "  %-40s %s\n" "$1" "$2"; }

TODAY=$(date -u +%Y-%m-%d)
MONTH_START=$(date -u +%Y-%m-01)
MONTH_END=$(date -u -v+1m +%Y-%m-01 2>/dev/null || date -u -d "+1 month" +%Y-%m-01)
LAST_MONTH_START=$(date -u -v-1m +%Y-%m-01 2>/dev/null || date -u -d "-1 month" +%Y-%m-01)
CURRENT_MONTH=$(date -u +%B\ %Y)

REGIONS=("us-east-1" "us-east-2" "us-west-1" "us-west-2" "eu-west-1" "eu-central-1" "ap-southeast-1" "ap-northeast-1")
TOTAL_RESOURCES=0
TOTAL_WARNINGS=0

count_resource() {
  local count=$1
  local label=$2
  if [[ $count -gt 0 ]]; then
    warn "$count $label"
    TOTAL_WARNINGS=$((TOTAL_WARNINGS + count))
  else
    ok "No $label"
  fi
  TOTAL_RESOURCES=$((TOTAL_RESOURCES + count))
}

# ─── identity ───────────────────────────────────────────────────────────────────

header "AWS Cost & Resource Audit — $CURRENT_MONTH"

section "Account Identity"
IDENTITY=$(aws sts get-caller-identity --output json 2>/dev/null || echo "{}")
ACCOUNT=$(echo "$IDENTITY" | jq -r '.Account // "unknown"')
ARN=$(echo "$IDENTITY" | jq -r '.Arn // "unknown"')
info "Account:  $ACCOUNT"
info "Identity: $ARN"
printf "\n"

# ─── current month costs ────────────────────────────────────────────────────────

header "Current Month Costs ($CURRENT_MONTH)"

section "Total spend this month"
MONTH_COST=$(aws ce get-cost-and-usage \
  --time-period Start="$MONTH_START",End="$TODAY" \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --output json 2>/dev/null || echo '{}')

TOTAL=$(echo "$MONTH_COST" | jq -r '.ResultsByTime[0].Total.BlendedCost.Amount // "0"' 2>/dev/null || echo "0")
printf "  ${BOLD}Month-to-date: \$%.2f${RESET}\n\n" "$TOTAL"

section "Cost breakdown by service"
SERVICE_COSTS=$(aws ce get-cost-and-usage \
  --time-period Start="$MONTH_START",End="$TODAY" \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --group-by Type=DIMENSION,Key=SERVICE \
  --output json 2>/dev/null || echo '{}')

echo "$SERVICE_COSTS" | jq -r '
  .ResultsByTime[0].Groups[]
  | select((.Metrics.BlendedCost.Amount | tonumber) > 0.001)
  | [.Keys[0], .Metrics.BlendedCost.Amount]
  | @tsv' 2>/dev/null | sort -t$'\t' -k2 -rn | while IFS=$'\t' read -r svc amt; do
    printf "  ${BOLD}\$%8.2f${RESET}  %s\n" "$amt" "$svc"
done
printf "\n"

# ─── last month costs ───────────────────────────────────────────────────────────

section "Last month total"
LAST_COST=$(aws ce get-cost-and-usage \
  --time-period Start="$LAST_MONTH_START",End="$MONTH_START" \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --output json 2>/dev/null || echo '{}')

LAST_TOTAL=$(echo "$LAST_COST" | jq -r '.ResultsByTime[0].Total.BlendedCost.Amount // "0"' 2>/dev/null || echo "0")
printf "  Last month: \$%.2f\n\n" "$LAST_TOTAL"

# ─── forecast ────────────────────────────────────────────────────────────────────

section "Forecast for rest of month"
FORECAST=$(aws ce get-cost-forecast \
  --time-period Start="$TODAY",End="$MONTH_END" \
  --granularity MONTHLY \
  --metric BLENDED_COST \
  --output json 2>/dev/null || echo '{}')

FORECAST_AMT=$(echo "$FORECAST" | jq -r '.Total.Amount // "N/A"' 2>/dev/null || echo "N/A")
if [[ "$FORECAST_AMT" != "N/A" ]]; then
  printf "  ${BOLD}Projected month-end total: \$%.2f${RESET}\n\n" "$FORECAST_AMT"
else
  info "Forecast unavailable (not enough data or no spend)"
  printf "\n"
fi

# ─── daily cost trend (last 14 days) ────────────────────────────────────────────

section "Daily cost trend (last 14 days)"
FOURTEEN_AGO=$(date -u -v-14d +%Y-%m-%d 2>/dev/null || date -u -d "-14 days" +%Y-%m-%d)
DAILY_COSTS=$(aws ce get-cost-and-usage \
  --time-period Start="$FOURTEEN_AGO",End="$TODAY" \
  --granularity DAILY \
  --metrics BlendedCost \
  --output json 2>/dev/null || echo '{}')

echo "$DAILY_COSTS" | jq -r '
  .ResultsByTime[]
  | [.TimePeriod.Start, .Total.BlendedCost.Amount]
  | @tsv' 2>/dev/null | while IFS=$'\t' read -r day amt; do
    bar_len=$(echo "$amt" | awk '{printf "%d", $1 * 20}')
    bar=""
    for ((i=0; i<bar_len && i<50; i++)); do bar+="█"; done
    printf "  %s  \$%6.2f  %s\n" "$day" "$amt" "$bar"
done
printf "\n"

# ─── resource scan ───────────────────────────────────────────────────────────────

header "Active Resources (potential cost sources)"

for REGION in "${REGIONS[@]}"; do
  HAS_RESOURCES=false
  OUTPUT=""

  # EC2 instances
  EC2=$(aws ec2 describe-instances --region "$REGION" \
    --filters "Name=instance-state-name,Values=running,stopped" \
    --query 'Reservations[].Instances[].[InstanceId,InstanceType,State.Name,Tags[?Key==`Name`].Value|[0]]' \
    --output json 2>/dev/null || echo '[]')
  EC2_COUNT=$(echo "$EC2" | jq 'length' 2>/dev/null || echo 0)

  # RDS instances
  RDS=$(aws rds describe-db-instances --region "$REGION" \
    --query 'DBInstances[].[DBInstanceIdentifier,DBInstanceClass,DBInstanceStatus,Engine]' \
    --output json 2>/dev/null || echo '[]')
  RDS_COUNT=$(echo "$RDS" | jq 'length' 2>/dev/null || echo 0)

  # ELBv2 load balancers
  ALB=$(aws elbv2 describe-load-balancers --region "$REGION" \
    --query 'LoadBalancers[].[LoadBalancerName,Type,State.Code]' \
    --output json 2>/dev/null || echo '[]')
  ALB_COUNT=$(echo "$ALB" | jq 'length' 2>/dev/null || echo 0)

  # Classic ELBs
  CLB=$(aws elb describe-load-balancers --region "$REGION" \
    --query 'LoadBalancerDescriptions[].LoadBalancerName' \
    --output json 2>/dev/null || echo '[]')
  CLB_COUNT=$(echo "$CLB" | jq 'length' 2>/dev/null || echo 0)

  # NAT Gateways
  NAT=$(aws ec2 describe-nat-gateways --region "$REGION" \
    --filter "Name=state,Values=available" \
    --query 'NatGateways[].[NatGatewayId,State]' \
    --output json 2>/dev/null || echo '[]')
  NAT_COUNT=$(echo "$NAT" | jq 'length' 2>/dev/null || echo 0)

  # Elastic IPs (unattached = wasted money)
  EIP=$(aws ec2 describe-addresses --region "$REGION" \
    --query 'Addresses[?AssociationId==null].[PublicIp,AllocationId]' \
    --output json 2>/dev/null || echo '[]')
  EIP_COUNT=$(echo "$EIP" | jq 'length' 2>/dev/null || echo 0)

  # EBS volumes (unattached)
  EBS=$(aws ec2 describe-volumes --region "$REGION" \
    --filters "Name=status,Values=available" \
    --query 'Volumes[].[VolumeId,Size,VolumeType]' \
    --output json 2>/dev/null || echo '[]')
  EBS_COUNT=$(echo "$EBS" | jq 'length' 2>/dev/null || echo 0)

  # ECS clusters with active services
  ECS_CLUSTERS=$(aws ecs list-clusters --region "$REGION" \
    --query 'clusterArns' --output json 2>/dev/null || echo '[]')
  ECS_COUNT=$(echo "$ECS_CLUSTERS" | jq 'length' 2>/dev/null || echo 0)

  # Lambda functions
  LAMBDA=$(aws lambda list-functions --region "$REGION" \
    --query 'Functions[].FunctionName' \
    --output json 2>/dev/null || echo '[]')
  LAMBDA_COUNT=$(echo "$LAMBDA" | jq 'length' 2>/dev/null || echo 0)

  # ElastiCache clusters
  CACHE=$(aws elasticache describe-cache-clusters --region "$REGION" \
    --query 'CacheClusters[].[CacheClusterId,CacheNodeType,Engine]' \
    --output json 2>/dev/null || echo '[]')
  CACHE_COUNT=$(echo "$CACHE" | jq 'length' 2>/dev/null || echo 0)

  # OpenSearch domains
  OS_DOMAINS=$(aws opensearch list-domain-names --region "$REGION" \
    --query 'DomainNames[].DomainName' \
    --output json 2>/dev/null || echo '[]')
  OS_COUNT=$(echo "$OS_DOMAINS" | jq 'length' 2>/dev/null || echo 0)

  # Redshift clusters
  REDSHIFT=$(aws redshift describe-clusters --region "$REGION" \
    --query 'Clusters[].[ClusterIdentifier,NodeType,ClusterStatus]' \
    --output json 2>/dev/null || echo '[]')
  RS_COUNT=$(echo "$REDSHIFT" | jq 'length' 2>/dev/null || echo 0)

  # Secrets Manager
  SECRETS=$(aws secretsmanager list-secrets --region "$REGION" \
    --query 'SecretList[].Name' \
    --output json 2>/dev/null || echo '[]')
  SECRETS_COUNT=$(echo "$SECRETS" | jq 'length' 2>/dev/null || echo 0)

  # CloudWatch Log Groups (can accumulate storage costs)
  CW_LOGS=$(aws logs describe-log-groups --region "$REGION" \
    --query 'logGroups[].logGroupName' \
    --output json 2>/dev/null || echo '[]')
  CW_COUNT=$(echo "$CW_LOGS" | jq 'length' 2>/dev/null || echo 0)

  REGION_TOTAL=$((EC2_COUNT + RDS_COUNT + ALB_COUNT + CLB_COUNT + NAT_COUNT + EIP_COUNT + EBS_COUNT + ECS_COUNT + LAMBDA_COUNT + CACHE_COUNT + OS_COUNT + RS_COUNT))
  if [[ $REGION_TOTAL -gt 0 || $SECRETS_COUNT -gt 0 ]]; then
    HAS_RESOURCES=true
  fi

  if $HAS_RESOURCES; then
    section "$REGION"
    [[ $EC2_COUNT -gt 0 ]] && {
      count_resource "$EC2_COUNT" "EC2 instances (running/stopped)"
      echo "$EC2" | jq -r '.[] | "    \(.[0])  \(.[1])  \(.[2])  \(.[3] // "no-name")"' 2>/dev/null
    }
    [[ $RDS_COUNT -gt 0 ]] && {
      count_resource "$RDS_COUNT" "RDS instances"
      echo "$RDS" | jq -r '.[] | "    \(.[0])  \(.[1])  \(.[2])  \(.[3])"' 2>/dev/null
    }
    [[ $ALB_COUNT -gt 0 ]] && {
      count_resource "$ALB_COUNT" "ALB/NLB load balancers"
      echo "$ALB" | jq -r '.[] | "    \(.[0])  \(.[1])  \(.[2])"' 2>/dev/null
    }
    [[ $CLB_COUNT -gt 0 ]] && {
      count_resource "$CLB_COUNT" "Classic load balancers"
      echo "$CLB" | jq -r '.[] | "    \(.)"' 2>/dev/null
    }
    [[ $NAT_COUNT -gt 0 ]] && count_resource "$NAT_COUNT" "NAT Gateways (~\$32/mo each)"
    [[ $EIP_COUNT -gt 0 ]] && {
      count_resource "$EIP_COUNT" "unattached Elastic IPs (~\$3.65/mo each)"
      echo "$EIP" | jq -r '.[] | "    \(.[0])  \(.[1])"' 2>/dev/null
    }
    [[ $EBS_COUNT -gt 0 ]] && {
      count_resource "$EBS_COUNT" "unattached EBS volumes"
      echo "$EBS" | jq -r '.[] | "    \(.[0])  \(.[1])GB  \(.[2])"' 2>/dev/null
    }
    [[ $ECS_COUNT -gt 0 ]] && count_resource "$ECS_COUNT" "ECS clusters"
    [[ $CACHE_COUNT -gt 0 ]] && {
      count_resource "$CACHE_COUNT" "ElastiCache clusters"
      echo "$CACHE" | jq -r '.[] | "    \(.[0])  \(.[1])  \(.[2])"' 2>/dev/null
    }
    [[ $OS_COUNT -gt 0 ]] && count_resource "$OS_COUNT" "OpenSearch domains"
    [[ $RS_COUNT -gt 0 ]] && count_resource "$RS_COUNT" "Redshift clusters"
    [[ $SECRETS_COUNT -gt 0 ]] && count_resource "$SECRETS_COUNT" "Secrets Manager secrets (~\$0.40/mo each)"
    [[ $LAMBDA_COUNT -gt 0 ]] && info "$LAMBDA_COUNT Lambda functions (pay-per-invoke, \$0 if idle)"
    [[ $CW_COUNT -gt 0 ]] && info "$CW_COUNT CloudWatch Log Groups (storage costs if large)"
    printf "\n"
  fi
done

# ─── global resources ────────────────────────────────────────────────────────────

header "Global / Non-Regional Resources"

section "S3 Buckets"
S3=$(aws s3api list-buckets --query 'Buckets[].Name' --output json 2>/dev/null || echo '[]')
S3_COUNT=$(echo "$S3" | jq 'length' 2>/dev/null || echo 0)
if [[ $S3_COUNT -gt 0 ]]; then
  info "$S3_COUNT S3 buckets (cost depends on stored data & requests):"
  echo "$S3" | jq -r '.[]' 2>/dev/null | while read -r bucket; do
    SIZE=$(aws s3 ls "s3://$bucket" --summarize --recursive 2>/dev/null | grep "Total Size" | awk '{print $3}' || echo "?")
    if [[ "$SIZE" == "0" || "$SIZE" == "?" ]]; then
      info "  $bucket  (empty or inaccessible)"
    else
      SIZE_MB=$(echo "$SIZE" | awk '{printf "%.1f", $1/1048576}')
      printf "    %-50s %s MB\n" "$bucket" "$SIZE_MB"
    fi
  done
else
  ok "No S3 buckets"
fi
printf "\n"

section "Route 53 Hosted Zones"
R53=$(aws route53 list-hosted-zones --query 'HostedZones[].[Name,Id]' --output json 2>/dev/null || echo '[]')
R53_COUNT=$(echo "$R53" | jq 'length' 2>/dev/null || echo 0)
if [[ $R53_COUNT -gt 0 ]]; then
  warn "$R53_COUNT hosted zones (~\$0.50/mo each)"
  echo "$R53" | jq -r '.[] | "    \(.[0])  \(.[1])"' 2>/dev/null
else
  ok "No Route 53 hosted zones"
fi
TOTAL_RESOURCES=$((TOTAL_RESOURCES + R53_COUNT))
printf "\n"

section "CloudFront Distributions"
CF=$(aws cloudfront list-distributions \
  --query 'DistributionList.Items[].[Id,DomainName,Status]' \
  --output json 2>/dev/null || echo '[]')
CF_COUNT=$(echo "$CF" | jq 'length' 2>/dev/null || echo 0)
if [[ $CF_COUNT -gt 0 ]]; then
  warn "$CF_COUNT CloudFront distributions"
  echo "$CF" | jq -r '.[] | "    \(.[0])  \(.[1])  \(.[2])"' 2>/dev/null
else
  ok "No CloudFront distributions"
fi
TOTAL_RESOURCES=$((TOTAL_RESOURCES + CF_COUNT))
printf "\n"

section "ACM Certificates"
ACM=$(aws acm list-certificates --region us-east-1 \
  --query 'CertificateSummaryList[].[DomainName,Status]' \
  --output json 2>/dev/null || echo '[]')
ACM_COUNT=$(echo "$ACM" | jq 'length' 2>/dev/null || echo 0)
if [[ $ACM_COUNT -gt 0 ]]; then
  info "$ACM_COUNT ACM certificates (free, but listed for awareness)"
  echo "$ACM" | jq -r '.[] | "    \(.[0])  \(.[1])"' 2>/dev/null
else
  ok "No ACM certificates"
fi
printf "\n"

# ─── summary ─────────────────────────────────────────────────────────────────────

header "Summary"

printf "  ${BOLD}Month-to-date spend:${RESET}      \$%.2f\n" "$TOTAL"
printf "  ${BOLD}Last month total:${RESET}         \$%.2f\n" "$LAST_TOTAL"
if [[ "$FORECAST_AMT" != "N/A" ]]; then
  printf "  ${BOLD}Projected month-end:${RESET}      \$%.2f\n" "$FORECAST_AMT"
fi
printf "  ${BOLD}Billable resources found:${RESET} %d\n" "$TOTAL_RESOURCES"
printf "  ${BOLD}Warnings:${RESET}                 %d\n" "$TOTAL_WARNINGS"
printf "\n"

if [[ $TOTAL_WARNINGS -eq 0 ]] && (( $(echo "$TOTAL < 0.01" | bc -l) )); then
  printf "  ${GREEN}${BOLD}All clean! No significant costs or lingering resources detected.${RESET}\n"
elif [[ $TOTAL_WARNINGS -eq 0 ]]; then
  printf "  ${YELLOW}${BOLD}No risky resources found, but you have some active spend. Check the service breakdown above.${RESET}\n"
else
  printf "  ${RED}${BOLD}⚠ Found $TOTAL_WARNINGS resource(s) that may be costing you money. Review the warnings above.${RESET}\n"
fi
printf "\n"
