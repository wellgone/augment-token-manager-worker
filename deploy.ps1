#!/usr/bin/env pwsh
# Augment Token Manager 部署脚本

Write-Host "🚀 开始部署 Augment Token Manager..." -ForegroundColor Green

# 检查必要的工具
Write-Host "📋 检查环境..." -ForegroundColor Yellow

if (-not (Get-Command "npm" -ErrorAction SilentlyContinue)) {
    Write-Host "❌ 错误: 未找到 npm，请先安装 Node.js" -ForegroundColor Red
    exit 1
}

if (-not (Get-Command "wrangler" -ErrorAction SilentlyContinue)) {
    Write-Host "❌ 错误: 未找到 wrangler，请先安装: npm install -g wrangler" -ForegroundColor Red
    exit 1
}

# 构建前端
Write-Host "🏗️  构建前端项目..." -ForegroundColor Yellow
Set-Location "manager-vue"

# 安装依赖（如果需要）
if (-not (Test-Path "node_modules")) {
    Write-Host "📦 安装前端依赖..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ 前端依赖安装失败" -ForegroundColor Red
        exit 1
    }
}

# 构建前端
Write-Host "🔨 构建前端代码..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 前端构建失败" -ForegroundColor Red
    exit 1
}

Write-Host "✅ 前端构建完成，输出到 ../manager-worker/dist" -ForegroundColor Green

# 切换到 worker 目录
Set-Location "../manager-worker"

# 安装 worker 依赖（如果需要）
if (-not (Test-Path "node_modules")) {
    Write-Host "📦 安装 Worker 依赖..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Worker 依赖安装失败" -ForegroundColor Red
        exit 1
    }
}

# 部署到 Cloudflare
Write-Host "☁️  部署到 Cloudflare Workers..." -ForegroundColor Yellow
wrangler deploy
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 部署失败" -ForegroundColor Red
    exit 1
}

Write-Host "🎉 部署成功！" -ForegroundColor Green
Write-Host "📝 请记住设置环境变量:" -ForegroundColor Yellow
Write-Host "   wrangler secret put USER_CREDENTIALS" -ForegroundColor Cyan
Write-Host "   格式: admin:your-password,user1:pass123" -ForegroundColor Gray

# 返回根目录
Set-Location ".."
