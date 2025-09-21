<template>
  <div class="page page-center">
    <div class="container container-tight py-4">
      <div class="text-center mb-4">
        <h1 class="h2 text-muted">Augment Token Manager</h1>
        <p class="text-muted">请登录以访问管理系统</p>
      </div>
      <div class="card card-md">
        <div class="card-body">
          <h2 class="h2 text-center mb-4">登录到您的账户</h2>
          <form @submit.prevent="handleLogin" autocomplete="off" novalidate>
            <div class="mb-3">
              <label class="form-label">用户名</label>
              <input 
                type="text" 
                v-model="loginForm.username"
                class="form-control" 
                :class="{ 'is-invalid': errors.username }"
                placeholder="请输入用户名"
                autocomplete="username"
                :disabled="isLoading"
                required
              >
              <div v-if="errors.username" class="invalid-feedback">
                {{ errors.username }}
              </div>
            </div>
            <div class="mb-2">
              <label class="form-label">
                密码
              </label>
              <div class="password-input-container">
                <input
                  :type="showPassword ? 'text' : 'password'"
                  v-model="loginForm.password"
                  class="form-control password-input"
                  :class="{ 'is-invalid': errors.password }"
                  placeholder="请输入密码"
                  autocomplete="current-password"
                  :disabled="isLoading"
                  required
                >
                <button
                  type="button"
                  class="password-toggle-btn"
                  @click="togglePasswordVisibility"
                  :disabled="isLoading"
                >
                  <svg v-if="!showPassword" xmlns="http://www.w3.org/2000/svg" class="icon" width="20" height="20" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
                    <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                    <circle cx="12" cy="12" r="2"/>
                    <path d="m22 12c-2.667 4.667 -6 7 -10 7s-7.333 -2.333 -10 -7c2.667 -4.667 6 -7 10 -7s7.333 2.333 10 7"/>
                  </svg>
                  <svg v-else xmlns="http://www.w3.org/2000/svg" class="icon" width="20" height="20" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
                    <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                    <line x1="3" y1="3" x2="21" y2="21"/>
                    <path d="m10.584 10.587a2 2 0 0 0 2.828 2.83"/>
                    <path d="m9.363 5.365a9.466 9.466 0 0 1 2.637 -.365c4 0 7.333 2.333 10 7c-.778 1.361 -1.612 2.524 -2.503 3.488m-2.14 1.861c-1.631 1.1 -3.415 1.651 -5.357 1.651c-4 0 -7.333 -2.333 -10 -7c1.369 -2.395 2.913 -4.175 4.632 -5.341"/>
                  </svg>
                </button>
              </div>
              <div v-if="errors.password" class="invalid-feedback d-block">
                {{ errors.password }}
              </div>
            </div>
            <div class="mb-2">
              <label class="form-check">
                <input 
                  type="checkbox" 
                  v-model="loginForm.remember_me"
                  class="form-check-input"
                  :disabled="isLoading"
                >
                <span class="form-check-label">记住我</span>
              </label>
            </div>

            <div class="form-footer">
              <button 
                type="submit" 
                class="btn btn-primary w-100"
                :disabled="isLoading || !isFormValid"
              >
                <span v-if="isLoading" class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                {{ isLoading ? '登录中...' : '登录' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from '../utils/toast'

interface LoginForm {
  username: string
  password: string
  remember_me: boolean
}

interface LoginResponse {
  data?: {
    user: {
      id: string
      username: string
      email?: string
      role: string
      createdAt: string
      updatedAt: string
    }
    sessionToken: string
    expiresIn: string
  }
  message?: string
  success: boolean
  error?: string
}

interface FormErrors {
  username?: string
  password?: string
}

const router = useRouter()

// 响应式数据
const loginForm = ref<LoginForm>({
  username: '',
  password: '',
  remember_me: false
})

const errors = ref<FormErrors>({})
const isLoading = ref<boolean>(false)
const showPassword = ref<boolean>(false)

// 计算属性
const isFormValid = computed(() => {
  return loginForm.value.username.trim() !== '' && 
         loginForm.value.password.trim() !== '' &&
         Object.keys(errors.value).length === 0
})

// 生命周期
onMounted(() => {
  // 检查是否已经登录
  const token = localStorage.getItem('auth_token')
  if (token) {
    router.push('/')
    return
  }

  // 加载记住的登录信息
  loadRememberedCredentials()
})

// 加载记住的登录信息
const loadRememberedCredentials = () => {
  const rememberedUsername = localStorage.getItem('remembered_username')
  const rememberedPassword = localStorage.getItem('remembered_password')
  const rememberMe = localStorage.getItem('remember_me') === 'true'

  if (rememberMe && rememberedUsername && rememberedPassword) {
    loginForm.value.username = rememberedUsername
    loginForm.value.password = rememberedPassword
    loginForm.value.remember_me = true
  }
}

// 保存或清除记住的登录信息
const saveRememberedCredentials = () => {
  if (loginForm.value.remember_me) {
    localStorage.setItem('remembered_username', loginForm.value.username)
    localStorage.setItem('remembered_password', loginForm.value.password)
    localStorage.setItem('remember_me', 'true')
  } else {
    localStorage.removeItem('remembered_username')
    localStorage.removeItem('remembered_password')
    localStorage.removeItem('remember_me')
  }
}

// 方法
const validateForm = (): boolean => {
  errors.value = {}
  
  if (!loginForm.value.username.trim()) {
    errors.value.username = '请输入用户名'
  }
  
  if (!loginForm.value.password.trim()) {
    errors.value.password = '请输入密码'
  }
  
  return Object.keys(errors.value).length === 0
}

const togglePasswordVisibility = () => {
  showPassword.value = !showPassword.value
}

const handleLogin = async () => {
  if (!validateForm()) {
    return
  }
  
  isLoading.value = true
  
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(loginForm.value)
    })

    // 检查响应是否有内容
    const responseText = await response.text()
    if (!responseText) {
      throw new Error('服务器返回空响应')
    }

    // 尝试解析JSON
    let data: LoginResponse
    try {
      data = JSON.parse(responseText)
    } catch (parseError) {
      console.error('JSON解析失败:', parseError, '响应内容:', responseText)
      throw new Error('服务器响应格式错误')
    }

    if (data.success && data.data) {
      // 登录成功，保存session token
      localStorage.setItem('auth_token', data.data.sessionToken)
      localStorage.setItem('username', data.data.user.username)

      // 保存或清除记住的登录信息
      saveRememberedCredentials()

      toast.success(data.message || '登录成功')

      // 跳转到Token管理页面
      router.push('/')
    } else {
      // 登录失败
      let errorMsg = data.error || '登录失败，请重试'

      // 检查是否是配置错误
      if (data.error && data.error.includes('not configured')) {
        errorMsg = '系统配置错误，请联系管理员'
      }

      toast.error(errorMsg)
    }
  } catch (error) {
    console.error('登录请求失败:', error)
    const errorMsg = error instanceof Error ? error.message : '网络错误，请检查网络连接后重试'
    toast.error(errorMsg)
  } finally {
    isLoading.value = false
  }
}
</script>

