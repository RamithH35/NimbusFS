# NimbusFS System Design & Architecture

This document details the system design, components, failover strategies, and security mechanics implemented in NimbusFS.

---

## 1. System Architecture

NimbusFS is designed as a resilient, multi-provider distributed file storage system. The architecture is decoupled to isolate storage orchestration from backend APIs, databases, and background queue workers.

```
                   +----------------------------------------+
                   |          React / Vite Client           |
                   +----------------------------------------+
                                        |
                                        | HTTPS (JWT / HTTP-Only Cookies)
                                        v
                   +----------------------------------------+
                   |        Express.js API Gateway          |
                   +----------------------------------------+
                     /                  |                 \
      Zod Validation/    Mongoose Models|                  \ BullMQ Jobs
                   v                    v                   v
            +------------+        +------------+      +------------+
            | Middleware |        |  MongoDB   |      | Redis Cache|
            +------------+        +------------+      +------------+
                                        |                   |
                                        v                   v
                               +------------------+   +------------+
                               | Metadata Store   |   | Bull Worker|
                               | (Users/Files/Logs|   +------------+
                               +------------------+         |
                                        |                   |
                                        +---------+---------+
                                                  |
                                                  v
                                  +-------------------------------+
                                  |    Storage Abstraction Layer  |
                                  |       (StorageManager)        |
                                  +-------------------------------+
                                   /        |             |      \
                                  v         v             v       v
                          +----------+ +-----------+ +-----------+ +-------+
                          |Cloudinary| | Supabase  | | Supabase  | | Local |
                          | (Primary)| |  Primary  | | Secondary | | Disk  |
                          +----------+ +-----------+ +-----------+ +-------+
```

### Infrastructure Components
- **Client (React / Vite)**: Offers a responsive drag-and-drop dashboard to upload files, manage shares, toggle light/dark modes, and view real-time system administrator stats.
- **Express Backend**: Hosts the API Gateway, handling routing, Zod validation, JWT session generation, token validation, rate-limiting, and error logging.
- **Metadata Database (MongoDB)**: Maintains documents for user credentials, file records (including stored names, symmetric keys, and file status), and failure logs.
- **Queue System (Redis & BullMQ)**: Provides asynchronous retry capabilities. If all remote storage providers are down, the encrypted file buffer is queued in Redis for background retry workers.

---

## 2. Storage Provider Abstraction

