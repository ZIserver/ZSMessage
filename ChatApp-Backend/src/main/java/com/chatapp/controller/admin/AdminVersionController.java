package com.chatapp.controller.admin;

import com.chatapp.entity.AppVersion;
import com.chatapp.repository.AppVersionRepository;
import com.chatapp.util.XssUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 管理员 - 版本管理控制器
 */
@RestController
@RequestMapping("/api/admin/versions")
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
public class AdminVersionController {
    
    private final AppVersionRepository versionRepository;
    
    @Value("${app.update-dir:./updates}")
    private String updateDir;
    
    /**
     * 获取所有版本
     */
    @GetMapping("/list")
    public ResponseEntity<?> getAllVersions() {
        try {
            List<AppVersion> versions = versionRepository.findAll();
            return ResponseEntity.ok(versions);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }
    
    /**
     * 根据平台获取版本列表
     */
    @GetMapping("/platform/{platform}")
    public ResponseEntity<?> getVersionsByPlatform(@PathVariable String platform) {
        try {
            List<AppVersion> versions = versionRepository.findByPlatformOrderByCreatedAtDesc(platform);
            return ResponseEntity.ok(versions);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }
    
    /**
     * 创建新版本
     */
    @PostMapping("/create")
    public ResponseEntity<?> createVersion(@RequestBody AppVersion version) {
        try {
            // XSS防护
            if (version.getVersion() != null) {
                version.setVersion(XssUtil.sanitize(version.getVersion()));
            }
            if (version.getReleaseNotes() != null) {
                version.setReleaseNotes(XssUtil.sanitize(version.getReleaseNotes()));
            }
            if (version.getDownloadUrl() != null) {
                version.setDownloadUrl(XssUtil.sanitize(version.getDownloadUrl()));
            }
            
            version.setCreatedAt(LocalDateTime.now());
            AppVersion saved = versionRepository.save(version);
            return ResponseEntity.ok(saved);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }
    
    /**
     * 更新版本信息
     */
    @PutMapping("/{versionId}")
    public ResponseEntity<?> updateVersion(@PathVariable Long versionId, @RequestBody AppVersion version) {
        try {
            AppVersion existing = versionRepository.findById(versionId)
                    .orElseThrow(() -> new RuntimeException("版本不存在"));
            
            // 更新字段并进行XSS防护
            if (version.getReleaseNotes() != null) {
                existing.setReleaseNotes(XssUtil.sanitize(version.getReleaseNotes()));
            }
            if (version.getDownloadUrl() != null) {
                existing.setDownloadUrl(XssUtil.sanitize(version.getDownloadUrl()));
            }
            if (version.getForceUpdate() != null) {
                existing.setForceUpdate(version.getForceUpdate());
            }
            if (version.getEnabled() != null) {
                existing.setEnabled(version.getEnabled());
            }
            if (version.getFileSize() != null) {
                existing.setFileSize(version.getFileSize());
            }
            if (version.getSha256() != null) {
                existing.setSha256(version.getSha256());
            }
            
            AppVersion saved = versionRepository.save(existing);
            return ResponseEntity.ok(saved);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }
    
    /**
     * 发布版本
     */
    @PostMapping("/{versionId}/publish")
    public ResponseEntity<?> publishVersion(@PathVariable Long versionId) {
        try {
            AppVersion version = versionRepository.findById(versionId)
                    .orElseThrow(() -> new RuntimeException("版本不存在"));
            
            version.setEnabled(true);
            version.setPublishedAt(LocalDateTime.now());
            versionRepository.save(version);
            
            return ResponseEntity.ok(version);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }
    
    /**
     * 删除版本
     */
    @DeleteMapping("/{versionId}")
    public ResponseEntity<?> deleteVersion(@PathVariable Long versionId) {
        try {
            versionRepository.deleteById(versionId);
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }
    
    /**
     * 上传安装包
     */
    @PostMapping("/upload")
    public ResponseEntity<?> uploadInstaller(
            @RequestParam("file") MultipartFile file,
            @RequestParam("version") String version,
            @RequestParam("platform") String platform,
            @RequestParam(required = false) String releaseNotes,
            @RequestParam(required = false, defaultValue = "false") Boolean forceUpdate) {
        try {
            // 验证文件
            if (file.isEmpty()) {
                Map<String, String> error = new HashMap<>();
                error.put("error", "文件不能为空");
                return ResponseEntity.badRequest().body(error);
            }
            
            // 验证文件类型
            String originalFilename = file.getOriginalFilename();
            if (originalFilename == null || !originalFilename.endsWith(".exe")) {
                Map<String, String> error = new HashMap<>();
                error.put("error", "只支持.exe文件");
                return ResponseEntity.badRequest().body(error);
            }
            
            // 创建更新目录
            File updateDirectory = new File(updateDir);
            if (!updateDirectory.exists()) {
                updateDirectory.mkdirs();
            }
            
            // 生成文件名：智穗语聊-版本号-平台.exe
            String filename = String.format("智穗语聊-%s-%s.exe", version, platform);
            Path filePath = Paths.get(updateDir, filename);
            
            // 保存文件
            Files.copy(file.getInputStream(), filePath, StandardCopyOption.REPLACE_EXISTING);
            
            // 计算文件SHA256
            String sha256 = calculateSHA256(filePath.toFile());
            
            // 获取文件大小
            long fileSize = Files.size(filePath);
            
            // 生成下载URL
            String downloadUrl = String.format("https://msg.v2.zhsdev.top/updates/%s", filename);
            
            // 创建版本记录
            AppVersion appVersion = new AppVersion();
            appVersion.setVersion(XssUtil.sanitize(version));
            appVersion.setPlatform(platform);
            appVersion.setDownloadUrl(downloadUrl);
            appVersion.setReleaseNotes(releaseNotes != null ? XssUtil.sanitize(releaseNotes) : "");
            appVersion.setForceUpdate(forceUpdate);
            appVersion.setFileSize(fileSize);
            appVersion.setSha256(sha256);
            appVersion.setEnabled(false); // 默认不启用，需要手动发布
            appVersion.setCreatedAt(LocalDateTime.now());
            
            AppVersion saved = versionRepository.save(appVersion);
            
            // 返回结果
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("version", saved);
            response.put("filename", filename);
            response.put("fileSize", fileSize);
            response.put("sha256", sha256);
            response.put("message", "安装包上传成功，请在版本列表中发布");
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            e.printStackTrace();
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            error.put("detail", e.toString());
            return ResponseEntity.badRequest().body(error);
        }
    }
    
    /**
     * 计算文件的SHA256哈希值
     */
    private String calculateSHA256(File file) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (FileInputStream fis = new FileInputStream(file)) {
            byte[] buffer = new byte[8192];
            int bytesRead;
            while ((bytesRead = fis.read(buffer)) != -1) {
                digest.update(buffer, 0, bytesRead);
            }
        }
        
        byte[] hashBytes = digest.digest();
        StringBuilder hexString = new StringBuilder();
        for (byte b : hashBytes) {
            String hex = Integer.toHexString(0xff & b);
            if (hex.length() == 1) {
                hexString.append('0');
            }
            hexString.append(hex);
        }
        return hexString.toString();
    }
}
