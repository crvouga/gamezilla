data "aws_availability_zones" "available" {
  state = "available"
}

locals {
  azs = slice(data.aws_availability_zones.available.names, 0, 2)
}

# ── VPC ──────────────────────────────────────────────────────────────────────

resource "aws_vpc" "this" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = { Name = "${var.name_prefix}-vpc" }
}

# ── Internet gateway ─────────────────────────────────────────────────────────

resource "aws_internet_gateway" "this" {
  vpc_id = aws_vpc.this.id
  tags   = { Name = "${var.name_prefix}-igw" }
}

# ── Public subnets ───────────────────────────────────────────────────────────

resource "aws_subnet" "public" {
  count                   = 2
  vpc_id                  = aws_vpc.this.id
  cidr_block              = cidrsubnet(aws_vpc.this.cidr_block, 8, count.index)
  availability_zone       = local.azs[count.index]
  map_public_ip_on_launch = true

  tags = { Name = "${var.name_prefix}-public-${local.azs[count.index]}" }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.this.id
  tags   = { Name = "${var.name_prefix}-public-rt" }
}

resource "aws_route" "public_internet" {
  route_table_id         = aws_route_table.public.id
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = aws_internet_gateway.this.id
}

resource "aws_route_table_association" "public" {
  count          = 2
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# ── NAT gateway (single, in first public subnet) ────────────────────────────

resource "aws_eip" "nat" {
  count  = var.nat_gateways
  domain = "vpc"
  tags   = { Name = "${var.name_prefix}-nat-eip-${count.index}" }
}

resource "aws_nat_gateway" "this" {
  count         = var.nat_gateways
  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index % 2].id

  tags = { Name = "${var.name_prefix}-nat-${count.index}" }

  depends_on = [aws_internet_gateway.this]
}

# ── Private subnets ──────────────────────────────────────────────────────────

resource "aws_subnet" "private" {
  count             = 2
  vpc_id            = aws_vpc.this.id
  cidr_block        = cidrsubnet(aws_vpc.this.cidr_block, 8, count.index + 100)
  availability_zone = local.azs[count.index]

  tags = { Name = "${var.name_prefix}-private-${local.azs[count.index]}" }
}

resource "aws_route_table" "private" {
  count  = 2
  vpc_id = aws_vpc.this.id
  tags   = { Name = "${var.name_prefix}-private-rt-${count.index}" }
}

resource "aws_route" "private_nat" {
  count                  = 2
  route_table_id         = aws_route_table.private[count.index].id
  destination_cidr_block = "0.0.0.0/0"
  nat_gateway_id         = aws_nat_gateway.this[count.index % var.nat_gateways].id
}

resource "aws_route_table_association" "private" {
  count          = 2
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private[count.index].id
}

# ── VPC endpoints ────────────────────────────────────────────────────────────

resource "aws_vpc_endpoint" "s3" {
  vpc_id            = aws_vpc.this.id
  service_name      = "com.amazonaws.${data.aws_region.current.name}.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = aws_route_table.private[*].id

  tags = { Name = "${var.name_prefix}-s3-endpoint" }
}

resource "aws_security_group" "vpc_endpoints" {
  name_prefix = "${var.name_prefix}-vpce-"
  description = "Allow HTTPS from VPC to interface endpoints"
  vpc_id      = aws_vpc.this.id

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = [aws_vpc.this.cidr_block]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${var.name_prefix}-vpce-sg" }
}

locals {
  interface_endpoints = {
    ecr_dkr = "com.amazonaws.${data.aws_region.current.name}.ecr.dkr"
    ecr_api = "com.amazonaws.${data.aws_region.current.name}.ecr.api"
    logs    = "com.amazonaws.${data.aws_region.current.name}.logs"
    ssm     = "com.amazonaws.${data.aws_region.current.name}.ssm"
    ssmmsg  = "com.amazonaws.${data.aws_region.current.name}.ssmmessages"
  }
}

resource "aws_vpc_endpoint" "interface" {
  for_each = local.interface_endpoints

  vpc_id              = aws_vpc.this.id
  service_name        = each.value
  vpc_endpoint_type   = "Interface"
  private_dns_enabled = true
  subnet_ids          = aws_subnet.private[*].id
  security_group_ids  = [aws_security_group.vpc_endpoints.id]

  tags = { Name = "${var.name_prefix}-${each.key}-endpoint" }
}

data "aws_region" "current" {}
