package com.chatapp.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.util.Base64;
import java.util.Map;
import java.util.Random;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 图片验证码服务
 */
@Service
@Slf4j
public class CaptchaService {
    
    // 验证码缓存（生产环境建议使用Redis）
    private final Map<String, CaptchaData> captchaCache = new ConcurrentHashMap<>();
    
    // 验证码有效期（5分钟）
    private static final long CAPTCHA_EXPIRE_MS = 5 * 60 * 1000;
    
    // 验证码字符集（排除易混淆字符）
    private static final String CHARS = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
    
    private final Random random = new Random();
    
    /**
     * 生成验证码
     * @return 验证码ID和Base64图片
     */
    public Map<String, String> generateCaptcha() {
        // 生成验证码文本
        String code = generateCode(4);
        String captchaId = UUID.randomUUID().toString();
        
        // 生成图片
        String imageBase64 = generateImage(code);
        
        // 缓存验证码
        captchaCache.put(captchaId, new CaptchaData(code, System.currentTimeMillis()));
        
        // 清理过期验证码
        cleanExpiredCaptcha();
        
        log.debug("[验证码] 生成验证码 - ID: {}, Code: {}", captchaId, code);
        
        return Map.of(
            "captchaId", captchaId,
            "captchaImage", "data:image/png;base64," + imageBase64
        );
    }
    
    /**
     * 验证验证码
     * @param captchaId 验证码ID
     * @param code 用户输入的验证码
     * @return 是否验证通过
     */
    public boolean verifyCaptcha(String captchaId, String code) {
        if (captchaId == null || code == null) {
            return false;
        }
        
        CaptchaData data = captchaCache.remove(captchaId);
        if (data == null) {
            log.warn("[验证码] 验证码不存在或已使用 - ID: {}", captchaId);
            return false;
        }
        
        // 检查是否过期
        if (System.currentTimeMillis() - data.createTime > CAPTCHA_EXPIRE_MS) {
            log.warn("[验证码] 验证码已过期 - ID: {}", captchaId);
            return false;
        }
        
        // 忽略大小写比较
        boolean valid = data.code.equalsIgnoreCase(code.trim());
        if (!valid) {
            log.warn("[验证码] 验证码错误 - ID: {}, 期望: {}, 实际: {}", captchaId, data.code, code);
        }
        
        return valid;
    }
    
    /**
     * 生成随机验证码文本
     */
    private String generateCode(int length) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < length; i++) {
            sb.append(CHARS.charAt(random.nextInt(CHARS.length())));
        }
        return sb.toString();
    }
    
    /**
     * 生成验证码图片
     */
    private String generateImage(String code) {
        int width = 120;
        int height = 40;
        
        BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = image.createGraphics();
        
        // 设置抗锯齿
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        
        // 背景色
        g.setColor(new Color(245, 245, 245));
        g.fillRect(0, 0, width, height);
        
        // 绘制干扰线
        for (int i = 0; i < 5; i++) {
            g.setColor(new Color(random.nextInt(200), random.nextInt(200), random.nextInt(200)));
            int x1 = random.nextInt(width);
            int y1 = random.nextInt(height);
            int x2 = random.nextInt(width);
            int y2 = random.nextInt(height);
            g.drawLine(x1, y1, x2, y2);
        }
        
        // 绘制干扰点
        for (int i = 0; i < 50; i++) {
            g.setColor(new Color(random.nextInt(200), random.nextInt(200), random.nextInt(200)));
            int x = random.nextInt(width);
            int y = random.nextInt(height);
            g.fillOval(x, y, 2, 2);
        }
        
        // 绘制验证码文字
        g.setFont(new Font("Arial", Font.BOLD, 28));
        for (int i = 0; i < code.length(); i++) {
            g.setColor(new Color(random.nextInt(100), random.nextInt(100), random.nextInt(100)));
            // 随机旋转角度
            double angle = (random.nextDouble() - 0.5) * 0.3;
            g.rotate(angle, 25 + i * 25, 25);
            g.drawString(String.valueOf(code.charAt(i)), 15 + i * 25, 30);
            g.rotate(-angle, 25 + i * 25, 25);
        }
        
        g.dispose();
        
        // 转为Base64
        try {
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            ImageIO.write(image, "png", baos);
            return Base64.getEncoder().encodeToString(baos.toByteArray());
        } catch (Exception e) {
            log.error("[验证码] 图片生成失败: {}", e.getMessage());
            return "";
        }
    }
    
    /**
     * 清理过期验证码
     */
    private void cleanExpiredCaptcha() {
        long now = System.currentTimeMillis();
        captchaCache.entrySet().removeIf(entry -> 
            now - entry.getValue().createTime > CAPTCHA_EXPIRE_MS
        );
    }
    
    /**
     * 验证码数据
     */
    private static class CaptchaData {
        final String code;
        final long createTime;
        
        CaptchaData(String code, long createTime) {
            this.code = code;
            this.createTime = createTime;
        }
    }
}
