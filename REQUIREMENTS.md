# System Requirements

This document outlines the system requirements for deploying the Political Nomination App on AWS EC2.

## Minimum Hardware Requirements

### AWS EC2 Instance (Recommended)

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| Instance Type | t3.medium | t3.large |
| vCPUs | 2 | 2+ |
| Memory | 4 GB | 8 GB |
| Storage | 30 GB SSD (gp3) | 50 GB SSD (gp3) |
| Network | Moderate | High |

### For Development/Build Server

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| Instance Type | t3.large | t3.xlarge |
| vCPUs | 2 | 4 |
| Memory | 8 GB | 16 GB |
| Storage | 50 GB SSD (gp3) | 100 GB SSD (gp3) |

## Operating System

- **Recommended**: Amazon Linux 2023 or Ubuntu 22.04 LTS
- **Alternative**: Ubuntu 24.04 LTS, Debian 12

## Software Requirements

### Runtime Environment

| Software | Version | Purpose |
|----------|---------|---------|
| Node.js | 18.x LTS (required) | JavaScript runtime |
| npm | 9.x+ | Package manager |
| Git | 2.40+ | Version control |

### Build Tools

| Software | Version | Purpose |
|----------|---------|---------|
| TypeScript | 5.6.x | Type checking |
| Expo CLI | Latest | React Native tooling |
| Firebase CLI | Latest | Firebase deployment |

### Optional (for Native Builds)

| Software | Version | Purpose |
|----------|---------|---------|
| Java JDK | 17 | Android builds |
| Android SDK | 34 | Android builds |
| Watchman | Latest | File watching (performance) |

## Network Requirements

### Inbound Ports

| Port | Protocol | Purpose |
|------|----------|---------|
| 22 | TCP | SSH access |
| 80 | TCP | HTTP (redirect to HTTPS) |
| 443 | TCP | HTTPS |
| 8081 | TCP | Metro bundler (development only) |
| 19000 | TCP | Expo DevTools (development only) |
| 19001 | TCP | Expo DevTools (development only) |

### Outbound Access

The server requires outbound internet access for:
- npm registry (registry.npmjs.org)
- Firebase services (*.googleapis.com, *.firebaseio.com)
- Expo services (expo.dev, *.expo.dev)
- GitHub (github.com) - for dependency fetching

## AWS Services Required

### Core Services

| Service | Purpose |
|---------|---------|
| EC2 | Application hosting |
| VPC | Network isolation |
| Security Groups | Firewall rules |
| Elastic IP | Static public IP (recommended) |

### Recommended Additional Services

| Service | Purpose |
|---------|---------|
| Route 53 | DNS management |
| ACM | SSL certificates |
| CloudWatch | Monitoring and logging |
| S3 | Static asset storage (optional) |
| CloudFront | CDN for web assets (optional) |

## Firebase Requirements

### Firebase Project Setup

The application requires a Firebase project with the following services enabled:

| Service | Purpose |
|---------|---------|
| Firebase Authentication | User authentication (email/password) |
| Cloud Firestore | NoSQL database |
| Firebase Storage | File uploads (documents, images) |
| Cloud Functions | Backend logic |
| Cloud Messaging | Push notifications |

### Firebase Configuration Files

| File | Platform | Location |
|------|----------|----------|
| GoogleService-Info.plist | iOS | Project root |
| google-services.json | Android | android/app/ |
| Firebase Admin SDK JSON | Server | Secure location |

## External Service Requirements

### Onfido (Identity Verification)

- API Token
- Workflow Run ID
- Configured verification workflow

## Environment Variables

The following environment variables must be configured:

```bash
# Firebase Configuration
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
EXPO_PUBLIC_FIREBASE_APP_ID_IOS=
EXPO_PUBLIC_FIREBASE_APP_ID_ANDROID=
EXPO_PUBLIC_FIREBASE_APP_ID_WEB=
EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID=

# Onfido Configuration
EXPO_PUBLIC_ONFIDO_API_TOKEN=
EXPO_PUBLIC_ONFIDO_WORKFLOW_RUN_ID=
```

## Security Requirements

### IAM Permissions

The EC2 instance role should have minimal permissions:
- CloudWatch Logs (for application logging)
- S3 (if using S3 for static assets)

### Security Best Practices

- [ ] Use SSH key-based authentication (disable password auth)
- [ ] Configure Security Groups with least-privilege access
- [ ] Enable automatic security updates
- [ ] Use AWS Secrets Manager for sensitive credentials
- [ ] Enable CloudWatch logging
- [ ] Regular security patching schedule

## Scaling Considerations

### Single Instance Deployment

Suitable for:
- Development/staging environments
- Low traffic (< 1000 concurrent users)
- Cost-sensitive deployments

### Production Scaling

For high-traffic production deployments, consider:
- Application Load Balancer (ALB)
- Auto Scaling Group
- Multiple Availability Zones
- RDS or DocumentDB (if migrating from Firestore)
- ElastiCache for session management

## Cost Estimation (US East Region)

| Resource | Monthly Cost (Estimate) |
|----------|------------------------|
| t3.medium EC2 | ~$30 |
| 30 GB gp3 EBS | ~$2.50 |
| Elastic IP | ~$3.60 |
| Data Transfer (50GB) | ~$4.50 |
| **Total (Minimum)** | **~$40/month** |

*Note: Firebase costs are separate and usage-based.*
