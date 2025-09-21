<script setup lang="ts">
import { RouterView, useRoute } from 'vue-router'
import { computed } from 'vue'
import NavigationBar from './components/NavigationBar.vue'
import ToastNotification from './components/ToastNotification.vue'

const route = useRoute()

// 判断是否为登录页面
const isLoginPage = computed(() => route.path === '/login')
</script>

<template>
  <!-- 登录页面布局 -->
  <div v-if="isLoginPage">
    <RouterView />
  </div>

  <!-- 管理页面布局 -->
  <div v-else class="page">
    <NavigationBar />
    <div class="page-wrapper">
      <div class="page-body" style="padding-bottom: 30px;">
        <div class="container-xl">
          <RouterView />
        </div>
      </div>
      <!-- 版权信息 -->
      <footer class="footer footer-transparent d-print-none" style="position: fixed; bottom: 0; left: 0; right: 0; z-index: 100; background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(10px); border-top: 1px solid var(--tblr-border-color-light); padding: 0;">
        <div class="container-xl" style="padding-top: 8px; padding-bottom: 8px;">
          <div class="text-center">
            <span style="font-size: 0.75rem; color: var(--tblr-muted);">
              &copy; 2025 qianshe. Powered by
              <a href="https://github.com/KleinerSource/augment_token_manager_frontend" target="_blank" style="color: var(--tblr-primary); text-decoration: none;">KleinerSource</a>
            </span>
          </div>
        </div>
      </footer>
    </div>
  </div>

  <!-- 全局提示组件 -->
  <ToastNotification />
</template>

<style scoped>
/* 使用 Tabler 的默认样式，无需额外自定义 */
</style>
