<template>
  <div id="app">
    <a-config-provider :locale="zhCN">
      <a-layout v-if="isLoggedIn && !isLoginPage" style="min-height: 100vh">
        <!-- 侧边栏 -->
        <a-layout-sider width="240" class="sidebar">
          <div class="sidebar-header">
            <h2>智穗语聊管理后台</h2>
          </div>
          <a-menu
            v-model:selectedKeys="selectedKeys"
            mode="inline"
            theme="dark"
            @click="handleMenuClick"
          >
            <a-menu-item key="/dashboard">
              <template #icon><home-outlined /></template>
              <span>仪表板</span>
            </a-menu-item>
            <a-menu-item key="/users">
              <template #icon><user-outlined /></template>
              <span>用户管理</span>
            </a-menu-item>
            <a-menu-item key="/messages">
              <template #icon><message-outlined /></template>
              <span>消息管理</span>
            </a-menu-item>
            <a-menu-item key="/chat-viewer">
              <template #icon><eye-outlined /></template>
              <span>消息监控</span>
            </a-menu-item>
            <a-menu-item key="/groups">
              <template #icon><team-outlined /></template>
              <span>群组管理</span>
            </a-menu-item>
            <a-menu-item key="/appeals">
              <template #icon><file-text-outlined /></template>
              <span>申诉管理</span>
            </a-menu-item>
            <a-menu-item key="/announcements">
              <template #icon><notification-outlined /></template>
              <span>公告管理</span>
            </a-menu-item>
            <a-menu-item key="/versions">
              <template #icon><appstore-outlined /></template>
              <span>版本管理</span>
            </a-menu-item>
            <a-menu-item key="/developers">
              <template #icon><code-outlined /></template>
              <span>开发者管理</span>
            </a-menu-item>
          </a-menu>
        </a-layout-sider>

        <!-- 主内容区域 -->
        <a-layout>
          <a-layout-header class="header">
            <div class="header-content">
              <h3>{{ getPageTitle }}</h3>
              <div class="header-user">
                <a-dropdown>
                  <a class="ant-dropdown-link" @click.prevent>
                    管理员 <down-outlined />
                  </a>
                  <template #overlay>
                    <a-menu>
                      <a-menu-item @click="showTokenSettings">Token设置</a-menu-item>
                      <a-menu-divider />
                      <a-menu-item @click="logout">退出登录</a-menu-item>
                    </a-menu>
                  </template>
                </a-dropdown>
              </div>
            </div>
          </a-layout-header>
          <a-layout-content class="main-content">
            <router-view />
          </a-layout-content>
        </a-layout>
      </a-layout>

      <!-- 登录页面 -->
      <div v-else-if="isLoginPage">
        <router-view />
      </div>

      <!-- 未登录时重定向到登录页 -->
      <div v-else>
        <router-view />
      </div>
    </a-config-provider>
  </div>
</template>

<script>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message, Modal } from 'ant-design-vue'
import zhCN from 'ant-design-vue/es/locale/zh_CN'
import {
  HomeOutlined,
  UserOutlined,
  MessageOutlined,
  EyeOutlined,
  TeamOutlined,
  FileTextOutlined,
  NotificationOutlined,
  AppstoreOutlined,
  CodeOutlined,
  DownOutlined
} from '@ant-design/icons-vue'

export default {
  name: 'App',
  components: {
    HomeOutlined,
    UserOutlined,
    MessageOutlined,
    EyeOutlined,
    TeamOutlined,
    FileTextOutlined,
    NotificationOutlined,
    AppstoreOutlined,
    CodeOutlined,
    DownOutlined
  },
  setup() {
    const route = useRoute()
    const router = useRouter()
    const selectedKeys = ref([route.path])
    
    // 监听路由变化
    watch(() => route.path, (newPath) => {
      selectedKeys.value = [newPath]
    })
    
    // 检查是否已登录
    const isLoggedIn = computed(() => {
      return !!localStorage.getItem('adminToken')
    })
    
    // 检查是否是登录页面
    const isLoginPage = computed(() => {
      return route.path === '/login'
    })
    
    // 获取页面标题
    const getPageTitle = computed(() => {
      const titles = {
        '/dashboard': '仪表板',
        '/users': '用户管理',
        '/messages': '消息管理',
        '/chat-viewer': '消息监控',
        '/groups': '群组管理',
        '/appeals': '申诉管理',
        '/announcements': '公告管理',
        '/versions': '版本管理',
        '/developers': '开发者管理'
      }
      return titles[route.path] || '管理后台'
    })
    
    // 菜单点击
    const handleMenuClick = ({ key }) => {
      router.push(key)
    }
    
    // 退出登录
    const logout = () => {
      localStorage.removeItem('adminToken')
      router.push('/login')
      message.success('已退出登录')
    }
    
    // 显示Token设置
    const showTokenSettings = () => {
      const currentToken = localStorage.getItem('adminToken') || ''
      Modal.confirm({
        title: 'Token设置',
        content: `当前Token: ${currentToken ? currentToken.substring(0, 10) + '...' : '未设置'}`,
        okText: '修改Token',
        cancelText: '取消',
        onOk() {
          const newToken = prompt('请输入新的管理员Token：', currentToken)
          if (newToken !== null) {
            if (newToken.trim() === '') {
              localStorage.removeItem('adminToken')
              message.info('Token已清除')
            } else {
              localStorage.setItem('adminToken', newToken.trim())
              message.success('Token设置成功')
            }
          }
        }
      })
    }
    
    // 检查登录状态并重定向
    onMounted(() => {
      if (!isLoggedIn.value && !isLoginPage.value) {
        router.push('/login')
      }
    })
    
    return {
      zhCN,
      selectedKeys,
      isLoggedIn,
      isLoginPage,
      getPageTitle,
      handleMenuClick,
      logout,
      showTokenSettings
    }
  }
}
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Microsoft YaHei', sans-serif;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  min-height: 100vh;
}

#app {
  height: 100vh;
}

.sidebar {
  background: linear-gradient(180deg, #1e3c72 0%, #2a5298 100%) !important;
  color: white;
  box-shadow: 4px 0 20px rgba(0,0,0,0.1);
  z-index: 100;
}

.sidebar .ant-layout-sider-children {
  background: transparent;
}

.sidebar .ant-menu {
  background: transparent !important;
}

.sidebar .ant-menu-item {
  margin: 4px 8px !important;
  border-radius: 8px !important;
}

.sidebar .ant-menu-item-selected {
  background: linear-gradient(90deg, #667eea 0%, #764ba2 100%) !important;
}

.sidebar-header {
  padding: 30px 20px;
  text-align: center;
  border-bottom: 1px solid rgba(255,255,255,0.15);
  background: linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%);
}

.sidebar-header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: bold;
  letter-spacing: 1px;
  color: white;
}

.header {
  background: white !important;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08) !important;
  padding: 0 30px !important;
  height: 70px !important;
  line-height: 70px !important;
  display: flex !important;
  align-items: center !important;
}

.header-content {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header h3 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #303133;
  display: flex;
  align-items: center;
}

.header h3::before {
  content: '';
  width: 4px;
  height: 24px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  margin-right: 12px;
  border-radius: 2px;
}

.header-user {
  display: flex;
  align-items: center;
  gap: 15px;
  color: #606266;
  font-size: 14px;
}

.header-user .ant-dropdown-link {
  color: #606266;
  cursor: pointer;
}

.main-content {
  background: #f0f2f5 !important;
  padding: 24px !important;
  overflow-y: auto;
  min-height: calc(100vh - 70px);
}
</style>
