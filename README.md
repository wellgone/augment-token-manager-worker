# Augment Token Manager

A simplified token management system with Vue.js frontend and Cloudflare Worker backend, focused on core token management and OAuth authorization.

## Project Structure

```
augment-token-manager-worker/
├── manager-vue/         # Vue.js Frontend Application
├── manager-worker/      # Cloudflare Worker Backend API
```

## Features

- **Session Authentication**: Simple session-based user authentication
- **Token Management**: Complete CRUD operations for token records
- **OAuth Authorization**: Augment OAuth flow with PKCE support
- **Token Validation**: Real-time token status checking and refresh
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

# Setup user credentials
wrangler secret put USER_CREDENTIALS
# Format: admin:your-password,user1:pass123

# Start development server
npm run dev
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/validate` - Validate current session
- `GET /api/auth/generate-url` - Generate OAuth authorization URL
- `POST /api/auth/validate-response` - Validate OAuth response

### Token Management
- `GET /api/tokens` - List all tokens with pagination
- `POST /api/tokens` - Create new token
- `GET /api/tokens/:id` - Get token by ID
- `PUT /api/tokens/:id` - Update token
- `DELETE /api/tokens/:id` - Delete token
- `POST /api/tokens/:id/validate` - Validate token status
- `POST /api/tokens/:id/refresh` - Refresh token information
- `POST /api/tokens/batch-import` - Batch import tokens
- `GET /api/tokens/stats` - Get token statistics

## Deployment

### Production Deployment
```bash
# Build frontend
cd manager-vue
npm run build

# Deploy worker
cd ../manager-worker
wrangler deploy
```

### Environment Setup
```bash
# Set user credentials
wrangler secret put USER_CREDENTIALS
# Format: admin:your-password,user1:pass123
```

## Technology Stack

### Frontend
- Vue.js 3 with Composition API
- TypeScript
- Tabler CSS Framework
- Vite Build Tool

### Backend
- Cloudflare Workers
- TypeScript
- Session-based Authentication
- KV Storage
- CORS & Rate Limiting

## License

MIT License

MIT License
