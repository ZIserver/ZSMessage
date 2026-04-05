package com.chatapp.controller;

import com.chatapp.entity.OAuthApplication;
import com.chatapp.service.OAuthService;
import com.chatapp.service.OAuthApplicationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

/**
 * OAuth 2.0 控制器
 * 处理第三方应用授权登录
 */
@RestController
@RequestMapping("/oauth")
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
@Slf4j
public class OAuthController {
    
    private final OAuthService oAuthService;
    private final OAuthApplicationService oAuthApplicationService;
    
    /**
     * 显示OAuth授权页面
     * GET /oauth/authorize?app_id=xxx&state=xxx&scope=userinfo
     * redirect_uri 从数据库获取，不需要前端传递
     */
    @GetMapping("/authorize")
    public ResponseEntity<String> showAuthorizePage(
            @RequestParam(required = false) String app_id,
            @RequestParam(required = false) String client_id,
            @RequestParam(required = false) String state,
            @RequestParam(required = false, defaultValue = "userinfo") String scope) {
        
        // 支持 app_id 和 client_id 两种参数名（app_id 优先）
        String appId = (app_id != null && !app_id.isEmpty()) ? app_id : client_id;
        
        log.info("[OAuth] 授权请求 - app_id: {}", appId);
        
        // 验证必要参数
        if (appId == null || appId.isEmpty()) {
            return ResponseEntity.badRequest().body(buildErrorPage("缺少参数: app_id"));
        }
        
        // 从数据库获取应用信息
        Optional<OAuthApplication> appOpt = oAuthApplicationService.getActiveApplication(appId);
        if (appOpt.isEmpty()) {
            return ResponseEntity.badRequest().body(buildErrorPage("应用不存在或已禁用"));
        }
        
        OAuthApplication app = appOpt.get();
        String redirectUri = app.getRedirectUri();
        
        // 返回授权页面HTML（传递应用信息）
        String html = buildAuthorizePage(app, redirectUri, state, scope);
        return ResponseEntity.ok()
                .header("Content-Type", "text/html; charset=UTF-8")
                .body(html);
    }
    
    /**
     * 处理授权确认
     * POST /oauth/authorize
     * 请求体: { app_id, state, scope, user_id }
     * redirect_uri 从数据库获取
     */
    @PostMapping("/authorize")
    public ResponseEntity<?> handleAuthorize(@RequestBody Map<String, Object> request) {
        try {
            // 支持 app_id 和 client_id 两种参数名（app_id 优先）
            String appId = request.get("app_id") != null ? (String) request.get("app_id") : (String) request.get("client_id");
            String state = (String) request.get("state");
            String scope = (String) request.get("scope");
            Long userId = Long.valueOf(request.get("user_id").toString());
            
            log.info("[OAuth] 授权确认 - app_id: {}, user_id: {}", appId, userId);
            
            // 从数据库获取应用信息
            Optional<OAuthApplication> appOpt = oAuthApplicationService.getActiveApplication(appId);
            if (appOpt.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "应用不存在或已禁用"));
            }
            
            OAuthApplication app = appOpt.get();
            String redirectUri = app.getRedirectUri();
            
            // 创建OAuth Token
            String token = oAuthService.createToken(userId, appId, redirectUri, scope, state);
            
