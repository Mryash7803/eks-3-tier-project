resource "random_password" "db_password" {
  length           = 24
  special          = true
  override_special = "!#$%&*()-_=+[]{}:?"
}

resource "aws_secretsmanager_secret" "db_credentials" {
  name        = "${local.name}/database"
  description = "PostgreSQL credentials for the 3-tier application"

  tags = local.common_tags
}

resource "aws_secretsmanager_secret_version" "db_credentials" {
  secret_id = aws_secretsmanager_secret.db_credentials.id

  secret_string = jsonencode({
    DB_HOST     = aws_db_instance.postgres.address
    DB_PORT     = aws_db_instance.postgres.port
    DB_NAME     = var.db_name
    DB_USERNAME = var.db_username
    DB_PASSWORD = random_password.db_password.result
  })
}
