<template>
  <div class="chat-viewer">
    <a-card class="selector-card">
      <template #title>
        <div class="card-header">
          <span>消息监控</span>
          <a-tag color="green">
            <check-outlined />
            服务器端加密（可查看明文）
          </a-tag>
        </div>
      </template>
      
      <div class="user-selector">
        <div class="selector-item">
          <span class="label">用户 1：</span>
          <a-select 
            v-model:value="selectedUser1" 
            show-search
            :filter-option="filterOption"
            placeholder="搜索用户名或ID"
            style="width: 280px;"
            @change="onUserChange"
          >
            <a-select-option
              v-for="user in users"
              :key="user.id"
              :value="user.id"
              :disabled="user.id === selectedUser2"
            >
              <div class="user-option">
                <span class="user-id">ID: {{ user.id }}</span>
                <span class="user-name">{{ user.nickname }}</span>
                <span class="user-username">@{{ user.username }}</span>
              </div>
            </a-select-option>
          </a-select>
        </div>
        
        <swap-outlined class="swap-icon" @click="swapUsers" />
        
        <div class="selector-item">
          <span class="label">用户 2：</span>
          <a-select 
            v-model:value="selectedUser2" 
            show-search
            :filter-option="filterOption"
            placeholder="搜索用户名或ID"
            style="width: 280px;"
            @change="onUserChange"
          >
            <a-select-option
              v-for="user in users"
              :key="user.id"
              :value="user.id"
              :disabled="user.id === selectedUser1"
            >
              <div class="user-option">
                <span class="user-id">ID: {{ user.id }}</span>
                <span class="user-name">{{ user.nickname }}</span>
                <span class="user-username">@{{ user.username }}</span>
              </div>
            </a-select-option>
          </a-select>
        </div>
        
        <a-button type="primary" @click="loadConversation" :loading="loading">
          <template #icon><search-outlined /></template>
          查看对话
        </a-button>
      </div>
    </a-card>

    <!-- 聊天对话框 -->
    <a-card class="chat-card" v-if="user1Info && user2Info">
      <template #title>
        <div class="chat-header">
          <div class="chat-users">
            <div class="user-info">
              <a-avatar :size="40" style="background: #1890ff;">
                {{ user1Info.nickname?.charAt(0) || 'U' }}
              </a-avatar>
              <div class="user-detail">
                <span class="nickname">{{ user1Info.nickname }}</span>
                <span class="username">@{{ user1Info.username }}</span>
              </div>
            </div>
            <swap-outlined class="vs-icon" />
            <div class="user-info">
              <a-avatar :size="40" style="background: #52c41a;">
                {{ user2Info.nickname?.charAt(0) || 'U' }}
              </a-avatar>
              <div class="user-detail">
                <span class="nickname">{{ user2Info.nickname }}</span>
                <span class="username">@{{ user2Info.username }}</span>
              </div>
            </div>
          </div>
          <div class="chat-stats">
            <a-tag>共 {{ totalMessages }} 条消息</a-tag>
          </div>
        </div>
      </template>

      <div class="messages-container" ref="messagesContainer">
        <div v-if="messages.length === 0" class="empty-state">
          <a-empty description="暂无消息记录" />
        </div>
        
        <div 
          v-for="msg in messages" 
          :key="msg.id"
          :class="['message-item', msg.senderId === selectedUser1 ? 'sent' : 'received']"
        >
          <div class="message-avatar">
            <a-avatar :size="36" :style="{ background: msg.senderId === selectedUser1 ? '#1890ff' : '#52c41a' }">
              {{ msg.senderId === selectedUser1 ? user1Info.nickname?.charAt(0) : user2Info.nickname?.charAt(0) }}
            </a-avatar>
          </div>
          <div class="message-content">
            <div class="message-header">
              <span class="sender-name">
                {{ msg.senderId === selectedUser1 ? user1Info.nickname : user2Info.nickname }}
              </span>
              <span class="message-time">{{ formatDate(msg.createdAt) }}</span>
            </div>
            <div class="message-bubble" :class="{ 'recalled': msg.isRecalled }">
              <template v-if="msg.isRecalled">
                <delete-outlined />
                <span>消息已撤回</span>
              </template>
              <template v-else>
                <div class="content-text">{{ formatContent(msg.content) }}</div>
              </template>
            </div>
            <div class="message-meta">
              <a-tag size="small" :color="msg.isRead ? 'green' : 'default'">
                {{ msg.isRead ? '已读' : '未读' }}
              </a-tag>
              <a-tag v-if="msg.isForwarded" size="small" color="orange">转发</a-tag>
              <a-tag size="small">{{ msg.messageType || 'TEXT' }}</a-tag>
            </div>
          </div>
        </div>
      </div>

      <!-- 分页 -->
      <div class="pagination" v-if="totalMessages > 100">
        <a-pagination
          size="small"
          :total="totalMessages"
          :page-size="100"
          @change="handlePageChange"
        />
      </div>
    </a-card>

    <!-- 未选择用户时的提示 -->
    <a-card v-else class="hint-card">
      <a-empty description="请选择两个用户查看对话记录">
        <template #image>
          <message-outlined style="font-size: 60px; color: #909399;" />
        </template>
      </a-empty>
    </a-card>
  </div>
