<template>
  <div class="login-container">
    <div class="login-form">
      <div class="login-header">
        <h2>管理员登录</h2>
        <p>请输入管理员Token以访问后台</p>
      </div>
      
      <a-form :model="form" :rules="rules" ref="formRef">
        <a-form-item name="token">
          <a-input-password
            v-model:value="form.token" 
            placeholder="请输入管理员Token" 
            size="large"
            @pressEnter="handleLogin"
          >
            <template #prefix>
              <lock-outlined />
            </template>
          </a-input-password>
        </a-form-item>
        
        <a-button 
          type="primary" 
          size="large" 
          :loading="loading" 
          @click="handleLogin"
          class="login-btn"
          block
        >
          {{ loading ? '登录中...' : '登录' }}
        </a-button>
      </a-form>
      
      <div class="token-info">
        <p>提示：默认管理员Token为 <code>ZSMESSAGE_ADMIN_TOKEN_2026</code></p>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { LockOutlined } from '@ant-design/icons-vue'

export default {
  name: 'Login',
  components: {
    LockOutlined
  },
  setup() {
    const router = useRouter()
    const formRef = ref()
    const loading = ref(false)
    
    const form = reactive({
      token: ''
    })
    
    const rules = {
      token: [
        { required: true, message: '请输入管理员Token', trigger: 'blur' }
      ]
    }
    
    const handleLogin = async () => {
      try {
        await formRef.value.validate()
        loading.value = true
        
        // 验证Token（这里只是简单验证非空，实际会通过API验证）
        if (form.token.trim()) {
          localStorage.setItem('adminToken', form.token.trim())
          message.success('登录成功')
          router.push('/dashboard')
        } else {
          message.error('Token不能为空')
        }
      } catch (error) {
        message.error('请输入有效的Token')
      } finally {
        loading.value = false
      }
    }
    
    return {
      form,
      rules,
      formRef,
      loading,
      handleLogin
    }
  }
}
</script>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.login-form {
  width: 400px;
  padding: 40px;
  background: white;
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.2);
}

.login-header {
  text-align: center;
  margin-bottom: 30px;
}

.login-header h2 {
  margin: 0 0 8px 0;
  font-size: 24px;
  font-weight: 600;
  color: #303133;
}

.login-header p {
  margin: 0;
  color: #909399;
  font-size: 14px;
}

.login-btn {
  height: 48px;
  font-size: 16px;
  font-weight: 500;
}

.token-info {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #ebeef5;
  text-align: center;
}

.token-info p {
  margin: 0;
  color: #e6a23c;
  font-size: 12px;
}

.token-info code {
  background: #f5f7fa;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: monospace;
}
</style>
