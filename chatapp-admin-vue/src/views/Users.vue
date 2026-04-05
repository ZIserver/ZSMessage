<template>
  <div class="users">
    <a-card>
      <template #title>
        <div class="card-header">
          <span>用户管理</span>
          <a-input-search 
            v-model:value="searchKeyword" 
            placeholder="搜索用户名或昵称" 
            style="width: 300px;"
            allow-clear
            @search="loadUsers"
            @pressEnter="loadUsers"
          />
        </div>
      </template>

      <a-table 
        :data-source="users" 
        :loading="loading"
        :columns="columns"
        :row-key="record => record.id"
        :pagination="false"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'gender'">
            {{ getGenderText(record.gender) }}
          </template>
          <template v-else-if="column.key === 'createdAt'">
            {{ formatDate(record.createdAt) }}
          </template>
          <template v-else-if="column.key === 'status'">
            <a-tag :color="getStatusType(record.status)">
              {{ getStatusText(record.status) }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'action'">
            <a-space>
              <a-button 
                size="small" 
                @click="showWarnDialog(record)"
                :disabled="record.status === 0"
              >
                警告
              </a-button>
              <a-button 
                size="small" 
                danger
                @click="showBanDialog(record)"
                :disabled="record.status === 0"
              >
                封禁
              </a-button>
              <a-button 
                size="small" 
                type="primary"
                @click="showUnbanDialog(record)"
                :disabled="record.status !== 0"
              >
                解封
              </a-button>
              <a-button 
                size="small" 
                @click="showWarnings(record)"
              >
                查看警告
              </a-button>
              <a-button 
                size="small" 
                @click="showDetail(record)"
              >
                详情
              </a-button>
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

    <!-- 警告用户对话框 -->
    <a-modal v-model:open="warnDialog.visible" title="警告用户" :width="500">
      <a-form :model="warnDialog.form" layout="vertical">
        <a-form-item label="警告原因">
          <a-textarea 
            v-model:value="warnDialog.form.reason" 
            :rows="4"
            placeholder="请输入警告原因"
          />
        </a-form-item>
      </a-form>
      <template #footer>
        <a-button @click="warnDialog.visible = false">取消</a-button>
        <a-button type="primary" @click="confirmWarn">确定</a-button>
      </template>
    </a-modal>

    <!-- 封禁用户对话框 -->
    <a-modal v-model:open="banDialog.visible" title="封禁用户" :width="500">
      <a-form :model="banDialog.form" layout="vertical">
        <a-form-item label="封禁原因">
          <a-textarea 
            v-model:value="banDialog.form.reason" 
            :rows="4"
            placeholder="请输入封禁原因"
          />
        </a-form-item>
      </a-form>
      <template #footer>
        <a-button @click="banDialog.visible = false">取消</a-button>
        <a-button type="primary" @click="confirmBan">确定</a-button>
      </template>
    </a-modal>

    <!-- 解封用户对话框 -->
    <a-modal v-model:open="unbanDialog.visible" title="解封用户" :width="500">
      <p>确定要解封用户 <strong>{{ unbanDialog.user?.username }}</strong> 吗？</p>
      <template #footer>
        <a-button @click="unbanDialog.visible = false">取消</a-button>
        <a-button type="primary" @click="confirmUnban">确定</a-button>
      </template>
    </a-modal>

    <!-- 用户详情对话框 -->
    <a-modal v-model:open="detailDialog.visible" title="用户详情" :width="600" :footer="null">
      <a-descriptions :column="1" bordered>
        <a-descriptions-item label="ID">{{ detailDialog.user?.id }}</a-descriptions-item>
        <a-descriptions-item label="用户名">{{ detailDialog.user?.username }}</a-descriptions-item>
        <a-descriptions-item label="昵称">{{ detailDialog.user?.nickname || '未设置' }}</a-descriptions-item>
        <a-descriptions-item label="性别">{{ getGenderText(detailDialog.user?.gender) }}</a-descriptions-item>
        <a-descriptions-item label="个性签名">{{ detailDialog.user?.bio || '未设置' }}</a-descriptions-item>
        <a-descriptions-item label="注册时间">{{ formatDate(detailDialog.user?.createdAt) }}</a-descriptions-item>
        <a-descriptions-item label="状态">
          <a-tag :color="getStatusType(detailDialog.user?.status)">
            {{ getStatusText(detailDialog.user?.status) }}
          </a-tag>
        </a-descriptions-item>
      </a-descriptions>
    </a-modal>

    <!-- 警告列表对话框 -->
    <a-modal v-model:open="warningsDialog.visible" title="用户警告列表" :width="800" :footer="null">
      <a-table 
        :data-source="warningsDialog.list" 
        :loading="warningsDialog.loading"
        :columns="warningColumns"
        :row-key="record => record.id"
        :pagination="false"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'createdAt'">
            {{ formatDate(record.createdAt) }}
          </template>
        </template>
      </a-table>
    </a-modal>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'
import { message, Modal } from 'ant-design-vue'
import api from '@/utils/api'

export default {
  name: 'Users',
  setup() {
    const users = ref([])
    const loading = ref(false)
    const searchKeyword = ref('')
    
    const columns = [
      { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
      { title: '用户名', dataIndex: 'username', key: 'username', width: 150 },
      { title: '昵称', dataIndex: 'nickname', key: 'nickname', width: 150 },
      { title: '性别', key: 'gender', width: 100 },
      { title: '个性签名', dataIndex: 'bio', key: 'bio', ellipsis: true },
      { title: '注册时间', key: 'createdAt', width: 180 },
      { title: '状态', key: 'status', width: 100 },
      { title: '操作', key: 'action', width: 320 }
    ]
    
    const warningColumns = [
      { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
      { title: '警告原因', dataIndex: 'reason', key: 'reason', ellipsis: true },
      { title: '警告级别', dataIndex: 'warningLevel', key: 'warningLevel', width: 100 },
      { title: '时间', key: 'createdAt', width: 180 }
    ]
    
    const pagination = ref({
      currentPage: 1,
      pageSize: 20,
      total: 0
    })
    
    const warnDialog = ref({
      visible: false,
      form: {
        reason: '',
        userId: null
      }
    })
    
    const banDialog = ref({
      visible: false,
      form: {
        reason: '',
        userId: null
      }
    })
    
    const unbanDialog = ref({
      visible: false,
      user: null
    })
    
    const detailDialog = ref({
      visible: false,
      user: null
    })
    
    const warningsDialog = ref({
      visible: false,
      list: [],
      loading: false,
      userId: null
    })
    
    const loadUsers = async () => {
      try {
        loading.value = true
        const params = {
          page: pagination.value.currentPage - 1,
          size: pagination.value.pageSize
        }
        if (searchKeyword.value) {
          params.keyword = searchKeyword.value
        }
        
        const response = await api.get('/admin/users/list', { params })
        users.value = response.data.users || []
        pagination.value.total = response.data.totalElements || 0
      } catch (error) {
        message.error('加载用户列表失败')
        console.error(error)
      } finally {
        loading.value = false
      }
    }
    
    const handleSizeChange = (current, size) => {
      pagination.value.pageSize = size
      pagination.value.currentPage = 1
      loadUsers()
    }
    
    const handleCurrentChange = (page) => {
      pagination.value.currentPage = page
      loadUsers()
    }
    
    const showWarnDialog = (user) => {
      warnDialog.value.form = {
        reason: '',
        userId: user.id
      }
      warnDialog.value.visible = true
    }
    
    const showBanDialog = (user) => {
      banDialog.value.form = {
        reason: '',
        userId: user.id
      }
      banDialog.value.visible = true
    }
    
    const showUnbanDialog = (user) => {
      unbanDialog.value.user = user
      unbanDialog.value.visible = true
    }
    
    const showDetail = (user) => {
      detailDialog.value.user = user
      detailDialog.value.visible = true
    }
    
    const showWarnings = async (user) => {
      try {
        warningsDialog.value.loading = true
        warningsDialog.value.visible = true
        const response = await api.get(`/admin/users/${user.id}/warnings`)
        warningsDialog.value.list = response.data.warnings || []
        warningsDialog.value.userId = user.id
      } catch (error) {
        message.error('获取警告列表失败')
      } finally {
        warningsDialog.value.loading = false
      }
    }
    
    const confirmWarn = async () => {
      try {
        await api.post(`/admin/users/${warnDialog.value.form.userId}/warn`, {
          reason: warnDialog.value.form.reason,
          adminId: 1
        })
        message.success('警告已发送')
        warnDialog.value.visible = false
        loadUsers()
      } catch (error) {
        message.error('警告发送失败')
      }
    }
    
    const confirmBan = async () => {
      try {
        await api.post(`/admin/users/${banDialog.value.form.userId}/ban`, {
          reason: banDialog.value.form.reason,
          adminId: 1
        })
        message.success('用户已封禁')
        banDialog.value.visible = false
        loadUsers()
      } catch (error) {
        message.error('封禁失败')
      }
    }
    
    const confirmUnban = async () => {
      try {
        await api.post(`/admin/users/${unbanDialog.value.user.id}/unban`, {
          adminId: 1
        })
        message.success('用户已解封')
        unbanDialog.value.visible = false
        loadUsers()
      } catch (error) {
        message.error('解封失败')
      }
    }
    
    const getGenderText = (gender) => {
      const map = { 'MALE': '男', 'FEMALE': '女', 'OTHER': '其他' }
      return map[gender] || '-'
    }
    
    const getStatusText = (status) => {
      const map = { 0: '封禁', 1: '正常', 2: '不安全' }
      return map[status] || '未知'
    }
    
    const getStatusType = (status) => {
      const map = { 0: 'red', 1: 'green', 2: 'orange' }
      return map[status] || 'default'
    }
    
    const formatDate = (dateString) => {
      if (!dateString) return '-'
      return new Date(dateString).toLocaleString('zh-CN')
    }
    
    onMounted(() => {
      loadUsers()
    })
    
    return {
      users,
      loading,
      searchKeyword,
      columns,
      warningColumns,
      pagination,
      warnDialog,
      banDialog,
      unbanDialog,
      detailDialog,
      warningsDialog,
      loadUsers,
      handleSizeChange,
      handleCurrentChange,
      showWarnDialog,
      showBanDialog,
      showUnbanDialog,
      showDetail,
      showWarnings,
      confirmWarn,
      confirmBan,
      confirmUnban,
      getGenderText,
      getStatusText,
      getStatusType,
      formatDate
    }
  }
}
</script>

<style scoped>
.users {
  padding: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.pagination {
  margin-top: 20px;
  text-align: right;
}
</style>
