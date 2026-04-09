# Mailroom — Infrastructure Setup Guide

This guide covers every step needed to deploy Mailroom to production on AWS, wire up email and Slack, and set up CI/CD.

## Suggested Order of Attack

| Priority | Task | Unblocks |
|----------|------|----------|
| 1 | AWS Account & IAM | Everything |
| 2 | Domain & SSL | All deployments |
| 3 | RDS PostgreSQL | Backend deploy |
| 4 | S3 Bucket | File uploads in prod |
| 5 | Deploy Backend (ECS) | All external surfaces going live |
| 6 | Deploy Frontend (CloudFront) | Users accessing the web app |
| 7 | CI/CD | Automated testing + deploys |
| 8 | Wire Email (SES) | Email capture going live |
| 9 | Wire Slack | Slack capture going live |
| 10 | Environment Management | Staging vs prod separation |

Steps 1–6 are the critical path. Once the backend is publicly deployed, everything else — email, Slack, iPhone app, Chrome extension in production — just works because the API contracts are already built.

---

## 1. AWS Account & IAM

1. Create an AWS account at [aws.amazon.com](https://aws.amazon.com)
2. Enable MFA on root account
3. Create an IAM user for yourself with programmatic access (access key + secret)
4. Create an IAM role for your backend service (ECS task role) with permissions for: S3, RDS, SES, CloudWatch Logs
5. Install AWS CLI locally: `brew install awscli`
6. Run `aws configure` with your IAM user credentials

---

## 2. Domain & SSL

1. Register a domain (e.g. `mailroom.dev` or `usemailroom.com`) via Route 53 or any registrar
2. If not using Route 53 as registrar, create a Route 53 hosted zone and point your domain's nameservers to it
3. Request an SSL certificate in AWS Certificate Manager (ACM) for `*.yourdomain.com` and `yourdomain.com`
4. Validate the certificate via DNS (add the CNAME record ACM gives you to Route 53)

---

## 3. Production Database (RDS PostgreSQL)

1. Create a VPC (or use default) with public + private subnets across 2 AZs
2. Create an RDS PostgreSQL instance (db.t3.micro for now) in a private subnet
3. Security group: allow inbound 5432 only from your backend's security group
4. Note the endpoint, username, password — you'll need these for `DATABASE_URL`
5. From your backend (once deployed), run `alembic upgrade head` to apply all 7 migrations

---

## 4. File Storage (S3)

1. Create an S3 bucket (e.g. `mailroom-attachments-prod`)
2. Block all public access (default)
3. Set bucket policy to allow your ECS task role to `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject`
4. In your backend env vars, set `STORAGE_BACKEND=s3` and `S3_BUCKET=mailroom-attachments-prod`

---

## 5. Deploy Backend (ECS Fargate)

### 5.1 Dockerize the backend

Create `backend/Dockerfile`:

```dockerfile
FROM python:3.9-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 5.2 Push to ECR

1. Create an ECR repository (e.g. `mailroom-backend`)
2. Build and push your Docker image:

```bash
aws ecr get-login-password | docker login --username AWS --password-stdin <account-id>.dkr.ecr.<region>.amazonaws.com
docker build -t mailroom-backend backend/
docker tag mailroom-backend:latest <account-id>.dkr.ecr.<region>.amazonaws.com/mailroom-backend:latest
docker push <account-id>.dkr.ecr.<region>.amazonaws.com/mailroom-backend:latest
```

### 5.3 Create ECS service

1. Create an ECS cluster (Fargate)
2. Create a task definition with:
   - Image: your ECR image
   - Port: 8000
   - Environment variables: `DATABASE_URL`, `ANTHROPIC_API_KEY`, `STORAGE_BACKEND`, `S3_BUCKET`, `SLACK_SIGNING_SECRET`
   - Task role: the IAM role from step 1
3. Create an ECS service with an Application Load Balancer (ALB)
4. ALB listener: HTTPS (443) using your ACM certificate → target group on port 8000
5. Route 53: create an A record alias `api.yourdomain.com` → ALB
6. Test: `curl https://api.yourdomain.com/api/v1/health`

---

## 6. Deploy Frontend (S3 + CloudFront)

1. Build the frontend: `cd frontend && npm run build`
2. Create an S3 bucket for the frontend (e.g. `mailroom-frontend-prod`)
3. Upload the `dist/` folder to S3
4. Create a CloudFront distribution:
   - Origin: your S3 bucket
   - Alternate domain: `app.yourdomain.com`
   - SSL certificate: the ACM cert from step 2
   - Default root object: `index.html`
   - Error pages: redirect 403/404 → `index.html` (for client-side routing)
5. Route 53: create an A record alias `app.yourdomain.com` → CloudFront
6. Update the frontend API client base URL to `https://api.yourdomain.com`
7. Update backend CORS to allow `https://app.yourdomain.com`

---

## 7. Wire Email Live (SES)

1. Verify your domain in SES (add the TXT/DKIM records SES provides)
2. Add an MX record on your inbound subdomain (e.g. `inbound.yourdomain.com`) pointing to SES:
   ```
   10 inbound-smtp.<region>.amazonaws.com
   ```
3. Create an SES receipt rule set with a rule that:
   - Matches: `*@inbound.yourdomain.com`
   - Action: publish to an SNS topic
4. Create the SNS topic (e.g. `mailroom-inbound-email`)
5. Subscribe the SNS topic to your endpoint: `https://api.yourdomain.com/api/v1/webhooks/email`
6. Confirm the SNS subscription (your endpoint will get a confirmation request)
7. Update the email webhook handler to parse the SNS envelope (currently accepts simple JSON)
8. Test: send an email to `capture@inbound.yourdomain.com` and verify it appears in Mailroom

---

## 8. Wire Slack Live

1. Create a Slack app at [api.slack.com/apps](https://api.slack.com/apps)
2. Add a slash command: `/mailroom` → `https://api.yourdomain.com/api/v1/webhooks/slack`
3. Copy the Signing Secret from app settings → add to backend env var `SLACK_SIGNING_SECRET`
4. Install the app to your Slack workspace
5. In Mailroom Settings, add a surface connection with your Slack team ID
6. Test: type `/mailroom Review Q3 budget by Friday` in Slack

---

## 9. CI/CD (GitHub Actions)

### 9.1 Test pipeline

Create `.github/workflows/ci.yml`:

```yaml
name: CI
on: [push, pull_request]
jobs:
  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "3.9" }
      - run: pip install -r backend/requirements.txt
      - run: cd backend && python -m pytest tests/ -v
      - run: cd backend && ruff check .
  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "18" }
      - run: cd frontend && npm ci
      - run: cd frontend && npx vitest run
      - run: cd frontend && npx tsc --noEmit
```

### 9.2 Deploy pipeline

Create `.github/workflows/deploy.yml` (trigger on merge to main):

- Build Docker image → push to ECR → update ECS service
- Build frontend → sync to S3 → invalidate CloudFront cache
- Add AWS credentials as GitHub repository secrets (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`)

---

## 10. Environment Management

1. Create a staging environment (separate RDS, S3 bucket, ECS service)
2. Use environment-specific `.env` files or SSM Parameter Store for secrets
3. Staging URL: `api-staging.yourdomain.com`
4. Production URL: `api.yourdomain.com`

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `ANTHROPIC_API_KEY` | Yes (prod) | Claude API key for AI extraction |
| `STORAGE_BACKEND` | Yes (prod) | `local` (dev) or `s3` (prod) |
| `S3_BUCKET` | If S3 | Attachment storage bucket name |
| `SLACK_SIGNING_SECRET` | If Slack | Slack app signing secret for webhook verification |
| `RATE_LIMIT_PER_MINUTE` | No | Default: 120 requests/min per user |

---

## Post-Deploy Checklist

- [ ] `curl https://api.yourdomain.com/api/v1/health` returns 200
- [ ] Bootstrap a user via `/api/v1/auth/bootstrap`
- [ ] Web app loads at `https://app.yourdomain.com`
- [ ] Text capture → AI extraction → review → approve works end-to-end
- [ ] File upload (image, PDF) works
- [ ] Chrome extension connects to production API URL
- [ ] Desktop app connects to production API URL
- [ ] Email forwarding creates a capture
- [ ] Slack `/mailroom` command creates a capture
- [ ] GitHub Actions runs tests on PR
- [ ] GitHub Actions deploys on merge to main
