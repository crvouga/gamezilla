# The role GitHub Actions assumes to apply AWS (IoT Core, the authorizer
# Lambda, its IAM user). No long-lived account key: the workflow's OIDC
# token is the credential. Bootstrap creates this once, with a person's
# AWS login, and publishes the role ARN as the Actions variable AWS_ROLE_ARN.
#
# The Worker's publish key is a different credential (modules/pubsub). A
# Worker has no GitHub token, so it keeps that generated IAM user key.

terraform {
  required_providers {
    aws = { source = "hashicorp/aws" }
  }
}

variable "project" {
  type = string
}

variable "github_repository" {
  type        = string
  description = "owner/repo whose main deploys and production environment may assume the role."
}

locals {
  issuer    = "https://token.actions.githubusercontent.com"
  role_name = "${var.project}-github-deploy"
  # Deploy on main has no GitHub environment (subject is the ref). Production
  # jobs set environment: production, which replaces the ref in the subject.
  subjects = [
    "repo:${var.github_repository}:ref:refs/heads/main",
    "repo:${var.github_repository}:environment:production",
  ]
}

resource "aws_iam_openid_connect_provider" "github" {
  url            = local.issuer
  client_id_list = ["sts.amazonaws.com"]
  # GitHub's OIDC thumbprints. AWS no longer validates them for this issuer;
  # the API still stores the list.
  thumbprint_list = [
    "6938fd4d98bab03faadb97b34396831e3780aea1",
    "1c58a3a8518e8759bf075b76b750d4f2df264fcd",
  ]

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_iam_role" "deploy" {
  name = local.role_name
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Action    = "sts:AssumeRoleWithWebIdentity"
      Principal = { Federated = aws_iam_openid_connect_provider.github.arn }
      Condition = {
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
        }
        StringLike = {
          "token.actions.githubusercontent.com:sub" = local.subjects
        }
      }
    }]
  })

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_iam_role_policy" "deploy" {
  name = local.role_name
  role = aws_iam_role.deploy.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Iot"
        Effect = "Allow"
        Action = [
          "iot:CreateAuthorizer",
          "iot:DeleteAuthorizer",
          "iot:DescribeAuthorizer",
          "iot:UpdateAuthorizer",
          "iot:ListAuthorizers",
          "iot:CreateDomainConfiguration",
          "iot:DeleteDomainConfiguration",
          "iot:DescribeDomainConfiguration",
          "iot:UpdateDomainConfiguration",
          "iot:ListDomainConfigurations",
          "iot:DescribeEndpoint",
          "iot:TagResource",
          "iot:UntagResource",
          "iot:ListTagsForResource",
        ]
        Resource = "*"
      },
      {
        Sid    = "Lambda"
        Effect = "Allow"
        Action = [
          "lambda:CreateFunction",
          "lambda:DeleteFunction",
          "lambda:GetFunction",
          "lambda:GetFunctionConfiguration",
          "lambda:GetFunctionCodeSigningConfig",
          "lambda:UpdateFunctionCode",
          "lambda:UpdateFunctionConfiguration",
          "lambda:ListTags",
          "lambda:TagResource",
          "lambda:UntagResource",
          "lambda:AddPermission",
          "lambda:RemovePermission",
          "lambda:GetPolicy",
          "lambda:ListVersionsByFunction",
        ]
        Resource = [
          "arn:aws:lambda:*:*:function:${var.project}-iot-*",
          "arn:aws:lambda:*:*:function:${var.project}-iot-*:*",
        ]
      },
      {
        Sid      = "LogsList"
        Effect   = "Allow"
        Action   = ["logs:DescribeLogGroups"]
        Resource = "*"
      },
      {
        Sid    = "Logs"
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:DeleteLogGroup",
          "logs:PutRetentionPolicy",
          "logs:ListTagsForResource",
          "logs:TagResource",
          "logs:UntagResource",
        ]
        Resource = [
          "arn:aws:logs:*:*:log-group:/aws/lambda/${var.project}-iot-*",
          "arn:aws:logs:*:*:log-group:/aws/lambda/${var.project}-iot-*:*",
        ]
      },
      {
        Sid    = "Acm"
        Effect = "Allow"
        Action = [
          "acm:RequestCertificate",
          "acm:DescribeCertificate",
          "acm:DeleteCertificate",
          "acm:ListCertificates",
          "acm:AddTagsToCertificate",
          "acm:RemoveTagsFromCertificate",
          "acm:ListTagsForCertificate",
        ]
        Resource = "*"
      },
      {
        Sid    = "IamForIot"
        Effect = "Allow"
        Action = [
          "iam:CreateRole",
          "iam:GetRole",
          "iam:DeleteRole",
          "iam:UpdateRole",
          "iam:UpdateAssumeRolePolicy",
          "iam:TagRole",
          "iam:UntagRole",
          "iam:ListRoleTags",
          "iam:ListInstanceProfilesForRole",
          "iam:AttachRolePolicy",
          "iam:DetachRolePolicy",
          "iam:ListAttachedRolePolicies",
          "iam:PutRolePolicy",
          "iam:GetRolePolicy",
          "iam:DeleteRolePolicy",
          "iam:ListRolePolicies",
          "iam:CreateUser",
          "iam:GetUser",
          "iam:DeleteUser",
          "iam:TagUser",
          "iam:UntagUser",
          "iam:ListUserTags",
          "iam:PutUserPolicy",
          "iam:GetUserPolicy",
          "iam:DeleteUserPolicy",
          "iam:ListUserPolicies",
          "iam:CreateAccessKey",
          "iam:ListAccessKeys",
          "iam:DeleteAccessKey",
          "iam:UpdateAccessKey",
          "iam:ListGroupsForUser",
          "iam:ListAttachedUserPolicies",
          "iam:DetachUserPolicy",
        ]
        Resource = [
          "arn:aws:iam::*:role/${var.project}-iot-*",
          "arn:aws:iam::*:user/${var.project}-iot-*",
        ]
      },
      {
        Sid      = "PassAuthorizerRole"
        Effect   = "Allow"
        Action   = ["iam:PassRole"]
        Resource = "arn:aws:iam::*:role/${var.project}-iot-*"
        Condition = {
          StringEquals = { "iam:PassedToService" = "lambda.amazonaws.com" }
        }
      },
      {
        # The first custom IoT domain asks IAM to create AWSServiceRoleForIoT.
        Sid      = "IotServiceLinkedRole"
        Effect   = "Allow"
        Action   = ["iam:CreateServiceLinkedRole"]
        Resource = "arn:aws:iam::*:role/aws-service-role/iot.amazonaws.com/AWSServiceRoleForIoT"
        Condition = {
          StringEquals = { "iam:AWSServiceName" = "iot.amazonaws.com" }
        }
      },
    ]
  })
}

output "role_arn" {
  value = aws_iam_role.deploy.arn
}
