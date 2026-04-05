package com.chatapp.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import org.springframework.stereotype.Controller;

import java.util.Map;

/**
 * WebRTC 信令控制器
 * 处理 WebRTC 连接所需的信令消息（SDP offer/answer 和 ICE candidates）
 */
@Controller
@RequiredArgsConstructor
@Slf4j
public class WebRTCSignalingController {

    private final SimpMessagingTemplate messagingTemplate;

    /**
     * 处理通话邀请
     * 当用户发起通话时，将邀请发送给目标用户
     */
    @MessageMapping("/call/invite")
    public void handleCallInvite(@Payload Map<String, Object> payload) {
        Integer targetUserIdInt = (Integer) payload.get("targetUserId");
        Long targetUserId = targetUserIdInt != null ? targetUserIdInt.longValue() : null;
        log.info("Call invite from {} to {}", payload.get("callerId"), targetUserId);
        
        // 转发给目标用户 - 直接发送到用户订阅的路径
        messagingTemplate.convertAndSend("/user/" + targetUserId + "/queue/call", payload);
    }

    /**
     * 处理通话应答（接受/拒绝）
     */
    @MessageMapping("/call/answer")
    public void handleCallAnswer(@Payload Map<String, Object> payload) {
        Integer targetUserIdInt = (Integer) payload.get("targetUserId");
        Long targetUserId = targetUserIdInt != null ? targetUserIdInt.longValue() : null;
        log.info("Call answer to {}: accepted={}", targetUserId, payload.get("accepted"));
        
        // 转发给发起方
        messagingTemplate.convertAndSend("/user/" + targetUserId + "/queue/call", payload);
    }

    /**
     * 处理 SDP Offer
     * 发起方创建 offer 后发送给接收方
     */
    @MessageMapping("/call/offer")
    public void handleOffer(@Payload Map<String, Object> payload) {
        Integer targetUserIdInt = (Integer) payload.get("targetUserId");
        Long targetUserId = targetUserIdInt != null ? targetUserIdInt.longValue() : null;
        log.info("SDP offer from {} to {}", payload.get("callerId"), targetUserId);
        
        // 转发 SDP offer 给目标用户
        messagingTemplate.convertAndSend("/user/" + targetUserId + "/queue/call", payload);
    }

    /**
     * 处理 SDP Answer
     * 接收方创建 answer 后发送给发起方
     */
    @MessageMapping("/call/sdp-answer")
    public void handleAnswer(@Payload Map<String, Object> payload) {
        Integer targetUserIdInt = (Integer) payload.get("targetUserId");
        Long targetUserId = targetUserIdInt != null ? targetUserIdInt.longValue() : null;
        log.info("SDP answer from {} to {}", payload.get("callerId"), targetUserId);
        
        // 转发 SDP answer 给目标用户
        messagingTemplate.convertAndSend("/user/" + targetUserId + "/queue/call", payload);
    }

    /**
     * 处理 ICE Candidate
     * 双方交换 ICE candidates 用于建立 P2P 连接
     */
    @MessageMapping("/call/ice-candidate")
    public void handleIceCandidate(@Payload Map<String, Object> payload) {
        Integer targetUserIdInt = (Integer) payload.get("targetUserId");
        Long targetUserId = targetUserIdInt != null ? targetUserIdInt.longValue() : null;
        log.debug("ICE candidate from {} to {}", payload.get("callerId"), targetUserId);
        
        // 转发 ICE candidate 给目标用户
        messagingTemplate.convertAndSend("/user/" + targetUserId + "/queue/call", payload);
    }

    /**
     * 处理挂断通话
     */
    @MessageMapping("/call/hangup")
    public void handleHangup(@Payload Map<String, Object> payload) {
        Integer targetUserIdInt = (Integer) payload.get("targetUserId");
        Long targetUserId = targetUserIdInt != null ? targetUserIdInt.longValue() : null;
        log.info("Call hangup from {} to {}", payload.get("callerId"), targetUserId);
        
        // 通知对方通话已结束
        messagingTemplate.convertAndSend("/user/" + targetUserId + "/queue/call", payload);
    }

    /**
     * 处理媒体状态变化（静音、关闭摄像头等）
     */
    @MessageMapping("/call/media-state")
    public void handleMediaState(@Payload Map<String, Object> payload) {
        Integer targetUserIdInt = (Integer) payload.get("targetUserId");
        Long targetUserId = targetUserIdInt != null ? targetUserIdInt.longValue() : null;
        log.debug("Media state change from {} to {}", payload.get("callerId"), targetUserId);
        
        // 转发媒体状态给对方
        messagingTemplate.convertAndSend("/user/" + targetUserId + "/queue/call", payload);
    }
}
