package com.chatapp.repository;

import com.chatapp.entity.OAuthToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Optional;

/**
 * OAuth Token Repository
 */
@Repository
public interface OAuthTokenRepository extends JpaRepository<OAuthToken, String> {
    
    /**
     * 查找有效的Token（未使用且未过期）
     */
    @Query("SELECT t FROM OAuthToken t WHERE t.token = :token AND t.used = false AND t.expiresAt > :now")
    Optional<OAuthToken> findValidToken(String token, LocalDateTime now);
    
    /**
     * 标记Token为已使用
     */
    @Modifying
    @Transactional
    @Query("UPDATE OAuthToken t SET t.used = true WHERE t.token = :token")
    void markAsUsed(String token);
    
    /**
     * 清理过期的Token
     */
    @Modifying
    @Transactional
    @Query("DELETE FROM OAuthToken t WHERE t.expiresAt < :now")
    void deleteExpiredTokens(LocalDateTime now);
    
    /**
     * 根据用户ID查找Token
     */
    Optional<OAuthToken> findByUserIdAndUsedFalse(Long userId);
}
