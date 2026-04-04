provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Project     = "app"
      ManagedBy   = "terraform"
      Environment = "production"
    }
  }
}
