package com.chatapp.controller;

import com.chatapp.entity.Call;
import com.chatapp.service.CallService;
import lombok.RequiredArgsConstructor;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * WebRTC 配置和会话管理控制器
 */
@RestController
@RequestMapping("/api/webrtc")
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
@Slf4j
public class WebRTCController {

    private final CallService callService;
    
    // 活跃通话会话存储 (callId -> 会话信息)
    private final Map<String, CallSession> activeSessions = new ConcurrentHashMap<>();
    
    // TURN 服务器配置 (可从配置文件读取)
    @Value("${webrtc.turn.url:}")
    private String turnUrl;
    
    @Value("${webrtc.turn.username:}")
    private String turnUsername;
    
    @Value("${webrtc.turn.credential:}")
    private String turnCredential;

    /**
     * 获取 ICE 服务器配置
     * 客户端在发起通话前调用此接口获取 STUN/TURN 服务器列表
     */
    @GetMapping("/ice-servers")
    public ResponseEntity<?> getIceServers() {
        List<Map<String, Object>> iceServers = new ArrayList<>();
        
        // Google 公共 STUN 服务器
        iceServers.add(Map.of("urls", "stun:stun.l.google.com:19302"));
        iceServers.add(Map.of("urls", "stun:stun1.l.google.com:19302"));
        iceServers.add(Map.of("urls", "stun:stun2.l.google.com:19302"));
        iceServers.add(Map.of("urls", "stun:stun3.l.google.com:19302"));
        iceServers.add(Map.of("urls", "stun:stun4.l.google.com:19302"));
        
        // 如果配置了 TURN 服务器，添加到列表
        if (turnUrl != null && !turnUrl.isEmpty()) {
            Map<String, Object> turnServer = new HashMap<>();
            turnServer.put("urls", turnUrl);
            if (turnUsername != null && !turnUsername.isEmpty()) {
                turnServer.put("username", turnUsername);
                turnServer.put("credential", turnCredential);
            }
            iceServers.add(turnServer);
        }
        
        Map<String, Object> response = new HashMap<>();
        response.put("iceServers", iceServers);
        response.put("iceTransportPolicy", "all"); // "all" 或 "relay"
        
        return ResponseEntity.ok(response);
    }

