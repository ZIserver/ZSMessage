<template>
  <div class="dashboard">
    <a-row :gutter="20" class="stats-grid">
      <a-col :span="6">
        <a-card class="stat-card stat-card-blue">
          <div class="stat-content">
            <div class="stat-icon">
              <message-outlined />
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ stats.totalMessages }}</div>
              <div class="stat-label">总消息数</div>
            </div>
          </div>
        </a-card>
      </a-col>
      <a-col :span="6">
        <a-card class="stat-card stat-card-green">
          <div class="stat-content">
            <div class="stat-icon">
              <team-outlined />
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ stats.totalGroups }}</div>
              <div class="stat-label">总群组数</div>
            </div>
          </div>
        </a-card>
      </a-col>
      <a-col :span="6">
        <a-card class="stat-card stat-card-orange">
          <div class="stat-content">
            <div class="stat-icon">
              <user-outlined />
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ stats.totalMembers }}</div>
              <div class="stat-label">群成员数</div>
            </div>
          </div>
        </a-card>
      </a-col>
      <a-col :span="6">
        <a-card class="stat-card stat-card-red">
          <div class="stat-content">
            <div class="stat-icon">
              <appstore-outlined />
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ stats.latestVersion }}</div>
              <div class="stat-label">最新版本</div>
            </div>
          </div>
        </a-card>
      </a-col>
    </a-row>

    <a-row :gutter="20" class="quick-actions">
      <a-col :span="24">
        <a-card class="action-card">
          <template #title>
            <span>快速操作</span>
          </template>
          <div class="actions-grid">
            <a-button type="primary" size="large" @click="$router.push('/users')">
              <template #icon><user-outlined /></template>
              用户管理
            </a-button>
            <a-button type="primary" size="large" @click="$router.push('/messages')" style="background: #52c41a; border-color: #52c41a;">
              <template #icon><message-outlined /></template>
              消息管理
            </a-button>
            <a-button type="primary" size="large" @click="$router.push('/groups')" style="background: #faad14; border-color: #faad14;">
              <template #icon><team-outlined /></template>
              群组管理
            </a-button>
            <a-button type="primary" size="large" @click="$router.push('/appeals')" style="background: #ff4d4f; border-color: #ff4d4f;">
              <template #icon><file-text-outlined /></template>
              申诉管理
            </a-button>
            <a-button type="primary" size="large" @click="$router.push('/announcements')" style="background: #722ed1; border-color: #722ed1;">
              <template #icon><notification-outlined /></template>
              公告管理
            </a-button>
            <a-button type="primary" size="large" @click="$router.push('/versions')">
              <template #icon><appstore-outlined /></template>
              版本管理
            </a-button>
          </div>
        </a-card>
      </a-col>
    </a-row>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'
import api from '@/utils/api'
import {
  MessageOutlined,
  TeamOutlined,
  UserOutlined,
  AppstoreOutlined,
  FileTextOutlined,
  NotificationOutlined
} from '@ant-design/icons-vue'

export default {
  name: 'Dashboard',
  components: {
    MessageOutlined,
    TeamOutlined,
    UserOutlined,
    AppstoreOutlined,
    FileTextOutlined,
    NotificationOutlined
  },
  setup() {
    const stats = ref({
      totalMessages: 0,
      totalGroups: 0,
      totalMembers: 0,
      latestVersion: 'N/A'
    })

    const loadStats = async () => {
      try {
        // 获取消息统计
        const msgStats = await api.get('/admin/messages/statistics')
        stats.value.totalMessages = msgStats.data.totalMessages || 0

        // 获取群组统计
        const groupStats = await api.get('/admin/groups/statistics')
        stats.value.totalGroups = groupStats.data.totalGroups || 0
        stats.value.totalMembers = groupStats.data.totalMembers || 0

        // 获取最新版本
        const versions = await api.get('/admin/versions/list')
        if (versions.data && versions.data.length > 0) {
          stats.value.latestVersion = versions.data[0].version
        }
      } catch (error) {
        console.error('加载统计数据失败:', error)
      }
    }

    onMounted(() => {
      loadStats()
    })

    return {
      stats
    }
  }
}
</script>

<style scoped>
.dashboard {
  padding: 20px;
}

.stats-grid {
  margin-bottom: 24px;
}

.stat-card {
  height: 120px;
  border-radius: 16px;
  overflow: hidden;
  border: none;
}

.stat-card :deep(.ant-card-body) {
  padding: 0;
  height: 100%;
}

.stat-card-blue {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.stat-card-green {
  background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
  color: white;
}

.stat-card-orange {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
  color: white;
}

.stat-card-red {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  color: white;
}

.stat-content {
  display: flex;
  align-items: center;
  height: 100%;
  padding: 0 20px;
}

.stat-icon {
  font-size: 36px;
  margin-right: 20px;
}

.stat-info .stat-value {
  font-size: 28px;
  font-weight: bold;
  margin-bottom: 4px;
}

.stat-info .stat-label {
  font-size: 14px;
  opacity: 0.9;
}

.action-card {
  border-radius: 12px;
}

.actions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 20px;
  padding: 20px 0;
}

.actions-grid .ant-btn {
  width: 100%;
  justify-content: center;
  height: 50px;
}
</style>
