package com.chatapp.repository;

import com.chatapp.entity.EmailVerification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Optional;

@Repository
public interface EmailVerificationRepository extends JpaRepository<EmailVerification, Long> {
    
    /**
     * 根据邮箱和验证码查找（未使用且未过期）
     */
    Optional<EmailVerification> findByEmailAndVerificationCodeAndIsUsedFalseAndExpiresAtAfter(
        String email, 
        String verificationCode, 
        LocalDateTime now
    );
    
    /**
     * 根据邮箱查找最新的验证码
     */
    Optional<EmailVerification> findFirstByEmailOrderByCreatedAtDesc(String email);
    
    /**
     * 删除过期的验证码记录
     */
    void deleteByExpiresAtBefore(LocalDateTime now);
}
