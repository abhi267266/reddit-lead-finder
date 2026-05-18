# 🔍 Reddit Lead Finder

Welcome to **Reddit Lead Finder**, an automated SaaS application that scans subreddits for high-engagement, high-intent posts matching keyword configurations to capture target audience leads seamlessly.

This repository is structured as a **Monorepo** comprising two main services:
- **Go Backend Service (`/`)**: A fast, concurrent engine built with Go, PostgreSQL, Goose, and SQLC.
- **Next.js Client Service (`/client`)**: A sleek modern dashboard built with React 19, TypeScript, Tailwind CSS, and AWS Cognito.

---

## 🏗 Repository Structure

```tree
reddit-lead-finder/
├── client/                 # Next.js Frontend App
│   ├── src/                # Next.js Application Source
│   ├── public/             # Static Assets
│   ├── package.json        # Frontend Dependencies
│   └── .env.example        # Frontend Environment Config
├── cmd/                    # Go Main Executables
│   └── server/             # API Server Entrypoint
├── internal/               # Go Private Application Packages
├── migrations/             # Database Migration Files
├── go.mod                  # Go Modules Definition
├── sqlc.yaml               # SQLC SQL Compiler Config
└── .gitignore              # Unified Monorepo Git Ignore Config
```

---

## 🛠 Prerequisites

Ensure you have the following installed on your system:
- **Go 1.22+**
- **Node.js 18+** & **npm** (or `pnpm`/`yarn`)
- **PostgreSQL** (running locally or in the cloud)
- **AWS Cognito User Pool** (for authentication)

---

## 🚀 Step-by-Step Monorepo Setup & Run

Follow these steps to configure and boot both backend and frontend applications.

### Step 1: Configure & Run Go Backend

1. **Navigate to the Root Directory**:
   ```bash
   cd reddit-lead-finder
   ```

2. **Configure Environment Variables**:
   Copy the backend example environment file and fill in your details:
   ```bash
   cp .env.example .env
   ```
   *Modify the database credentials and Reddit API app details inside `.env`.*

3. **Install Go Dependencies**:
   ```bash
   go mod download
   ```

4. **Apply Database Migrations**:
   The Go server applies migrations on boot automatically, or you can run them manually:
   ```bash
   bash migration.sh up
   ```

5. **Start the Go Backend Server**:
   ```bash
   go run cmd/server/main.go
   ```
   The backend will start and listen on port `8080` (or the configured `PORT`).

---

### Step 2: Configure & Run Next.js Client

Open a new terminal window or tab and set up the client side:

1. **Navigate to the Client Directory**:
   ```bash
   cd reddit-lead-finder/client
   ```

2. **Configure Client Environment Variables**:
   Copy the frontend example environment file:
   ```bash
   cp .env.example .env
   ```
   *Fill in your `NEXT_PUBLIC_USER_POOL_ID` and `NEXT_PUBLIC_USER_POOL_CLIENT_ID` matching your AWS Cognito setup. Ensure `NEXT_PUBLIC_API_URL` points to the Go backend (`http://localhost:8080`).*

3. **Install Frontend Dependencies**:
   ```bash
   npm install
   ```

4. **Start the Next.js Development Server**:
   ```bash
   npm run dev
   ```
   The client will compile and boot a dev server at [http://localhost:3000](http://localhost:3000).

---

## 📡 API Endpoints

Once the backend is running, the following API endpoints are exposed on `http://localhost:8080`:

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/auth/register` | `POST` | Register a new user |
| `/api/auth/login` | `POST` | Authenticate & retrieve JWT token |
| `/api/auth/me` | `GET` | Get current user's profile |
| `/api/campaigns` | `GET` | List all search campaigns |
| `/api/campaigns` | `POST` | Create a new campaign |
| `/api/campaigns/{id}` | `GET` | Get specific campaign info |
| `/api/campaigns/{id}` | `PATCH` | Edit campaign parameters |
| `/api/campaigns/{id}` | `DELETE` | Delete a campaign |
| `/api/campaigns/{id}/status`| `PATCH` | Toggle Campaign state (Active/Paused) |
| `/api/campaigns/{id}/posts` | `GET` | Retrieve identified Reddit leads |
| `/api/posts/{id}` | `DELETE` | Remove a target lead |

---

## 🔨 Development Workflows

### Generating DB Queries with SQLC
If you modify `.sql` files inside `internal/db/queries/`, run the SQLC compiler to regenerate type-safe Go code:
```bash
# Make sure sqlc is installed
sqlc generate
```

### Creating Migrations
To add database schema changes, create a new `.sql` file in `migrations/` and apply:
```bash
bash migration.sh up
```

### Running Tests
To run Go tests:
```bash
go test ./...
```
