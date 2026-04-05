package com.chatapp.controller;

import com.chatapp.entity.Appeal;
import com.chatapp.service.UserManagementService;
import com.chatapp.util.XssUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/appeals")
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
public class UserAppealController {

    private final UserManagementService userManagementService;

    /**
     * 提交申诉
     */
    @PostMapping("/submit")
    public ResponseEntity<?> submitAppeal(@RequestBody Map<String, Object> request) {
        try {
            String username = (String) request.get("username");
            Object zsNumberObj = request.get("zsNumber");
            Long zsNumber = null;
            if (zsNumberObj != null) {
                if (zsNumberObj instanceof Integer) {
                    zsNumber = ((Integer) zsNumberObj).longValue();
                } else if (zsNumberObj instanceof Long) {
                    zsNumber = (Long) zsNumberObj;
                } else if (zsNumberObj instanceof String) {
                    try {
                        zsNumber = Long.parseLong((String) zsNumberObj);
                    } catch (NumberFormatException e) {
                        Map<String, String> error = new HashMap<>();
                        error.put("error", "智穗号格式不正确");
                        return ResponseEntity.badRequest().body(error);
                    }
                }
            }
            String reason = (String) request.get("reason");

            // 验证必填参数
            if (username == null || username.trim().isEmpty()) {
                Map<String, String> error = new HashMap<>();
                error.put("error", "用户名不能为空");
                return ResponseEntity.badRequest().body(error);
            }

            if (reason == null || reason.trim().isEmpty()) {
                Map<String, String> error = new HashMap<>();
                error.put("error", "申诉理由不能为空");
                return ResponseEntity.badRequest().body(error);
            }

            // XSS过滤
            username = XssUtil.sanitize(username);
            reason = XssUtil.sanitize(reason);

            // 提交申诉
            Appeal appeal = userManagementService.submitAppeal(username, zsNumber, reason);

            Map<String, Object> response = new HashMap<>();
            response.put("message", "申诉提交成功");
            response.put("appealId", appeal.getId());

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }
}