<template>
  <div class="messages">
    <a-card>
      <template #title>
        <div class="card-header">
          <span>消息管理</span>
          <div class="toolbar">
            <a-input-search 
              v-model:value="searchKeyword" 
              placeholder="搜索消息内容" 
              style="width: 300px; margin-right: 10px;"
              allow-clear
              @search="loadMessages"
              @pressEnter="loadMessages"
            />
            <a-button type="primary" @click="loadMessages">
              <template #icon><reload-outlined /></template>
              刷新
            </a-button>
          </div>
        </div>
      </template>

      <a-table 
        :data-source="messages" 
        :loading="loading"
        :columns="columns"
        :row-key="record => record.id"
        :pagination="false"
        :row-selection="{ selectedRowKeys, onChange: handleSelectionChange }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'createdAt'">
            {{ formatDate(record.createdAt) }}
          </template>
          <template v-else-if="column.key === 'action'">
            <a-button 
              size="small" 
              danger
              @click="deleteMessage(record.id)"
            >
              删除
            </a-button>
          </template>
        </template>
      </a-table>

      <div class="batch-actions" v-if="selectedRowKeys.length > 0">
        <a-button 
          danger
          @click="batchDelete"
        >
          批量删除 ({{ selectedRowKeys.length }})
        </a-button>
      </div>

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
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'
import { message, Modal } from 'ant-design-vue'
import { ReloadOutlined } from '@ant-design/icons-vue'
import api from '@/utils/api'

export default {
  name: 'Messages',
  components: {
    ReloadOutlined
  },
  setup() {
    const messages = ref([])
    const loading = ref(false)
    const searchKeyword = ref('')
    const selectedRowKeys = ref([])
    
    const columns = [
      { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
      { title: '发送者ID', dataIndex: 'senderId', key: 'senderId', width: 100 },
      { title: '接收者ID', dataIndex: 'receiverId', key: 'receiverId', width: 100 },
      { title: '消息内容', dataIndex: 'content', key: 'content', ellipsis: true },
      { title: '发送时间', key: 'createdAt', width: 180 },
      { title: '操作', key: 'action', width: 150 }
    ]
    
    const pagination = ref({
      currentPage: 1,
      pageSize: 20,
      total: 0
    })
    
    const loadMessages = async () => {
      try {
        loading.value = true
        const params = {
          page: pagination.value.currentPage - 1,
          size: pagination.value.pageSize
        }
        if (searchKeyword.value) {
          params.keyword = searchKeyword.value
        }
        
        const response = await api.get('/admin/messages/list', { params })
        messages.value = response.data.messages || []
        pagination.value.total = response.data.totalElements || 0
      } catch (error) {
        message.error('加载消息列表失败')
        console.error(error)
      } finally {
        loading.value = false
      }
    }
    
    const handleSizeChange = (current, size) => {
      pagination.value.pageSize = size
      pagination.value.currentPage = 1
      loadMessages()
    }
    
    const handleCurrentChange = (page) => {
      pagination.value.currentPage = page
      loadMessages()
    }
    
    const handleSelectionChange = (keys) => {
      selectedRowKeys.value = keys
    }
    
    const deleteMessage = async (id) => {
      Modal.confirm({
        title: '提示',
        content: '确定要删除这条消息吗？',
        okText: '确定',
        cancelText: '取消',
        onOk: async () => {
          try {
            await api.delete(`/admin/messages/${id}`)
            message.success('消息已删除')
            loadMessages()
          } catch (error) {
            message.error('删除失败')
          }
        }
      })
    }
    
    const batchDelete = async () => {
      if (selectedRowKeys.value.length === 0) {
        message.warning('请先选择要删除的消息')
        return
      }
      
      Modal.confirm({
        title: '提示',
        content: `确定要删除选中的 ${selectedRowKeys.value.length} 条消息吗？`,
        okText: '确定',
        cancelText: '取消',
        onOk: async () => {
          try {
            await api.delete('/admin/messages/batch', { data: selectedRowKeys.value })
            message.success('批量删除成功')
            loadMessages()
            selectedRowKeys.value = []
          } catch (error) {
            message.error('批量删除失败')
          }
        }
      })
    }
    
    const formatDate = (dateString) => {
      if (!dateString) return '-'
      return new Date(dateString).toLocaleString('zh-CN')
    }
    
    onMounted(() => {
      loadMessages()
    })
    
    return {
      messages,
      loading,
      searchKeyword,
      selectedRowKeys,
      columns,
      pagination,
      loadMessages,
      handleSizeChange,
      handleCurrentChange,
      handleSelectionChange,
      deleteMessage,
      batchDelete,
      formatDate
    }
  }
}
</script>

<style scoped>
.messages {
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

.batch-actions {
  margin: 20px 0;
}

.pagination {
  margin-top: 20px;
  text-align: right;
}
</style>