            // 构建回调URL
            String callbackUrl = redirectUri;
            if (callbackUrl.contains("?")) {
                callbackUrl += "&token=" + token;
            } else {
                callbackUrl += "?token=" + token;
            }
            if (state != null && !state.isEmpty()) {
                callbackUrl += "&state=" + URLEncoder.encode(state, StandardCharsets.UTF_8);
            }
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("token", token);
            response.put("redirect_url", callbackUrl);
            
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            log.error("[OAuth] 授权失败: {}", e.getMessage());
            Map<String, String> error = new HashMap<>();
            error.put("error", "授权失败: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
        }
    }
    
    /**
     * 第三方用Token获取用户数据（旧接口，保留兼容）
     * POST /oauth/auth/{token}
     * Token只能使用一次，3分钟有效
     */
    @PostMapping("/auth/{token}")
    public ResponseEntity<?> getUserDataByToken(@PathVariable String token) {
        log.info("[OAuth] Token验证请求: {}", token);
        
        Map<String, Object> userData = oAuthService.validateAndGetUserData(token);
        
        if (userData == null) {
            Map<String, String> error = new HashMap<>();
            error.put("error", "Token无效或已过期");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(error);
        }
        
        return ResponseEntity.ok(userData);
    }
    
    /**
     * 使用 App ID + App Secret + Token 换取用户信息（新接口，推荐使用）
     * POST /oauth/token
     * 请求体: { app_id, app_secret, token }
     */
    @PostMapping("/token")
    public ResponseEntity<?> exchangeToken(@RequestBody Map<String, String> request) {
        String appId = request.get("app_id");
        String appSecret = request.get("app_secret");
        String token = request.get("token");
        
        log.info("[OAuth] Token换取请求 - app_id: {}", appId);
        
        // 验证参数
        if (appId == null || appId.isEmpty()) {
            return badRequest("invalid_request", "缺少参数: app_id");
        }
        if (appSecret == null || appSecret.isEmpty()) {
            return badRequest("invalid_request", "缺少参数: app_secret");
        }
        if (token == null || token.isEmpty()) {
            return badRequest("invalid_request", "缺少参数: token");
        }
        
        // 验证应用凭证
        Optional<OAuthApplication> appOpt = oAuthApplicationService.getActiveApplication(appId);
        if (appOpt.isEmpty()) {
            log.warn("[OAuth] App ID 不存在或已禁用: {}", appId);
            return unauthorized("invalid_client", "App ID 不存在或已禁用");
        }
        
        OAuthApplication app = appOpt.get();
        if (!app.getAppSecret().equals(appSecret)) {
            log.warn("[OAuth] App Secret 错误 - app_id: {}", appId);
            return unauthorized("invalid_client", "App Secret 错误");
        }
        
        // 验证Token并获取用户数据
        Map<String, Object> userData = oAuthService.validateAndGetUserData(token);
        
        if (userData == null) {
            log.warn("[OAuth] Token 无效或已过期: {}", token);
            return unauthorized("invalid_token", "Token 无效或已过期");
        }
        
        // 增加授权次数
        oAuthApplicationService.incrementAuthCount(appId);
        
        log.info("[OAuth] Token换取成功 - app_id: {}, user_id: {}", appId, userData.get("user_id"));
        
        return ResponseEntity.ok(userData);
    }
    
    private ResponseEntity<?> badRequest(String error, String message) {
        Map<String, String> response = new HashMap<>();
        response.put("error", error);
        response.put("message", message);
        return ResponseEntity.badRequest().body(response);
    }
    
    private ResponseEntity<?> unauthorized(String error, String message) {
        Map<String, String> response = new HashMap<>();
        response.put("error", error);
        response.put("message", message);
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(response);
    }
    
    /**
     * 检查Token是否有效（不消费Token）
     * GET /oauth/check/{token}
     */
    @GetMapping("/check/{token}")
    public ResponseEntity<?> checkToken(@PathVariable String token) {
        boolean valid = oAuthService.isTokenValid(token);
        
        Map<String, Object> response = new HashMap<>();
        response.put("valid", valid);
        
        return ResponseEntity.ok(response);
    }
    
    /**
     * 构建OAuth授权页面HTML
     * @param app 应用信息（从数据库获取）
     */
    private String buildAuthorizePage(OAuthApplication app, String redirectUri, String state, String scope) {
        String appId = app.getAppId();
        String appName = app.getAppName();
        String iconUrl = app.getIconUrl();
        
        // 应用图标内容：如果有iconUrl则显示图片，否则显示应用名称首字母
        String iconContent;
        String iconStyle = "";
        if (iconUrl != null && !iconUrl.isEmpty()) {
            iconContent = "<img src='https://msg.v2.zhsdev.top" + iconUrl + "' alt='" + appName + "'>";
            iconStyle = "background: #fff; overflow: hidden;";
        } else {
            iconContent = appName.substring(0, 1).toUpperCase();
            iconStyle = "";
        }
        
        return """
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>智穗语聊 - 授权登录</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Microsoft YaHei', sans-serif;
            min-height: 100vh;
            background: linear-gradient(180deg, #e8f4fc 0%%, #ffffff 100%%);
        }
        
        /* 顶部装饰 */
        .top-decoration {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 280px;
            background: linear-gradient(135deg, #00a8ff 0%%, #0078d4 100%%);
            border-radius: 0 0 60px 60px;
        }
        .top-decoration::before {
            content: '';
            position: absolute;
            top: 20px;
            left: 10%%;
            width: 200px;
            height: 200px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 50%%;
        }
        .top-decoration::after {
            content: '';
            position: absolute;
            top: -50px;
            right: 5%%;
            width: 300px;
            height: 300px;
            background: rgba(255, 255, 255, 0.08);
            border-radius: 50%%;
        }
        
        /* 主容器 */
        .main-container {
            position: relative;
            z-index: 1;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 40px 20px;
        }
        
        /* Logo */
        .brand {
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 40px;
            margin-top: 20px;
        }
        
        /* 授权卡片 */
        .auth-card {
            background: white;
            border-radius: 24px;
            padding: 40px 36px;
            max-width: 420px;
            width: 100%%;
            box-shadow: 0 20px 60px rgba(0, 120, 212, 0.15);
        }
        
        /* 标题 */
        .auth-header {
            text-align: center;
            margin-bottom: 32px;
        }
        .auth-header h1 {
            font-size: 22px;
            font-weight: 600;
            color: #1a1a1a;
            margin-bottom: 8px;
        }
        .auth-header p {
            color: #666;
            font-size: 14px;
        }
        .auth-header a {
            color: #0078d4;
            text-decoration: none;
        }
        .auth-header a:hover {
            text-decoration: underline;
        }
        
        /* 授权流程 */
        .auth-flow {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 20px;
            margin-bottom: 28px;
            padding: 24px 0;
        }
        
        /* 应用/用户卡片 */
        .entity-card {
            text-align: center;
            transition: transform 0.2s ease;
        }
        .entity-card:hover {
            transform: scale(1.02);
        }
        .entity-icon {
            width: 72px;
            height: 72px;
            border-radius: 18px;
            margin: 0 auto 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 28px;
            color: white;
            background: linear-gradient(135deg, #0078d4, #00a8ff);
            box-shadow: 0 8px 24px rgba(0, 120, 212, 0.3);
            overflow: hidden;
        }
        .entity-icon img {
            width: 100%%;
            height: 100%%;
            object-fit: cover;
        }
        .entity-icon.user {
            border-radius: 50%%;
            background: linear-gradient(135deg, #00b894, #00cec9);
            box-shadow: 0 8px 24px rgba(0, 184, 148, 0.3);
        }
        .entity-icon.loading {
            background: linear-gradient(90deg, #e0e0e0 25%%, #f0f0f0 50%%, #e0e0e0 75%%);
            background-size: 200%% 100%%;
            animation: shimmer 1.5s infinite;
        }
        @keyframes shimmer {
            0%% { background-position: 200%% 0; }
            100%% { background-position: -200%% 0; }
        }
        .entity-name {
            font-size: 13px;
            font-weight: 500;
            color: #333;
        }
        .entity-name.loading {
            color: #999;
        }
        
        /* 连接线 */
        .connect-arrow {
            display: flex;
            align-items: center;
            gap: 4px;
            color: #0078d4;
        }
        .connect-arrow .dot {
            width: 6px;
            height: 6px;
            background: #0078d4;
            border-radius: 50%%;
            animation: dotPulse 1.5s ease-in-out infinite;
        }
        .connect-arrow .dot:nth-child(2) { animation-delay: 0.2s; }
        .connect-arrow .dot:nth-child(3) { animation-delay: 0.4s; }
        .connect-arrow svg {
            width: 20px;
            height: 20px;
        }
        @keyframes dotPulse {
            0%%, 100%% { opacity: 0.3; transform: scale(0.8); }
            50%% { opacity: 1; transform: scale(1); }
        }
        
        /* 状态提示 */
        .status-bar {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            padding: 12px 16px;
            border-radius: 10px;
            margin-bottom: 20px;
            font-size: 13px;
        }
        .status-bar.success {
            background: #e8f8f0;
            color: #00875a;
        }
        .status-bar.warning {
            background: #fff8e6;
            color: #b25e00;
        }
        .status-bar.error {
            background: #ffebe6;
            color: #c41e3a;
        }
        .status-bar a {
            color: inherit;
            text-decoration: underline;
        }
        .status-icon {
            font-size: 16px;
        }
        
        /* 权限列表 */
        .permissions {
            background: #f8fafc;
            border-radius: 14px;
            padding: 18px 20px;
            margin-bottom: 24px;
        }
        .permissions-title {
            font-size: 13px;
            color: #666;
            margin-bottom: 14px;
        }
        .permissions-title span {
            color: #0078d4;
            font-weight: 600;
        }
        .permission-item {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 8px 0;
            color: #333;
            font-size: 14px;
        }
        .permission-check {
            width: 18px;
            height: 18px;
            border-radius: 50%%;
            background: linear-gradient(135deg, #00b894, #00cec9);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            color: white;
            flex-shrink: 0;
        }
        
        /* 授权按钮 */
        .btn-authorize {
            width: 100%%;
            padding: 14px 32px;
            border: none;
            border-radius: 12px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
            background: linear-gradient(135deg, #0078d4, #00a8ff);
            color: white;
            box-shadow: 0 4px 16px rgba(0, 120, 212, 0.35);
        }
        .btn-authorize:hover:not(:disabled) {
            transform: translateY(-1px);
            box-shadow: 0 6px 20px rgba(0, 120, 212, 0.45);
        }
        .btn-authorize:active:not(:disabled) {
            transform: translateY(0);
        }
        .btn-authorize:disabled {
            background: #d0d0d0;
            box-shadow: none;
            cursor: not-allowed;
        }
        
        /* 加载动画 */
        .spinner {
            display: inline-block;
            width: 16px;
            height: 16px;
            border: 2px solid rgba(255, 255, 255, 0.3);
            border-top-color: white;
            border-radius: 50%%;
            animation: spin 0.8s linear infinite;
            margin-right: 8px;
            vertical-align: middle;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        
        /* 底部 */
        .auth-footer {
            display: flex;
            justify-content: center;
            gap: 20px;
            margin-top: 20px;
            padding-top: 20px;
            border-top: 1px solid #eee;
        }
        .auth-footer a {
            color: #888;
            text-decoration: none;
            font-size: 13px;
            transition: color 0.2s;
        }
        .auth-footer a:hover {
            color: #0078d4;
        }
        
        /* 协议 */
        .agreement {
            text-align: center;
            margin-top: 16px;
            font-size: 12px;
            color: #999;
        }
        .agreement a {
            color: #666;
            text-decoration: none;
        }
        .agreement a:hover {
            color: #0078d4;
        }
    </style>
</head>
<body>
    <!-- 顶部装饰 -->
    <div class="top-decoration"></div>
    
    <div class="main-container">
        <!-- Logo -->
        <div class="brand">
            <span style="font-size:26px;font-weight:700;color:white;display:flex;align-items:center;gap:8px;"><img src="https://msg.v2.zhsdev.top/uploads/oauth-icons/1bdca5a9-700e-4f42-b1d7-6d808bd5df87.png" style="height:26px;" onerror="this.outerHTML='💬'"> 智穗语聊</span>
        </div>
        
        <div class="auth-card">
            <!-- 标题 -->
            <div class="auth-header">
                <h1>授权登录</h1>
                <p>请确保 <a href="https://msg.v2.zhsdev.top/download" target="_blank">智穗语聊客户端</a> 已登录</p>
            </div>
            
            <!-- 授权流程 -->
            <div class="auth-flow">
                <div class="entity-card">
                    <div class="entity-icon" style="%s">%s</div>
                    <div class="entity-name">%s</div>
                </div>
                
                <div class="connect-arrow">
                    <span class="dot"></span>
                    <span class="dot"></span>
                    <span class="dot"></span>
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/>
                    </svg>
                </div>
                
                <div class="entity-card" id="user-card">
                    <div class="entity-icon user loading" id="user-avatar">
                        <span>❓</span>
                    </div>
                    <div class="entity-name loading" id="user-name">检测中...</div>
                </div>
            </div>
            
            <!-- 状态提示 -->
            <div class="status-bar warning" id="status-bar">
                <span class="status-icon">⚠</span>
                <span id="status-text">正在检测客户端登录状态...</span>
            </div>
            
            <!-- 权限列表 -->
            <div class="permissions">
                <div class="permissions-title"><span>%s</span> 将获取以下权限</div>
                <div class="permission-item">
                    <div class="permission-check">✓</div>
                    <span>使用你的头像、昵称信息</span>
                </div>
                <div class="permission-item" id="email-permission" style="display: none;">
                    <div class="permission-check">✓</div>
                    <span>获取你的邮箱地址</span>
                </div>
            </div>
            
            <!-- 授权按钮 -->
            <button class="btn-authorize" id="authorize-btn" disabled onclick="handleAuthorize()">
                <span id="btn-text">检测登录状态...</span>
            </button>
            
            <!-- 协议 -->
            <div class="agreement">
                授权即同意 <a href="https://msg.v2.zhsdev.top/terms" target="_blank">服务条款</a> 和 <a href="https://msg.v2.zhsdev.top/privacy" target="_blank">隐私政策</a>
            </div>
            
            <!-- 底部链接 -->
            <div class="auth-footer">
                <a href="https://msg.v2.zhsdev.top/download" target="_blank">下载客户端</a>
                <a href="https://msg.v2.zhsdev.top/help" target="_blank">帮助中心</a>
                <a href="javascript:handleCancel()">取消</a>
            </div>
        </div>
    </div>
    
    <script>
        const appId = '%s';
        const redirectUri = '%s';
        const state = '%s';
        const scope = '%s';
        
        let loggedUserId = null;
        let loggedNickname = null;
        let loggedAvatar = null;
        
        if (scope.includes('email')) {
            document.getElementById('email-permission').style.display = 'flex';
        }
        
        async function checkLoginStatus() {
            const statusBar = document.getElementById('status-bar');
            const statusText = document.getElementById('status-text');
            const userAvatar = document.getElementById('user-avatar');
            const userName = document.getElementById('user-name');
            const authorizeBtn = document.getElementById('authorize-btn');
            const btnText = document.getElementById('btn-text');
            
            
            try {
                const response = await fetch('http://127.0.0.1:61830/status', { method: 'GET', mode: 'cors' });
                
                if (response.ok) {
                    const data = await response.json();
                    
                    if (data.logged_in) {
                        loggedUserId = data.user_id;
                        loggedNickname = data.nickname || data.username;
                        loggedAvatar = data.avatar;
                        
                        statusBar.className = 'status-bar success';
                        statusText.textContent = '✓ 已检测到登录，点击按钮授权';
                        
                        userAvatar.classList.remove('loading');
                        if (loggedAvatar) {
                            userAvatar.innerHTML = '<img src="https://msg.v2.zhsdev.top' + loggedAvatar + "'>";
                        } else {
                            userAvatar.innerHTML = '<span>' + loggedNickname.charAt(0).toUpperCase() + '</span>';
                            userAvatar.style.background = 'linear-gradient(135deg, #00b894, #00cec9)';
                        }
                        
                        userName.classList.remove('loading');
                        userName.textContent = loggedNickname;
                        
                        
                        authorizeBtn.disabled = false;
                        btnText.textContent = '授权登录';
                    } else {
                        showNotLoggedIn();
                    }
                } else {
                    throw new Error('failed');
                }
            } catch (error) {
                statusBar.className = 'status-bar error';
                statusText.innerHTML = '✗ 无法连接客户端，请确保 <a href="https://msg.v2.zhsdev.top/download">智穗语聊</a> 已启动';
                
                userAvatar.classList.remove('loading');
                userAvatar.innerHTML = '<span>✗</span>';
                userAvatar.style.background = '#ffebe6';
                userAvatar.style.color = '#c41e3a';
                
                userName.classList.remove('loading');
                userName.textContent = '未连接';
                userName.style.color = '#c41e3a';
                
                btnText.textContent = '无法连接客户端';
                setTimeout(checkLoginStatus, 5000);
            }
        }
        
        function showNotLoggedIn() {
            const statusBar = document.getElementById('status-bar');
            const statusText = document.getElementById('status-text');
            const userAvatar = document.getElementById('user-avatar');
            const userName = document.getElementById('user-name');
            const btnText = document.getElementById('btn-text');
            
            statusBar.className = 'status-bar warning';
            statusText.textContent = '✗ 客户端未登录，请先登录智穗语聊';
            
            userAvatar.classList.remove('loading');
            userAvatar.innerHTML = '<span>❓</span>';
            userAvatar.style.background = '#fff8e6';
            userAvatar.style.color = '#b25e00';
            
            userName.classList.remove('loading');
            userName.textContent = '未登录';
            userName.style.color = '#b25e00';
            
            btnText.textContent = '请先登录客户端';
        }
        
        async function handleAuthorize() {
            if (!loggedUserId) return;
            
            const authorizeBtn = document.getElementById('authorize-btn');
            const btnText = document.getElementById('btn-text');
            
            authorizeBtn.disabled = true;
            btnText.innerHTML = '<span class="spinner"></span>授权中...';
            
            try {
                const response = await fetch('/oauth/authorize', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        app_id: appId,
                        redirect_uri: redirectUri,
                        state: state,
                        scope: scope,
                        user_id: loggedUserId
                    })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    btnText.textContent = '授权成功，正在跳转...';
                    window.location.href = result.redirect_url;
                } else {
                    throw new Error(result.error || '授权失败');
                }
            } catch (error) {
                alert('授权失败: ' + error.message);
                authorizeBtn.disabled = false;
                btnText.textContent = '授权登录';
            }
        }
        
        function handleCancel() {
            if (redirectUri) {
                window.location.href = redirectUri + (redirectUri.includes('?') ? '&' : '?') + 'error=access_denied';
            } else {
                window.close();
            }
        }
        
        checkLoginStatus();
        setInterval(checkLoginStatus, 10000);
    </script>
</body>
</html>
""".formatted(iconStyle, iconContent, appName, appName, appId, redirectUri, state != null ? state : "", scope);
    }
    
    /**
     * 构建错误页面HTML
     */
    private String buildErrorPage(String errorMessage) {
        return """
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>授权错误 - 智穗语聊</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Microsoft YaHei', sans-serif;
            background: linear-gradient(180deg, #e8f4fc 0%%, #ffffff 100%%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .error-container {
            background: white;
            border-radius: 24px;
            box-shadow: 0 20px 60px rgba(0, 120, 212, 0.15);
            max-width: 400px;
            width: 100%%;
            padding: 40px;
            text-align: center;
        }
        .error-icon {
            font-size: 48px;
            margin-bottom: 20px;
        }
        .error-title {
            font-size: 20px;
            font-weight: bold;
            color: #c41e3a;
            margin-bottom: 10px;
        }
        .error-message {
            color: #666;
            margin-bottom: 20px;
        }
    </style>
</head>
<body>
    <div class="error-container">
        <div class="error-icon">❌</div>
        <div class="error-title">授权请求错误</div>
        <div class="error-message">%s</div>
    </div>
</body>
</html>
""".formatted(errorMessage);
    }
}