    /**
     * 创建通话会话
     */
    @PostMapping("/sessions")
    public ResponseEntity<?> createSession(@RequestBody Map<String, Object> request) {
        try {
            Integer callerIdInt = (Integer) request.get("callerId");
            Integer receiverIdInt = (Integer) request.get("receiverId");
            Long callerId = callerIdInt != null ? callerIdInt.longValue() : null;
            Long receiverId = receiverIdInt != null ? receiverIdInt.longValue() : null;
            String callType = request.getOrDefault("callType", "video").toString();
            
            // 创建数据库通话记录
            Call call = callService.initiateCall(callerId, receiverId, callType.toUpperCase());
            
            // 创建会话
            String sessionId = UUID.randomUUID().toString();
            CallSession session = new CallSession();
            session.setSessionId(sessionId);
            session.setCallId(call.getId());
            session.setCallerId(callerId);
            session.setReceiverId(receiverId);
            session.setCallType(callType);
            session.setStatus("PENDING");
            session.setCreatedAt(System.currentTimeMillis());
            
            activeSessions.put(sessionId, session);
            
            log.info("Created WebRTC session: {} for call: {}", sessionId, call.getId());
            
            Map<String, Object> response = new HashMap<>();
            response.put("sessionId", sessionId);
            response.put("callId", call.getId());
            response.put("status", "PENDING");
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Failed to create session", e);
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * 获取会话状态
     */
    @GetMapping("/sessions/{sessionId}")
    public ResponseEntity<?> getSession(@PathVariable String sessionId) {
        CallSession session = activeSessions.get(sessionId);
        
        if (session == null) {
            return ResponseEntity.notFound().build();
        }
        
        return ResponseEntity.ok(session.toMap());
    }

    /**
     * 更新会话状态
     */
    @PutMapping("/sessions/{sessionId}")
    public ResponseEntity<?> updateSession(
            @PathVariable String sessionId,
            @RequestBody Map<String, Object> request) {
        
        CallSession session = activeSessions.get(sessionId);
        
        if (session == null) {
            return ResponseEntity.notFound().build();
        }
        
        String status = request.getOrDefault("status", session.getStatus()).toString();
        session.setStatus(status);
        
        // 如果状态变为 CONNECTED，记录连接时间
        if ("CONNECTED".equals(status) && session.getConnectedAt() == null) {
            session.setConnectedAt(System.currentTimeMillis());
            
            // 更新数据库中的通话状态
            try {
                callService.acceptCall(session.getCallId(), session.getReceiverId());
            } catch (Exception e) {
                log.warn("Failed to update call status in DB", e);
            }
        }
        
        // 如果状态变为 ENDED，清理会话
        if ("ENDED".equals(status)) {
            session.setEndedAt(System.currentTimeMillis());
            
            // 更新数据库中的通话状态
            try {
                callService.endCall(session.getCallId(), session.getCallerId());
            } catch (Exception e) {
                log.warn("Failed to end call in DB", e);
            }
            
            // 延迟清理会话
            new Thread(() -> {
                try {
                    Thread.sleep(30000); // 30秒后清理
                    activeSessions.remove(sessionId);
                    log.info("Cleaned up session: {}", sessionId);
                } catch (InterruptedException ignored) {}
            }).start();
        }
        
        log.info("Updated session {} status to {}", sessionId, status);
        
        return ResponseEntity.ok(session.toMap());
    }

    /**
     * 结束会话
     */
    @DeleteMapping("/sessions/{sessionId}")
    public ResponseEntity<?> endSession(@PathVariable String sessionId) {
        CallSession session = activeSessions.get(sessionId);
        
        if (session == null) {
            return ResponseEntity.notFound().build();
        }
        
        session.setStatus("ENDED");
        session.setEndedAt(System.currentTimeMillis());
        
        // 更新数据库
        try {
            callService.endCall(session.getCallId(), session.getCallerId());
        } catch (Exception e) {
            log.warn("Failed to end call in DB", e);
        }
        
        activeSessions.remove(sessionId);
        
        log.info("Ended session: {}", sessionId);
        
        return ResponseEntity.ok(Map.of("status", "ENDED"));
    }

    /**
     * 获取用户的活跃通话
     */
    @GetMapping("/active-call/{userId}")
    public ResponseEntity<?> getActiveCall(@PathVariable Long userId) {
        for (CallSession session : activeSessions.values()) {
            if ((session.getCallerId().equals(userId) || session.getReceiverId().equals(userId))
                    && !"ENDED".equals(session.getStatus())) {
                return ResponseEntity.ok(session.toMap());
            }
        }
        
        return ResponseEntity.ok(Map.of("hasActiveCall", false));
    }

    /**
     * 通话会话内部类
     */
    private static class CallSession {
        private String sessionId;
        private Long callId;
        private Long callerId;
        private Long receiverId;
        private String callType;
        private String status;
        private Long createdAt;
        private Long connectedAt;
        private Long endedAt;
        
        // Getters and Setters
        public String getSessionId() { return sessionId; }
        public void setSessionId(String sessionId) { this.sessionId = sessionId; }
        
        public Long getCallId() { return callId; }
        public void setCallId(Long callId) { this.callId = callId; }
        
        public Long getCallerId() { return callerId; }
        public void setCallerId(Long callerId) { this.callerId = callerId; }
        
        public Long getReceiverId() { return receiverId; }
        public void setReceiverId(Long receiverId) { this.receiverId = receiverId; }
        
        public String getCallType() { return callType; }
        public void setCallType(String callType) { this.callType = callType; }
        
        public String getStatus() { return status; }
        public void setStatus(String status) { this.status = status; }
        
        public Long getCreatedAt() { return createdAt; }
        public void setCreatedAt(Long createdAt) { this.createdAt = createdAt; }
        
        public Long getConnectedAt() { return connectedAt; }
        public void setConnectedAt(Long connectedAt) { this.connectedAt = connectedAt; }
        
        public Long getEndedAt() { return endedAt; }
        public void setEndedAt(Long endedAt) { this.endedAt = endedAt; }
        
        public Map<String, Object> toMap() {
            Map<String, Object> map = new HashMap<>();
            map.put("sessionId", sessionId);
            map.put("callId", callId);
            map.put("callerId", callerId);
            map.put("receiverId", receiverId);
            map.put("callType", callType);
            map.put("status", status);
            map.put("createdAt", createdAt);
            map.put("connectedAt", connectedAt);
            map.put("endedAt", endedAt);
            if (connectedAt != null && endedAt != null) {
                map.put("duration", (endedAt - connectedAt) / 1000);
            }
            return map;
        }
    }
}
