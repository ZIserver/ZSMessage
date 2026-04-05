package com.chatapp.repository;

import com.chatapp.entity.UserLoginAttempt;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 用户登录尝试记录Repository
 */
@Repository
public interface UserLoginAttemptRepository extends JpaRepository<UserLoginAttempt, Long> {
    
    /**
     * 查询指定用户在指定时间范围内的失败尝试次数
     * @param username 用户名
     * @param startTime 开始时间
     * @return 失败次数
     */
    @Query("SELECT COUNT(a) FROM UserLoginAttempt a WHERE a.username = :username AND a.success = false AND a.attemptTime >= :startTime")
    long countFailedAttemptsByUsername(@Param("username") String username, @Param("startTime") LocalDateTime startTime);
    
    /**
     * 查询指定IP在指定时间范围内的失败尝试次数
     * @param ipAddress IP地址
     * @param startTime 开始时间
     * @return 失败次数
     */
    @Query("SELECT COUNT(a) FROM UserLoginAttempt a WHERE a.ipAddress = :ipAddress AND a.success = false AND a.attemptTime >= :startTime")
    long countFailedAttemptsByIp(@Param("ipAddress") String ipAddress, @Param("startTime") LocalDateTime startTime);
    
    /**
     * 查询指定用户或IP的最近登录尝试
     * @param username 用户名
     * @param ipAddress IP地址
     * @param startTime 开始时间
     * @return 登录尝试列表
     */
    @Query("SELECT a FROM UserLoginAttempt a WHERE (a.username = :username OR a.ipAddress = :ipAddress) AND a.attemptTime >= :startTime ORDER BY a.attemptTime DESC")
    List<UserLoginAttempt> findRecentAttempts(@Param("username") String username, @Param("ipAddress") String ipAddress, @Param("startTime") LocalDateTime startTime);
    
    /**
     * 删除过期的记录（保留最近30天）
     * @param beforeTime 时间点
     */
    void deleteByAttemptTimeBefore(LocalDateTime beforeTime);
    
    /**
     * 删除指定用户的失败记录（登录成功后调用）
     * @param username 用户名
     */
    void deleteByUsernameAndSuccessFalse(String username);
}
