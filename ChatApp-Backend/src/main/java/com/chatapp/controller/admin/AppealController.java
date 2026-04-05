package com.chatapp.controller.admin;

import com.chatapp.entity.Appeal;
import com.chatapp.service.UserManagementService;
import com.chatapp.util.XssUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/appeals")
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
public class AppealController {

    private final UserManagementService userManagementService;

    /**
     * 获取申诉列表
     */
    @GetMapping
    public ResponseEntity<?> getAppeals(@RequestParam(required = false) String status) {
        try {
            List<Appeal> appeals = userManagementService.getAppeals(status);
            
            Map<String, Object> response = new HashMap<>();
            response.put("appeals", appeals);
            response.put("total", appeals.size());
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }

    /**
     * 处理申诉
     */
    @PostMapping("/{appealId}/process")
    public ResponseEntity<?> processAppeal(
            @PathVariable Long appealId,
            @RequestBody Map<String, Object> request) {
        try {
            String status = (String) request.get("status");
            String adminResponse = (String) request.get("adminResponse");
            Object adminIdObj = request.get("adminId");
            Long adminId = null;
            if (adminIdObj != null) {
                if (adminIdObj instanceof Integer) {
                    adminId = ((Integer) adminIdObj).longValue();
                } else if (adminIdObj instanceof Long) {
                    adminId = (Long) adminIdObj;
                } else if (adminIdObj instanceof String) {
                    try {
                        adminId = Long.parseLong((String) adminIdObj);
                    } catch (NumberFormatException e) {
                        Map<String, String> error = new HashMap<>();
                        error.put("error", "管理员ID格式不正确");
                        return ResponseEntity.badRequest().body(error);
                    }
                }
            }
            
            // 验证状态参数
            if (status == null || (!"APPROVED".equals(status) && !"REJECTED".equals(status))) {
                Map<String, String> error = new HashMap<>();
                error.put("error", "状态必须是 APPROVED 或 REJECTED");
                return ResponseEntity.badRequest().body(error);
            }
            
            // XSS过滤
            if (adminResponse != null) {
                adminResponse = XssUtil.sanitize(adminResponse);
            }
            
            Appeal appeal = userManagementService.processAppeal(appealId, status, adminResponse, adminId);
            
            Map<String, Object> response = new HashMap<>();
            response.put("message", "申诉处理成功");
            response.put("appeal", appeal);
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }
}