All storage backends inherit from a common base class: [`StorageProvider`](file:///c:/Users/ramit/Resume_projects/NimbusFS/src/providers/StorageProvider.js). This design guarantees that adding or removing a storage provider does not require changing core application routes or controllers.

### Common Interface
Each provider must implement the following async interface:
- `upload(fileBuffer, originalName, mimeType)`: Commits a file to the provider's storage. Returns a unique locator (`storedName`) and file `url`.
- `download(storedName)`: Fetches the file binary stream.
- `delete(storedName)`: Removes the file from the provider.
- `healthCheck()`: Assesses the availability and response latency of the remote service.

---

## 3. Failover Strategy

To bypass single-provider outages, NimbusFS implements cascading inline fallbacks during upload operations.

The fallback sequence is prioritized as follows:

```
[Cloudinary] (Primary Cloud)
       ↓ (Unhealthy or Upload Exception)
[Supabase Primary] (First Fallback)
       ↓ (Unhealthy or Upload Exception)
[Supabase Secondary] (Second Fallback)
       ↓ (Unhealthy or Upload Exception)
[Local Storage / BullMQ Queue] (Asynchronous Retry)
```

1. **Cloudinary**: Checked first as the primary cloud storage service.
2. **Supabase Primary**: The first fallback cloud provider.
3. **Supabase Secondary**: The second fallback cloud provider, acting as an independent failure domain.
4. **Local Disk**: The last-resort local fallback. The server stores the file locally in `/uploads` and schedules an asynchronous BullMQ background task to push it to cloud providers once they recover.

---

## 4. Failure Detection & Health Checks

Availability is determined dynamically:
- **Pre-Upload Pings**: Before sending a file to a provider, the `StorageManager` invokes the provider's `.healthCheck()`.
- **Latency Monitoring**: Latency is tracked and displayed on the Admin Dashboard to visualize degradation.
- **Timeout Management**: Secondary fallbacks (like Supabase Secondary) are bound to strict request timeout limits (e.g., 2000ms) to ensure failovers occur quickly without hanging the client.
- **Failure Logging**: Any provider failure or upload exception is written to the [`FailureLog`](file:///c:/Users/ramit/Resume_projects/NimbusFS/src/storage/FailureLog.js) collection. Admin dashboards use these logs to display 24-hour health history and alert administrators.

---

## 5. Metadata Storage

Database schemas are strictly modeled using Mongoose:
- **`User`**: Tracks email, hashed password, name, and `tokenVersion` (utilized for invalidating outstanding JWT tokens immediately on logout).
- **`File`**: Tracks ownership, file size, visibility (private vs. shared), link passwords, expiry limits, download counts, chunk configurations, and decryption keys (`iv` and `authTag`).
- **`FailureLog`**: Captures details of failed storage operations, including provider name, error message, and the fallback provider that ultimately resolved the request.

---

## 6. Queue & Retry System

If all cloud storage services are offline:
1. The server uploads the file locally and returns a `queued` state to the user.
2. The server base64-encodes the encrypted payload and inserts an upload job into the BullMQ retry queue.
3. The background BullMQ worker pulls the job and repeatedly tries to push the file to a healthy cloud provider.
4. Once successfully uploaded, the file's provider metadata in MongoDB is updated from `local` to the resolving cloud provider, and the local file copy is purged.

---

## 7. Encryption Architecture

NimbusFS follows a zero-knowledge cloud storage principle: **Symmetric Encryption is performed client-side (server-side relative to the cloud)** before writing any binaries to remote servers.

- **Algorithm**: `AES-256-GCM` (Galois/Counter Mode).
- **Process**:
  1. For every uploaded file, a unique 12-byte Initialization Vector (IV) is generated.
  2. The server encrypts the buffer using the symmetric key defined in `ENCRYPTION_KEY`.
  3. GCM outputs the ciphertext and a 16-byte Authentication Tag (guaranteeing integrity and authenticity).
  4. The IV and Authentication Tag are saved in MongoDB on the `File` document, while the ciphertext is written to the cloud provider.
  5. During download, the stream is decrypted on-the-fly using the key, IV, and Tag, streaming plaintext to the authorized user.

---

## 8. Authentication & Session Security

Session management is built to prevent common token theft and XSS vulnerabilities:
- **Dual-Token System**:
  - **Access Token**: Short-lived (15 minutes) JWT token passed in headers for API access.
  - **Refresh Token**: Long-lived (7 days) JWT token sent via `HttpOnly`, `Secure`, and `SameSite=Strict` cookies.
- **Active Token Invalidation**:
  - Instead of waiting for tokens to expire naturally, the user document holds a `tokenVersion`.
  - On user logout, the `tokenVersion` is incremented.
  - Any incoming request verifying against an older `tokenVersion` is immediately rejected, rendering all previously issued tokens useless.

---

## 9. Reliability & Security Configurations

- **File Extension Sniffing**: Uses the `file-type` library to read file magic numbers instead of relying on the user-supplied file extension, preventing malicious uploads.
- **Rate Limiting**: Custom Express rate limiters guard API endpoints (specifically authorization and sharing endpoints) against brute-force attacks.
- **Independent Fallbacks**: Supabase Primary and Supabase Secondary represent separate, isolated projects under different Supabase instances, protecting against provider-wide network failures.

---

## 10. Design Tradeoffs

### High Availability vs. Storage Replication Costs
- **Resilience**: Spanning uploads across Cloudinary and two Supabase projects ensures the storage system stays operational even during multi-provider outages.
- **Complexity Tradeoff**: Maintaining independent API keys, buckets, and configurations increases DevOps and operational complexity. High-availability failover also requires structured synchronization (like the background BullMQ retry queue) to reconcile local fallbacks with cloud providers.