</template>

<script>
import { ref, onMounted, nextTick } from 'vue'
import { message } from 'ant-design-vue'
import {
  CheckOutlined,
  SwapOutlined,
  SearchOutlined,
  DeleteOutlined,
  MessageOutlined
} from '@ant-design/icons-vue'
import api from '@/utils/api'

export default {
  name: 'ChatViewer',
  components: {
    CheckOutlined,
    SwapOutlined,
    SearchOutlined,
    DeleteOutlined,
    MessageOutlined
  },
  setup() {
    const users = ref([])
    const selectedUser1 = ref(null)
    const selectedUser2 = ref(null)
    const user1Info = ref(null)
    const user2Info = ref(null)
    const messages = ref([])
    const totalMessages = ref(0)
    const loading = ref(false)
    const messagesContainer = ref(null)
    const currentPage = ref(0)

    // 加载用户列表
    const loadUsers = async () => {
      try {
        const response = await api.get('/admin/messages/users')
        users.value = response.data || []
      } catch (error) {
        message.error('加载用户列表失败')
        console.error(error)
      }
    }

    // 过滤选项（支持按名称或ID搜索）
    const filterOption = (input, option) => {
      const user = users.value.find(u => u.id === option.value)
      if (!user) return false
      const q = input.toLowerCase()
      return (
        user.nickname?.toLowerCase().includes(q) ||
        user.username?.toLowerCase().includes(q) ||
        String(user.id).includes(q)
      )
    }

    // 用户选择变化
    const onUserChange = () => {
      // 清空当前对话
      messages.value = []
      user1Info.value = null
      user2Info.value = null
      totalMessages.value = 0
    }

    // 交换用户
    const swapUsers = () => {
      const temp = selectedUser1.value
      selectedUser1.value = selectedUser2.value
      selectedUser2.value = temp
    }

    // 加载对话
    const loadConversation = async () => {
      if (!selectedUser1.value || !selectedUser2.value) {
        message.warning('请选择两个用户')
        return
      }

      try {
        loading.value = true
        const response = await api.get(
          `/admin/messages/conversation/${selectedUser1.value}/${selectedUser2.value}`,
          { params: { page: currentPage.value, size: 100 } }
        )
        
        messages.value = response.data.messages || []
        totalMessages.value = response.data.totalElements || 0
        user1Info.value = response.data.user1
        user2Info.value = response.data.user2

        // 滚动到底部
        await nextTick()
        if (messagesContainer.value) {
          messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
        }
      } catch (error) {
        message.error('加载对话失败')
        console.error(error)
      } finally {
        loading.value = false
      }
    }

    // 分页变化
    const handlePageChange = (page) => {
      currentPage.value = page - 1
      loadConversation()
    }

    // 格式化消息内容（服务器端已解密，直接显示）
    const formatContent = (content) => {
      if (!content) return '[空消息]'
      
      // 尝试解析 JSON（文件/图片/视频消息）
      if (content.startsWith('{')) {
        try {
          const data = JSON.parse(content)
          if (data.mediaType === 'image') {
            return `[图片] ${data.name || '图片文件'}`
          } else if (data.mediaType === 'video') {
            return `[视频] ${data.name || '视频文件'}`
          } else if (data.mediaType === 'file') {
            return `[文件] ${data.name || '文件'}`
          } else if (data.type === 'quote') {
            return `[引用] ${data.content}`
          } else if (data.type === 'chat_history') {
            return `[聊天记录] ${data.count}条消息`
          }
          return content
        } catch (e) {
          return content
        }
      }
      
      return content
    }

    // 格式化日期
    const formatDate = (dateString) => {
      if (!dateString) return '-'
      const date = new Date(dateString)
      const now = new Date()
      const isToday = date.toDateString() === now.toDateString()
      
      if (isToday) {
        return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
      }
      return date.toLocaleString('zh-CN', { 
        month: '2-digit', 
        day: '2-digit', 
        hour: '2-digit', 
        minute: '2-digit' 
      })
    }

    onMounted(() => {
      loadUsers()
    })

    return {
      users,
      selectedUser1,
      selectedUser2,
      user1Info,
      user2Info,
      messages,
      totalMessages,
      loading,
      messagesContainer,
      filterOption,
      onUserChange,
      swapUsers,
      loadConversation,
      handlePageChange,
      formatContent,
      formatDate
    }
  }
}
</script>

