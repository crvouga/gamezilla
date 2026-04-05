terraform {
  backend "s3" {
    bucket         = "gamezilla-terraform-state"
    key            = "gamezilla/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "gamezilla-terraform-lock"
  }
}
