package com.chatapp.controller;

import com.chatapp.entity.User;
import com.chatapp.repository.UserRepository;
import com.chatapp.service.SmsService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/phone")
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
@Slf4j
public class PhoneController {
    
    private final SmsService smsService;
    private final UserRepository userRepository;
    
    /**
     * 发送短信验证码
     */
    @PostMapping("/send-code")
    public ResponseEntity<?> sendVerificationCode(@RequestBody Map<String, String> request) {
        try {
            String phone = request.get("phone");
            Long userId = request.get("userId") != null ? Long.parseLong(request.get("userId")) : null;
            
            if (phone == null || phone.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "手机号不能为空"));
            }
            
            // 验证手机号格式
            if (!smsService.isValidPhone(phone)) {
                return ResponseEntity.badRequest().body(Map.of("error", "手机号格式不正确"));
            }
            
            // 检查手机号是否已被其他用户绑定
            Optional<User> existingUser = userRepository.findFirstByPhoneOrderByIdAsc(phone);
            if (existingUser.isPresent()) {
                if (userId == null || !existingUser.get().getId().equals(userId)) {
                    return ResponseEntity.badRequest().body(Map.of("error", "该手机号已被其他用户绑定"));
                }
            }
            
            // 发送验证码
            smsService.sendVerificationCode(phone);
            
            log.info("验证码发送成功: userId={}, phone={}", userId, phone.substring(0, 3) + "****" + phone.substring(7));
            return ResponseEntity.ok(Map.of("message", "验证码已发送"));
            
        } catch (RuntimeException e) {
            log.warn("发送验证码失败: {}", e.getMessage());
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("发送验证码异常", e);
            return ResponseEntity.internalServerError().body(Map.of("error", "系统错误，请稍后重试"));
        }
    }
    
    /**
     * 绑定手机号
     */
    @PostMapping("/bind")
    public ResponseEntity<?> bindPhone(@RequestBody Map<String, String> request) {
        try {
            String phone = request.get("phone");
            String code = request.get("code");
            String userIdStr = request.get("userId");
            
            if (phone == null || code == null || userIdStr == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "参数不完整"));
            }
            
            Long userId = Long.parseLong(userIdStr);
            
            // 验证验证码
            if (!smsService.verifyCode(phone, code)) {
                return ResponseEntity.badRequest().body(Map.of("error", "验证码错误或已过期"));
            }
            
            // 查找用户
            User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("用户不存在"));
            
            // 检查手机号是否已被其他用户绑定
            Optional<User> existingUser = userRepository.findFirstByPhoneOrderByIdAsc(phone);
            if (existingUser.isPresent() && !existingUser.get().getId().equals(userId)) {
                return ResponseEntity.badRequest().body(Map.of("error", "该手机号已被其他用户绑定"));
            }
            
            // 绑定手机号
            user.setPhone(phone);
            user.setPhoneVerified(true);
            userRepository.save(user);
            
            log.info("手机号绑定成功: userId={}, phone={}", userId, phone.substring(0, 3) + "****" + phone.substring(7));
            
            Map<String, Object> response = new HashMap<>();
            response.put("message", "手机号绑定成功");
            response.put("phone", phone);
            response.put("phoneVerified", true);
            
            return ResponseEntity.ok(response);
            
        } catch (NumberFormatException e) {
            return ResponseEntity.badRequest().body(Map.of("error", "用户ID格式错误"));
        } catch (RuntimeException e) {
            log.warn("绑定手机号失败: {}", e.getMessage());
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("绑定手机号异常", e);
            return ResponseEntity.internalServerError().body(Map.of("error", "系统错误，请稍后重试"));
        }
    }
    
    /**
     * 解绑手机号 - 已禁用（绑定后不允许解绑）
     */
    @PostMapping("/unbind")
    public ResponseEntity<?> unbindPhone(@RequestBody Map<String, String> request) {
        return ResponseEntity.badRequest().body(Map.of("error", "手机号绑定后不允许解绑"));
    }
    
    /**
     * 获取用户手机绑定状态
     */
    @GetMapping("/status/{userId}")
    public ResponseEntity<?> getPhoneStatus(@PathVariable Long userId) {
        try {
            User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("用户不存在"));
            
            Map<String, Object> response = new HashMap<>();
            response.put("bound", user.getPhone() != null);
            response.put("verified", user.getPhoneVerified() != null && user.getPhoneVerified());
            
            // 脱敏显示手机号
            if (user.getPhone() != null) {
                String phone = user.getPhone();
                response.put("phone", phone.substring(0, 3) + "****" + phone.substring(7));
            }
            
            return ResponseEntity.ok(response);
            
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
