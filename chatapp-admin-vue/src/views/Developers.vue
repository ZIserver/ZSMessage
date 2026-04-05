<template>
  <div class="developers">
    <!-- 统计卡片 -->
    <a-row :gutter="16" style="margin-bottom: 24px;">
      <a-col :span="6">
        <a-card>
          <a-statistic
            title="总开发者"
            :value="stats.totalDevelopers"
            :value-style="{ color: '#3f8600' }"
          >
            <template #prefix>
              <user-outlined />
            </template>
          </a-statistic>
        </a-card>
      </a-col>
      <a-col :span="6">
        <a-card>
          <a-statistic
            title="已认证"
            :value="stats.verifiedDevelopers"
            :value-style="{ color: '#1890ff' }"
          >
            <template #prefix>
              <safety-certificate-outlined />
            </template>
          </a-statistic>
        </a-card>
      </a-col>
      <a-col :span="6">
        <a-card>
          <a-statistic
            title="未认证"
            :value="stats.unverifiedDevelopers"
            :value-style="{ color: '#faad14' }"
          >
            <template #prefix>
              <warning-outlined />
            </template>
          </a-statistic>
        </a-card>
      </a-col>
      <a-col :span="6">
        <a-card>
          <a-statistic
            title="活跃中"
            :value="stats.activeDevelopers"
            :value-style="{ color: '#52c41a' }"
          >
            <template #prefix>
              <check-circle-outlined />
            </template>
          </a-statistic>
        </a-card>
      </a-col>
    </a-row>

    <!-- 主列表卡片 -->
    <a-card>
      <template #title>
        <div class="card-header">
          <span>开发者管理</span>
          <a-space>
            <a-input-search 
              v-model:value="searchKeyword" 
              placeholder="搜索用户名/昵称/真实姓名" 
              style="width: 300px;"
              allow-clear
              @search="loadDevelopers"
              @pressEnter="loadDevelopers"
            />
            <a-select 
              v-model:value="filterStatus" 
              placeholder="状态筛选"
              style="width: 120px;"
              allow-clear
              @change="loadDevelopers"
            >
              <a-select-option value="">全部</a-select-option>
              <a-select-option value="ACTIVE">活跃</a-select-option>
              <a-select-option value="DISABLED">禁用</a-select-option>
              <a-select-option value="BANNED">封禁</a-select-option>
            </a-select>
            <a-select 
              v-model:value="filterVerified" 
              placeholder="认证筛选"
              style="width: 120px;"
              allow-clear
              @change="loadDevelopers"
            >
              <a-select-option :value="null">全部</a-select-option>
              <a-select-option :value="true">已认证</a-select-option>
              <a-select-option :value="false">未认证</a-select-option>
            </a-select>
          </a-space>
        </div>
      </template>

      <a-table 
        :data-source="developers" 
        :loading="loading"
        :columns="columns"
        :row-key="record => record.id"
        :pagination="false"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'developer'">
            <div class="developer-info">
              <a-avatar :size="40" v-if="record.avatarUrl" :src="getAvatarUrl(record.avatarUrl)">
                {{ record.nickname?.charAt(0) || record.username?.charAt(0) || 'D' }}
              </a-avatar>
              <a-avatar :size="40" v-else>
                {{ record.nickname?.charAt(0) || record.username?.charAt(0) || 'D' }}
              </a-avatar>
              <div class="info-text">
                <div class="name">{{ record.nickname || record.username }}</div>
                <div class="username">@{{ record.username }}</div>
              </div>
            </div>
          </template>
          <template v-else-if="column.key === 'verified'">
            <div v-if="record.verified" class="verified-info">
              <a-tag color="success">已认证</a-tag>
              <div class="real-name">{{ record.realName }}</div>
              <div class="id-card" v-if="record.idCard">
                {{ record.idCard }}
                <a-typography-paragraph
                  :copyable="{ text: record.idCard }"
                  style="display: inline; margin: 0 0 0 4px;"
                />
              </div>
            </div>
            <a-tag v-else color="warning">未认证</a-tag>
          </template>
          <template v-else-if="column.key === 'status'">
            <a-tag :color="getStatusColor(record.status)">
              {{ getStatusText(record.status) }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'createdAt'">
            {{ formatDate(record.createdAt) }}
          </template>
          <template v-else-if="column.key === 'action'">
            <a-space>
              <a-button 
                size="small" 
                @click="showDetail(record)"
              >
                详情
              </a-button>
              <a-button 
                v-if="!record.verified && record.realName"
                size="small" 
                type="primary"
                @click="handleVerify(record, true)"
              >
                通过认证
              </a-button>
              <a-button 
                v-if="record.verified"
                size="small" 
                danger
                @click="handleVerify(record, false)"
              >
                取消认证
              </a-button>
              <a-dropdown>
                <a-button size="small">
                  更多 <down-outlined />
                </a-button>
                <template #overlay>
                  <a-menu>
                    <a-menu-item 
                      v-if="record.status !== 'ACTIVE'"
                      @click="handleStatusChange(record, 'ACTIVE')"
                    >
                      激活
                    </a-menu-item>
                    <a-menu-item 
                      v-if="record.status !== 'DISABLED'"
                      @click="handleStatusChange(record, 'DISABLED')"
                    >
                      禁用
                    </a-menu-item>
                    <a-menu-item 
                      v-if="record.status !== 'BANNED'"
                      @click="handleStatusChange(record, 'BANNED')"
                    >
                      封禁
                    </a-menu-item>
                    <a-menu-divider />
                    <a-menu-item danger @click="handleDelete(record)">
                      删除
                    </a-menu-item>
                  </a-menu>
                </template>
              </a-dropdown>
            </a-space>
          </template>
        </template>
      </a-table>

      <div class="pagination">
        <a-pagination
          :current="pagination.currentPage"
          :page-size="pagination.pageSize"
          :total="pagination.total"
          :show-size-changer="true"
          :page-size-options="['10', '20', '50', '100']"
          show-quick-jumper
          :show-total="total => `共 ${total} 条`"
          @change="handleCurrentChange"
          @showSizeChange="handleSizeChange"
        />
      </div>
    </a-card>

    <!-- 开发者详情对话框 -->
    <a-modal v-model:open="detailDialog.visible" title="开发者详情" :width="700" :footer="null">
      <a-descriptions :column="2" bordered v-if="detailDialog.developer">
        <a-descriptions-item label="ID">{{ detailDialog.developer.id }}</a-descriptions-item>
        <a-descriptions-item label="用户ID">{{ detailDialog.developer.userId }}</a-descriptions-item>
        <a-descriptions-item label="用户名">{{ detailDialog.developer.username }}</a-descriptions-item>
        <a-descriptions-item label="昵称">{{ detailDialog.developer.nickname || '未设置' }}</a-descriptions-item>
        <a-descriptions-item label="真实姓名" :span="2">
          {{ detailDialog.developer.realName || '未认证' }}
        </a-descriptions-item>
        <a-descriptions-item label="身份证号" :span="2">
          <span v-if="detailDialog.developer.idCard">
            {{ detailDialog.developer.idCard }}
            <a-typography-paragraph
              :copyable="{ text: detailDialog.developer.idCard }"
              style="display: inline; margin: 0 0 0 8px;"
            />
          </span>
          <span v-else>未认证</span>
        </a-descriptions-item>
        <a-descriptions-item label="认证状态">
          <a-tag :color="detailDialog.developer.verified ? 'success' : 'warning'">
            {{ detailDialog.developer.verified ? '已认证' : '未认证' }}
          </a-tag>
        </a-descriptions-item>
        <a-descriptions-item label="认证时间">
          {{ detailDialog.developer.verifiedAt ? formatDate(detailDialog.developer.verifiedAt) : '-' }}
        </a-descriptions-item>
        <a-descriptions-item label="状态">
          <a-tag :color="getStatusColor(detailDialog.developer.status)">
            {{ getStatusText(detailDialog.developer.status) }}
          </a-tag>
        </a-descriptions-item>
        <a-descriptions-item label="注册时间">
          {{ formatDate(detailDialog.developer.createdAt) }}
        </a-descriptions-item>
        <a-descriptions-item label="更新时间" :span="2">
          {{ formatDate(detailDialog.developer.updatedAt) }}
        </a-descriptions-item>
      </a-descriptions>
    </a-modal>
  </div>
</template>

<script>
import { ref, reactive, onMounted } from 'vue'
import { message, Modal } from 'ant-design-vue'
import {
  UserOutlined,
  SafetyCertificateOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  DownOutlined
} from '@ant-design/icons-vue'
import api from '@/utils/api'

export default {
  name: 'Developers',
  components: {
    UserOutlined,
    SafetyCertificateOutlined,
    WarningOutlined,
    CheckCircleOutlined,
    DownOutlined
  },
  setup() {
    const developers = ref([])
    const loading = ref(false)
    const searchKeyword = ref('')
    const filterStatus = ref('')
    const filterVerified = ref(null)
    
    const stats = reactive({
      totalDevelopers: 0,
      verifiedDevelopers: 0,
      unverifiedDevelopers: 0,
      activeDevelopers: 0,
      disabledDevelopers: 0,
      bannedDevelopers: 0
    })
    
    const columns = [
      { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
      { title: '开发者信息', key: 'developer', width: 250 },
      { title: '用户ID', dataIndex: 'userId', key: 'userId', width: 100 },
      { title: '实名认证', key: 'verified', width: 200 },
      { title: '状态', key: 'status', width: 100 },
      { title: '注册时间', key: 'createdAt', width: 180 },
      { title: '操作', key: 'action', width: 300, fixed: 'right' }
    ]
    
    const pagination = reactive({
      currentPage: 1,
      pageSize: 20,
      total: 0
    })
    
    const detailDialog = reactive({
      visible: false,
      developer: null
    })
    
    // 加载统计信息
    const loadStats = async () => {
      try {
        const response = await api.get('/admin/developers/statistics')
        Object.assign(stats, response.data)
      } catch (error) {
        console.error('获取统计信息失败:', error)
      }
    }
    
    // 加载开发者列表
    const loadDevelopers = async () => {
      loading.value = true
      try {
        const params = {
          page: pagination.currentPage - 1,
          size: pagination.pageSize
        }
        if (searchKeyword.value) {
          params.keyword = searchKeyword.value
        }
        if (filterStatus.value) {
          params.status = filterStatus.value
        }
        if (filterVerified.value !== null) {
          params.verified = filterVerified.value
        }
        
        const response = await api.get('/admin/developers/list', { params })
        developers.value = response.data.developers || []
        pagination.total = response.data.totalElements || 0
      } catch (error) {
        message.error('获取开发者列表失败')
        console.error(error)
      } finally {
        loading.value = false
      }
    }
    
    // 显示详情
    const showDetail = async (record) => {
      try {
        // 获取完整的开发者信息（包含解密后的身份证号）
        const response = await api.get(`/admin/developers/${record.id}`)
        detailDialog.developer = response.data
        detailDialog.visible = true
      } catch (error) {
        message.error('获取开发者详情失败')
        console.error(error)
      }
    }
    
    // 审核认证
    const handleVerify = async (record, approved) => {
      Modal.confirm({
        title: approved ? '通过认证' : '取消认证',
        content: approved 
          ? `确认通过 ${record.realName} 的实名认证？` 
          : `确认取消 ${record.nickname || record.username} 的实名认证？`,
        okText: '确定',
        cancelText: '取消',
        async onOk() {
          try {
            await api.post(`/admin/developers/${record.id}/verify`, { approved })
            message.success(approved ? '认证审核通过' : '已取消认证')
            loadDevelopers()
            loadStats()
          } catch (error) {
            // 错误已在拦截器中处理
          }
        }
      })
    }
    
    // 更新状态
    const handleStatusChange = async (record, status) => {
      const statusText = {
        'ACTIVE': '激活',
        'DISABLED': '禁用',
        'BANNED': '封禁'
      }
      
      Modal.confirm({
        title: `${statusText[status]}开发者`,
        content: `确认${statusText[status]} ${record.nickname || record.username} 吗？`,
        okText: '确定',
        cancelText: '取消',
        async onOk() {
          try {
            await api.put(`/admin/developers/${record.id}/status`, { status })
            message.success('状态已更新')
            loadDevelopers()
            loadStats()
          } catch (error) {
            // 错误已在拦截器中处理
          }
        }
      })
    }
    
    // 删除开发者
    const handleDelete = async (record) => {
      Modal.confirm({
        title: '删除开发者',
        content: `确认删除开发者 ${record.nickname || record.username}？此操作不可恢复！`,
        okText: '确定删除',
        okType: 'danger',
        cancelText: '取消',
        async onOk() {
          try {
            await api.delete(`/admin/developers/${record.id}`)
            message.success('开发者已删除')
            loadDevelopers()
            loadStats()
          } catch (error) {
            // 错误已在拦截器中处理
          }
        }
      })
    }
    
    // 分页处理
    const handleCurrentChange = (page) => {
      pagination.currentPage = page
      loadDevelopers()
    }
    
    const handleSizeChange = (current, size) => {
      pagination.currentPage = 1
      pagination.pageSize = size
      loadDevelopers()
    }
    
    // 辅助方法
    const getAvatarUrl = (url) => {
      return url ? `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'}${url}` : ''
    }
    
    const getMaskedIdCard = (developer) => {
      if (developer.idCardLast4) {
        return `**************${developer.idCardLast4}`
      }
      return null
    }
    
    const getStatusColor = (status) => {
      const map = {
        'ACTIVE': 'success',
        'DISABLED': 'warning',
        'BANNED': 'error'
      }
      return map[status] || 'default'
    }
    
    const getStatusText = (status) => {
      const map = {
        'ACTIVE': '活跃',
        'DISABLED': '禁用',
        'BANNED': '封禁'
      }
      return map[status] || status
    }
    
    const formatDate = (dateStr) => {
      if (!dateStr) return '-'
      const date = new Date(dateStr)
      return date.toLocaleString('zh-CN')
    }
    
    onMounted(() => {
      loadStats()
      loadDevelopers()
    })
    
    return {
      developers,
      loading,
      searchKeyword,
      filterStatus,
      filterVerified,
      stats,
      columns,
      pagination,
      detailDialog,
      loadDevelopers,
      showDetail,
      handleVerify,
      handleStatusChange,
      handleDelete,
      handleCurrentChange,
      handleSizeChange,
      getAvatarUrl,
      getMaskedIdCard,
      getStatusColor,
      getStatusText,
      formatDate
    }
  }
}
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.developer-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.info-text {
  flex: 1;
  min-width: 0;
}

.info-text .name {
  font-weight: bold;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.info-text .username {
  font-size: 12px;
  color: #999;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.verified-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.verified-info .real-name {
  font-weight: bold;
}

.verified-info .id-card {
  font-size: 13px;
  color: #333;
  font-family: 'Courier New', monospace;
  display: flex;
  align-items: center;
  gap: 4px;
}

.pagination {
  margin-top: 20px;
  text-align: right;
}
</style>
