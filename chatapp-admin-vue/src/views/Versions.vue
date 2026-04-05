<template>
  <div class="versions">
    <a-card>
      <template #title>
        <div class="card-header">
          <span>版本管理</span>
          <a-button type="primary" @click="showCreateDialog">
            <template #icon><plus-outlined /></template>
            创建版本
          </a-button>
        </div>
      </template>

      <a-table 
        :data-source="versions" 
        :loading="loading"
        :columns="columns"
        :row-key="record => record.id"
        :pagination="false"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'platform'">
            <a-tag :color="getPlatformType(record.platform)">
              {{ getPlatformText(record.platform) }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'isForceUpdate'">
            <a-tag :color="record.isForceUpdate ? 'red' : 'green'">
              {{ record.isForceUpdate ? '是' : '否' }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'status'">
            <a-tag :color="getStatusType(record.status)">
              {{ getStatusText(record.status) }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'releaseDate'">
            {{ formatDate(record.releaseDate) }}
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
                type="primary"
                @click="publishVersion(record.id)"
                :disabled="record.status === 'ACTIVE'"
              >
                发布
              </a-button>
              <a-button 
                size="small" 
                danger
                @click="deleteVersion(record.id)"
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

    <!-- 创建/编辑版本对话框 -->
    <a-modal 
      v-model:open="dialog.visible" 
      :title="dialog.isEdit ? '编辑版本' : '创建版本'" 
      :width="700"
    >
      <a-form :model="dialog.form" layout="vertical" ref="formRef">
        <a-form-item label="版本号" name="version" :rules="[{ required: true, message: '请输入版本号' }]">
          <a-input v-model:value="dialog.form.version" placeholder="请输入版本号，如：1.0.0" />
        </a-form-item>
        <a-form-item label="平台" name="platform" :rules="[{ required: true, message: '请选择平台' }]">
          <a-select v-model:value="dialog.form.platform" placeholder="请选择平台">
            <a-select-option value="WINDOWS">Windows</a-select-option>
            <a-select-option value="MACOS">macOS</a-select-option>
            <a-select-option value="LINUX">Linux</a-select-option>
            <a-select-option value="ANDROID">Android</a-select-option>
            <a-select-option value="IOS">iOS</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="下载地址" name="downloadUrl" :rules="[{ required: true, message: '请输入下载地址' }]">
          <a-textarea 
            v-model:value="dialog.form.downloadUrl" 
            placeholder="请输入下载地址"
            :rows="3"
          />
        </a-form-item>
        <a-form-item label="更新说明" name="updateDescription" :rules="[{ required: true, message: '请输入更新说明' }]">
          <a-textarea 
            v-model:value="dialog.form.updateDescription" 
            :rows="4"
            placeholder="请输入更新说明"
          />
        </a-form-item>
        <a-form-item label="强制更新">
          <a-switch v-model:checked="dialog.form.isForceUpdate" />
        </a-form-item>
        <a-form-item label="是否立即发布">
          <a-switch v-model:checked="dialog.form.shouldPublish" />
        </a-form-item>
      </a-form>
      <template #footer>
        <a-button @click="dialog.visible = false">取消</a-button>
        <a-button type="primary" @click="saveVersion">确定</a-button>
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
  name: 'Versions',
  components: {
    PlusOutlined
  },
  setup() {
    const versions = ref([])
    const loading = ref(false)
    
    const columns = [
      { title: '版本号', dataIndex: 'version', key: 'version', width: 150 },
      { title: '平台', key: 'platform', width: 120 },
      { title: '下载地址', dataIndex: 'downloadUrl', key: 'downloadUrl', ellipsis: true },
      { title: '更新说明', dataIndex: 'updateDescription', key: 'updateDescription', ellipsis: true },
      { title: '强制更新', key: 'isForceUpdate', width: 100 },
      { title: '状态', key: 'status', width: 100 },
      { title: '发布时间', key: 'releaseDate', width: 180 },
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
        version: '',
        platform: undefined,
        downloadUrl: '',
        updateDescription: '',
        isForceUpdate: false,
        shouldPublish: false
      }
    })
    
    const formRef = ref()
    
    const loadVersions = async () => {
      try {
        loading.value = true
        const params = {
          page: pagination.value.currentPage - 1,
          size: pagination.value.pageSize
        }
        
        const response = await api.get('/admin/versions/list', { params })
        versions.value = response.data || []
        pagination.value.total = response.data?.length || 0
      } catch (error) {
        message.error('加载版本列表失败')
        console.error(error)
      } finally {
        loading.value = false
      }
    }
    
    const handleSizeChange = (current, size) => {
      pagination.value.pageSize = size
      pagination.value.currentPage = 1
      loadVersions()
    }
    
    const handleCurrentChange = (page) => {
      pagination.value.currentPage = page
      loadVersions()
    }
    
    const showCreateDialog = () => {
      dialog.value.form = {
        version: '',
        platform: undefined,
        downloadUrl: '',
        updateDescription: '',
        isForceUpdate: false,
        shouldPublish: false
      }
      dialog.value.isEdit = false
      dialog.value.visible = true
    }
    
    const showEditDialog = (version) => {
      dialog.value.form = {
        id: version.id,
        version: version.version,
        platform: version.platform,
        downloadUrl: version.downloadUrl,
        updateDescription: version.updateDescription,
        isForceUpdate: version.isForceUpdate,
        shouldPublish: false
      }
      dialog.value.isEdit = true
      dialog.value.visible = true
    }
    
    const saveVersion = async () => {
      try {
        // 简单验证
        if (!dialog.value.form.version || !dialog.value.form.platform || !dialog.value.form.downloadUrl || !dialog.value.form.updateDescription) {
          message.error('请填写必填项')
          return
        }
        
        if (dialog.value.isEdit) {
          await api.put(`/admin/versions/${dialog.value.form.id}`, dialog.value.form)
          message.success('版本更新成功')
        } else {
          await api.post('/admin/versions/create', dialog.value.form)
          message.success('版本创建成功')
        }
        
        dialog.value.visible = false
        loadVersions()
      } catch (error) {
        message.error('保存失败')
      }
    }
    
    const publishVersion = async (id) => {
      try {
        await api.post(`/admin/versions/${id}/publish`)
        message.success('版本发布成功')
        loadVersions()
      } catch (error) {
        message.error('发布失败')
      }
    }
    
    const deleteVersion = async (id) => {
      Modal.confirm({
        title: '提示',
        content: '确定要删除这个版本吗？',
        okText: '确定',
        cancelText: '取消',
        okButtonProps: { danger: true },
        onOk: async () => {
          try {
            await api.delete(`/admin/versions/${id}`)
            message.success('版本已删除')
            loadVersions()
          } catch (error) {
            message.error('删除失败')
          }
        }
      })
    }
    
    const getPlatformText = (platform) => {
      const map = { 'WINDOWS': 'Windows', 'MACOS': 'macOS', 'LINUX': 'Linux', 'ANDROID': 'Android', 'IOS': 'iOS' }
      return map[platform] || platform
    }
    
    const getPlatformType = (platform) => {
      const map = { 'WINDOWS': 'blue', 'MACOS': 'green', 'LINUX': 'orange', 'ANDROID': 'red', 'IOS': 'purple' }
      return map[platform] || 'default'
    }
    
    const getStatusText = (status) => {
      const map = { 'DRAFT': '草稿', 'ACTIVE': '已发布', 'ARCHIVED': '已归档' }
      return map[status] || status
    }
    
    const getStatusType = (status) => {
      const map = { 'DRAFT': 'default', 'ACTIVE': 'green', 'ARCHIVED': 'gray' }
      return map[status] || 'default'
    }
    
    const formatDate = (dateString) => {
      if (!dateString) return '-'
      return new Date(dateString).toLocaleString('zh-CN')
    }
    
    onMounted(() => {
      loadVersions()
    })
    
    return {
      versions,
      loading,
      columns,
      pagination,
      dialog,
      formRef,
      loadVersions,
      handleSizeChange,
      handleCurrentChange,
      showCreateDialog,
      showEditDialog,
      saveVersion,
      publishVersion,
      deleteVersion,
      getPlatformText,
      getPlatformType,
      getStatusText,
      getStatusType,
      formatDate
    }
  }
}
</script>

<style scoped>
.versions {
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
