<template>
  <div class="appeals">
    <a-card>
      <template #title>
        <div class="card-header">
          <span>申诉管理</span>
          <div class="toolbar">
            <a-select 
              v-model:value="statusFilter" 
              placeholder="状态筛选" 
              style="width: 150px; margin-right: 10px;"
              allow-clear
              @change="loadAppeals"
            >
              <a-select-option value="">全部状态</a-select-option>
              <a-select-option value="PENDING">待处理</a-select-option>
              <a-select-option value="APPROVED">已批准</a-select-option>
              <a-select-option value="REJECTED">已拒绝</a-select-option>
            </a-select>
            <a-button type="primary" @click="loadAppeals">
              <template #icon><reload-outlined /></template>
              刷新
            </a-button>
          </div>
        </div>
      </template>

      <a-table 
        :data-source="appeals" 
        :loading="loading"
        :columns="columns"
        :row-key="record => record.id"
        :pagination="false"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'status'">
            <a-tag :color="getStatusType(record.status)">
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
                type="primary"
                @click="showApproveDialog(record)"
                :disabled="record.status !== 'PENDING'"
              >
                批准
              </a-button>
              <a-button 
                size="small" 
                danger
                @click="showRejectDialog(record)"
                :disabled="record.status !== 'PENDING'"
              >
                拒绝
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

    <!-- 批准申诉对话框 -->
    <a-modal v-model:open="approveDialog.visible" title="批准申诉" :width="500">
      <a-form :model="approveDialog.form" layout="vertical">
        <a-form-item label="处理意见">
          <a-textarea 
            v-model:value="approveDialog.form.adminResponse" 
            :rows="4"
            placeholder="请输入处理意见（可选）"
          />
        </a-form-item>
      </a-form>
      <template #footer>
        <a-button @click="approveDialog.visible = false">取消</a-button>
        <a-button type="primary" @click="confirmApprove">确定</a-button>
      </template>
    </a-modal>

    <!-- 拒绝申诉对话框 -->
    <a-modal v-model:open="rejectDialog.visible" title="拒绝申诉" :width="500">
      <a-form :model="rejectDialog.form" layout="vertical">
        <a-form-item label="拒绝理由" required>
          <a-textarea 
            v-model:value="rejectDialog.form.adminResponse" 
            :rows="4"
            placeholder="请输入拒绝理由"
          />
        </a-form-item>
      </a-form>
      <template #footer>
        <a-button @click="rejectDialog.visible = false">取消</a-button>
        <a-button type="primary" @click="confirmReject">确定</a-button>
      </template>
    </a-modal>

    <!-- 申诉详情对话框 -->
    <a-modal v-model:open="detailDialog.visible" title="申诉详情" :width="600" :footer="null">
      <a-descriptions :column="1" bordered>
        <a-descriptions-item label="ID">{{ detailDialog.appeal?.id }}</a-descriptions-item>
        <a-descriptions-item label="用户名">{{ detailDialog.appeal?.username }}</a-descriptions-item>
        <a-descriptions-item label="智穗号">{{ detailDialog.appeal?.zsNumber || '-' }}</a-descriptions-item>
        <a-descriptions-item label="申诉原因">{{ detailDialog.appeal?.reason }}</a-descriptions-item>
        <a-descriptions-item label="状态">
          <a-tag :color="getStatusType(detailDialog.appeal?.status)">
            {{ getStatusText(detailDialog.appeal?.status) }}
          </a-tag>
        </a-descriptions-item>
        <a-descriptions-item label="管理员回复">{{ detailDialog.appeal?.adminResponse || '-' }}</a-descriptions-item>
        <a-descriptions-item label="申请时间">{{ formatDate(detailDialog.appeal?.createdAt) }}</a-descriptions-item>
        <a-descriptions-item label="处理时间">{{ formatDate(detailDialog.appeal?.processedAt) }}</a-descriptions-item>
      </a-descriptions>
    </a-modal>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { ReloadOutlined } from '@ant-design/icons-vue'
import api from '@/utils/api'

