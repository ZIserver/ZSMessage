# ChatApp Electron 客户端

基于 Electron + HTML + CSS + JavaScript 开发的跨平台桌面聊天应用。

## 技术栈

- **Electron** - 跨平台桌面应用框架
- **HTML5/CSS3** - 现代化UI界面
- **Vanilla JavaScript** - 原生JS，无额外框架依赖
- **Axios** - HTTP请求库
- **Node.js** - 后端运行环境

## 项目结构

```
ChatApp-Electron/
├── main.js                    # Electron主进程
├── package.json               # 项目配置
├── src/
│   ├── pages/                 # 页面文件
│   │   ├── login.html        # 登录/注册页面
│   │   └── chat.html         # 主聊天页面
│   ├── styles/                # 样式文件
│   │   ├── common.css        # 公共样式
│   │   └── chat.css          # 聊天页面样式
│   ├── scripts/               # JavaScript文件
│   │   └── chat.js           # 聊天页面逻辑
│   └── services/              # 服务层
│       └── api.js            # API服务封装
└── README.md
```

## 快速开始

### 1. 安装依赖

```bash
cd ChatApp-Electron
npm install
```

### 2. 确保后端服务运行

确保后端服务已启动在 `http://localhost:8080`

### 3. 启动应用

```bash
# 开发模式（自动打开DevTools）
npm run dev

# 生产模式
npm start
```

## 功能特性

### ✅ 已实现

- 🔐 **用户认证**
  - 登录/注册
  - Token认证
  - 自动登录状态保持

- 💬 **即时通讯**
  - 一对一聊天
  - 实时消息显示
  - 消息历史记录

- 👥 **好友管理**
  - 搜索用户
  - 发送好友请求
  - 接受/拒绝好友请求
  - 好友列表展示

- 👤 **个人资料**
  - 查看/编辑昵称
  - 个性签名
  - 头像显示（首字母）

### 🚧 待实现

- 📁 文件传输
- 😊 表情包支持
- 🔍 消息搜索
- 🔄 消息撤回/转发
- 🔔 桌面通知
- 🌐 WebSocket实时推送

## API接口

项目使用以下后端API：

- `POST /api/auth/login` - 登录
- `POST /api/auth/register` - 注册
- `GET /api/users/search` - 搜索用户
- `GET /api/friends/list/{userId}` - 获取好友列表
- `POST /api/friends/request` - 发送好友请求
- `GET /api/friends/pending/{userId}` - 获取待处理请求
- `POST /api/friends/accept/{requestId}` - 接受好友请求
- `POST /api/friends/reject/{requestId}` - 拒绝好友请求
- `GET /api/messages/history` - 获取消息历史
- `POST /api/messages/send` - 发送消息

## 开发说明

### 修改API地址

编辑 `src/services/api.js` 文件：

```javascript
this.baseURL = 'http://your-backend-url:port/api';
```

### 调试

开发模式下会自动打开 DevTools：

```bash
npm run dev
```

按 `F12` 或 `Ctrl+Shift+I` 打开开发者工具

### 打包发布

```bash
# 安装打包工具
npm install --save-dev electron-builder

# 打包Windows版本
npm run build:win

# 打包Mac版本
npm run build:mac

# 打包Linux版本
npm run build:linux
```

## 常见问题

### 1. 无法连接后端

- 确保后端服务已启动
- 检查 `src/services/api.js` 中的 `baseURL` 配置
- 查看控制台Network日志

### 2. 登录失败

- 检查数据库连接是否正常
- 确认后端服务正常运行
- 查看后端控制台日志

### 3. 消息不显示

- 确保已登录成功
- 检查好友关系是否建立
- 查看浏览器控制台错误信息

## 相比WinUI3的优势

1. **跨平台** - 支持 Windows、macOS、Linux
2. **开发简单** - 使用Web技术，学习成本低
3. **调试方便** - 内置Chrome DevTools
4. **生态丰富** - npm包管理，海量第三方库
5. **热更新** - 支持在线更新应用
6. **易于扩展** - 模块化架构，便于维护

## 性能优化建议

- 使用虚拟滚动优化长列表
- 实现消息分页加载
- 添加图片懒加载
- 使用WebSocket替代轮询
- 实现本地消息缓存

## 安全建议

- Token存储使用electron-store
- 敏感信息加密存储
- 启用Content Security Policy
- 禁用Node Integration（生产环境）
- 使用preload脚本隔离上下文

## License

MIT
