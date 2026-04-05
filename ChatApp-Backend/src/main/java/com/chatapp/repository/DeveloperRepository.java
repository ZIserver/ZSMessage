package com.chatapp.repository;

import com.chatapp.entity.Developer;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Optional;

/**
 * 开发者Repository
 */
@Repository
public interface DeveloperRepository extends JpaRepository<Developer, Long> {
    
    /**
     * 根据智穗语聊用户ID查找开发者
     */
    Optional<Developer> findByUserId(Long userId);
    
    /**
     * 根据开发者Token查找开发者
     */
    Optional<Developer> findByDeveloperToken(String developerToken);
    
    /**
     * 根据Token查找有效的开发者（Token未过期且状态正常）
     */
    @Query("SELECT d FROM Developer d WHERE d.developerToken = :token " +
           "AND d.tokenExpiresAt > :now AND d.status = 'ACTIVE'")
    Optional<Developer> findByValidToken(@Param("token") String token, @Param("now") LocalDateTime now);
    
    /**
     * 检查用户ID是否已注册为开发者
     */
    boolean existsByUserId(Long userId);
    
    /**
     * 根据用户名查找开发者
     */
    Optional<Developer> findByUsername(String username);
    
    /**
     * 更新开发者Token
     */
    @Modifying
    @Query("UPDATE Developer d SET d.developerToken = :token, d.tokenExpiresAt = :expiresAt WHERE d.id = :id")
    void updateToken(@Param("id") Long id, @Param("token") String token, @Param("expiresAt") LocalDateTime expiresAt);
    
    /**
     * 更新实名认证状态
     */
    @Modifying
    @Query("UPDATE Developer d SET d.verified = true, d.realName = :realName, " +
           "d.idCard = :idCard, d.idCardLast4 = :idCardLast4, d.verifiedAt = :verifiedAt WHERE d.id = :id")
    void updateVerification(@Param("id") Long id, @Param("realName") String realName, 
                           @Param("idCard") String idCard, @Param("idCardLast4") String idCardLast4,
                           @Param("verifiedAt") LocalDateTime verifiedAt);
    
    /**
     * 统计已认证的开发者数量
     */
    long countByVerified(Boolean verified);
    
    /**
     * 根据状态统计开发者数量
     */
    long countByStatus(String status);
    
    /**
     * 管理员查询方法 - 根据关键词搜索
     */
    @Query("SELECT d FROM Developer d WHERE " +
           "d.username LIKE %:keyword% OR d.nickname LIKE %:keyword% OR d.realName LIKE %:keyword%")
    Page<Developer> findByUsernameContainingOrNicknameContainingOrRealNameContaining(
        @Param("keyword") String keyword1, 
        @Param("keyword") String keyword2, 
        @Param("keyword") String keyword3, 
        Pageable pageable);
    
    /**
     * 管理员查询方法 - 根据关键词和状态搜索
     */
    @Query("SELECT d FROM Developer d WHERE " +
           "(d.username LIKE %:keyword% OR d.nickname LIKE %:keyword% OR d.realName LIKE %:keyword%) " +
           "AND d.status = :status")
    Page<Developer> findByUsernameContainingOrNicknameContainingOrRealNameContainingAndStatus(
        @Param("keyword") String keyword1, 
        @Param("keyword") String keyword2, 
        @Param("keyword") String keyword3, 
        @Param("status") String status, 
        Pageable pageable);
    
    /**
     * 管理员查询方法 - 根据关键词和认证状态搜索
     */
    @Query("SELECT d FROM Developer d WHERE " +
           "(d.username LIKE %:keyword% OR d.nickname LIKE %:keyword% OR d.realName LIKE %:keyword%) " +
           "AND d.verified = :verified")
    Page<Developer> findByUsernameContainingOrNicknameContainingOrRealNameContainingAndVerified(
        @Param("keyword") String keyword1, 
        @Param("keyword") String keyword2, 
        @Param("keyword") String keyword3, 
        @Param("verified") Boolean verified, 
        Pageable pageable);
    
    /**
     * 管理员查询方法 - 根据关键词、状态和认证状态搜索
     */
    @Query("SELECT d FROM Developer d WHERE " +
           "(d.username LIKE %:keyword% OR d.nickname LIKE %:keyword% OR d.realName LIKE %:keyword%) " +
           "AND d.status = :status AND d.verified = :verified")
    Page<Developer> findByUsernameContainingOrNicknameContainingOrRealNameContainingAndStatusAndVerified(
        @Param("keyword") String keyword1, 
        @Param("keyword") String keyword2, 
        @Param("keyword") String keyword3, 
        @Param("status") String status, 
        @Param("verified") Boolean verified, 
        Pageable pageable);
    
    /**
     * 管理员查询方法 - 根据状态查询
     */
    Page<Developer> findByStatus(String status, Pageable pageable);
    
    /**
     * 管理员查询方法 - 根据认证状态查询
     */
    Page<Developer> findByVerified(Boolean verified, Pageable pageable);
    
    /**
     * 管理员查询方法 - 根据状态和认证状态查询
     */
    Page<Developer> findByStatusAndVerified(String status, Boolean verified, Pageable pageable);
}
