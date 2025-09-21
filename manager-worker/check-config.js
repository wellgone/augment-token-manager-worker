#!/usr/bin/env node

/**
 * Configuration Checker for Augment Token Manager
 * 
 * This script helps validate the configuration setup for the simplified
 * KV structure (TOKENS_KV + SESSIONS_KV only).
 */

import fs from 'fs';
import path from 'path';

const CONFIG_FILES = ['wrangler.toml', 'wrangler-dev.toml'];
const REQUIRED_KV_BINDINGS = ['TOKENS_KV', 'SESSIONS_KV'];
const REQUIRED_VARS = ['USER_CREDENTIALS'];
const OPTIONAL_VARS = [
  'EMAIL_DOMAINS',
  'EMAIL_API_BASE_URL',
  'EMAIL_API_TOKEN'
];

function checkConfigFile(filePath) {
  console.log(`\n🔍 检查配置文件: ${filePath}`);
  
  if (!fs.existsSync(filePath)) {
    console.log(`❌ 文件不存在: ${filePath}`);
    console.log(`💡 请从 ${filePath}.example 复制并配置`);
    return false;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  let isValid = true;

  // 检查KV命名空间
  console.log('\n📦 检查KV命名空间:');
  for (const binding of REQUIRED_KV_BINDINGS) {
    const kvRegex = new RegExp(`binding\\s*=\\s*"${binding}"`, 'i');
    if (kvRegex.test(content)) {
      console.log(`✅ ${binding} - 已配置`);
    } else {
      console.log(`❌ ${binding} - 缺失`);
      isValid = false;
    }
  }

  // 检查必需的环境变量
  console.log('\n🔧 检查必需配置:');
  for (const varName of REQUIRED_VARS) {
    const varRegex = new RegExp(`${varName}\\s*=`, 'i');
    if (varRegex.test(content)) {
      console.log(`✅ ${varName} - 已配置`);
    } else {
      console.log(`❌ ${varName} - 缺失`);
      isValid = false;
    }
  }

  // 检查可选的环境变量
  console.log('\n⚙️ 检查可选配置:');
  for (const varName of OPTIONAL_VARS) {
    const varRegex = new RegExp(`${varName}\\s*=`, 'i');
    if (varRegex.test(content)) {
      console.log(`✅ ${varName} - 已配置`);
    } else {
      console.log(`⚠️ ${varName} - 未配置 (可选)`);
    }
  }

  // 检查是否有已移除的配置
  console.log('\n🗑️ 检查已移除的配置:');
  const removedBindings = ['USERS_KV', 'OAUTH_KV'];
  for (const binding of removedBindings) {
    const kvRegex = new RegExp(`binding\\s*=\\s*"${binding}"`, 'i');
    if (kvRegex.test(content)) {
      console.log(`⚠️ ${binding} - 应该移除 (已简化)`);
    } else {
      console.log(`✅ ${binding} - 已正确移除`);
    }
  }

  return isValid;
}

function checkPackageScripts() {
  console.log('\n📜 检查package.json脚本:');
  
  const packagePath = 'package.json';
  if (!fs.existsSync(packagePath)) {
    console.log('❌ package.json 不存在');
    return false;
  }

  const packageContent = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  const scripts = packageContent.scripts || {};

  const expectedScripts = {
    'kv:create:dev': 'wrangler kv:namespace create TOKENS_KV --preview && wrangler kv:namespace create SESSIONS_KV --preview',
    'kv:create:prod': 'wrangler kv:namespace create TOKENS_KV && wrangler kv:namespace create SESSIONS_KV'
  };

  let isValid = true;
  for (const [scriptName, expectedCommand] of Object.entries(expectedScripts)) {
    if (scripts[scriptName]) {
      if (scripts[scriptName].includes('USERS_KV') || scripts[scriptName].includes('OAUTH_KV')) {
        console.log(`⚠️ ${scriptName} - 包含已移除的KV命名空间`);
        isValid = false;
      } else {
        console.log(`✅ ${scriptName} - 已更新`);
      }
    } else {
      console.log(`❌ ${scriptName} - 缺失`);
      isValid = false;
    }
  }

  return isValid;
}

function main() {
  console.log('🚀 Augment Token Manager 配置检查器');
  console.log('📋 极简版本 - 仅使用 TOKENS_KV + SESSIONS_KV，数值配置已硬编码');
  
  let allValid = true;

  // 检查配置文件
  for (const configFile of CONFIG_FILES) {
    const isValid = checkConfigFile(configFile);
    allValid = allValid && isValid;
  }

  // 检查package.json脚本
  const scriptsValid = checkPackageScripts();
  allValid = allValid && scriptsValid;

  // 总结
  console.log('\n' + '='.repeat(50));
  if (allValid) {
    console.log('🎉 配置检查通过！');
    console.log('💡 提示:');
    console.log('   - 如果是首次部署，请运行: npm run kv:create:dev 或 npm run kv:create:prod');
    console.log('   - 确保 USER_CREDENTIALS 格式为: admin:password');
    console.log('   - 邮箱功能需要配置 EMAIL_DOMAINS, EMAIL_API_BASE_URL 和 EMAIL_API_TOKEN (CloudMail)');
    console.log('   - 数值配置已硬编码: 会话24h, 登录限制10次/分钟, API限制100次/分钟');
  } else {
    console.log('❌ 配置检查失败，请修复上述问题');
    console.log('📖 参考文档: CONFIG.md');
  }
  
  process.exit(allValid ? 0 : 1);
}

main();
