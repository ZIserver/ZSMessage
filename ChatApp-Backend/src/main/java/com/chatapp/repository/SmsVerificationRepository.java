package com.chatapp.repository;

import com.chatapp.entity.SmsVerification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface SmsVerificationRepository extends JpaRepository<SmsVerification, Long> {
    
    /**
     * 查找手机号最新的未使用验证码
     */
    Optional<SmsVerification> findTopByPhoneAndUsedFalseOrderByCreatedAtDesc(String phone);
    
    /**
     * 查找手机号在指定时间后发送的验证码数量（用于限流）
     */
    long countByPhoneAndCreatedAtAfter(String phone, LocalDateTime after);
    
    /**
     * 删除过期的验证码
     */
    void deleteByExpiresAtBefore(LocalDateTime dateTime);
    
    /**
     * 查找指定手机号的所有未使用验证码
     */
    List<SmsVerification> findByPhoneAndUsedFalse(String phone);
}
