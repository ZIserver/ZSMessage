package com.chatapp.controller;

import com.chatapp.entity.User;
import com.chatapp.repository.UserRepository;
import com.chatapp.util.XssUtil;
import com.chatapp.util.LogUtil;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/users")
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
public class UserController {
    
    private static final Logger logger = LoggerFactory.getLogger(UserController.class);
    private final UserRepository userRepository;
    
    // 头像上传目录
    private static final String AVATAR_UPLOAD_DIR = "uploads/avatars/";
    
    @GetMapping("/search")
    public ResponseEntity<?> searchUsers(@RequestParam String keyword) {
        long startTime = System.currentTimeMillis();
            
        try {
            LogUtil.logApiRequest(this.getClass(), "searchUsers", null, keyword, "unknown");
                
            if (keyword == null || keyword.trim().isEmpty()) {
                Map<String, String> error = new HashMap<>();
                error.put("error", "搜索关键词不能为空");
                logger.warn("搜索关键词为空");
                LogUtil.logError(this.getClass(), "searchUsers", null, "搜索关键词为空", null);
                return ResponseEntity.badRequest().body(error);
            }
    
            // XSS防护：清理搜索关键词
            String sanitizedKeyword = XssUtil.sanitize(keyword.trim());
            logger.info("开始搜索用户 - 关键词: {}", sanitizedKeyword);
            
            List<User> allUsers = userRepository.findAll();
            List<User> matchedUsers;
            
            // 判断是否是纯数字（可能是智穗号）
            if (sanitizedKeyword.matches("\\d+")) {
                Long zsNumber = Long.parseLong(sanitizedKeyword);
                // 优先精确匹配智穗号
                matchedUsers = allUsers.stream()
                        .filter(user -> {
                            // 精确匹配智穗号
                            if (user.getZsNumber() != null && user.getZsNumber().equals(zsNumber)) {
                                return true;
                            }
                            // 模糊匹配用户名或昵称
                            return (user.getUsername() != null && user.getUsername().toLowerCase().contains(sanitizedKeyword.toLowerCase())) ||
                                   (user.getNickname() != null && user.getNickname().toLowerCase().contains(sanitizedKeyword.toLowerCase()));
                        })
                        .collect(Collectors.toList());
            } else {
                // 搜索用户名或昵称包含关键词的用户
                matchedUsers = allUsers.stream()
                        .filter(user -> 
                            (user.getUsername() != null && user.getUsername().toLowerCase().contains(sanitizedKeyword.toLowerCase())) ||
                            (user.getNickname() != null && user.getNickname().toLowerCase().contains(sanitizedKeyword.toLowerCase()))
                        )
                        .collect(Collectors.toList());
            }
    
            logger.info("用户搜索完成 - 关键词: {}, 匹配用户数: {}", sanitizedKeyword, matchedUsers.size());
            LogUtil.logApiResponse(this.getClass(), "searchUsers", null, matchedUsers, System.currentTimeMillis() - startTime);
                
            return ResponseEntity.ok(matchedUsers);
        } catch (Exception e) {
            logger.error("搜索用户时发生错误 - 关键词: {}, 错误: {}", keyword, e.getMessage(), e);
            LogUtil.logError(this.getClass(), "searchUsers", null, "搜索用户失败: " + e.getMessage(), e);
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }

    @GetMapping("/{userId}")
    public ResponseEntity<?> getUserById(@PathVariable Long userId) {
        long startTime = System.currentTimeMillis();
        
        try {
            LogUtil.logApiRequest(this.getClass(), "getUserById", userId, userId, "unknown");
            
            User user = userRepository.findById(userId)
                    .orElseThrow(() -> new RuntimeException("用户不存在"));
            
            logger.info("获取用户信息成功 - 用户ID: {}", userId);
            LogUtil.logApiResponse(this.getClass(), "getUserById", userId, user, System.currentTimeMillis() - startTime);
            
            return ResponseEntity.ok(user);
        } catch (Exception e) {
            logger.error("获取用户信息失败 - 用户ID: {}, 错误: {}", userId, e.getMessage(), e);
            LogUtil.logError(this.getClass(), "getUserById", userId, "获取用户信息失败: " + e.getMessage(), e);
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }

    @PutMapping("/{userId}")
    public ResponseEntity<?> updateUser(@PathVariable Long userId, @RequestBody Map<String, Object> updates) {
        long startTime = System.currentTimeMillis();
        
        try {
            LogUtil.logApiRequest(this.getClass(), "updateUser", userId, updates, "unknown");
            
            User user = userRepository.findById(userId)
                    .orElseThrow(() -> new RuntimeException("用户不存在"));

            // 记录更新前的信息
            logger.info("开始更新用户信息 - 用户ID: {}, 更新字段: {}", userId, updates.keySet());
            
            // XSS防护：清理用户输入
            if (updates.containsKey("nickname")) {
                String oldNickname = user.getNickname();
                String newNickname = XssUtil.sanitize(updates.get("nickname").toString());
                user.setNickname(newNickname);
                logger.debug("更新用户昵称 - 用户ID: {}, 旧昵称: {}, 新昵称: {}", userId, oldNickname, newNickname);
            }
            if (updates.containsKey("bio")) {
                String oldBio = user.getBio();
                String newBio = XssUtil.sanitize(updates.get("bio").toString());
                user.setBio(newBio);
                logger.debug("更新用户简介 - 用户ID: {}, 旧简介: {}, 新简介: {}", userId, oldBio, newBio);
            }
            if (updates.containsKey("avatar")) {
                String oldAvatar = user.getAvatar();
                String newAvatar = XssUtil.sanitize(updates.get("avatar").toString());
                user.setAvatar(newAvatar);
                logger.debug("更新用户头像 - 用户ID: {}, 旧头像: {}, 新头像: {}", userId, oldAvatar, newAvatar);
            }

            User savedUser = userRepository.save(user);
            logger.info("用户信息更新成功 - 用户ID: {}", userId);
            LogUtil.logApiResponse(this.getClass(), "updateUser", userId, savedUser, System.currentTimeMillis() - startTime);
            
            return ResponseEntity.ok(savedUser);
        } catch (Exception e) {
            logger.error("更新用户信息失败 - 用户ID: {}, 错误: {}", userId, e.getMessage(), e);
            LogUtil.logError(this.getClass(), "updateUser", userId, "更新用户信息失败: " + e.getMessage(), e);
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }

    /**
     * 上传用户头像
     */
    @PostMapping("/{userId}/avatar")
    public ResponseEntity<?> uploadAvatar(@PathVariable Long userId,
                                         @RequestParam("file") MultipartFile file) {
        long startTime = System.currentTimeMillis();
        
        try {
            LogUtil.logApiRequest(this.getClass(), "uploadAvatar", userId, "file upload", "unknown");
            
            // 验证用户存在
            User user = userRepository.findById(userId)
                    .orElseThrow(() -> new RuntimeException("用户不存在"));
            
            logger.info("开始上传头像 - 用户ID: {}, 原始文件名: {}", userId, file.getOriginalFilename());

            // 验证文件
            if (file.isEmpty()) {
                Map<String, String> error = new HashMap<>();
                error.put("error", "请选择要上传的头像");
                logger.warn("头像上传失败 - 用户ID: {}, 原因: 未选择文件", userId);
                LogUtil.logError(this.getClass(), "uploadAvatar", userId, "未选择文件", null);
                return ResponseEntity.badRequest().body(error);
            }

            // 验证文件类型
            String contentType = file.getContentType();
            if (contentType == null || !contentType.startsWith("image/")) {
                Map<String, String> error = new HashMap<>();
                error.put("error", "只能上传图片文件");
                logger.warn("头像上传失败 - 用户ID: {}, 原因: 文件类型不支持, Content-Type: {}", userId, contentType);
                LogUtil.logError(this.getClass(), "uploadAvatar", userId, "文件类型不支持", null);
                return ResponseEntity.badRequest().body(error);
            }

            // 验证文件大小（5MB）
            if (file.getSize() > 5 * 1024 * 1024) {
                Map<String, String> error = new HashMap<>();
                error.put("error", "头像文件大小不能超过5MB");
                logger.warn("头像上传失败 - 用户ID: {}, 原因: 文件过大, 大小: {} bytes", userId, file.getSize());
                LogUtil.logError(this.getClass(), "uploadAvatar", userId, "文件过大", null);
                return ResponseEntity.badRequest().body(error);
            }

            // 创建上传目录
            File uploadDir = new File(AVATAR_UPLOAD_DIR);
            if (!uploadDir.exists()) {
                uploadDir.mkdirs();
                logger.info("创建头像上传目录: {}", AVATAR_UPLOAD_DIR);
            }

            // 生成唯一文件名
            String originalFilename = file.getOriginalFilename();
            String fileExtension = "";
            if (originalFilename != null && originalFilename.contains(".")) {
                fileExtension = originalFilename.substring(originalFilename.lastIndexOf("."));
            }
            String newFilename = UUID.randomUUID().toString() + fileExtension;
            Path filePath = Paths.get(AVATAR_UPLOAD_DIR + newFilename);
            
            logger.debug("生成新文件名 - 用户ID: {}, 原文件名: {}, 新文件名: {}", userId, originalFilename, newFilename);

            // 删除旧头像文件（如果存在）
            if (user.getAvatar() != null && !user.getAvatar().isEmpty()) {
                String oldAvatarPath = user.getAvatar();
                if (oldAvatarPath.startsWith("/api/avatars/")) {
                    String oldFilename = oldAvatarPath.substring("/api/avatars/".length());
                    File oldFile = new File(AVATAR_UPLOAD_DIR + oldFilename);
                    if (oldFile.exists()) {
                        boolean deleted = oldFile.delete();
                        logger.info("删除旧头像文件 - 用户ID: {}, 文件名: {}, 删除结果: {}", userId, oldFilename, deleted);
                    }
                }
            }

            // 保存文件
            Files.write(filePath, file.getBytes());
            logger.info("保存新头像文件 - 用户ID: {}, 文件路径: {}", userId, filePath.toString());

            // 更新用户头像 URL
            String avatarUrl = "/api/avatars/" + newFilename;
            String oldAvatar = user.getAvatar();
            user.setAvatar(avatarUrl);
            userRepository.save(user);
            
            logger.info("更新用户头像信息 - 用户ID: {}, 旧头像: {}, 新头像: {}", userId, oldAvatar, avatarUrl);

            // 返回结果
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("avatarUrl", avatarUrl);
            response.put("message", "头像上传成功");
            
            logger.info("头像上传成功 - 用户ID: {}, 新头像URL: {}", userId, avatarUrl);
            LogUtil.logApiResponse(this.getClass(), "uploadAvatar", userId, response, System.currentTimeMillis() - startTime);
            
            return ResponseEntity.ok(response);

        } catch (IOException e) {
            logger.error("头像上传IO异常 - 用户ID: {}, 错误: {}", userId, e.getMessage(), e);
            LogUtil.logError(this.getClass(), "uploadAvatar", userId, "文件上传IO异常: " + e.getMessage(), e);
            Map<String, String> error = new HashMap<>();
            error.put("error", "文件上传失败: " + e.getMessage());
            return ResponseEntity.status(500).body(error);
        } catch (Exception e) {
            logger.error("头像上传异常 - 用户ID: {}, 错误: {}", userId, e.getMessage(), e);
            LogUtil.logError(this.getClass(), "uploadAvatar", userId, "头像上传异常: " + e.getMessage(), e);
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }

    /**
     * 根据智穗号获取用户信息
     */
    @GetMapping("/smartcode/{smartCode}")
    public ResponseEntity<?> getUserBySmartCode(@PathVariable String smartCode) {
        long startTime = System.currentTimeMillis();
        
        try {
            LogUtil.logApiRequest(this.getClass(), "getUserBySmartCode", null, smartCode, "unknown");
            
            if (smartCode == null || smartCode.trim().isEmpty()) {
                Map<String, String> error = new HashMap<>();
                error.put("error", "智穗号不能为空");
                logger.warn("智穗号为空");
                LogUtil.logError(this.getClass(), "getUserBySmartCode", null, "智穗号为空", null);
                return ResponseEntity.badRequest().body(error);
            }
    
            // XSS防护：清理智穗号
            String sanitizedSmartCode = XssUtil.sanitize(smartCode.trim());
            logger.info("开始查找用户 - 智穗号: {}", sanitizedSmartCode);
            
            // 智穗号是数字类型，所以需要转换
            Long zsNumber;
            try {
                zsNumber = Long.parseLong(sanitizedSmartCode);
            } catch (NumberFormatException e) {
                Map<String, String> error = new HashMap<>();
                error.put("error", "智穗号格式不正确");
                logger.warn("智穗号格式不正确 - 智穗号: {}", sanitizedSmartCode);
                LogUtil.logError(this.getClass(), "getUserBySmartCode", null, "智穗号格式不正确", e);
                return ResponseEntity.badRequest().body(error);
            }
            
            // 在所有用户中查找匹配的智穗号
            List<User> allUsers = userRepository.findAll();
            User matchedUser = allUsers.stream()
                    .filter(user -> user.getZsNumber() != null && user.getZsNumber().equals(zsNumber))
                    .findFirst()
                    .orElse(null);
            
            if (matchedUser == null) {
                logger.info("未找到匹配的用户 - 智穗号: {}", zsNumber);
                return ResponseEntity.notFound().build();
            }
            
            logger.info("获取用户信息成功 - 智穗号: {}, 用户ID: {}", zsNumber, matchedUser.getId());
            LogUtil.logApiResponse(this.getClass(), "getUserBySmartCode", matchedUser.getId(), matchedUser, System.currentTimeMillis() - startTime);
            
            return ResponseEntity.ok(matchedUser);
        } catch (Exception e) {
            logger.error("根据智穗号获取用户信息时发生错误 - 智穗号: {}, 错误: {}", smartCode, e.getMessage(), e);
            LogUtil.logError(this.getClass(), "getUserBySmartCode", null, "根据智穗号获取用户信息失败: " + e.getMessage(), e);
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }
}
