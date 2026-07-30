# NimbusFS Project Development Guidelines

This project consists of:
- **Backend**: Node.js + Express backend (ES modules) located in `src/`.
- **Frontend**: React + Vite client located in `client/`.
- **Database**: MongoDB via Mongoose.

## Tech Stack & Structure

- **Backend Location**: `src/`
  - Scaffolding: `auth/`, `storage/`, `providers/` (Cloudinary, Supabase), `services/`, `controllers/`, `routes/`, `middleware/`, `jobs/`, `utils/`, `config/`
  - Entry Point: `src/server.js`
- **Frontend Location**: `client/`
  - Scaffolding: React (Vite) styled with Tailwind CSS v4.
- **Database**: MongoDB (configured via Mongoose connection in `server.js`).

## Getting Started

### 1. Setup Environment
Create a `.env` file in the root directory based on `.env.example`:
```ini
PORT=5000
ALLOWED_ORIGIN=http://localhost:5173
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
MAX_FILE_SIZE_MB=10
```

### 2. Run Backend
From the project root:
```bash
npm install     # Install dependencies
npm run dev     # Run backend in watch/development mode
npm run lint    # Lint the backend code
```

### 3. Run Frontend
From the `client/` directory:
```bash
cd client
npm install     # Install dependencies
npm run dev     # Run front-end client
npm run build   # Build production assets
```
