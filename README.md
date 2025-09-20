# Augment Token Manager

A comprehensive token management system with Vue.js frontend and Cloudflare Worker backend.

## Project Structure

```
augment-token-manager-worker/
├── manager-vue/         # Vue.js Frontend Application
├── manager-worker/      # Cloudflare Worker Backend API
└── manager-go/          # Go Backend Reference Implementation
```

## Features

- **JWT Authentication**: Secure user authentication with session management
- **Token Management**: Complete CRUD operations for token records
- **Multi-Environment**: Separate development and production configurations
- **Rate Limiting**: Configurable API rate limiting and security
- **CORS Support**: Cross-origin resource sharing for frontend integration
- **KV Storage**: Cloudflare KV for scalable data persistence

## Quick Start

### Frontend (Vue.js)
```bash
cd manager-vue
npm install
npm run dev
```

### Backend (Cloudflare Worker)
```bash
cd manager-worker
npm install

# Setup development environment
npm run kv:create:dev
npm run secret:dev JWT_SECRET
npm run secret:dev ADMIN_PASSWORD

# Start development server
npm run dev
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/profile` - Get user profile
- `POST /api/auth/change-password` - Change password

### Token Management
- `GET /api/tokens` - List tokens with pagination
- `POST /api/tokens` - Create new token
- `GET /api/tokens/:id` - Get token by ID
- `PUT /api/tokens/:id` - Update token
- `DELETE /api/tokens/:id` - Delete token
- `POST /api/tokens/batch-import` - Batch import tokens

### System
- `GET /health` - Health check endpoint
- `GET /api/tokens/stats` - Token statistics

## Environment Configuration

### Development
- Worker Name: `augtoken-manager-dev`
- Higher rate limits for testing
- Localhost CORS origins
- Development KV namespaces

### Production
- Worker Name: `augtoken-manager`
- Production rate limits
- Production domain CORS
- Production KV namespaces

## Deployment

See [DEPLOYMENT.md](manager-worker/DEPLOYMENT.md) for detailed deployment instructions.

## Technology Stack

### Frontend
- Vue.js 3 with Composition API
- TypeScript
- Tabler CSS Framework
- Vite Build Tool

### Backend
- Cloudflare Workers
- TypeScript
- JWT Authentication (JOSE)
- KV Storage
- CORS & Rate Limiting

## License

MIT License
