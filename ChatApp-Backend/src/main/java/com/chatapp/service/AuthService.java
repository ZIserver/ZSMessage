package com.chatapp.service;

import com.chatapp.dto.AuthResponse;
import com.chatapp.dto.LoginRequest;
import com.chatapp.dto.RegisterRequest;
import com.chatapp.entity.EmailVerification;
import com.chatapp.entity.SystemMessage;
import com.chatapp.entity.SystemMessageType;
import com.chatapp.entity.User;
import com.chatapp.repository.EmailVerificationRepository;
import com.chatapp.repository.UserRepository;
import com.chatapp.service.SystemMessageService;
import com.chatapp.util.JwtUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthService {

    private final UserRepository userRepository;
    private final EmailVerificationRepository emailVerificationRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final TokenService tokenService;
    private final EmailService emailService;
    private final SmsService smsService;
    private final SystemMessageService systemMessageService;

    public AuthResponse register(RegisterRequest request) {
        // 判断注册方式：手机号注册 or 邮箱注册
        boolean isPhoneRegister = request.getPhone() != null && !request.getPhone().trim().isEmpty();
        
        // 验证基本输入
        if (request.getUsername() == null || request.getUsername().trim().isEmpty()) {
            throw new RuntimeException("用户名不能为空");
        }
        if (request.getPassword() == null || request.getPassword().trim().isEmpty()) {
            throw new RuntimeException("密码不能为空");
        }
        if (request.getNickname() == null || request.getNickname().trim().isEmpty()) {
            throw new RuntimeException("昵称不能为空");
        }
        
        if (userRepository.existsByUsername(request.getUsername())) {
            throw new RuntimeException("用户名已存在");
        }
        
        User user = new User();
        user.setUsername(request.getUsername());
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setNickname(request.getNickname());
        user.setOnline(false);
        user.setStatus(1); // 新用户默认状态为正常
        
        if (isPhoneRegister) {
            // 手机号注册
            if (request.getSmsCode() == null || request.getSmsCode().trim().isEmpty()) {
                throw new RuntimeException("短信验证码不能为空");
            }
            
            // 验证手机号格式
            if (!smsService.isValidPhone(request.getPhone())) {
                throw new RuntimeException("手机号格式不正确");
            }
            
            // 检查手机号是否已被注册
            if (userRepository.findFirstByPhoneOrderByIdAsc(request.getPhone()).isPresent()) {
                throw new RuntimeException("该手机号已被注册");
            }
            
            // 验证短信验证码
            if (!smsService.verifyCode(request.getPhone(), request.getSmsCode())) {
                throw new RuntimeException("短信验证码错误或已过期");
            }
            
            user.setPhone(request.getPhone());
            user.setPhoneVerified(true);
            log.info("用户通过手机号注册: {}", request.getPhone().substring(0, 3) + "****" + request.getPhone().substring(7));
        } else {
            // 邮箱注册（保留兼容）
            if (request.getEmail() == null || request.getEmail().trim().isEmpty()) {
                throw new RuntimeException("请使用手机号注册");
            }
            if (request.getVerificationCode() == null || request.getVerificationCode().trim().isEmpty()) {
                throw new RuntimeException("验证码不能为空");
            }
            
            // 验证邮箱验证码
            EmailVerification verification = emailVerificationRepository
                .findByEmailAndVerificationCodeAndIsUsedFalseAndExpiresAtAfter(
                    request.getEmail(),
                    request.getVerificationCode(),
                    LocalDateTime.now()
                )
                .orElseThrow(() -> new RuntimeException("验证码错误或已过期"));
            
            // 标记验证码已使用
            verification.setIsUsed(true);
            emailVerificationRepository.save(verification);
            
            user.setEmail(request.getEmail());
            user.setEmailVerified(true);
        }
        
        // 分配智穗号（从100000001开始）
        Long nextZsNumber = generateNextZsNumber();
        user.setZsNumber(nextZsNumber);
        log.info("新用户分配智穗号: {}", nextZsNumber);
        
        user = userRepository.save(user);

        // 生成JWT Token（用于兼容）
        String jwtToken = jwtUtil.generateToken(user.getUsername(), user.getId());
        
        // 生成并保存持久化Token到数据库
        String sessionToken = tokenService.generateToken(user.getId(), "Registration");

        return new AuthResponse(sessionToken, user.getId(), user.getUsername(), user.getNickname(), user, null);
    }

    public AuthResponse login(LoginRequest request) {
        User user = null;
        
        // 优先使用智穗号登录，如果没有智穗号则使用用户名登录
        if (request.getSmartCode() != null && !request.getSmartCode().isEmpty()) {
            // 智穗号登录
            Long smartCodeLong;
            try {
                smartCodeLong = Long.parseLong(request.getSmartCode());
            } catch (NumberFormatException e) {
                throw new RuntimeException("智穗号格式不正确");
            }
            
            // 查找智穗号匹配的用户
            List<User> allUsers = userRepository.findAll();
            user = allUsers.stream()
                    .filter(u -> u.getZsNumber() != null && u.getZsNumber().equals(smartCodeLong))
                    .findFirst()
                    .orElseThrow(() -> new RuntimeException("用户不存在"));
        } else {
            // 传统用户名登录
            user = userRepository.findByUsername(request.getUsername())
                    .orElseThrow(() -> new RuntimeException("User not found"));
        }

        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new RuntimeException("Invalid password");
        }
        
        // 检查用户状态
        if (user.getStatus() == 0) { // 封禁状态
            String banReason = getLatestBanReason(user.getId());
            String errorMessage = "账户封禁中" + (banReason != null ? "，理由：" + banReason : "");
            throw new RuntimeException(errorMessage);
        }
        
        if (user.getStatus() == 2) { // 不安全状态
            throw new RuntimeException("账户存在安全隐患，请联系客服处理");
        }

        user.setOnline(true);
        userRepository.save(user);

        // 生成JWT Token（用于兼容）
        String jwtToken = jwtUtil.generateToken(user.getUsername(), user.getId());
        
        // 生成并保存持久化Token到数据库
        String deviceInfo = "Electron Desktop"; // 可以从请求头中获取
        String sessionToken = tokenService.generateToken(user.getId(), deviceInfo);

        String banReason = user.getStatus() == 0 ? getLatestBanReason(user.getId()) : null;
        return new AuthResponse(sessionToken, user.getId(), user.getUsername(), user.getNickname(), user, banReason);
    }
    
    /**
     * 获取用户的最新封禁理由
     */
    private String getLatestBanReason(Long userId) {
        // 查询与封禁相关的系统消息，获取最近的一条
        try {
            List<SystemMessage> banMessages = systemMessageService.getUserSystemMessages(userId);
            if (banMessages != null && !banMessages.isEmpty()) {
                // 找到最新的BAN类型的消息
                return banMessages.stream()
                    .filter(msg -> SystemMessageType.BAN == msg.getMessageType())
                    .max(Comparator.comparing(SystemMessage::getCreatedAt))
                    .map(SystemMessage::getReason)
                    .orElse("违反社区规定");
            }
        } catch (Exception e) {
            // 如果无法获取系统消息，则返回默认原因
            return "违反社区规定";
        }
        return "违反社区规定";
    }
    
    /**
     * 发送邮箱验证码
     */
    @Transactional
    public boolean sendVerificationCode(String email) {
        // 生成验证码
        String code = emailService.generateVerificationCode();
        
        // 先保存验证码到数据库
        EmailVerification verification = new EmailVerification();
        verification.setEmail(email);
        verification.setVerificationCode(code);
        verification.setExpiresAt(LocalDateTime.now().plusMinutes(5)); // 5分钟有效
        verification.setIsUsed(false);
        
        emailVerificationRepository.save(verification);
        
        // 异步发送邮件（不阻塞请求）
        try {
            emailService.sendVerificationEmail(email, code);
        } catch (Exception e) {
            // 邮件发送失败不影响验证码保存
            // 用户可以从控制台获取验证码
        }
        
        // 立即返回成功（验证码已保存）
        return true;
    }
    
    /**
     * 生成下一个智穗号
     * 从100000001开始递增
     */
    private synchronized Long generateNextZsNumber() {
        Long maxZsNumber = userRepository.findMaxZsNumber();
        if (maxZsNumber == null || maxZsNumber < 100000001L) {
            return 100000001L;
        }
        return maxZsNumber + 1;
    }
}