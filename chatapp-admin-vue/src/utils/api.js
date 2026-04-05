import axios from 'axios'
import { message } from 'ant-design-vue'

// 创建axios实例
const api = axios.create({
  baseURL: 'https://msg.v2.zhsdev.top/api',
  timeout: 10000
})

// 请求拦截器
api.interceptors.request.use(
  config => {
    const token = localStorage.getItem('adminToken')
    if (token) {
      config.headers['Admin-Token'] = token
    }
    return config
  },
  error => {
    return Promise.reject(error)
  }
)

// 响应拦截器
api.interceptors.response.use(
  response => {
    return response
  },
  error => {
    if (error.response?.status === 401) {
      // Token失效，清除本地存储并跳转到登录页
      localStorage.removeItem('adminToken')
      window.location.hash = '#/login'
      message.error('认证失效，请重新登录')
    } else if (error.response?.data?.error) {
      message.error(error.response.data.error)
    } else {
      message.error('请求失败')
    }
    return Promise.reject(error)
  }
)

// 封装请求方法
const request = {
  get(url, params = {}) {
    return api.get(url, { params })
  },
  post(url, data = {}) {
    return api.post(url, data)
  },
  put(url, data = {}) {
    return api.put(url, data)
  },
  delete(url) {
    return api.delete(url)
  }
}

export default request
