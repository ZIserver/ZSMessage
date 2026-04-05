package com.chatapp.repository;

import com.chatapp.entity.OAuthApplication;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * OAuth应用数据访问层
 */
@Repository
public interface OAuthApplicationRepository extends JpaRepository<OAuthApplication, Long> {
    
    /**
     * 根据应用ID查找应用
     */
    Optional<OAuthApplication> findByAppId(String appId);
    
    /**
     * 根据用户ID查找所有应用
     */
    List<OAuthApplication> findByUserIdOrderByCreatedAtDesc(Long userId);
    
    /**
     * 根据开发者ID查找所有应用
     */
    List<OAuthApplication> findByDeveloperIdOrderByCreatedAtDesc(Long developerId);
    
    /**
     * 根据用户ID统计应用数量
     */
    long countByUserId(Long userId);
    
    /**
     * 根据开发者ID统计应用数量
     */
    long countByDeveloperId(Long developerId);
    
    /**
     * 检查应用ID是否存在
     */
    boolean existsByAppId(String appId);
    
    /**
     * 检查应用名称是否已被该用户使用
     */
    boolean existsByUserIdAndAppName(Long userId, String appName);
    
    /**
     * 检查应用名称是否已被该开发者使用
     */
    boolean existsByDeveloperIdAndAppName(Long developerId, String appName);
    
    /**
     * 根据应用ID和用户ID查找应用（确保是应用所有者）
     */
    Optional<OAuthApplication> findByAppIdAndUserId(String appId, Long userId);
    
    /**
     * 根据应用ID和开发者ID查找应用
     */
    Optional<OAuthApplication> findByAppIdAndDeveloperId(String appId, Long developerId);
    
    /**
     * 删除应用（需要验证所有者）
     */
    @Modifying
    @Query("DELETE FROM OAuthApplication a WHERE a.appId = :appId AND a.userId = :userId")
    int deleteByAppIdAndUserId(@Param("appId") String appId, @Param("userId") Long userId);
    
    /**
     * 根据开发者ID删除应用
     */
    @Modifying
    @Query("DELETE FROM OAuthApplication a WHERE a.appId = :appId AND a.developerId = :developerId")
    int deleteByAppIdAndDeveloperId(@Param("appId") String appId, @Param("developerId") Long developerId);
    
    /**
     * 增加授权次数
     */
    @Modifying
    @Query("UPDATE OAuthApplication a SET a.authCount = a.authCount + 1 WHERE a.appId = :appId")
    void incrementAuthCount(@Param("appId") String appId);
    
    /**
     * 根据状态查找应用
     */
    List<OAuthApplication> findByStatus(String status);
    
    /**
     * 查找活跃的应用
     */
    @Query("SELECT a FROM OAuthApplication a WHERE a.appId = :appId AND a.status = 'ACTIVE'")
    Optional<OAuthApplication> findActiveByAppId(@Param("appId") String appId);
}
