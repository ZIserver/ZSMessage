package com.chatapp.controller;

import com.chatapp.entity.Call;
import com.chatapp.service.CallService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/calls")
@RequiredArgsConstructor
public class CallController {
    
    private final CallService callService;
    private final SimpMessagingTemplate messagingTemplate;

    @PostMapping("/initiate")
    public ResponseEntity<?> initiateCall(@RequestBody Map<String, Object> request) {
        try {
            Integer callerIdInt = (Integer) request.get("callerId");
            Integer receiverIdInt = (Integer) request.get("receiverId");
            Long callerId = callerIdInt != null ? callerIdInt.longValue() : null;
            Long receiverId = receiverIdInt != null ? receiverIdInt.longValue() : null;
            String callType = request.get("callType").toString();

            Call call = callService.initiateCall(callerId, receiverId, callType);
            
            // 通过 WebSocket 通知接收方
            messagingTemplate.convertAndSend("/user/" + receiverId + "/queue/calls", call);
            
            return ResponseEntity.ok(call);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }

    @PostMapping("/accept/{callId}")
    public ResponseEntity<?> acceptCall(@PathVariable Long callId,
                                       @RequestBody Map<String, Object> request) {
        try {
            Integer userIdInt = (Integer) request.get("userId");
            Long userId = userIdInt != null ? userIdInt.longValue() : null;
            Call call = callService.acceptCall(callId, userId);
            
            // 通知发起方
            messagingTemplate.convertAndSend("/user/" + call.getCallerId() + "/queue/calls", call);
            
            return ResponseEntity.ok(call);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }

    @PostMapping("/reject/{callId}")
    public ResponseEntity<?> rejectCall(@PathVariable Long callId,
                                       @RequestBody Map<String, Object> request) {
        try {
            Integer userIdInt = (Integer) request.get("userId");
            Long userId = userIdInt != null ? userIdInt.longValue() : null;
            callService.rejectCall(callId, userId);
            
            Call call = callService.getCallById(callId);
            // 通知发起方
            messagingTemplate.convertAndSend("/user/" + call.getCallerId() + "/queue/calls", call);
            
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }

    @PostMapping("/end/{callId}")
    public ResponseEntity<?> endCall(@PathVariable Long callId,
                                    @RequestBody Map<String, Object> request) {
        try {
            Integer userIdInt = (Integer) request.get("userId");
            Long userId = userIdInt != null ? userIdInt.longValue() : null;
            callService.endCall(callId, userId);
            
            Call call = callService.getCallById(callId);
            // 通知双方
            messagingTemplate.convertAndSend("/user/" + call.getCallerId() + "/queue/calls", call);
            messagingTemplate.convertAndSend("/user/" + call.getReceiverId() + "/queue/calls", call);
            
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }

    @GetMapping("/history/{userId}")
    public ResponseEntity<?> getCallHistory(@PathVariable Long userId) {
        try {
            List<Call> calls = callService.getCallHistory(userId);
            return ResponseEntity.ok(calls);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }

    @GetMapping("/{callId}")
    public ResponseEntity<?> getCallById(@PathVariable Long callId) {
        try {
            Call call = callService.getCallById(callId);
            return ResponseEntity.ok(call);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }
}