<style scoped>
/* 蓝色科技风背景 */
.page-center {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #1e3c72 0%, #2a5298 50%, #1e3c72 100%);
  position: relative;
  overflow: hidden;
}

.page-center::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background:
    radial-gradient(circle at 20% 80%, rgba(30, 60, 114, 0.4) 0%, transparent 50%),
    radial-gradient(circle at 80% 20%, rgba(42, 82, 152, 0.3) 0%, transparent 50%),
    radial-gradient(circle at 40% 40%, rgba(59, 130, 246, 0.2) 0%, transparent 50%);
  animation: float 8s ease-in-out infinite;
}

@keyframes float {
  0%, 100% { transform: translateY(0px) rotate(0deg); }
  50% { transform: translateY(-15px) rotate(1deg); }
}

.container-tight {
  max-width: 400px;
  position: relative;
  z-index: 1;
}

/* 蓝色科技风卡片 */
.card-md {
  max-width: 400px;
  margin: 0 auto;
  background: rgba(255, 255, 255, 0.98);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: 20px;
  box-shadow:
    0 20px 40px rgba(30, 60, 114, 0.15),
    0 8px 20px rgba(42, 82, 152, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.8);
  transition: all 0.4s ease;
  animation: slideUp 0.8s ease-out;
}

.card-md:hover {
  transform: translateY(-3px);
  box-shadow:
    0 25px 50px rgba(30, 60, 114, 0.2),
    0 12px 25px rgba(42, 82, 152, 0.15),
    inset 0 1px 0 rgba(255, 255, 255, 0.9);
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 蓝色科技风标题样式 */
.h2.text-muted {
  color: #ffffff !important;
  font-weight: 800;
  font-size: 2.2rem;
  margin-bottom: 0.5rem;
  text-shadow:
    0 2px 4px rgba(30, 60, 114, 0.8),
    0 1px 2px rgba(0, 0, 0, 0.3);
  letter-spacing: 0.5px;
}

.text-muted {
  color: rgba(255, 255, 255, 0.95) !important;
  font-weight: 600;
  text-shadow: 0 1px 2px rgba(30, 60, 114, 0.6);
}

/* 蓝色科技风表单样式 */
.form-control {
  border: 2px solid rgba(59, 130, 246, 0.2);
  border-radius: 14px;
  padding: 16px 20px;
  height: 56px;
  font-size: 15px;
  font-weight: 500;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  background: rgba(255, 255, 255, 0.95);
  box-shadow:
    0 2px 8px rgba(30, 60, 114, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.9);
}

.form-control:focus {
  border-color: #3b82f6;
  box-shadow:
    0 0 0 4px rgba(59, 130, 246, 0.15),
    0 4px 12px rgba(30, 60, 114, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 1);
  background: rgba(255, 255, 255, 1);
  transform: translateY(-1px);
}

.form-control::placeholder {
  color: rgba(59, 130, 246, 0.6);
  font-weight: 500;
}

/* 密码输入容器样式 */
.password-input-container {
  position: relative;
  display: flex;
  align-items: center;
}

.password-input {
  padding-right: 50px !important;
}

.password-toggle-btn {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: rgba(59, 130, 246, 0.7);
  cursor: pointer;
  padding: 8px;
  border-radius: 8px;
  transition: all 0.3s ease;
  z-index: 10;
}

.password-toggle-btn:hover {
  color: #3b82f6;
  background: rgba(59, 130, 246, 0.1);
}

.password-toggle-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 蓝色科技风输入组样式 */
.input-group-text {
  border: 2px solid rgba(59, 130, 246, 0.2);
  border-left: none;
  border-radius: 0 14px 14px 0;
  height: 56px;
  background: rgba(255, 255, 255, 0.95);
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow:
    0 2px 8px rgba(30, 60, 114, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.9);
}

.input-group .form-control {
  border-radius: 14px 0 0 14px;
}

.input-group:focus-within .input-group-text {
  border-color: #3b82f6;
  background: rgba(255, 255, 255, 1);
  box-shadow:
    0 0 0 4px rgba(59, 130, 246, 0.15),
    0 4px 12px rgba(30, 60, 114, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 1);
  transform: translateY(-1px);
}

/* 蓝色科技风按钮样式 */
.btn-primary {
  background: linear-gradient(135deg, #3b82f6 0%, #1e40af 50%, #1d4ed8 100%);
  border: none;
  border-radius: 14px;
  padding: 16px 32px;
  height: 56px;
  font-weight: 700;
  font-size: 16px;
  letter-spacing: 0.5px;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
  box-shadow:
    0 4px 15px rgba(59, 130, 246, 0.3),
    0 2px 8px rgba(30, 60, 114, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
}

.btn-primary::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
  transition: left 0.6s ease;
}

.btn-primary:hover::before {
  left: 100%;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow:
    0 8px 25px rgba(59, 130, 246, 0.4),
    0 4px 15px rgba(30, 60, 114, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.3);
}

.btn-primary:disabled {
  opacity: 0.6;
  transform: none;
  box-shadow:
    0 2px 8px rgba(59, 130, 246, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

.btn-link {
  color: #3b82f6;
  text-decoration: none;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  border-radius: 8px;
  padding: 8px;
}

.btn-link:hover {
  color: #1e40af;
  background: rgba(59, 130, 246, 0.1);
  transform: scale(1.1);
}

.btn-link:focus {
  box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.15);
  background: rgba(59, 130, 246, 0.05);
}

/* 蓝色科技风复选框样式 */
.form-check-input:checked {
  background-color: #3b82f6;
  border-color: #3b82f6;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
}

.form-check-input:focus {
  box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.15);
}

/* 蓝色科技风标签样式 */
.form-label {
  font-weight: 700;
  color: #1e40af;
  margin-bottom: 10px;
  font-size: 14px;
  letter-spacing: 0.3px;
}

.form-check-label {
  color: #1e40af;
  font-weight: 600;
  font-size: 14px;
}

/* 蓝色科技风错误状态 */
.is-invalid {
  border-color: #ef4444 !important;
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1) !important;
}

.invalid-feedback {
  color: #ef4444;
  font-weight: 600;
  font-size: 13px;
}

.spinner-border-sm {
  width: 1rem;
  height: 1rem;
}

/* 响应式设计 */
@media (max-width: 576px) {
  .container-tight {
    max-width: 90%;
    padding: 0 15px;
  }

  .card-md {
    margin: 20px 0;
  }

  .h2.text-muted {
    font-size: 1.5rem;
  }
}
</style>
