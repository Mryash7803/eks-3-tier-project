resource "aws_db_subnet_group" "postgres" {
  name = "${local.name}-postgres-subnet-group"

  subnet_ids = module.vpc.database_subnets

  tags = merge(
    local.common_tags,
    {
      Name = "${local.name}-postgres-subnet-group"
    }
  )
}

resource "aws_db_parameter_group" "postgres" {
  name   = "${local.name}-postgres-params"
  family = "postgres17"

  tags = merge(
    local.common_tags,
    {
      Name = "${local.name}-postgres-params"
    }
  )
}

resource "aws_db_instance" "postgres" {
  identifier = "${local.name}-postgres"

  engine         = "postgres"
  engine_version = "17"

  instance_class        = var.db_instance_class
  allocated_storage     = var.db_allocated_storage
  max_allocated_storage = 100
  storage_type          = "gp3"
  storage_encrypted     = true

  db_name  = var.db_name
  username = var.db_username
  password = random_password.db_password.result
  port     = 5432

  db_subnet_group_name   = aws_db_subnet_group.postgres.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  parameter_group_name   = aws_db_parameter_group.postgres.name

  publicly_accessible = false
  multi_az            = true

  backup_retention_period = 7
  deletion_protection     = true
  skip_final_snapshot     = false
  final_snapshot_identifier = "${local.name}-postgres-final-snapshot"

  apply_immediately = false

  tags = merge(
    local.common_tags,
    {
      Name = "${local.name}-postgres"
    }
  )
}
