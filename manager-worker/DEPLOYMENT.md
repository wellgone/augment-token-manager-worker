# Deployment Guide

## Environment Setup

### Development Environment

1. **Create KV Namespaces for Development**
   ```bash
   npm run kv:create:dev
   ```

2. **Set Development Secrets**
   ```bash
   npm run secret:dev JWT_SECRET
   # Enter your JWT secret when prompted
   
   npm run secret:dev ADMIN_PASSWORD
   # Enter your admin password when prompted
   ```

3. **Start Development Server**
   ```bash
   npm run dev
   ```

### Production Environment

1. **Create KV Namespaces for Production**
   ```bash
   npm run kv:create:prod
   ```

2. **Update wrangler.toml**
   - Replace KV namespace IDs with the ones created above
   - Update ALLOWED_ORIGINS with your production domain

3. **Set Production Secrets**
   ```bash
   npm run secret:prod JWT_SECRET
   # Enter your JWT secret when prompted
   
   npm run secret:prod ADMIN_PASSWORD
   # Enter your admin password when prompted
   ```

4. **Deploy to Production**
   ```bash
   npm run deploy
   ```

## Environment Configurations

### Development (wrangler-dev.toml)
- Name: `augtoken-manager-dev`
- Higher rate limits for testing
- Localhost CORS origins
- Development KV namespaces

### Production (wrangler.toml)
- Name: `augtoken-manager`
- Production rate limits
- Production domain CORS origins
- Production KV namespaces

## Manual Commands

### KV Namespace Management
```bash
# Create individual namespaces
wrangler kv:namespace create USERS_KV
wrangler kv:namespace create TOKENS_KV
wrangler kv:namespace create SESSIONS_KV

# List namespaces
wrangler kv:namespace list

# Delete namespace (be careful!)
wrangler kv:namespace delete --namespace-id=<id>
```

### Secret Management
```bash
# Set secrets for specific environment
wrangler secret put JWT_SECRET --config wrangler-dev.toml
wrangler secret put ADMIN_PASSWORD --config wrangler-dev.toml

# List secrets
wrangler secret list

# Delete secret
wrangler secret delete SECRET_NAME
```

### Deployment Commands
```bash
# Deploy to development
npm run deploy:dev

# Deploy to production
npm run deploy

# View deployment logs
wrangler tail

# View worker analytics
wrangler analytics
```

## Environment Variables

### Required Secrets
- `JWT_SECRET`: Secret key for JWT token signing
- `ADMIN_PASSWORD`: Password for admin user login

### Optional Secrets
- `EMAIL_API_KEY`: API key for email service integration

### Configuration Variables (set in wrangler.toml)
- `ALLOWED_ORIGINS`: Comma-separated list of allowed CORS origins
- `JWT_EXPIRES_IN`: JWT token expiration time (e.g., "24h")
- `REFRESH_TOKEN_EXPIRES_IN`: Refresh token expiration time (e.g., "7d")
- `RATE_LIMIT_LOGIN`: Login attempts per minute
- `RATE_LIMIT_API`: API requests per minute

## Troubleshooting

### Common Issues

1. **KV Namespace Not Found**
   - Ensure KV namespaces are created and IDs are correct in wrangler.toml

2. **CORS Errors**
   - Check ALLOWED_ORIGINS includes your frontend domain
   - Verify protocol (http/https) matches

3. **Authentication Failures**
   - Verify JWT_SECRET and ADMIN_PASSWORD are set correctly
   - Check token expiration settings

4. **Rate Limiting**
   - Adjust rate limits in wrangler.toml if needed
   - Monitor usage patterns

### Debugging
```bash
# View real-time logs
wrangler tail

# Check worker status
wrangler status

# Validate configuration
wrangler validate
```
