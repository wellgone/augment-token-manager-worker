# 部署指南

## 快速部署

### 自动部署（推荐）

**Windows (PowerShell):**
```powershell
.\deploy.ps1
```

**Linux/macOS (Bash):**
```bash
./deploy.sh
```

### 手动部署

1. **构建前端**
   ```bash
   cd manager-vue
   npm install
   npm run build
   ```

2. **部署Worker**
   ```bash
   cd ../manager-worker
   npm install
   wrangler deploy
   ```

## 环境配置

部署完成后，需要设置用户凭据：

```bash
cd manager-worker
wrangler secret put USER_CREDENTIALS
```

输入格式：`admin:your-password,user1:pass123,user2:pass456`

## 构建配置说明

### Vue项目配置
- **输出目录**: `../manager-worker/dist`
- **自动清空**: 构建前清空目标目录
- **图标复制**: 自动复制图标文件到worker

### Worker配置
- **静态资源**: 从 `./dist` 目录服务前端文件
- **API路由**: `/api/*` 路径处理后端逻辑
- **健康检查**: `/health` 端点

## 开发模式

### 前端开发
```bash
cd manager-vue
npm run dev
# 访问 http://localhost:5173
```

### Worker开发
```bash
cd manager-worker
wrangler dev
# 访问 http://localhost:8787
```

## 功能标志

通过环境变量控制功能模块：

- `VITE_ENABLE_EMAIL_SUBSCRIPTION`: 邮件订阅功能
- `VITE_ENABLE_UUID_MANAGER`: UUID管理功能  
- `VITE_ENABLE_ACTIVATION_CODE_MANAGER`: 激活码管理功能

开发环境默认全部启用，生产环境默认全部禁用。
