# NimbusFS

NimbusFS is a distributed multi-cloud file storage platform featuring automatic failover, client/server-side encryption, and access-controlled file sharing.

---

## 🛠️ Technology Stack

* **Backend**: Node.js + Express (ES Modules)
* **Frontend**: React (Vite) styled with Tailwind CSS v4
* **Database**: MongoDB via Mongoose
* **Security & Headers**: Helmet, CORS, and Express Rate Limit
* **Linting**: ESLint (Flat Config)

---

## 📂 Project Structure

The codebase is organized into a backend root project and a frontend client sub-directory:

```text
NimbusFS/
├── src/                      # Express Backend
│   ├── auth/                 # Authentication logic
│   ├── config/               # App configuration (env.js)
│   ├── controllers/          # Request controllers
│   ├── jobs/                 # Cron tasks and background workers
│   ├── middleware/           # Express middleware (auth, rate limits)
│   ├── providers/            # Cloud storage providers
│   │   ├── cloudinary/       # Cloudinary setup
│   │   └── supabase/         # Supabase setup
│   ├── routes/               # API endpoint routing
│   ├── services/             # Core business logic
│   ├── storage/              # Local disk storage managers
│   ├── utils/                # Utility helper functions
│   └── server.js             # Express application entry point
├── client/                   # Frontend React + Vite Workspace
│   ├── src/                  # React source files
│   │   ├── assets/           # Client-side static assets (images/SVGs)
│   │   ├── index.css         # Main stylesheet (Tailwind v4 entry)
│   │   ├── main.jsx          # Vite React entry mount
│   │   └── App.jsx           # Main React App layout
│   └── package.json          # Client-side dependencies and build scripts
├── eslint.config.js          # ESLint flat config
├── .env.example              # Template environment file
├── package.json              # Backend dependencies and scripts
└── README.md                 # This file
```

---

## 🚀 Getting Started

### 1. Prerequisites
Ensure you have [Node.js](https://nodejs.org/) installed (v18+ recommended).

### 2. Environment Configuration
Create a `.env` file in the project root:
```ini
# Copy values from .env.example
cp .env.example .env
```
Fill in your MongoDB credentials (`MONGO_URI`) and other provider API keys:
* `MONGO_URI`: Your MongoDB connection string.
* `ALLOWED_ORIGIN`: Front-end origin URL (e.g. `http://localhost:5173`).
* `JWT_SECRET`: Secret key for signing web tokens.
* `MAX_FILE_SIZE_MB`: Max upload file size constraint (defaults to `10`).

---

## 💻 Running the Application

### Running the Backend
From the project root:
```bash
# Install dependencies
npm install

# Run the backend in development watch mode
npm run dev

# Run the linter
npm run lint
```

The backend server runs by default on port `5000` (configurable via `PORT` in `.env`).

### Running the Frontend Client
From the `client/` subdirectory:
```bash
cd client

# Install dependencies
npm install

# Run the client in development mode
npm run dev

# Compile the client for production
npm run build
```

The client local development server runs by default at `http://localhost:5173`.
