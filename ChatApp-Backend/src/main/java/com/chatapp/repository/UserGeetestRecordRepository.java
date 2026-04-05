package com.chatapp.repository;

import com.chatapp.entity.UserGeetestRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Optional;

/**
 * 用户Geetest验证记录Repository
 */
@Repository
public interface UserGeetestRecordRepository extends JpaRepository<UserGeetestRecord, Long> {
    
    /**
     * 查找有效的验证记录
     * @param username 用户名
     * @param ipAddress IP地址
     * @param lotNumber Geetest lot_number
     * @return 验证记录
     */
    @Query("SELECT g FROM UserGeetestRecord g WHERE g.username = :username AND g.ipAddress = :ipAddress AND g.lotNumber = :lotNumber AND g.verified = false AND g.expiresAt > :now")
    Optional<UserGeetestRecord> findValidRecord(@Param("username") String username, @Param("ipAddress") String ipAddress, @Param("lotNumber") String lotNumber, @Param("now") LocalDateTime now);
    
    /**
     * 删除过期的记录
     * @param beforeTime 时间点
     */
    void deleteByExpiresAtBefore(LocalDateTime beforeTime);
}
