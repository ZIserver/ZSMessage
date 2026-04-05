package com.chatapp.repository;

import com.chatapp.entity.AppVersion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AppVersionRepository extends JpaRepository<AppVersion, Long> {
    
    /**
     * 查找指定平台的最新版本
     */
    Optional<AppVersion> findFirstByPlatformAndEnabledTrueOrderByCreatedAtDesc(String platform);
    
    /**
     * 根据版本号和平台查找
     */
    Optional<AppVersion> findByVersionAndPlatform(String version, String platform);
    
    /**
     * 查找所有已启用的版本
     */
    List<AppVersion> findByEnabledTrueOrderByCreatedAtDesc();
    
    /**
     * 根据平台查找所有版本
     */
    List<AppVersion> findByPlatformOrderByCreatedAtDesc(String platform);
    
    /**
     * 根据平台查找所有已启用的版本（用于更新日志）
     */
    List<AppVersion> findByPlatformAndEnabledTrueOrderByCreatedAtDesc(String platform);
}
