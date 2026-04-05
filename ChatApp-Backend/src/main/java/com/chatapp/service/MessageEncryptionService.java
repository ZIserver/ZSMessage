package com.chatapp.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import javax.crypto.Cipher;
import javax.crypto.spec.IvParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;

/**
 * 消息加密服务 - 服务器端 AES-256-CBC 加密
 * 用于替代客户端E2E加密，便于审核管理
 */
@Service
@Slf4j
public class MessageEncryptionService {
    
    // 加密密钥（与管理后台一致）
    private static final String SECRET_KEY = "ZSMESSAGENB114514-MESSAGEJIAMI";
    
    // AES算法配置
    private static final String ALGORITHM = "AES/CBC/PKCS5Padding";
    private static final int IV_LENGTH = 16;
    
    private final SecretKeySpec secretKeySpec;
    
    public MessageEncryptionService() {
        try {
            // 使用SHA-256生成256位密钥
            MessageDigest sha = MessageDigest.getInstance("SHA-256");
            byte[] keyBytes = sha.digest(SECRET_KEY.getBytes(StandardCharsets.UTF_8));
            this.secretKeySpec = new SecretKeySpec(keyBytes, "AES");
            log.info("消息加密服务初始化成功");
        } catch (Exception e) {
            log.error("消息加密服务初始化失败", e);
            throw new RuntimeException("加密服务初始化失败", e);
        }
    }
    
    /**
     * 加密消息
     * @param plainText 明文
     * @return 加密后的字符串（格式：base64(iv):base64(ciphertext)）
     */
    public String encrypt(String plainText) {
        if (plainText == null || plainText.isEmpty()) {
            return plainText;
        }
        
        try {
            // 生成随机IV
            byte[] iv = new byte[IV_LENGTH];
            new SecureRandom().nextBytes(iv);
            IvParameterSpec ivSpec = new IvParameterSpec(iv);
            
            // 加密
            Cipher cipher = Cipher.getInstance(ALGORITHM);
            cipher.init(Cipher.ENCRYPT_MODE, secretKeySpec, ivSpec);
            byte[] encrypted = cipher.doFinal(plainText.getBytes(StandardCharsets.UTF_8));
            
            // 返回 IV:密文 格式
            String ivBase64 = Base64.getEncoder().encodeToString(iv);
            String cipherBase64 = Base64.getEncoder().encodeToString(encrypted);
            
            return ivBase64 + ":" + cipherBase64;
        } catch (Exception e) {
            log.error("消息加密失败: {}", e.getMessage());
            // 加密失败返回原文（避免丢失消息）
            return plainText;
        }
    }
    
    /**
     * 解密消息
     * @param encryptedText 加密后的字符串
     * @return 解密后的明文
     */
    public String decrypt(String encryptedText) {
        if (encryptedText == null || encryptedText.isEmpty()) {
            return encryptedText;
        }
        
        // 检查是否为加密格式
        if (!encryptedText.contains(":")) {
            // 非加密消息，直接返回
            return encryptedText;
        }
        
        try {
            String[] parts = encryptedText.split(":");
            if (parts.length != 2) {
                return encryptedText;
            }
            
            byte[] iv = Base64.getDecoder().decode(parts[0]);
            byte[] cipherText = Base64.getDecoder().decode(parts[1]);
            
            IvParameterSpec ivSpec = new IvParameterSpec(iv);
            
            // 解密
            Cipher cipher = Cipher.getInstance(ALGORITHM);
            cipher.init(Cipher.DECRYPT_MODE, secretKeySpec, ivSpec);
            byte[] decrypted = cipher.doFinal(cipherText);
            
            return new String(decrypted, StandardCharsets.UTF_8);
        } catch (Exception e) {
            log.warn("消息解密失败，可能是旧格式消息: {}", e.getMessage());
            // 解密失败返回原文
            return encryptedText;
        }
    }
    
    /**
     * 检查消息是否为加密格式
     */
    public boolean isEncrypted(String text) {
        if (text == null || text.isEmpty()) {
            return false;
        }
        
        if (!text.contains(":")) {
            return false;
        }
        
        String[] parts = text.split(":");
        if (parts.length != 2) {
            return false;
        }
        
        try {
            // 尝试Base64解码IV，如果成功且长度正确，则认为是加密消息
            byte[] iv = Base64.getDecoder().decode(parts[0]);
            return iv.length == IV_LENGTH;
        } catch (Exception e) {
            return false;
        }
    }
}