export default {
  name: 'Appeals',
  components: {
    ReloadOutlined
  },
  setup() {
    const appeals = ref([])
    const loading = ref(false)
    const statusFilter = ref('')
    
    const columns = [
      { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
      { title: '用户名', dataIndex: 'username', key: 'username', width: 150 },
      { title: '智穗号', dataIndex: 'zsNumber', key: 'zsNumber', width: 120 },
      { title: '申诉原因', dataIndex: 'reason', key: 'reason', ellipsis: true },
      { title: '状态', key: 'status', width: 120 },
      { title: '管理员回复', dataIndex: 'adminResponse', key: 'adminResponse', ellipsis: true },
      { title: '申请时间', key: 'createdAt', width: 180 },
      { title: '操作', key: 'action', width: 250 }
    ]
    
    const pagination = ref({
      currentPage: 1,
      pageSize: 20,
      total: 0
    })
    
    const approveDialog = ref({
      visible: false,
      form: {
        adminResponse: '',
        appealId: null
      }
    })
    
    const rejectDialog = ref({
      visible: false,
      form: {
        adminResponse: '',
        appealId: null
      }
    })
    
    const detailDialog = ref({
      visible: false,
      appeal: null
    })
    
    const loadAppeals = async () => {
      try {
        loading.value = true
        const params = {
          page: pagination.value.currentPage - 1,
          size: pagination.value.pageSize
        }
        if (statusFilter.value) {
          params.status = statusFilter.value
        }
        
        const response = await api.get('/admin/appeals', { params })
        appeals.value = response.data.appeals || []
        pagination.value.total = response.data.total || 0
      } catch (error) {
        message.error('加载申诉列表失败')
        console.error(error)
      } finally {
        loading.value = false
      }
    }
    
    const handleSizeChange = (current, size) => {
      pagination.value.pageSize = size
      pagination.value.currentPage = 1
      loadAppeals()
    }
    
    const handleCurrentChange = (page) => {
      pagination.value.currentPage = page
      loadAppeals()
    }
    
    const showApproveDialog = (appeal) => {
      approveDialog.value.form = {
        adminResponse: '',
        appealId: appeal.id
      }
      approveDialog.value.visible = true
    }
    
    const showRejectDialog = (appeal) => {
      rejectDialog.value.form = {
        adminResponse: '',
        appealId: appeal.id
      }
      rejectDialog.value.visible = true
    }
    
    const showDetail = (appeal) => {
      detailDialog.value.appeal = appeal
      detailDialog.value.visible = true
    }
    
    const confirmApprove = async () => {
      try {
        await api.post(`/admin/appeals/${approveDialog.value.form.appealId}/process`, {
          status: 'APPROVED',
          adminResponse: approveDialog.value.form.adminResponse,
          adminId: 1
        })
        message.success('申诉已批准')
        approveDialog.value.visible = false
        loadAppeals()
      } catch (error) {
        message.error('批准失败')
      }
    }
    
    const confirmReject = async () => {
      try {
        if (!rejectDialog.value.form.adminResponse.trim()) {
          message.error('请输入拒绝理由')
          return
        }
        
        await api.post(`/admin/appeals/${rejectDialog.value.form.appealId}/process`, {
          status: 'REJECTED',
          adminResponse: rejectDialog.value.form.adminResponse,
          adminId: 1
        })
        message.success('申诉已拒绝')
        rejectDialog.value.visible = false
        loadAppeals()
      } catch (error) {
        message.error('拒绝失败')
      }
    }
    
    const getStatusText = (status) => {
      const map = { 'PENDING': '待处理', 'APPROVED': '已批准', 'REJECTED': '已拒绝' }
      return map[status] || status
    }
    
    const getStatusType = (status) => {
      const map = { 'PENDING': 'orange', 'APPROVED': 'green', 'REJECTED': 'red' }
      return map[status] || 'default'
    }
    
    const formatDate = (dateString) => {
      if (!dateString) return '-'
      return new Date(dateString).toLocaleString('zh-CN')
    }
    
    onMounted(() => {
      loadAppeals()
    })
    
    return {
      appeals,
      loading,
      statusFilter,
      columns,
      pagination,
      approveDialog,
      rejectDialog,
      detailDialog,
      loadAppeals,
      handleSizeChange,
      handleCurrentChange,
      showApproveDialog,
      showRejectDialog,
      showDetail,
      confirmApprove,
      confirmReject,
      getStatusText,
      getStatusType,
      formatDate
    }
  }
}
</script>

<style scoped>
.appeals {
  padding: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.toolbar {
  display: flex;
  gap: 10px;
}

.pagination {
  margin-top: 20px;
  text-align: right;
}
</style>
