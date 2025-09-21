# Augment Token Manager

一个极简的Token管理系统，采用Vue.js前端和Cloudflare Worker后端，专注于核心Token管理和OAuth授权功能。

## 项目结构

```
augment-token-manager-worker/
├── manager-vue/         # Vue.js 前端应用
├── manager-worker/      # Cloudflare Worker 后端API
```

## 核心功能

- **会话认证**: 简单的基于会话的用户认证
- **Token管理**: 完整的Token记录CRUD操作
- **OAuth授权**: Augment OAuth流程，支持PKCE
- **Token验证**: 实时Token状态检查和刷新
- **邮箱集成**: CloudMail邮箱服务集成（可选）
- **极简配置**: 最少配置项，大部分参数硬编码
- **KV存储**: Cloudflare KV可扩展数据持久化

## 快速开始

### 前端 (Vue.js)
```bash
cd manager-vue
npm install
npm run dev
```

### 后端 (Cloudflare Worker)
```bash
cd manager-worker
npm install

# 检查配置
npm run check-config

# 设置用户凭据（必需）
wrangler secret put USER_CREDENTIALS
# 格式: admin:your-password

# 创建KV命名空间（极简：仅2个命名空间）
npm run kv:create:dev  # 开发环境
npm run kv:create:prod # 生产环境

# 启动开发服务器
npm run dev
```

### 可选：邮箱功能配置
```bash
# 在 wrangler.toml 中配置（可选）
EMAIL_DOMAINS = ["your-domain1.com","your-domain2.com"]
EMAIL_API_BASE_URL = "https://your-cloudmail-domain.com"
EMAIL_API_TOKEN = "your-cloudmail-admin-token"
```

## API接口

### 认证相关
- `POST /api/auth/login` - 用户登录
- `POST /api/auth/logout` - 用户登出
- `GET /api/auth/validate` - 验证当前会话
- `GET /api/auth/generate-url` - 生成OAuth授权URL
- `POST /api/auth/validate-response` - 验证OAuth响应

### Token管理
- `GET /api/tokens` - 分页获取Token列表
- `POST /api/tokens` - 创建新Token
- `GET /api/tokens/:id` - 根据ID获取Token
- `PUT /api/tokens/:id` - 更新Token
- `DELETE /api/tokens/:id` - 删除Token
- `POST /api/tokens/:id/validate` - 验证Token状态
- `POST /api/tokens/:id/refresh` - 刷新Token信息
- `POST /api/tokens/batch-import` - 批量导入Token
- `GET /api/tokens/stats` - 获取Token统计

### 邮箱服务（可选）
- `GET /api/email/domains` - 获取可用邮箱域名
- `POST /api/email/generate` - 生成临时邮箱
- `GET /api/email/verification-code` - 获取验证码

## 部署

### 生产环境部署
```bash
# 构建前端
cd manager-vue
npm run build

# 部署Worker
cd ../manager-worker
wrangler deploy
```

### 环境配置
```bash
# 首先检查配置
cd manager-worker
npm run check-config

# 设置用户凭据（必需）
wrangler secret put USER_CREDENTIALS
# 格式: admin:your-password

# 创建KV命名空间（极简结构）
npm run kv:create:prod
```

## 配置说明

### 必需配置
- **USER_CREDENTIALS**: 用户凭据（格式：admin:password）

### 可选配置（邮箱功能）
- **EMAIL_DOMAINS**: 邮箱域名列表
- **EMAIL_API_BASE_URL**: CloudMail服务URL
- **EMAIL_API_TOKEN**: CloudMail管理员令牌

### 硬编码配置（无需设置）
- 会话过期时间：24小时
- 登录速率限制：10次/分钟
- API速率限制：100次/分钟
- Token验证超时：30秒

## 技术栈

### 前端
- Vue.js 3 + Composition API
- TypeScript
- Bootstrap CSS框架
- Vite构建工具

### 后端
- Cloudflare Workers
- TypeScript
- 基于会话的认证
- KV存储
- 内置速率限制

## 许可证

MIT License
