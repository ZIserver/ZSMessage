import Dashboard from './views/Dashboard.vue'
import Users from './views/Users.vue'
import Messages from './views/Messages.vue'
import ChatViewer from './views/ChatViewer.vue'
import Groups from './views/Groups.vue'
import Appeals from './views/Appeals.vue'
import Announcements from './views/Announcements.vue'
import Versions from './views/Versions.vue'
import Developers from './views/Developers.vue'
import Login from './views/Login.vue'

const routes = [
  {
    path: '/',
    redirect: '/dashboard'
  },
  {
    path: '/login',
    name: 'Login',
    component: Login,
    meta: { requiresGuest: true }
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: Dashboard,
    meta: { requiresAuth: true }
  },
  {
    path: '/users',
    name: 'Users',
    component: Users,
    meta: { requiresAuth: true }
  },
  {
    path: '/messages',
    name: 'Messages',
    component: Messages,
    meta: { requiresAuth: true }
  },
  {
    path: '/chat-viewer',
    name: 'ChatViewer',
    component: ChatViewer,
    meta: { requiresAuth: true }
  },
  {
    path: '/groups',
    name: 'Groups',
    component: Groups,
    meta: { requiresAuth: true }
  },
  {
    path: '/appeals',
    name: 'Appeals',
    component: Appeals,
    meta: { requiresAuth: true }
  },
  {
    path: '/announcements',
    name: 'Announcements',
    component: Announcements,
    meta: { requiresAuth: true }
  },
  {
    path: '/versions',
    name: 'Versions',
    component: Versions,
    meta: { requiresAuth: true }
  },
  {
    path: '/developers',
    name: 'Developers',
    component: Developers,
    meta: { requiresAuth: true }
  }
]

export default routes