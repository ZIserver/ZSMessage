package com.chatapp.controller;

import com.chatapp.dto.AuthResponse;
import com.chatapp.dto.LoginRequest;
import com.chatapp.dto.RegisterRequest;
import com.chatapp.service.AuthService;
import com.chatapp.service.EmailService;
import com.chatapp.service.SmsService;
import com.chatapp.service.LoginSecurityService;
import com.chatapp.service.CaptchaService;
import com.chatapp.util.XssUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import jakarta.servlet.http.HttpServletRequest;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final EmailService emailService;
    private final SmsService smsService;
    private final LoginSecurityService loginSecurityService;
    private final CaptchaService captchaService;

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody RegisterRequest request) {
        try {
            // XSS防护：清理用户输入
            if (request.getUsername() != null) {
                request.setUsername(XssUtil.sanitize(request.getUsername()));
            }
            if (request.getNickname() != null) {
                request.setNickname(XssUtil.sanitize(request.getNickname()));
            }
            
            AuthResponse response = authService.register(request);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(error);
        }
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest request, HttpServletRequest httpRequest) {
        String ipAddress = getClientIp(httpRequest);
        String userAgent = httpRequest.getHeader("User-Agent");
        String deviceType = loginSecurityService.detectDeviceType(userAgent != null ? userAgent : "");
        
        // 确定用于验证的用户名（优先使用智穗号，如果没有则使用用户名）
        String loginIdentifier = null;
        if (request.getSmartCode() != null && !request.getSmartCode().isEmpty()) {
            loginIdentifier = request.getSmartCode();
        } else if (request.getUsername() != null && !request.getUsername().isEmpty()) {
            loginIdentifier = request.getUsername();
        }
        
        if (loginIdentifier == null || loginIdentifier.isEmpty()) {
            Map<String, String> error = new HashMap<>();
            error.put("error", "用户名或智穗号不能为空");
            return ResponseEntity.badRequest().body(error);
        }
        
        // 检查是否需要验证码
        boolean needsCaptcha = loginSecurityService.needsCaptcha(loginIdentifier, ipAddress);
        
        if (needsCaptcha) {
            // 需要验证码，检查是否提供了图片验证码
            if (request.getCaptchaId() == null || request.getCaptchaId().isEmpty() ||
                request.getCaptchaCode() == null || request.getCaptchaCode().isEmpty()) {
                // 没有提供验证码，返回需要验证码的状态
                Map<String, Object> response = new HashMap<>();
                response.put("needsCaptcha", true);
                response.put("error", "需要完成验证码验证");
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(response);
            }
            
            // 验证图片验证码
            boolean captchaValid = captchaService.verifyCaptcha(request.getCaptchaId(), request.getCaptchaCode());
            
            if (!captchaValid) {
                Map<String, Object> response = new HashMap<>();
                response.put("error", "验证码错误或已过期");
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
            }
            
            // 验证成功，清除失败记录
            loginSecurityService.clearFailedAttempts(loginIdentifier);
        }
        
        try {
            AuthResponse response = authService.login(request);
            
            // 登录成功，记录成功尝试
            loginSecurityService.recordLoginAttempt(
                loginIdentifier, ipAddress, deviceType, 
                userAgent, true, null
            );
            
            // 登录成功，清除该用户的失败记录
            loginSecurityService.clearFailedAttempts(loginIdentifier);
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            // 登录失败，记录失败尝试
            loginSecurityService.recordLoginAttempt(
                loginIdentifier, ipAddress, deviceType, 
                userAgent, false, e.getMessage()
            );
            
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(error);
        }
    }
    
    /**
     * 获取图片验证码
     * GET /api/auth/captcha
     */
    @GetMapping("/captcha")
    public ResponseEntity<?> getCaptcha() {
        Map<String, String> captcha = captchaService.generateCaptcha();
        return ResponseEntity.ok(captcha);
    }
    
    /**
     * 发送邮箱验证码
     */
    @PostMapping("/send-verification-code")
    public ResponseEntity<?> sendVerificationCode(@RequestBody Map<String, String> request) {
        try {
            String email = request.get("email");
            
            if (email == null || email.trim().isEmpty()) {
                Map<String, String> error = new HashMap<>();
                error.put("error", "邮箱地址不能为空");
                return ResponseEntity.badRequest().body(error);
            }
            
            // 生成并发送验证码
            boolean sent = authService.sendVerificationCode(email);
            
            if (sent) {
                Map<String, String> response = new HashMap<>();
                response.put("message", "验证码已发送到您的邮箱");
                return ResponseEntity.ok(response);
            } else {
                Map<String, String> error = new HashMap<>();
                error.put("error", "验证码发送失败");
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
            }
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }
    
    /**
     * 发送短信验证码（注册用）
     */
    @PostMapping("/send-sms-code")
    public ResponseEntity<?> sendSmsCode(@RequestBody Map<String, String> request) {
        try {
            String phone = request.get("phone");
            
            if (phone == null || phone.trim().isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "手机号不能为空"));
            }
            
            // 验证手机号格式
            if (!smsService.isValidPhone(phone)) {
                return ResponseEntity.badRequest().body(Map.of("error", "手机号格式不正确"));
            }
            
            // 发送验证码
            smsService.sendVerificationCode(phone);
            
            return ResponseEntity.ok(Map.of("message", "验证码已发送"));
            
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", "系统错误，请稍后重试"));
        }
    }
    
    /**
     * 检查是否需要Geetest验证
     * POST /api/auth/check-need-captcha
     * Body: { "username": "xxx" }
     */
    @PostMapping("/check-need-captcha")
    public ResponseEntity<?> checkNeedCaptcha(@RequestBody Map<String, String> request, HttpServletRequest httpRequest) {
        try {
            String username = request.get("username");
            if (username == null || username.trim().isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "用户名不能为空"));
            }
            
            // 获取IP地址
            String ipAddress = getClientIp(httpRequest);
            
            // 检查是否需要验证码
            boolean needsCaptcha = loginSecurityService.needsCaptcha(username, ipAddress);
            
            return ResponseEntity.ok(Map.of(
                "needsCaptcha", needsCaptcha,
                "message", needsCaptcha ? "需要验证码" : "不需要验证码"
            ));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", "系统错误"));
        }
    }
    
    /**
     * 获取客户端IP地址
     */
    private String getClientIp(HttpServletRequest request) {
        String ip = request.getHeader("X-Forwarded-For");
        if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getHeader("X-Real-IP");
        }
        if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getRemoteAddr();
        }
        // 处理多个IP的情况（取第一个）
        if (ip != null && ip.contains(",")) {
            ip = ip.split(",")[0].trim();
        }
        return ip;
    }
}
