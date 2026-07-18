# 🚀 Enterprise Task Cloud (React + Go + PostgreSQL)

A high-performance, enterprise-grade 3-tier task management application built to showcase modern cloud-native architectures. The stack runs a **React/Vite** frontend (served via Nginx), a high-throughput **Go REST API** backend, and a persistent **PostgreSQL** database. 

It is designed for production deployment on **Amazon EKS (Elastic Kubernetes Service)** using **GitOps**, **Progressive Delivery (Argo Rollouts)**, and a **DevSecOps** pipeline.

---

## 🏗️ System & GitOps Architecture

```mermaid
graph TD
    User([User Browser]) -->|HTTPS| ALB[AWS Application Load Balancer]
    ALB -->|/| FE[Frontend Rollout: Blue/Green]
    ALB -->|/api| BE[Backend Rollout: Canary]
    
    subgraph Kubernetes Production Cluster (EKS)
        FE -->|Stable / Active| FE-Active[Frontend Pods: Active]
        FE -.->|Preview / Green| FE-Preview[Frontend Pods: Preview]
        
        BE -->|Stable / 80% Traffic| BE-Stable[Backend Pods: Stable]
        BE -.->|Canary / 20% Traffic| BE-Canary[Backend Pods: Canary]
        
        BE-Stable -->|SQL| RDS[(AWS Aurora PostgreSQL / RDS)]
        BE-Canary -->|SQL| RDS
    end
    
    subgraph Progressive Delivery & GitOps
        ArgoCD[ArgoCD Controller] -->|Sync Manifests| EKS-Apps[Multi-Environment Applications]
        ArgoRollouts[Argo Rollouts Controller] -->|Orchestrate Releases| FE
        ArgoRollouts -->|Orchestrate Releases| BE
        Prometheus[(Prometheus metrics)] -->|Query Health| ArgoRollouts
    end
```

---

## ✨ Features

- **Frontend (Presentation Tier)**: Responsive, glassmorphic dark-theme React application served via Nginx with container-level optimization.
- **Backend (Application Tier)**: Statically compiled Go API handling connection pooling, CORS middleware, and automatic database migration jobs.
- **Multi-Environment GitOps**: Environment-specific values (`Dev`, `Stage`, `Prod`) feeding a unified Helm chart managed via distinct ArgoCD Applications.
- **Progressive Delivery (Argo Rollouts)**:
  - **Backend**: Automated Canary deployments routing 20% ➔ 50% ➔ 80% traffic, validated dynamically by a Prometheus `AnalysisTemplate` monitoring request success rate.
  - **Frontend**: Zero-downtime Blue/Green deployments with automated preview promotions.
- **DevSecOps Pipeline**:
  - GHA-triggered filesystem and Helm configuration security audits using Trivy (failing on critical vulnerabilities).
  - Software Bill of Materials (SBOM) generation (CycloneDX format) uploaded as workflow artifacts.
  - Cryptographic container image signing using **Cosign** during ECR pushes.
- **Policy as Code (Kyverno)**: Cluster admission controller enforcing resource limits, blocking `:latest` tags, requiring Cosign image signatures, and banning root-user container executions.
- **Autoscaling & Observability**: High availability using HPA coupled with EKS Cluster Autoscaler, and log aggregation using Grafana Loki + Promtail.

---

## 📂 Project Structure

```text
eks-3-tier-project/
├── .github/workflows/       # GitHub Actions CI Workflow
│   └── ci.yaml              # Trivy Scans, SBOM, Cosign signing, ECR push
├── argocd/                  # ArgoCD GitOps Application Definitions
│   ├── dev-app.yaml         # Deploys Chart to 'dev' namespace using dev values
│   ├── stage-app.yaml       # Deploys Chart to 'stage' namespace using stage values
│   └── prod-app.yaml        # Deploys Chart to 'production' namespace using prod values
├── backend/                 # Go REST API Service
│   ├── cmd/                 # Application Entrypoints (API Server & Migration tool)
│   ├── Dockerfile           # Multi-stage optimized Go build (Go 1.24)
│   └── go.mod               # Dependencies declarations
├── frontend/                # React Vite UI Web App
│   ├── src/                 # React component templates
│   ├── Dockerfile           # Nginx:alpine based optimized frontend build
│   └── nginx.conf           # Reverse proxy routing rules
├── helm/                    # Unified Deployment Manifests
│   ├── eks-3-tier-app/      # Main application Helm Chart (Templates, Chart.yaml)
│   ├── values-dev.yaml      # Low-cost developer configurations
│   ├── values-stage.yaml    # Pre-production validation configurations
│   └── values-prod.yaml     # High-availability production settings (Rollouts enabled)
├── k8s/                     # Infrastructure Addons & Policies
│   ├── autoscaler/          # EKS Cluster Autoscaler deployment manifests
│   └── kyverno/             # Kyverno admission controller rules & setup scripts
└── cosign.pub               # Cosign public key for container signature verification
```

