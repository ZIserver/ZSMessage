package com.chatapp.util;

import javax.crypto.Cipher;
import javax.crypto.spec.IvParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;

/**
 * 加密解密工具类
 * 用于身份证号等敏感信息的加密解密
 */
public class CryptoUtil {
    
    private static final String SECRET_KEY = "ZSMESSAGENB114514-MESSAGEJIAMI";
    private static final String ALGORITHM = "AES/CBC/PKCS5Padding";
    
    /**
     * 解密身份证号
     * @param encryptedText 加密后的文本（格式：base64(iv):base64(encryptedData)）
     * @return 解密后的文本
     */
    public static String decryptIdCard(String encryptedText) {
        if (encryptedText == null || encryptedText.trim().isEmpty()) {
            return null;
        }
        
        // 检查是否包含分隔符
        if (!encryptedText.contains(":")) {
            return encryptedText; // 非加密格式，直接返回
        }
        
        try {
            String[] parts = encryptedText.split(":");
            if (parts.length != 2) {
                return encryptedText;
            }
            
            // 解码 IV 和加密数据
            byte[] iv = Base64.getDecoder().decode(parts[0]);
            byte[] encryptedData = Base64.getDecoder().decode(parts[1]);
            
            // 生成密钥（使用 SHA-256 哈希）
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] keyBytes = digest.digest(SECRET_KEY.getBytes(StandardCharsets.UTF_8));
            SecretKeySpec keySpec = new SecretKeySpec(keyBytes, "AES");
            
            // 解密
            Cipher cipher = Cipher.getInstance(ALGORITHM);
            cipher.init(Cipher.DECRYPT_MODE, keySpec, new IvParameterSpec(iv));
            byte[] decrypted = cipher.doFinal(encryptedData);
            
            return new String(decrypted, StandardCharsets.UTF_8);
        } catch (Exception e) {
            // 解密失败，返回原文
            return encryptedText;
        }
    }
    
    /**
     * 脱敏显示身份证号
     * @param idCard 身份证号
     * @return 脱敏后的身份证号
     */
    public static String maskIdCard(String idCard) {
        if (idCard == null || idCard.length() < 4) {
            return idCard;
        }
        String last4 = idCard.substring(idCard.length() - 4);
        return "**************" + last4;
    }
}
