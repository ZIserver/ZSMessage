<template>
  <div class="groups">
    <a-card>
      <template #title>
        <div class="card-header">
          <span>群组管理</span>
          <div class="toolbar">
            <a-input-search 
              v-model:value="searchKeyword" 
              placeholder="搜索群组名称" 
              style="width: 300px; margin-right: 10px;"
              allow-clear
              @search="loadGroups"
              @pressEnter="loadGroups"
            />
            <a-button type="primary" @click="loadGroups">
              <template #icon><reload-outlined /></template>
              刷新
            </a-button>
          </div>
        </div>
      </template>

      <a-table 
        :data-source="groups" 
        :loading="loading"
        :columns="columns"
        :row-key="record => record.id"
        :pagination="false"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'createdAt'">
            {{ formatDate(record.createdAt) }}
          </template>
          <template v-else-if="column.key === 'action'">
            <a-space>
              <a-button 
                size="small" 
                @click="showMembers(record)"
              >
                查看成员
              </a-button>
              <a-button 
                size="small" 
                danger
                @click="deleteGroup(record.id)"
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

    <!-- 群组成员对话框 -->
    <a-modal v-model:open="membersDialog.visible" title="群组成员" :width="600" :footer="null">
      <a-table 
        :data-source="membersDialog.members" 
        :loading="membersDialog.loading"
        :columns="memberColumns"
        :row-key="record => record.userId"
        :pagination="false"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'role'">
            <a-tag :color="record.role === 'OWNER' ? 'blue' : record.role === 'ADMIN' ? 'orange' : 'default'">
              {{ getRoleText(record.role) }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'joinedAt'">
            {{ formatDate(record.joinedAt) }}
          </template>
        </template>
      </a-table>
    </a-modal>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'
import { message, Modal } from 'ant-design-vue'
import { ReloadOutlined } from '@ant-design/icons-vue'
import api from '@/utils/api'

export default {
  name: 'Groups',
  components: {
    ReloadOutlined
  },
  setup() {
    const groups = ref([])
    const loading = ref(false)
    const searchKeyword = ref('')
    
    const columns = [
      { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
      { title: '群组名称', dataIndex: 'groupName', key: 'groupName', width: 200 },
      { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
      { title: '群主ID', dataIndex: 'ownerId', key: 'ownerId', width: 100 },
      { title: '创建时间', key: 'createdAt', width: 180 },
      { title: '操作', key: 'action', width: 200 }
    ]
    
    const memberColumns = [
      { title: '用户ID', dataIndex: 'userId', key: 'userId', width: 100 },
      { title: '角色', key: 'role', width: 100 },
      { title: '加入时间', key: 'joinedAt', width: 180 }
    ]
    
    const pagination = ref({
      currentPage: 1,
      pageSize: 20,
      total: 0
    })
    
    const membersDialog = ref({
      visible: false,
      members: [],
      loading: false
    })
    
    const loadGroups = async () => {
      try {
        loading.value = true
        const params = {
          page: pagination.value.currentPage - 1,
          size: pagination.value.pageSize
        }
        if (searchKeyword.value) {
          params.keyword = searchKeyword.value
        }
        
        const response = await api.get('/admin/groups/list', { params })
        groups.value = response.data || []
        pagination.value.total = response.data?.length || 0
      } catch (error) {
        message.error('加载群组列表失败')
        console.error(error)
      } finally {
        loading.value = false
      }
    }
    
    const handleSizeChange = (current, size) => {
      pagination.value.pageSize = size
      pagination.value.currentPage = 1
      loadGroups()
    }
    
    const handleCurrentChange = (page) => {
      pagination.value.currentPage = page
      loadGroups()
    }
    
    const showMembers = async (group) => {
      try {
        membersDialog.value.loading = true
        membersDialog.value.visible = true
        const response = await api.get(`/admin/groups/${group.id}`)
        membersDialog.value.members = response.data.members || []
      } catch (error) {
        message.error('获取群组成员失败')
      } finally {
        membersDialog.value.loading = false
      }
    }
    
    const deleteGroup = async (id) => {
      Modal.confirm({
        title: '提示',
        content: '确定要删除这个群组吗？删除后无法恢复！',
        okText: '确定',
        cancelText: '取消',
        okButtonProps: { danger: true },
        onOk: async () => {
          try {
            await api.delete(`/admin/groups/${id}`)
            message.success('群组已删除')
            loadGroups()
          } catch (error) {
            message.error('删除失败')
          }
        }
      })
    }
    
    const getRoleText = (role) => {
      const map = { 'OWNER': '群主', 'ADMIN': '管理员', 'MEMBER': '成员' }
      return map[role] || role
    }
    
    const formatDate = (dateString) => {
      if (!dateString) return '-'
      return new Date(dateString).toLocaleString('zh-CN')
    }
    
    onMounted(() => {
      loadGroups()
    })
    
    return {
      groups,
      loading,
      searchKeyword,
      columns,
      memberColumns,
      pagination,
      membersDialog,
      loadGroups,
      handleSizeChange,
      handleCurrentChange,
      showMembers,
      deleteGroup,
      getRoleText,
      formatDate
    }
  }
}
</script>

<style scoped>
.groups {
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
