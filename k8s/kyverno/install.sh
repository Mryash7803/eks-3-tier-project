#!/bin/bash
set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}Adding Kyverno Helm repository...${NC}"
helm repo add kyverno https://kyverno.github.io/kyverno/
helm repo update

echo -e "${BLUE}Installing Kyverno in 'kyverno' namespace...${NC}"
helm upgrade --install kyverno kyverno/kyverno \
  --namespace kyverno \
  --create-namespace \
  --set admissionController.replicas=3 \
  --set backgroundController.replicas=2 \
  --set cleanupController.replicas=2 \
  --set reportsController.replicas=2

echo -e "${BLUE}Waiting for Kyverno admission controller deployment to be ready...${NC}"
kubectl rollout status deployment/kyverno-admission-controller -n kyverno --timeout=150s

echo -e "${BLUE}Applying Kyverno ClusterPolicies...${NC}"
kubectl apply -f policies.yaml

echo -e "${GREEN}Kyverno and policies have been applied successfully!${NC}"
kubectl get clusterpolicy
