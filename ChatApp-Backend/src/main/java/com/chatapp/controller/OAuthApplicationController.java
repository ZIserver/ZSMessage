package com.chatapp.controller;

import com.chatapp.entity.Developer;
import com.chatapp.entity.OAuthApplication;
import com.chatapp.service.DeveloperService;
import com.chatapp.service.OAuthApplicationService;
import com.chatapp.service.TokenService;
import com.chatapp.util.JwtUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.multipart.MultipartFile;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * OAuth应用管理控制器
 */
@RestController
@RequestMapping("/api/oauth/apps")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = "*")
public class OAuthApplicationController {
    
    private final OAuthApplicationService appService;
    private final DeveloperService developerService;
    private final JwtUtil jwtUtil;
    private final TokenService tokenService;
    
    @Value("${file.upload-dir:./uploads}")
    private String uploadDir;
    
    /**
     * 创建新应用
     * 支持开发者Token和普通用户Token
     */
    @PostMapping
    public ResponseEntity<?> createApplication(
            @RequestHeader("Authorization") String authHeader,
            @RequestBody CreateAppRequest request) {
        try {
            // 优先尝试开发者Token
            Optional<Developer> developerOpt = extractDeveloper(authHeader);
            
            if (developerOpt.isPresent()) {
                // 使用开发者身份创建应用
                Developer developer = developerOpt.get();
                OAuthApplication app = appService.createApplicationByDeveloper(
                        developer.getId(),
                        request.getAppName(),
                        request.getRedirectUri(),
                        request.getDescription(),
                        request.getHomepageUrl(),
                        request.getPrivacyUrl()
                );
                return ResponseEntity.ok(toResponse(app, true));
            } else {
                // 兼容旧的用户Token方式
                Long userId = extractUserId(authHeader);
                OAuthApplication app = appService.createApplication(
                        userId,
                        request.getAppName(),
                        request.getRedirectUri(),
                        request.getDescription(),
                        request.getHomepageUrl(),
                        request.getPrivacyUrl()
                );
                return ResponseEntity.ok(toResponse(app, true));
            }
        } catch (Exception e) {
            log.error("创建应用失败", e);
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
    
    /**
     * 获取我的应用列表
     */
    @GetMapping
    public ResponseEntity<?> getMyApplications(@RequestHeader("Authorization") String authHeader) {
        try {
            // 优先尝试开发者Token
            Optional<Developer> developerOpt = extractDeveloper(authHeader);
            
            List<OAuthApplication> apps;
            if (developerOpt.isPresent()) {
                apps = appService.getApplicationsByDeveloper(developerOpt.get().getId());
            } else {
                Long userId = extractUserId(authHeader);
                apps = appService.getApplicationsByUser(userId);
            }
            
            List<Map<String, Object>> result = apps.stream()
                    .map(app -> toResponse(app, false))
                    .collect(Collectors.toList());
            
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            log.error("获取应用列表失败", e);
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
    
    /**
     * 获取应用详情
     */
    @GetMapping("/{appId}")
    public ResponseEntity<?> getApplication(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable String appId) {
        try {
            Optional<Developer> developerOpt = extractDeveloper(authHeader);
            
            Optional<OAuthApplication> appOpt;
            if (developerOpt.isPresent()) {
                appOpt = appService.getApplicationByDeveloper(appId, developerOpt.get().getId());
            } else {
                Long userId = extractUserId(authHeader);
                appOpt = appService.getApplicationByOwner(appId, userId);
            }
            
            return appOpt.map(app -> ResponseEntity.ok(toResponse(app, true)))
                    .orElse(ResponseEntity.notFound().build());
        } catch (Exception e) {
            log.error("获取应用详情失败", e);
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
    
    /**
     * 更新应用信息
     */
    @PutMapping("/{appId}")
    public ResponseEntity<?> updateApplication(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable String appId,
            @RequestBody UpdateAppRequest request) {
        try {
            Optional<Developer> developerOpt = extractDeveloper(authHeader);
            
            OAuthApplication app;
            if (developerOpt.isPresent()) {
                app = appService.updateApplicationByDeveloper(
                        appId, developerOpt.get().getId(),
                        request.getAppName(),
                        request.getRedirectUri(),
                        request.getDescription(),
                        request.getHomepageUrl(),
                        request.getPrivacyUrl(),
                        request.getIconUrl()
                );
            } else {
                Long userId = extractUserId(authHeader);
                app = appService.updateApplication(
                        appId, userId,
                        request.getAppName(),
                        request.getRedirectUri(),
                        request.getDescription(),
                        request.getHomepageUrl(),
                        request.getPrivacyUrl(),
                        request.getIconUrl()
                );
            }
            
            return ResponseEntity.ok(toResponse(app, true));
        } catch (Exception e) {
            log.error("更新应用失败", e);
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
    
    /**
     * 删除应用
     */
    @DeleteMapping("/{appId}")
    public ResponseEntity<?> deleteApplication(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable String appId) {
        try {
            Optional<Developer> developerOpt = extractDeveloper(authHeader);
            
            boolean deleted;
            if (developerOpt.isPresent()) {
                deleted = appService.deleteApplicationByDeveloper(appId, developerOpt.get().getId());
            } else {
                Long userId = extractUserId(authHeader);
                deleted = appService.deleteApplication(appId, userId);
            }
            
            if (deleted) {
                return ResponseEntity.ok(Map.of("success", true, "message", "应用已删除"));
            } else {
                return ResponseEntity.notFound().build();
            }
        } catch (Exception e) {
            log.error("删除应用失败", e);
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
    
    /**
     * 重新生成密钥
     */
    @PostMapping("/{appId}/regenerate-secret")
    public ResponseEntity<?> regenerateSecret(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable String appId) {
        try {
            Optional<Developer> developerOpt = extractDeveloper(authHeader);
            
            OAuthApplication app;
            if (developerOpt.isPresent()) {
                app = appService.regenerateSecretByDeveloper(appId, developerOpt.get().getId());
            } else {
                Long userId = extractUserId(authHeader);
                app = appService.regenerateSecret(appId, userId);
            }
            
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "appSecret", app.getAppSecret(),
                    "message", "密钥已重新生成，请妥善保管"
            ));
        } catch (Exception e) {
            log.error("重新生成密钥失败", e);
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
    
    /**
     * 上传应用图标
     */
    @PostMapping("/{appId}/icon")
    public ResponseEntity<?> uploadAppIcon(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable String appId,
            @RequestParam("file") MultipartFile file) {
        try {
            Optional<Developer> developerOpt = extractDeveloper(authHeader);
            
            // 验证应用归属
            Optional<OAuthApplication> appOpt;
            if (developerOpt.isPresent()) {
                appOpt = appService.getApplicationByDeveloper(appId, developerOpt.get().getId());
            } else {
                Long userId = extractUserId(authHeader);
                appOpt = appService.getApplicationByOwner(appId, userId);
            }
            
            if (appOpt.isEmpty()) {
                return ResponseEntity.notFound().build();
            }
            
            // 验证文件
            if (file.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "请选择图片文件"));
            }
            
            String contentType = file.getContentType();
            if (contentType == null || !contentType.startsWith("image/")) {
                return ResponseEntity.badRequest().body(Map.of("error", "只能上传图片文件"));
            }
            
            // 限制文件大小 2MB
            if (file.getSize() > 2 * 1024 * 1024) {
                return ResponseEntity.badRequest().body(Map.of("error", "图片大小不能超过2MB"));
            }
            
            // 创建OAuth应用图标目录（使用绝对路径）
            Path iconDir = Paths.get(uploadDir, "oauth-icons").toAbsolutePath();
            if (!Files.exists(iconDir)) {
                Files.createDirectories(iconDir);
            }
            
            // 生成文件名
            String originalFilename = file.getOriginalFilename();
            String extension = "";
            if (originalFilename != null && originalFilename.contains(".")) {
                extension = originalFilename.substring(originalFilename.lastIndexOf("."));
            } else {
                extension = ".png";
            }
            String filename = UUID.randomUUID().toString() + extension;
            
            // 保存文件（使用Files.copy替代transferTo，更可靠）
            Path filePath = iconDir.resolve(filename);
            Files.copy(file.getInputStream(), filePath, StandardCopyOption.REPLACE_EXISTING);
            
            // 更新应用图标URL
            String iconUrl = "/uploads/oauth-icons/" + filename;
            OAuthApplication app = appOpt.get();
            
            if (developerOpt.isPresent()) {
                appService.updateApplicationByDeveloper(
                        appId, developerOpt.get().getId(),
                        null, null, null, null, null, iconUrl
                );
            } else {
                Long userId = extractUserId(authHeader);
                appService.updateApplication(
                        appId, userId,
                        null, null, null, null, null, iconUrl
                );
            }
            
            log.info("应用 {} 上传了新图标: {}", appId, iconUrl);
            
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "iconUrl", iconUrl,
                    "message", "图标上传成功"
            ));
        } catch (IOException e) {
            log.error("上传应用图标失败", e);
            return ResponseEntity.badRequest().body(Map.of("error", "文件上传失败: " + e.getMessage()));
        } catch (Exception e) {
            log.error("上传应用图标失败", e);
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
    
    /**
     * 切换应用状态（启用/禁用）
     */
    @PostMapping("/{appId}/toggle-status")
    public ResponseEntity<?> toggleStatus(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable String appId) {
        try {
            Optional<Developer> developerOpt = extractDeveloper(authHeader);
            
            OAuthApplication app;
            if (developerOpt.isPresent()) {
                app = appService.toggleStatusByDeveloper(appId, developerOpt.get().getId());
            } else {
                Long userId = extractUserId(authHeader);
                app = appService.toggleStatus(appId, userId);
            }
            
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "status", app.getStatus(),
                    "message", app.isActive() ? "应用已启用" : "应用已禁用"
            ));
        } catch (Exception e) {
            log.error("切换应用状态失败", e);
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
    
    /**
     * 尝试从 Authorization 头提取开发者
     */
    private Optional<Developer> extractDeveloper(String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            return Optional.empty();
        }
        
        String token = authHeader.substring(7);
        
        // 开发者Token以 dev_ 开头
        if (token.startsWith("dev_")) {
            return developerService.getDeveloperByToken(token);
        }
        
        return Optional.empty();
    }
    
    /**
     * 从 Authorization 头提取用户ID
     * 支持JWT Token和数据库Token两种方式
     */
    private Long extractUserId(String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            throw new RuntimeException("未授权");
        }
        
        String token = authHeader.substring(7);
        
        // 尝试JWT Token验证
        try {
            if (jwtUtil.validateToken(token)) {
                Long userId = jwtUtil.getUserIdFromToken(token);
                if (userId != null) {
                    return userId;
                }
            }
        } catch (Exception e) {
            log.debug("JWT验证失败，尝试数据库Token: {}", e.getMessage());
        }
        
        // 尝试数据库Token验证
        try {
            if (tokenService.validateToken(token)) {
                Optional<Long> userIdOpt = tokenService.getUserIdByToken(token);
                if (userIdOpt.isPresent()) {
                    return userIdOpt.get();
                }
            }
        } catch (Exception e) {
            log.debug("数据库Token验证失败: {}", e.getMessage());
        }
        
        throw new RuntimeException("无效的Token");
    }
    
    /**
     * 转换为响应对象
     */
    private Map<String, Object> toResponse(OAuthApplication app, boolean includeSecret) {
        Map<String, Object> response = new HashMap<>();
        response.put("id", app.getId());
        response.put("appId", app.getAppId());
        response.put("appName", app.getAppName());
        response.put("redirectUri", app.getRedirectUri());
        response.put("description", app.getDescription());
        response.put("iconUrl", app.getIconUrl());
        response.put("homepageUrl", app.getHomepageUrl());
        response.put("privacyUrl", app.getPrivacyUrl());
        response.put("status", app.getStatus());
        response.put("authCount", app.getAuthCount());
        response.put("createdAt", app.getCreatedAt());
        response.put("updatedAt", app.getUpdatedAt());
        
        if (includeSecret) {
            response.put("appSecret", app.getAppSecret());
        }
        
        return response;
    }
    
    // 请求DTO
    @lombok.Data
    public static class CreateAppRequest {
        private String appName;
        private String redirectUri;
        private String description;
        private String homepageUrl;
        private String privacyUrl;
    }
    
    @lombok.Data
    public static class UpdateAppRequest {
        private String appName;
        private String redirectUri;
        private String description;
        private String homepageUrl;
        private String privacyUrl;
        private String iconUrl;
    }
}
