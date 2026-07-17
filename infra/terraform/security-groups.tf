resource "aws_security_group" "rds" {
  name_prefix = "${local.name}-rds-"
  description = "Security group for PostgreSQL RDS"
  vpc_id      = module.vpc.vpc_id

  tags = merge(
    local.common_tags,
    {
      Name = "${local.name}-rds-sg"
    }
  )

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_vpc_security_group_ingress_rule" "rds_from_eks" {
  security_group_id = aws_security_group.rds.id

  referenced_security_group_id = module.eks.node_security_group_id

  from_port   = 5432
  to_port     = 5432
  ip_protocol = "tcp"

  description = "Allow PostgreSQL access from EKS worker nodes"
}
