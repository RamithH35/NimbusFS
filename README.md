# NimbusFS
### Resilient Distributed File Storage System

NimbusFS is a multi-provider distributed file storage system designed for high availability, fault tolerance, and zero-knowledge privacy. It abstracts storage providers behind a common interface, transparently encrypts files client-side (prior to upload), and automatically fails over across independent cloud infrastructures to guarantee continuous availability.

---

## Conceptual Architecture

```
                    Client (React / Vite)
                             │
                             ▼ HTTPS (JWT / Cookies)
                     Express API Gateway
                             │
                             ▼
                 Storage Manager Abstraction
                             │
            ┌────────────────┼────────────────┬────────────────┐
            │                │                │                │
            ▼                ▼                ▼                ▼
       Cloudinary     Supabase Primary   Supabase Secondary  Local Disk
    (Primary Storage)  (First Fallback)  (Second Fallback)   (Last Resort)
                             │                │                │
                             └────────┬───────┘                │
                                      │                        ▼
                                      │                 BullMQ Queue (Redis)
                                      │                        │
                                      ▼                        ▼
                                MongoDB Metadata        Background Retry
```

### Infrastructure Dependencies
- **MongoDB**: Stores user information, file metadata (including AES encryption initialization vectors and authorization tags), and system failure logs.
- **Redis / BullMQ**: Drives background jobs, retry queues, and asynchronous workers. If all remote storage providers are down, the encrypted file buffer is queued in Redis for background retry workers.

---

## Failover & Storage Strategy

NimbusFS isolates cloud provider API details behind a unified `StorageProvider` base class. The failover loop checks the status of registered providers in a priority-ordered sequence:

1. **Cloudinary** (Primary Cloud Storage)
2. **Supabase Primary** (First Fallback Cloud Storage)
3. **Supabase Secondary** (Second Fallback Cloud Storage)
4. **Local Disk & Queue Fallback** (Last-resort fallback)

