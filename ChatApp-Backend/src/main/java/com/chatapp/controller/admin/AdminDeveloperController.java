package com.chatapp.controller.admin;

import com.chatapp.entity.Developer;
import com.chatapp.repository.DeveloperRepository;
import com.chatapp.util.CryptoUtil;
import com.chatapp.util.XssUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

/**
 * 管理员 - 开发者管理控制器
 */
@RestController
@RequestMapping("/api/admin/developers")
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
@Slf4j
public class AdminDeveloperController {
    
    private final DeveloperRepository developerRepository;
    
    /**
     * 分页查询所有开发者
     */
    @GetMapping("/list")
    public ResponseEntity<?> getDevelopers(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Boolean verified) {
        try {
            Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
            Page<Developer> developers;
            
            // 构建查询条件
            if (keyword != null && !keyword.trim().isEmpty()) {
                String safeKeyword = XssUtil.sanitize(keyword.trim());
                
                // 支持按用户名、昵称、真实姓名搜索
                if (status != null && !status.isEmpty()) {
                    if (verified != null) {
                        developers = developerRepository.findByUsernameContainingOrNicknameContainingOrRealNameContainingAndStatusAndVerified(
                            safeKeyword, safeKeyword, safeKeyword, status, verified, pageable);
                    } else {
                        developers = developerRepository.findByUsernameContainingOrNicknameContainingOrRealNameContainingAndStatus(
                            safeKeyword, safeKeyword, safeKeyword, status, pageable);
                    }
                } else if (verified != null) {
                    developers = developerRepository.findByUsernameContainingOrNicknameContainingOrRealNameContainingAndVerified(
                        safeKeyword, safeKeyword, safeKeyword, verified, pageable);
                } else {
                    developers = developerRepository.findByUsernameContainingOrNicknameContainingOrRealNameContaining(
                        safeKeyword, safeKeyword, safeKeyword, pageable);
                }
            } else {
                // 无关键词，按状态和认证状态筛选
                if (status != null && !status.isEmpty()) {
                    if (verified != null) {
                        developers = developerRepository.findByStatusAndVerified(status, verified, pageable);
                    } else {
                        developers = developerRepository.findByStatus(status, pageable);
                    }
                } else if (verified != null) {
                    developers = developerRepository.findByVerified(verified, pageable);
                } else {
                    developers = developerRepository.findAll(pageable);
                }
            }
            
            // 解密所有开发者的身份证号
            developers.forEach(developer -> {
                if (developer.getIdCard() != null) {
                    String decryptedIdCard = CryptoUtil.decryptIdCard(developer.getIdCard());
                    developer.setIdCard(decryptedIdCard);
                }
            });
            
            Map<String, Object> response = new HashMap<>();
            response.put("developers", developers.getContent());
            response.put("totalPages", developers.getTotalPages());
            response.put("totalElements", developers.getTotalElements());
            response.put("currentPage", page);
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("[管理员] 查询开发者列表失败: {}", e.getMessage(), e);
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }
    
    /**
     * 根据ID查询开发者详情
     */
    @GetMapping("/{developerId}")
    public ResponseEntity<?> getDeveloperDetail(@PathVariable Long developerId) {
        try {
            Optional<Developer> developerOpt = developerRepository.findById(developerId);
            if (!developerOpt.isPresent()) {
                Map<String, String> error = new HashMap<>();
                error.put("error", "开发者不存在");
                return ResponseEntity.badRequest().body(error);
            }
            
            Developer developer = developerOpt.get();
            
            // 构建响应数据，包含解密后的身份证号
            Map<String, Object> response = new HashMap<>();
            response.put("id", developer.getId());
            response.put("userId", developer.getUserId());
            response.put("username", developer.getUsername());
            response.put("nickname", developer.getNickname());
            response.put("avatarUrl", developer.getAvatarUrl());
            response.put("realName", developer.getRealName());
            response.put("verified", developer.getVerified());
            response.put("verifiedAt", developer.getVerifiedAt());
            response.put("status", developer.getStatus());
            response.put("createdAt", developer.getCreatedAt());
            response.put("updatedAt", developer.getUpdatedAt());
            
            // 解密身份证号（仅管理员可见）
            if (developer.getIdCard() != null) {
                String decryptedIdCard = CryptoUtil.decryptIdCard(developer.getIdCard());
                response.put("idCard", decryptedIdCard);
                response.put("idCardLast4", developer.getIdCardLast4());
            } else {
                response.put("idCard", null);
                response.put("idCardLast4", null);
            }
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("[管理员] 查询开发者详情失败: {}", e.getMessage(), e);
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }
    
    /**
     * 更新开发者状态
     */
    @PutMapping("/{developerId}/status")
    public ResponseEntity<?> updateDeveloperStatus(
            @PathVariable Long developerId,
            @RequestBody Map<String, String> request) {
        try {
            Optional<Developer> developerOpt = developerRepository.findById(developerId);
            if (!developerOpt.isPresent()) {
                Map<String, String> error = new HashMap<>();
                error.put("error", "开发者不存在");
                return ResponseEntity.badRequest().body(error);
            }
            
            String newStatus = request.get("status");
            if (newStatus == null || newStatus.trim().isEmpty()) {
                Map<String, String> error = new HashMap<>();
                error.put("error", "状态不能为空");
                return ResponseEntity.badRequest().body(error);
            }
            
            // 验证状态值
            if (!newStatus.equals("ACTIVE") && !newStatus.equals("DISABLED") && !newStatus.equals("BANNED")) {
                Map<String, String> error = new HashMap<>();
                error.put("error", "无效的状态值");
                return ResponseEntity.badRequest().body(error);
            }
            
            Developer developer = developerOpt.get();
            String oldStatus = developer.getStatus();
            developer.setStatus(newStatus);
            
            // 如果被禁用或封禁，清除Token
            if (!newStatus.equals("ACTIVE")) {
                developer.setDeveloperToken(null);
                developer.setTokenExpiresAt(null);
            }
            
            developerRepository.save(developer);
            
            log.info("[管理员] 开发者状态已更新 - developerId: {}, {} -> {}", 
                    developerId, oldStatus, newStatus);
            
            Map<String, Object> response = new HashMap<>();
            response.put("message", "状态更新成功");
            response.put("developer", developer);
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("[管理员] 更新开发者状态失败: {}", e.getMessage(), e);
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }
    
    /**
     * 审核实名认证
     */
    @PostMapping("/{developerId}/verify")
    public ResponseEntity<?> verifyDeveloper(
            @PathVariable Long developerId,
            @RequestBody Map<String, Object> request) {
        try {
            Optional<Developer> developerOpt = developerRepository.findById(developerId);
            if (!developerOpt.isPresent()) {
                Map<String, String> error = new HashMap<>();
                error.put("error", "开发者不存在");
                return ResponseEntity.badRequest().body(error);
            }
            
            Boolean approved = (Boolean) request.get("approved");
            if (approved == null) {
                Map<String, String> error = new HashMap<>();
                error.put("error", "请指定是否通过审核");
                return ResponseEntity.badRequest().body(error);
            }
            
            Developer developer = developerOpt.get();
            
            if (approved) {
                // 通过审核
                if (developer.getRealName() == null || developer.getIdCard() == null) {
                    Map<String, String> error = new HashMap<>();
                    error.put("error", "开发者尚未提交实名认证信息");
                    return ResponseEntity.badRequest().body(error);
                }
                
                developer.setVerified(true);
                developer.setVerifiedAt(LocalDateTime.now());
                log.info("[管理员] 开发者实名认证已通过 - developerId: {}, realName: {}", 
                        developerId, developer.getRealName());
            } else {
                // 拒绝审核，清除认证信息
                developer.setVerified(false);
                developer.setVerifiedAt(null);
                developer.setRealName(null);
                developer.setIdCard(null);
                developer.setIdCardLast4(null);
                log.info("[管理员] 开发者实名认证已拒绝 - developerId: {}", developerId);
            }
            
            developerRepository.save(developer);
            
            Map<String, Object> response = new HashMap<>();
            response.put("message", approved ? "认证审核通过" : "认证审核已拒绝");
            response.put("developer", developer);
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("[管理员] 审核开发者认证失败: {}", e.getMessage(), e);
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }
    
    /**
     * 删除开发者
     */
    @DeleteMapping("/{developerId}")
    public ResponseEntity<?> deleteDeveloper(@PathVariable Long developerId) {
        try {
            if (!developerRepository.existsById(developerId)) {
                Map<String, String> error = new HashMap<>();
                error.put("error", "开发者不存在");
                return ResponseEntity.badRequest().body(error);
            }
            
            // 注意：这里应该考虑是否级联删除开发者的OAuth应用
            // 目前仅删除开发者账户
            developerRepository.deleteById(developerId);
            
            log.info("[管理员] 开发者已删除 - developerId: {}", developerId);
            
            Map<String, String> response = new HashMap<>();
            response.put("message", "开发者删除成功");
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("[管理员] 删除开发者失败: {}", e.getMessage(), e);
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }
    
    /**
     * 获取开发者统计信息
     */
    @GetMapping("/statistics")
    public ResponseEntity<?> getStatistics() {
        try {
            long totalDevelopers = developerRepository.count();
            long verifiedDevelopers = developerRepository.countByVerified(true);
            long activeDevelopers = developerRepository.countByStatus("ACTIVE");
            long disabledDevelopers = developerRepository.countByStatus("DISABLED");
            long bannedDevelopers = developerRepository.countByStatus("BANNED");
            
            Map<String, Object> stats = new HashMap<>();
            stats.put("totalDevelopers", totalDevelopers);
            stats.put("verifiedDevelopers", verifiedDevelopers);
            stats.put("unverifiedDevelopers", totalDevelopers - verifiedDevelopers);
            stats.put("activeDevelopers", activeDevelopers);
            stats.put("disabledDevelopers", disabledDevelopers);
            stats.put("bannedDevelopers", bannedDevelopers);
            
            return ResponseEntity.ok(stats);
        } catch (Exception e) {
            log.error("[管理员] 获取开发者统计信息失败: {}", e.getMessage(), e);
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }
}
