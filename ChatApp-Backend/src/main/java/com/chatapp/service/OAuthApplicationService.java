package com.chatapp.service;

import com.chatapp.entity.Developer;
import com.chatapp.entity.OAuthApplication;
import com.chatapp.repository.DeveloperRepository;
import com.chatapp.repository.OAuthApplicationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

/**
 * OAuth应用服务
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class OAuthApplicationService {
    
    private final OAuthApplicationRepository appRepository;
    private final DeveloperRepository developerRepository;
    
    /**
     * 每个开发者最多创建的应用数量
     */
    private static final int MAX_APPS_PER_DEVELOPER = 10;
    
    /**
     * 创建新应用（使用开发者ID）
     */
    @Transactional
    public OAuthApplication createApplicationByDeveloper(Long developerId, String appName, String redirectUri, 
                                              String description, String homepageUrl, String privacyUrl) {
        // 检查开发者是否已实名认证
        Developer developer = developerRepository.findById(developerId)
                .orElseThrow(() -> new RuntimeException("开发者不存在"));
        
        if (!developer.getVerified()) {
            throw new RuntimeException("请先完成实名认证后再创建应用");
        }
        
        // 检查应用数量限制
        long appCount = appRepository.countByDeveloperId(developerId);
        if (appCount >= MAX_APPS_PER_DEVELOPER) {
            throw new RuntimeException("每个开发者最多只能创建 " + MAX_APPS_PER_DEVELOPER + " 个应用");
        }
        
        // 检查应用名称是否重复
        if (appRepository.existsByDeveloperIdAndAppName(developerId, appName)) {
            throw new RuntimeException("应用名称已存在");
        }
        
        // 生成唯一的appId
        String appId;
        do {
            appId = OAuthApplication.generateAppId();
        } while (appRepository.existsByAppId(appId));
        
        OAuthApplication app = new OAuthApplication();
        app.setDeveloperId(developerId);
        app.setUserId(developer.getUserId()); // 兼容旧字段
        app.setAppName(appName);
        app.setAppId(appId);
        app.setAppSecret(OAuthApplication.generateAppSecret());
        app.setRedirectUri(redirectUri);
        app.setDescription(description);
        app.setHomepageUrl(homepageUrl);
        app.setPrivacyUrl(privacyUrl);
        app.setStatus("ACTIVE");
        app.setAuthCount(0L);
        
        log.info("开发者 {} 创建了新应用: {}", developerId, appName);
        return appRepository.save(app);
    }
    
    /**
     * 创建新应用（兼容旧的userId方式）
     */
    @Transactional
    public OAuthApplication createApplication(Long userId, String appName, String redirectUri, 
                                              String description, String homepageUrl, String privacyUrl) {
        // 检查应用数量限制
        long appCount = appRepository.countByUserId(userId);
        if (appCount >= MAX_APPS_PER_DEVELOPER) {
            throw new RuntimeException("每个用户最多只能创建 " + MAX_APPS_PER_DEVELOPER + " 个应用");
        }
        
        // 检查应用名称是否重复
        if (appRepository.existsByUserIdAndAppName(userId, appName)) {
            throw new RuntimeException("应用名称已存在");
        }
        
        // 生成唯一的appId
        String appId;
        do {
            appId = OAuthApplication.generateAppId();
        } while (appRepository.existsByAppId(appId));
        
        OAuthApplication app = new OAuthApplication();
        app.setUserId(userId);
        app.setAppName(appName);
        app.setAppId(appId);
        app.setAppSecret(OAuthApplication.generateAppSecret());
        app.setRedirectUri(redirectUri);
        app.setDescription(description);
        app.setHomepageUrl(homepageUrl);
        app.setPrivacyUrl(privacyUrl);
        app.setStatus("ACTIVE");
        app.setAuthCount(0L);
        
        log.info("用户 {} 创建了新应用: {}", userId, appName);
        return appRepository.save(app);
    }
    
    /**
     * 更新应用信息（支持开发者ID）
     */
    @Transactional
    public OAuthApplication updateApplicationByDeveloper(String appId, Long developerId, String appName, 
                                              String redirectUri, String description, 
                                              String homepageUrl, String privacyUrl, String iconUrl) {
        OAuthApplication app = appRepository.findByAppIdAndDeveloperId(appId, developerId)
                .orElseThrow(() -> new RuntimeException("应用不存在或无权限修改"));
        
        // 检查新名称是否与其他应用重复
        if (appName != null && !appName.equals(app.getAppName())) {
            if (appRepository.existsByDeveloperIdAndAppName(developerId, appName)) {
                throw new RuntimeException("应用名称已存在");
            }
            app.setAppName(appName);
        }
        
        if (redirectUri != null) {
            app.setRedirectUri(redirectUri);
        }
        if (description != null) {
            app.setDescription(description);
        }
        if (homepageUrl != null) {
            app.setHomepageUrl(homepageUrl);
        }
        if (privacyUrl != null) {
            app.setPrivacyUrl(privacyUrl);
        }
        if (iconUrl != null) {
            app.setIconUrl(iconUrl);
        }
        
        log.info("开发者 {} 更新了应用: {}", developerId, appId);
        return appRepository.save(app);
    }
    
    /**
     * 更新应用信息（兼容旧的userId方式）
     */
    @Transactional
    public OAuthApplication updateApplication(String appId, Long userId, String appName, 
                                              String redirectUri, String description, 
                                              String homepageUrl, String privacyUrl, String iconUrl) {
        OAuthApplication app = appRepository.findByAppIdAndUserId(appId, userId)
                .orElseThrow(() -> new RuntimeException("应用不存在或无权限修改"));
        
        // 检查新名称是否与其他应用重复
        if (appName != null && !appName.equals(app.getAppName())) {
            if (appRepository.existsByUserIdAndAppName(userId, appName)) {
                throw new RuntimeException("应用名称已存在");
            }
            app.setAppName(appName);
        }
        
        if (redirectUri != null) {
            app.setRedirectUri(redirectUri);
        }
        if (description != null) {
            app.setDescription(description);
        }
        if (homepageUrl != null) {
            app.setHomepageUrl(homepageUrl);
        }
        if (privacyUrl != null) {
            app.setPrivacyUrl(privacyUrl);
        }
        if (iconUrl != null) {
            app.setIconUrl(iconUrl);
        }
        
        log.info("用户 {} 更新了应用: {}", userId, appId);
        return appRepository.save(app);
    }
    
    /**
     * 删除应用（支持开发者ID）
     */
    @Transactional
    public boolean deleteApplicationByDeveloper(String appId, Long developerId) {
        int deleted = appRepository.deleteByAppIdAndDeveloperId(appId, developerId);
        if (deleted > 0) {
            log.info("开发者 {} 删除了应用: {}", developerId, appId);
            return true;
        }
        return false;
    }
    
    /**
     * 删除应用（兼容旧的userId方式）
     */
    @Transactional
    public boolean deleteApplication(String appId, Long userId) {
        int deleted = appRepository.deleteByAppIdAndUserId(appId, userId);
        if (deleted > 0) {
            log.info("用户 {} 删除了应用: {}", userId, appId);
            return true;
        }
        return false;
    }
    
    /**
     * 获取开发者的所有应用
     */
    public List<OAuthApplication> getApplicationsByDeveloper(Long developerId) {
        return appRepository.findByDeveloperIdOrderByCreatedAtDesc(developerId);
    }
    
    /**
     * 获取用户的所有应用（兼容旧方式）
     */
    public List<OAuthApplication> getApplicationsByUser(Long userId) {
        return appRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }
    
    /**
     * 获取应用详情（开发者验证）
     */
    public Optional<OAuthApplication> getApplicationByDeveloper(String appId, Long developerId) {
        return appRepository.findByAppIdAndDeveloperId(appId, developerId);
    }
    
    /**
     * 获取应用详情（userId验证，兼容旧方式）
     */
    public Optional<OAuthApplication> getApplicationByOwner(String appId, Long userId) {
        return appRepository.findByAppIdAndUserId(appId, userId);
    }
    
    /**
     * 重新生成应用密钥（开发者验证）
     */
    @Transactional
    public OAuthApplication regenerateSecretByDeveloper(String appId, Long developerId) {
        OAuthApplication app = appRepository.findByAppIdAndDeveloperId(appId, developerId)
                .orElseThrow(() -> new RuntimeException("应用不存在或无权限修改"));
        
        app.regenerateSecret();
        log.info("开发者 {} 重新生成了应用 {} 的密钥", developerId, appId);
        return appRepository.save(app);
    }
    
    /**
     * 重新生成应用密钥（userId验证，兼容旧方式）
     */
    @Transactional
    public OAuthApplication regenerateSecret(String appId, Long userId) {
        OAuthApplication app = appRepository.findByAppIdAndUserId(appId, userId)
                .orElseThrow(() -> new RuntimeException("应用不存在或无权限修改"));
        
        app.regenerateSecret();
        log.info("用户 {} 重新生成了应用 {} 的密钥", userId, appId);
        return appRepository.save(app);
    }
    
    /**
     * 启用/禁用应用（开发者验证）
     */
    @Transactional
    public OAuthApplication toggleStatusByDeveloper(String appId, Long developerId) {
        OAuthApplication app = appRepository.findByAppIdAndDeveloperId(appId, developerId)
                .orElseThrow(() -> new RuntimeException("应用不存在或无权限修改"));
        
        app.setStatus(app.isActive() ? "DISABLED" : "ACTIVE");
        log.info("开发者 {} 将应用 {} 状态更改为: {}", developerId, appId, app.getStatus());
        return appRepository.save(app);
    }
    
    /**
     * 启用/禁用应用（userId验证，兼容旧方式）
     */
    @Transactional
    public OAuthApplication toggleStatus(String appId, Long userId) {
        OAuthApplication app = appRepository.findByAppIdAndUserId(appId, userId)
                .orElseThrow(() -> new RuntimeException("应用不存在或无权限修改"));
        
        app.setStatus(app.isActive() ? "DISABLED" : "ACTIVE");
        log.info("用户 {} 将应用 {} 状态更改为: {}", userId, appId, app.getStatus());
        return appRepository.save(app);
    }
    
    /**
     * 根据appId获取活跃的应用（用于OAuth验证）
     */
    public Optional<OAuthApplication> getActiveApplication(String appId) {
        return appRepository.findActiveByAppId(appId);
    }
    
    /**
     * 增加授权次数
     */
    @Transactional
    public void incrementAuthCount(String appId) {
        appRepository.incrementAuthCount(appId);
    }
    
    /**
     * 验证回调地址是否匹配
     */
    public boolean validateRedirectUri(String appId, String redirectUri) {
        return appRepository.findActiveByAppId(appId)
                .map(app -> app.getRedirectUri().equals(redirectUri))
                .orElse(false);
    }
}