### How Failover and Health Checks Work
- **Pre-Upload Health Checks**: Prior to uploading a file, the system runs a fast, lightweight ping (`healthCheck()`) to verify if the provider is online.
- **Cascading Fallback**: If a provider is marked unhealthy or throws an exception during upload, the system logs the failure details to MongoDB ([`FailureLog`](file:///c:/Users/ramit/Resume_projects/NimbusFS/src/storage/FailureLog.js)) and immediately drops to the next provider.
- **Strict Latency Control**: Network timeouts are wrapper-configured (e.g., 2000ms for Supabase Secondary) to prevent the user request from hanging if a provider is experiencing high latency.
- **Queue Fallback**: If all remote storage backends are unreachable, the server saves the encrypted file locally and enqueues an asynchronous upload job in BullMQ. A background worker periodically retries the upload to the cloud and updates the record once resolved.

---

## Interview & Design Q&A

### Why two Supabase projects?
Using two independent Supabase instances (Supabase Primary and Supabase Secondary) provides separate, isolated failure domains. Even if a provider-wide regional outage or API deprecation impacts one Supabase project, the second project remains as a resilient backup.

**Tradeoffs Considered:**
- **Operational Complexity**: Managing two sets of API keys, URLs, and storage buckets increases the configuration surface area.
- **Data Duplication**: Maintaining multiple environments adds maintenance overhead.
- **Resilience**: The extra configuration ensures that the service is protected from single-provider downtime, matching enterprise-grade disaster recovery practices.

---

## Technology Stack

### Backend
- **Node.js** & **Express** (using ES Modules)
- **Zod**: Input schema validation
- **Multer**: Multi-part form-data parsing

### Storage
- **Cloudinary**: Primary cloud storage
- **Supabase Storage (×2)**: Primary and Secondary independent fallback cloud domains
- **Local Filesystem**: Emergency fallback directory (`/uploads`)

### Database & Caching
- **MongoDB** (via **Mongoose**): System metadata, users, files, and failure logs
- **Redis** & **BullMQ**: Asynchronous background retry system

### Security
- **Symmetric Encryption**: `AES-256-GCM` encryption of file buffers server-side prior to cloud transmission
- **JWT Authentication**: Short-lived access tokens with HTTP-Only, SameSite-Strict refresh cookies
- **Active Token Invalidation**: Increment-based `tokenVersion` stored on the User schema to instantly invalidate old sessions on logout
- **File Sniffing Protection**: Magic-number verification using the `file-type` library to block extension spoofing
- **Bcrypt**: Multi-round password hashing for shares and accounts
- **Express Rate Limiters**: Brute-force protection on authentication and public file-sharing endpoints

### Frontend
- **React 19** & **Vite**
- **Tailwind CSS v4**
- **React Router Dom v7**

### DevOps
- **GitHub Actions**: Scheduled infrastructure health/activity workflow (pings Supabase, Upstash Redis, and MongoDB Atlas databases to maintain activity and audit health)

---

## API Routes Overview

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :---: |
| **POST** | `/api/auth/register` | Create a new user profile | No |
| **POST** | `/api/auth/login` | Login user, return JWT and refresh cookie | No |
| **POST** | `/api/auth/refresh` | Issue new access token via refresh token | No |
| **POST** | `/api/auth/logout` | Clear refresh token and increment `tokenVersion` | No |
| **GET** | `/api/auth/profile` | Retrieve authenticated user profile | **Yes** |
| **POST** | `/api/files/upload` | Upload and encrypt a single file | **Yes** |
| **POST** | `/api/files/upload/init` | Initialize chunked upload session | **Yes** |
| **POST** | `/api/files/upload/chunk` | Upload individual file chunk | **Yes** |
| **POST** | `/api/files/upload/complete` | Reassemble, encrypt, and commit chunked file | **Yes** |
| **GET** | `/api/files/:id/download` | Decrypt and send file buffer to owner | **Yes** |
| **GET** | `/api/files` | Get user's uploaded files (paginated) | **Yes** |
| **DELETE**| `/api/files/:id` | Delete file from db and active provider | **Yes** |
| **POST** | `/api/files/:id/share` | Generate public access credentials for a file | **Yes** |
| **POST** | `/api/files/:id/revoke-share`| Revert file visibility to private | **Yes** |
| **GET** | `/api/share/:shareId` | Download shared file (processes password/expiry) | No |
| **GET** | `/api/health/storage` | Check health and latency of all storage providers | **Yes** |
| **GET** | `/api/admin/failures` | Retrieve history of system failures (paginated) | **Yes** |
| **POST** | `/api/admin/cleanup-chunks` | Clean up expired memory chunks and upload documents | **Yes** |

---

## Setup & Local Development

### Prerequisites
- Node.js (v18+)
- MongoDB (Local or Atlas)
- Redis (required for BullMQ queue)

### Environment Setup
Create a `.env` file in the root based on `.env.example`:

```ini
PORT=5000
NODE_ENV=development
ALLOWED_ORIGIN=http://localhost:5173

MONGO_URI=your_mongodb_connection_string

JWT_SECRET=your_jwt_secret
REFRESH_TOKEN_SECRET=your_refresh_jwt_secret

MAX_FILE_SIZE_MB=10

CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret

SUPABASE_URL=your_supabase_primary_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_primary_key
SUPABASE_BUCKET=nimbusfs-files

SUPABASE_URL_2=your_supabase_secondary_url
SUPABASE_SERVICE_ROLE_KEY_2=your_supabase_secondary_key
SUPABASE_BUCKET_2=nimbusfs-files

REDIS_URL=redis://127.0.0.1:6379

FRONTEND_URL=http://localhost:5173

ENCRYPTION_KEY=64_character_hexadecimal_encryption_key
```

### Installation
1. Install dependencies & run backend:
   ```bash
   npm install
   npm run dev
   ```
2. Install client dependencies & run frontend:
   ```bash
   cd client
   npm install
   npm run dev
   ```

---

## AI-Assisted Development

This repository contains development guidelines in the [`.agents/`](file:///c:/Users/ramit/Resume_projects/NimbusFS/.agents) folder. These instructions guide AI pair programmers on project rules, styling guidelines, and engineering playbooks when assisting with local development.
