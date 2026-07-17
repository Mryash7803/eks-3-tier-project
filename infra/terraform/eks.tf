module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "21.20.0"

  name               = local.name
  kubernetes_version = var.kubernetes_version

  endpoint_public_access  = true
  endpoint_private_access = true

  enable_cluster_creator_admin_permissions = true

  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets

  addons = {
    vpc-cni = {
      before_compute = true
    }

    kube-proxy = {}

    coredns = {}

    eks-pod-identity-agent = {
      before_compute = true
    }
  }

  eks_managed_node_groups = {
    default = {
      name = "${local.name}-ng"

      instance_types = var.node_instance_types

      min_size     = var.node_min_size
      desired_size = var.node_desired_size
      max_size     = var.node_max_size

      subnet_ids = module.vpc.private_subnets

      labels = {
        role = "general"
      }

      tags = merge(local.common_tags, {
        Name = "${local.name}-node-group"
      })
    }
  }

  tags = local.common_tags
}
