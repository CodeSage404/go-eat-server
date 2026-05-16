# Go-eat Backend Server

A robust, containerized Node.js backend for the Go-eat platform. Built with Express and TypeScript.

## 🚀 Getting Started

### Prerequisites
- Node.js (v22+)
- Docker & Docker Compose (Optional, but recommended)

### Local Development (Without Docker)
1. Install dependencies:
   ```bash
   npm installE
   ```
2. Start the development server:
   ```bash
   npm run dev
   ```
3. The API will be available at `http://localhost:5000`.

### Development with Docker
1. Ensure Docker is running.
2. Build and start the containers:
   ```bash
   docker-compose up --build
   ```
3. The container will mount your local files and support hot-reloading.

## 📁 Project Structure
- `src/`
  - `app.ts`: Express application setup and middleware.
  - `index.ts`: Entry point.
  - `controllers/`: Request handlers.
  - `routes/`: API route definitions.
  - `models/`: Database models.
  - `middleware/`: Custom Express middleware.
  - `config/`: Configuration files (DB, auth, etc.).

## 🛠️ Tech Stack
- **Node.js** & **TypeScript**
- **Express**: Web framework.
- **Helmet**: Security headers.
- **Morgan**: HTTP request logging.
- **CORS**: Cross-origin resource sharing.
- **Docker**: Containerization.

## 🛡️ Security Best Practices
- Multi-stage Docker builds.
- Running as non-root user in containers.
- Environment variable management via `.env`.
- Security-focused middleware (Helmet).
