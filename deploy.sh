#!/bin/bash
# Augment Token Manager 部署脚本

echo "🚀 开始部署 Augment Token Manager..."

# 检查必要的工具
echo "📋 检查环境..."

if ! command -v npm &> /dev/null; then
    echo "❌ 错误: 未找到 npm，请先安装 Node.js"
    exit 1
fi

if ! command -v wrangler &> /dev/null; then
    echo "❌ 错误: 未找到 wrangler，请先安装: npm install -g wrangler"
    exit 1
fi

# 构建前端
echo "🏗️  构建前端项目..."
cd manager-vue

# 安装依赖（如果需要）
if [ ! -d "node_modules" ]; then
    echo "📦 安装前端依赖..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ 前端依赖安装失败"
        exit 1
    fi
fi

# 构建前端
echo "🔨 构建前端代码..."
npm run build
if [ $? -ne 0 ]; then
    echo "❌ 前端构建失败"
    exit 1
fi

echo "✅ 前端构建完成，输出到 ../manager-worker/dist"

# 切换到 worker 目录
cd ../manager-worker

# 安装 worker 依赖（如果需要）
if [ ! -d "node_modules" ]; then
    echo "📦 安装 Worker 依赖..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ Worker 依赖安装失败"
        exit 1
    fi
fi

# 部署到 Cloudflare
echo "☁️  部署到 Cloudflare Workers..."
wrangler deploy
if [ $? -ne 0 ]; then
    echo "❌ 部署失败"
    exit 1
fi

echo "🎉 部署成功！"
echo "📝 请记住设置环境变量:"
echo "   wrangler secret put USER_CREDENTIALS"
echo "   格式: admin:your-password,user1:pass123"

# 返回根目录
cd ..
