package com.chatapp.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

import java.util.Random;

@Service
@RequiredArgsConstructor
@Slf4j
public class EmailService {
    
    private final JavaMailSender mailSender;
    
    @Value("${spring.mail.username}")
    private String fromEmail;
    
    /**
     * 生成6位验证码
     */
    public String generateVerificationCode() {
        Random random = new Random();
        int code = 100000 + random.nextInt(900000);
        return String.valueOf(code);
    }
    
    /**
     * 发送验证码邮件
     */
    public boolean sendVerificationEmail(String email, String code) {
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(fromEmail);
            message.setTo(email);
            message.setSubject("智穗语聊 - 注册验证码");
            message.setText(String.format(
                "您好！\n\n" +
                "您的注册验证码是：%s\n\n" +
                "验证码有效期为5分钟，请及时使用。\n\n" +
                "如果这不是您的操作，请忽略此邮件。\n\n" +
                "智穗语聊团队",
                code
            ));
            
            mailSender.send(message);
            log.info("[邮件服务] 验证码邮件发送成功 -> {}", email);
            return true;
        } catch (Exception e) {
            log.error("[邮件服务] 发送失败 -> {}: {}", email, e.getMessage());
            return false;
        }
    }
}
