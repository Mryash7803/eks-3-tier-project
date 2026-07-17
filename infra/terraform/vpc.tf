data "aws_availability_zones" "available" {
  state = "available"
}

locals {
  azs = slice(data.aws_availability_zones.available.names, 0, 2)
}

module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "6.6.1"

  name = "${local.name}-vpc"
  cidr = var.vpc_cidr

  azs = local.azs

  public_subnets = [
    "10.20.1.0/24",
    "10.20.2.0/24"
  ]

  private_subnets = [
    "10.20.11.0/24",
    "10.20.12.0/24"
  ]

  database_subnets = [
    "10.20.21.0/24",
    "10.20.22.0/24"
  ]

  enable_dns_hostnames = true
  enable_dns_support   = true

  enable_nat_gateway     = true
  single_nat_gateway     = false
  one_nat_gateway_per_az = true

  create_database_subnet_group = true

  public_subnet_tags = {
    "kubernetes.io/role/elb" = "1"
  }

  private_subnet_tags = {
    "kubernetes.io/role/internal-elb" = "1"
  }

  tags = local.common_tags
}