<style scoped>
.chat-viewer {
  padding: 20px;
}

.selector-card {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.user-selector {
  display: flex;
  align-items: center;
  gap: 15px;
  flex-wrap: wrap;
}

.selector-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.selector-item .label {
  font-weight: 500;
  color: #606266;
}

.swap-icon {
  font-size: 24px;
  color: #909399;
  cursor: pointer;
  transition: color 0.3s;
}

.swap-icon:hover {
  color: #1890ff;
}

.chat-card {
  height: calc(100vh - 280px);
  display: flex;
  flex-direction: column;
}

.chat-card :deep(.ant-card-body) {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.chat-users {
  display: flex;
  align-items: center;
  gap: 20px;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.user-detail {
  display: flex;
  flex-direction: column;
}

.nickname {
  font-weight: 600;
  color: #303133;
}

.username {
  font-size: 12px;
  color: #909399;
}

.vs-icon {
  font-size: 20px;
  color: #c0c4cc;
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  background: #f5f7fa;
  border-radius: 8px;
}

.empty-state {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.message-item {
  display: flex;
  margin-bottom: 20px;
  gap: 10px;
}

.message-item.sent {
  flex-direction: row;
}

.message-item.received {
  flex-direction: row-reverse;
}

.message-content {
  max-width: 70%;
}

.message-item.received .message-content {
  text-align: right;
}

.message-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 5px;
}

.message-item.received .message-header {
  flex-direction: row-reverse;
}

.sender-name {
  font-weight: 500;
  font-size: 13px;
  color: #606266;
}

.message-time {
  font-size: 12px;
  color: #909399;
}

.message-bubble {
  padding: 12px 16px;
  border-radius: 12px;
  background: white;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  display: inline-block;
  text-align: left;
}

.message-item.sent .message-bubble {
  background: #e6f7ff;
  border-bottom-left-radius: 4px;
}

.message-item.received .message-bubble {
  background: #f6ffed;
  border-bottom-right-radius: 4px;
}

.message-bubble.recalled {
  background: #f4f4f5;
  color: #909399;
  font-style: italic;
  display: flex;
  align-items: center;
  gap: 5px;
}

.content-text {
  word-break: break-all;
  line-height: 1.5;
  max-height: 200px;
  overflow-y: auto;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 12px;
  white-space: pre-wrap;
}

.message-meta {
  margin-top: 5px;
  display: flex;
  gap: 5px;
}

.message-item.received .message-meta {
  justify-content: flex-end;
}

.pagination {
  margin-top: 15px;
  text-align: center;
}

.hint-card {
  height: calc(100vh - 280px);
  display: flex;
  align-items: center;
  justify-content: center;
}

.hint-card :deep(.ant-card-body) {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}

/* 用户选项样式 */
.user-option {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
}

.user-option .user-id {
  background: #e6f7ff;
  color: #1890ff;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  min-width: 60px;
  text-align: center;
}

.user-option .user-name {
  font-weight: 500;
  color: #303133;
  flex: 1;
}

.user-option .user-username {
  font-size: 12px;
  color: #909399;
}
</style>
