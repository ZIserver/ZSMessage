package com.chatapp.controller;

import com.chatapp.entity.AppVersion;
import com.chatapp.repository.AppVersionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * 客户端更新检查控制器
 */
@RestController
@RequestMapping("/api/update")
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
public class UpdateController {
    
    private final AppVersionRepository versionRepository;
    
    /**
     * 检查更新
     * @param currentVersion 当前版本号
     * @param platform 平台（windows, mac, linux）
     */
    @GetMapping("/check")
    public ResponseEntity<?> checkUpdate(
            @RequestParam(required = false, defaultValue = "0.0.0") String currentVersion,
            @RequestParam(defaultValue = "windows") String platform) {
        try {
            // 获取最新版本
            Optional<AppVersion> latestVersionOpt = versionRepository
                    .findFirstByPlatformAndEnabledTrueOrderByCreatedAtDesc(platform);
            
            if (latestVersionOpt.isEmpty()) {
                Map<String, Object> response = new HashMap<>();
                response.put("hasUpdate", false);
                response.put("message", "当前已是最新版本");
                return ResponseEntity.ok(response);
            }
            
            AppVersion latestVersion = latestVersionOpt.get();
            
            // 比较版本号
            boolean hasUpdate = compareVersion(latestVersion.getVersion(), currentVersion) > 0;
            
            Map<String, Object> response = new HashMap<>();
            response.put("hasUpdate", hasUpdate);
            response.put("currentVersion", currentVersion);
            response.put("latestVersion", latestVersion.getVersion());
            
            if (hasUpdate) {
                response.put("version", latestVersion.getVersion());
                response.put("downloadUrl", latestVersion.getDownloadUrl());
                response.put("releaseNotes", latestVersion.getReleaseNotes());
                response.put("forceUpdate", latestVersion.getForceUpdate());
                response.put("fileSize", latestVersion.getFileSize());
                response.put("sha256", latestVersion.getSha256());
                response.put("publishedAt", latestVersion.getPublishedAt());
            } else {
                response.put("message", "当前已是最新版本");
            }
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            error.put("detail", e.toString());
            return ResponseEntity.badRequest().body(error);
        }
    }
    
    /**
     * 获取latest.yml格式的更新信息（给electron-updater使用）
     */
    @GetMapping("/latest.yml")
    public ResponseEntity<String> getLatestYml(@RequestParam(defaultValue = "windows") String platform) {
        try {
            Optional<AppVersion> latestVersionOpt = versionRepository
                    .findFirstByPlatformAndEnabledTrueOrderByCreatedAtDesc(platform);
            
            if (latestVersionOpt.isEmpty()) {
                return ResponseEntity.notFound().build();
            }
            
            AppVersion version = latestVersionOpt.get();
            
            // 构造latest.yml内容
            StringBuilder yml = new StringBuilder();
            yml.append("version: ").append(version.getVersion()).append("\n");
            yml.append("releaseDate: '").append(version.getPublishedAt()).append("'\n");
            yml.append("path: ").append(extractFileName(version.getDownloadUrl())).append("\n");
            
            if (version.getSha256() != null) {
                yml.append("sha512: ").append(version.getSha256()).append("\n");
            }
            
            if (version.getFileSize() != null) {
                yml.append("files:\n");
                yml.append("  - url: ").append(extractFileName(version.getDownloadUrl())).append("\n");
                yml.append("    size: ").append(version.getFileSize()).append("\n");
            }
            
            return ResponseEntity.ok()
                    .header("Content-Type", "text/yaml")
                    .body(yml.toString());
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }
    
    /**
     * 获取更新日志列表
     * @param platform 平台（可选，默认返回所有平台）
     * @param limit 返回数量限制（可选，默认20）
     */
    @GetMapping("/changelog")
    public ResponseEntity<?> getChangelog(
            @RequestParam(required = false) String platform,
            @RequestParam(defaultValue = "20") int limit) {
        try {
            List<AppVersion> versions;
            
            if (platform != null && !platform.isEmpty()) {
                versions = versionRepository.findByPlatformAndEnabledTrueOrderByCreatedAtDesc(platform);
            } else {
                versions = versionRepository.findByEnabledTrueOrderByCreatedAtDesc();
            }
            
            // 限制返回数量
            if (versions.size() > limit) {
                versions = versions.subList(0, limit);
            }
            
            // 转换为响应格式
            List<Map<String, Object>> changelog = versions.stream().map(v -> {
                Map<String, Object> item = new HashMap<>();
                item.put("version", v.getVersion());
                item.put("platform", v.getPlatform());
                item.put("releaseNotes", v.getReleaseNotes());
                item.put("publishedAt", v.getPublishedAt());
                item.put("downloadUrl", v.getDownloadUrl());
                item.put("fileSize", v.getFileSize());
                item.put("forceUpdate", v.getForceUpdate());
                return item;
            }).collect(Collectors.toList());
            
            Map<String, Object> response = new HashMap<>();
            response.put("changelog", changelog);
            response.put("total", changelog.size());
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }
    
    /**
     * 获取指定版本的详细信息
     * @param version 版本号
     * @param platform 平台
     */
    @GetMapping("/changelog/{version}")
    public ResponseEntity<?> getVersionDetail(
            @PathVariable String version,
            @RequestParam(defaultValue = "windows") String platform) {
        try {
            Optional<AppVersion> versionOpt = versionRepository.findByVersionAndPlatform(version, platform);
            
            if (versionOpt.isEmpty()) {
                Map<String, String> error = new HashMap<>();
                error.put("error", "版本不存在");
                return ResponseEntity.notFound().build();
            }
            
            AppVersion v = versionOpt.get();
            Map<String, Object> response = new HashMap<>();
            response.put("version", v.getVersion());
            response.put("platform", v.getPlatform());
            response.put("releaseNotes", v.getReleaseNotes());
            response.put("publishedAt", v.getPublishedAt());
            response.put("downloadUrl", v.getDownloadUrl());
            response.put("fileSize", v.getFileSize());
            response.put("sha256", v.getSha256());
            response.put("forceUpdate", v.getForceUpdate());
            response.put("createdAt", v.getCreatedAt());
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }
    
    /**
     * 从URL中提取文件名
     */
    private String extractFileName(String url) {
        if (url == null) return "";
        int lastSlash = url.lastIndexOf('/');
        return lastSlash >= 0 ? url.substring(lastSlash + 1) : url;
    }
    
    /**
     * 比较版本号
     * @param v1 版本1
     * @param v2 版本2
     * @return 1: v1>v2, 0: v1==v2, -1: v1<v2
     */
    private int compareVersion(String v1, String v2) {
        String[] parts1 = v1.split("\\.");
        String[] parts2 = v2.split("\\.");
        
        int maxLength = Math.max(parts1.length, parts2.length);
        
        for (int i = 0; i < maxLength; i++) {
            int num1 = i < parts1.length ? Integer.parseInt(parts1[i]) : 0;
            int num2 = i < parts2.length ? Integer.parseInt(parts2[i]) : 0;
            
            if (num1 > num2) {
                return 1;
            } else if (num1 < num2) {
                return -1;
            }
        }
        
        return 0;
    }
}
