package com.chatapp.controller;

import com.chatapp.entity.Developer;
import com.chatapp.service.DeveloperService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

/**
 * 开发者控制器
 * 处理开发者账户相关操作
 */
@RestController
@RequestMapping("/api/developer")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = "*")
public class DeveloperController {
    
    private final DeveloperService developerService;
    
    /**
     * 创建开发者账户
     * POST /api/developer/register
     * 
     * 前端通过 /oauth/token 获取用户信息后，调用此接口创建开发者账户
     */
    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody DeveloperRegisterRequest request) {
        log.info("[开发者] 注册请求 - userId: {}", request.getUserId());
        
        try {
            // 验证必要参数
            if (request.getUserId() == null) {
                return badRequest("缺少用户ID");
            }
            
            // 创建或登录开发者
            DeveloperService.DeveloperLoginResult result = 
                    developerService.loginOrRegister(
                        request.getUserId(), 
                        request.getUsername(), 
                        request.getNickname(), 
                        request.getAvatar()
                    );
            
            Developer developer = result.getDeveloper();
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("token", result.getToken());
            response.put("isNewRegistration", result.isNewRegistration());
            response.put("developer", buildDeveloperInfo(developer));
            
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            log.error("[开发者] 注册失败: {}", e.getMessage());
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "error", e.getMessage()
            ));
        }
    }
    
    /**
     * 获取当前开发者信息
     * GET /api/developer/profile
     */
    @GetMapping("/profile")
    public ResponseEntity<?> getProfile(@RequestHeader("Authorization") String authHeader) {
        try {
            Developer developer = extractDeveloper(authHeader);
            return ResponseEntity.ok(buildDeveloperInfo(developer));
        } catch (Exception e) {
            log.error("[开发者] 获取信息失败: {}", e.getMessage());
            return unauthorized(e.getMessage());
        }
    }
    
    /**
     * 提交实名认证
     * POST /api/developer/verify-identity
     */
    @PostMapping("/verify-identity")
    public ResponseEntity<?> verifyIdentity(
            @RequestHeader("Authorization") String authHeader,
            @RequestBody VerifyIdentityRequest request) {
        
        try {
            Developer developer = extractDeveloper(authHeader);
            
            // 验证参数
            if (request.getRealName() == null || request.getRealName().trim().isEmpty()) {
                return badRequest("请输入真实姓名");
            }
            if (request.getIdCard() == null || request.getIdCard().trim().isEmpty()) {
                return badRequest("请输入身份证号");
            }
            
            // 执行实名认证
            DeveloperService.VerificationResult result = 
                    developerService.verifyIdentity(developer.getId(), request.getRealName(), request.getIdCard());
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", result.isSuccess());
            response.put("message", result.getMessage());
            
            if (result.isSuccess()) {
                // 重新获取开发者信息（包含更新后的认证状态）
                developer = developerService.getDeveloperById(developer.getId()).orElse(developer);
                response.put("developer", buildDeveloperInfo(developer));
            }
            
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            log.error("[开发者] 实名认证失败: {}", e.getMessage());
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "error", e.getMessage()
            ));
        }
    }
    
    /**
     * 刷新Token
     * POST /api/developer/refresh-token
     */
    @PostMapping("/refresh-token")
    public ResponseEntity<?> refreshToken(@RequestHeader("Authorization") String authHeader) {
        try {
            Developer developer = extractDeveloper(authHeader);
            String newToken = developerService.refreshToken(developer.getId());
            
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "token", newToken
            ));
        } catch (Exception e) {
            log.error("[开发者] 刷新Token失败: {}", e.getMessage());
            return unauthorized(e.getMessage());
        }
    }
    
    /**
     * 退出登录
     * POST /api/developer/logout
     */
    @PostMapping("/logout")
    public ResponseEntity<?> logout(@RequestHeader("Authorization") String authHeader) {
        try {
            Developer developer = extractDeveloper(authHeader);
            developerService.logout(developer.getId());
            
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "已退出登录"
            ));
        } catch (Exception e) {
            // 即使出错也返回成功（前端会清除本地token）
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "已退出登录"
            ));
        }
    }
    
    /**
     * 检查用户是否已注册为开发者（公开接口）
     * GET /api/developer/check-registered?userId={userId}
     */
    @GetMapping("/check-registered")
    public ResponseEntity<?> checkRegistered(@RequestParam Long userId) {
        boolean registered = developerService.isRegistered(userId);
        return ResponseEntity.ok(Map.of(
                "registered", registered
        ));
    }
    
    /**
     * 从Authorization头提取开发者
     */
    private Developer extractDeveloper(String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            throw new RuntimeException("未授权");
        }
        
        String token = authHeader.substring(7);
        Optional<Developer> developer = developerService.getDeveloperByToken(token);
        
        if (developer.isEmpty()) {
            throw new RuntimeException("Token无效或已过期");
        }
        
        if (!developer.get().isActive()) {
            throw new RuntimeException("开发者账户已被禁用");
        }
        
        return developer.get();
    }
    
    /**
     * 构建开发者信息响应
     */
    private Map<String, Object> buildDeveloperInfo(Developer developer) {
        Map<String, Object> info = new HashMap<>();
        info.put("id", developer.getId());
        info.put("userId", developer.getUserId());
        info.put("username", developer.getUsername());
        info.put("nickname", developer.getNickname());
        info.put("avatarUrl", developer.getAvatarUrl());
        info.put("verified", developer.getVerified());
        info.put("verifiedAt", developer.getVerifiedAt());
        info.put("status", developer.getStatus());
        info.put("createdAt", developer.getCreatedAt());
        
        // 实名认证信息（脱敏）
        if (developer.getVerified()) {
            info.put("realName", maskRealName(developer.getRealName()));
            info.put("maskedIdCard", developer.getMaskedIdCard());
        }
        
        return info;
    }
    
    /**
     * 姓名脱敏
     */
    private String maskRealName(String name) {
        if (name == null || name.length() < 2) return "***";
        if (name.length() == 2) return name.charAt(0) + "*";
        return name.charAt(0) + "*".repeat(name.length() - 2) + name.charAt(name.length() - 1);
    }
    
    private ResponseEntity<?> badRequest(String message) {
        return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "error", message
        ));
    }
    
    private ResponseEntity<?> unauthorized(String message) {
        return ResponseEntity.status(401).body(Map.of(
                "success", false,
                "error", message
        ));
    }
    
    // 请求DTO
    @Data
    public static class DeveloperRegisterRequest {
        private Long userId;
        private Long zsNumber;
        private String username;
        private String nickname;
        private String avatar;
        private String email;
    }
    
    @Data
    public static class VerifyIdentityRequest {
        private String realName;
        private String idCard;
    }
}
