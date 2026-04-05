<template>
  <div class="announcements">
    <a-card>
      <template #title>
        <div class="card-header">
          <span>公告管理</span>
          <a-button type="primary" @click="showCreateDialog">
            <template #icon><plus-outlined /></template>
            创建公告
          </a-button>
        </div>
      </template>

      <a-table 
        :data-source="announcements" 
        :loading="loading"
        :columns="columns"
        :row-key="record => record.id"
        :pagination="false"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'type'">
            <a-tag :color="getTypeType(record.type)">
              {{ getTypeText(record.type) }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'priority'">
            <a-tag :color="getPriorityType(record.priority)">
              {{ getPriorityText(record.priority) }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'enabled'">
            <a-tag :color="record.enabled ? 'green' : 'default'">
              {{ record.enabled ? '已启用' : '未启用' }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'createdAt'">
            {{ formatDate(record.createdAt) }}
          </template>
          <template v-else-if="column.key === 'action'">
            <a-space>
              <a-button 
                size="small" 
                @click="showEditDialog(record)"
              >
                编辑
              </a-button>
              <a-button 
                size="small" 
                :type="record.enabled ? 'default' : 'primary'"
                @click="toggleEnabled(record)"
              >
                {{ record.enabled ? '禁用' : '启用' }}
              </a-button>
              <a-button 
                size="small" 
                danger
                @click="deleteAnnouncement(record.id)"
              >
                删除
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

    <!-- 创建/编辑公告对话框 -->
    <a-modal 
      v-model:open="dialog.visible" 
      :title="dialog.isEdit ? '编辑公告' : '创建公告'" 
      :width="700"
    >
      <a-form :model="dialog.form" layout="vertical" ref="formRef">
        <a-form-item label="标题" name="title" :rules="[{ required: true, message: '请输入公告标题' }]">
          <a-input v-model:value="dialog.form.title" placeholder="请输入公告标题" />
        </a-form-item>
        <a-form-item label="类型" name="type" :rules="[{ required: true, message: '请选择公告类型' }]">
          <a-select v-model:value="dialog.form.type" placeholder="请选择公告类型">
            <a-select-option value="notice">系统公告</a-select-option>
            <a-select-option value="maintenance">维护通知</a-select-option>
            <a-select-option value="event">活动通知</a-select-option>
            <a-select-option value="update">更新公告</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="优先级" name="priority" :rules="[{ required: true, message: '请选择优先级' }]">
          <a-select v-model:value="dialog.form.priority" placeholder="请选择优先级">
            <a-select-option :value="0">低</a-select-option>
            <a-select-option :value="1">中</a-select-option>
            <a-select-option :value="2">高</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="内容" name="content" :rules="[{ required: true, message: '请输入公告内容' }]">
          <a-textarea 
            v-model:value="dialog.form.content" 
            :rows="6"
            placeholder="请输入公告内容"
          />
        </a-form-item>
        <a-form-item label="是否立即发布">
          <a-switch v-model:checked="dialog.form.shouldPublish" />
        </a-form-item>
      </a-form>
      <template #footer>
        <a-button @click="dialog.visible = false">取消</a-button>
        <a-button type="primary" @click="saveAnnouncement">确定</a-button>
      </template>
    </a-modal>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'
import { message, Modal } from 'ant-design-vue'
import { PlusOutlined } from '@ant-design/icons-vue'
import api from '@/utils/api'

export default {
  name: 'Announcements',
  components: {
    PlusOutlined
  },
  setup() {
    const announcements = ref([])
    const loading = ref(false)
    
    const columns = [
      { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
      { title: '标题', dataIndex: 'title', key: 'title', ellipsis: true },
      { title: '类型', key: 'type', width: 120 },
      { title: '优先级', key: 'priority', width: 100 },
      { title: '状态', key: 'enabled', width: 100 },
      { title: '发布时间', key: 'createdAt', width: 180 },
      { title: '操作', key: 'action', width: 250 }
    ]
    
    const pagination = ref({
      currentPage: 1,
      pageSize: 20,
      total: 0
    })
    
    const dialog = ref({
      visible: false,
      isEdit: false,
      form: {
        title: '',
        type: undefined,
        priority: undefined,
        content: '',
        shouldPublish: false
      }
    })
    
    const formRef = ref()
    
    const loadAnnouncements = async () => {
      try {
        loading.value = true
        const params = {
          page: pagination.value.currentPage - 1,
          size: pagination.value.pageSize
        }
        
        const response = await api.get('/admin/announcements/list', { params })
        announcements.value = response.data.content || []
        pagination.value.total = response.data.totalElements || 0
      } catch (error) {
        message.error('加载公告列表失败')
        console.error(error)
      } finally {
        loading.value = false
      }
    }
    
    const handleSizeChange = (current, size) => {
      pagination.value.pageSize = size
      pagination.value.currentPage = 1
      loadAnnouncements()
    }
    
    const handleCurrentChange = (page) => {
      pagination.value.currentPage = page
      loadAnnouncements()
    }
    
    const showCreateDialog = () => {
      dialog.value.form = {
        title: '',
        type: undefined,
        priority: undefined,
        content: '',
        shouldPublish: false
      }
      dialog.value.isEdit = false
      dialog.value.visible = true
    }
    
    const showEditDialog = (announcement) => {
      dialog.value.form = {
        id: announcement.id,
        title: announcement.title,
        type: announcement.type,
        priority: announcement.priority,
        content: announcement.content,
        shouldPublish: false
      }
      dialog.value.isEdit = true
      dialog.value.visible = true
    }
    
    const saveAnnouncement = async () => {
      try {
        // 简单验证
        if (!dialog.value.form.title || !dialog.value.form.type || !dialog.value.form.priority || !dialog.value.form.content) {
          message.error('请填写必填项')
          return
        }
        
        if (dialog.value.isEdit) {
          await api.put(`/admin/announcements/${dialog.value.form.id}`, dialog.value.form)
          message.success('公告更新成功')
        } else {
          await api.post('/admin/announcements/create', dialog.value.form)
          message.success('公告创建成功')
        }
        
        dialog.value.visible = false
        loadAnnouncements()
      } catch (error) {
        message.error('保存失败')
      }
    }
    
    const toggleEnabled = async (record) => {
      try {
        // 使用专门的 toggle 接口
        await api.post(`/admin/announcements/${record.id}/toggle`)
        message.success(record.enabled ? '公告已禁用' : '公告已启用')
        loadAnnouncements()
      } catch (error) {
        message.error('操作失败')
      }
    }
    
    const deleteAnnouncement = async (id) => {
      Modal.confirm({
        title: '提示',
        content: '确定要删除这个公告吗？',
        okText: '确定',
        cancelText: '取消',
        okButtonProps: { danger: true },
        onOk: async () => {
          try {
            await api.delete(`/admin/announcements/${id}`)
            message.success('公告已删除')
            loadAnnouncements()
          } catch (error) {
            message.error('删除失败')
          }
        }
      })
    }
    
    const getTypeText = (type) => {
      const map = { 'notice': '系统公告', 'maintenance': '维护通知', 'event': '活动通知', 'update': '更新公告' }
      return map[type] || type
    }
    
    const getTypeType = (type) => {
      const map = { 'notice': 'blue', 'maintenance': 'orange', 'event': 'green', 'update': 'purple' }
      return map[type] || 'default'
    }
    
    const getPriorityText = (priority) => {
      // priority 是数字：0=低, 1=中, 2=高
      const map = { 0: '低', 1: '中', 2: '高' }
      return map[priority] ?? priority
    }
    
    const getPriorityType = (priority) => {
      const map = { 0: 'default', 1: 'orange', 2: 'red' }
      return map[priority] ?? 'default'
    }
    
    const formatDate = (dateString) => {
      if (!dateString) return '-'
      return new Date(dateString).toLocaleString('zh-CN')
    }
    
    onMounted(() => {
      loadAnnouncements()
    })
    
    return {
      announcements,
      loading,
      columns,
      pagination,
      dialog,
      formRef,
      loadAnnouncements,
      handleSizeChange,
      handleCurrentChange,
      showCreateDialog,
      showEditDialog,
      saveAnnouncement,
      toggleEnabled,
      deleteAnnouncement,
      getTypeText,
      getTypeType,
      getPriorityText,
      getPriorityType,
      formatDate
    }
  }
}
</script>

<style scoped>
.announcements {
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