---

## 💻 Local Quickstart (Docker Compose)

Launch the stack locally to test endpoints and frontend interface instantly:

```bash
# Clone the repository and navigate to root
git clone https://github.com/Mryash7803/eks-3-tier-project.git
cd eks-3-tier-project

# Launch services
docker compose up --build -d
```

### Accessing the Local Services:
- **React Frontend**: Open [http://localhost:3002](http://localhost:3002) in your browser.
- **Go API Healthcheck**: Access [http://localhost:8081/api/health](http://localhost:8081/api/health).
- **Go API Tasks Endpoint**: Access [http://localhost:8081/api/tasks](http://localhost:8081/api/tasks).

To stop the containers and purge local data volumes:
```bash
docker compose down -v
```

---

## ☸️ GitOps Multi-Environment Deployments (ArgoCD)

The project leverages a single, customizable Helm chart (`helm/eks-3-tier-app`) mapped to three different environments via ArgoCD.

To deploy any environment, apply its corresponding Application file:

```bash
# Deploy DEV (Namespace: dev, Rollouts: Disabled, Replicas: 1)
kubectl apply -f argocd/dev-app.yaml

# Deploy STAGE (Namespace: stage, Rollouts: Disabled, Replicas: 2)
kubectl apply -f argocd/stage-app.yaml

# Deploy PROD (Namespace: production, Rollouts: Enabled, Replicas: 3)
kubectl apply -f argocd/prod-app.yaml
```

---

## 🎯 Progressive Delivery (Argo Rollouts)

In the **production** environment, releases bypass standard rolling updates and utilize **Argo Rollouts** for controlled, safe rollouts.

### Backend Canary Deployment:
During a backend image update, traffic shifts incrementally:
1. **Step 1**: Routes **20%** of traffic to the Canary pods.
2. **Analysis Run**: A Prometheus `AnalysisTemplate` queries the gateway metrics every 30s. If the success rate falls below `95%`, the deployment immediately aborts and rolls back.
3. **Step 2**: Routes **50%** of traffic for 2 minutes.
4. **Step 3**: Routes **80%** of traffic for 1 minute.
5. **Promotion**: Promotes to 100% stable version.

### Frontend Blue/Green Deployment:
Frontend updates deploy to a green stack. A preview service allows validation while 100% of user traffic safely targets the stable blue stack. Once validation passes, the active service shifts traffic instantly to the green stack.

---

## 🛡️ DevSecOps & Policy Enforcements

We enforce security at every step, starting from the CI pipeline up to cluster admission.

### 1. CI Pipeline Guardrails (Trivy & Cosign)
The GitHub Actions workflow executes these steps:
- **Static Security Audits**: Scans the filesystem, secrets, and Helm configs with Trivy. Files containing critical vulnerabilities fail the build.
- **SBOM Generation**: Generates a `sbom.json` using CycloneDX and attaches it as a workflow artifact.
- **Cosign Image Signing**: Automatically signs backend and frontend images using a secure Cosign private key stored in GitHub Repository Secrets.

### 2. Admission Control Policies (Kyverno)
Kyverno ClusterPolicies block non-compliant workloads before pods start:
- `require-resource-limits`: Blocks any pod that does not specify CPU/Memory limits.
- `disallow-latest-tag`: Rejects deployments using `:latest` tags.
- `require-signed-images`: Inspects container image signatures against the public key `cosign.pub`. Non-signed containers are blocked.
- `require-non-root-user`: Enforces `runAsNonRoot: true` in the pod/container securityContexts.

To install Kyverno and apply the policies:
```bash
cd k8s/kyverno
chmod +x install.sh
./install.sh
```

---

## ⚙️ EKS Cluster Autoscaling

Cluster Autoscaler is deployed under the `kube-system` namespace in EKS to dynamically adjust managed node groups based on pod resource demands.

> **Design Choice Justification**:
> Cluster Autoscaler was chosen for this project because it integrates cleanly with EKS managed node groups. Karpenter is a newer alternative that offers more advanced provisioning and cost optimization, but Cluster Autoscaler was selected to demonstrate the classic autoscaling architecture.

To deploy the autoscaler resources:
```bash
kubectl apply -f k8s/autoscaler/cluster-autoscaler.yaml
```

---

## 📊 Monitoring & Log Analysis

Logs from the application tiers are aggregated using Grafana Loki and Promtail.

Port-forward to Grafana dashboard:
```bash
kubectl port-forward -n monitoring svc/monitoring-grafana 3000:80
```
Open [http://localhost:3000](http://localhost:3000), log in (`admin`/`BINNiiBxsWT4y7Nz83oO2bFGYgrtOpd9N6kXTdUt`), and explore the pre-configured **"3-Tier Application Logs (Loki)"** dashboard.
