package com.chatapp.service;

import com.chatapp.entity.Call;
import com.chatapp.repository.CallRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;

@Service
@RequiredArgsConstructor
public class CallService {
    
    private final CallRepository callRepository;

    @Transactional
    public Call initiateCall(Long callerId, Long receiverId, String callType) {
        Call call = new Call();
        call.setCallerId(callerId);
        call.setReceiverId(receiverId);
        call.setCallType(callType);
        call.setStatus("CALLING");
        call.setCreatedAt(LocalDateTime.now());
        return callRepository.save(call);
    }

    @Transactional
    public Call acceptCall(Long callId, Long userId) {
        Call call = callRepository.findById(callId)
                .orElseThrow(() -> new RuntimeException("通话不存在"));

        if (!call.getReceiverId().equals(userId)) {
            throw new RuntimeException("无权操作此通话");
        }

        if (!"CALLING".equals(call.getStatus())) {
            throw new RuntimeException("通话状态不正确");
        }

        call.setStatus("ACCEPTED");
        call.setAnsweredAt(LocalDateTime.now());
        return callRepository.save(call);
    }

    @Transactional
    public void rejectCall(Long callId, Long userId) {
        Call call = callRepository.findById(callId)
                .orElseThrow(() -> new RuntimeException("通话不存在"));

        if (!call.getReceiverId().equals(userId)) {
            throw new RuntimeException("无权操作此通话");
        }

        if (!"CALLING".equals(call.getStatus())) {
            throw new RuntimeException("通话状态不正确");
        }

        call.setStatus("REJECTED");
        call.setEndedAt(LocalDateTime.now());
        callRepository.save(call);
    }

    @Transactional
    public void endCall(Long callId, Long userId) {
        Call call = callRepository.findById(callId)
                .orElseThrow(() -> new RuntimeException("通话不存在"));

        if (!call.getCallerId().equals(userId) && !call.getReceiverId().equals(userId)) {
            throw new RuntimeException("无权操作此通话");
        }

        if ("ENDED".equals(call.getStatus()) || "REJECTED".equals(call.getStatus())) {
            throw new RuntimeException("通话已结束");
        }

        call.setStatus("ENDED");
        call.setEndedAt(LocalDateTime.now());

        // 计算通话时长
        if (call.getAnsweredAt() != null) {
            long seconds = ChronoUnit.SECONDS.between(call.getAnsweredAt(), call.getEndedAt());
            call.setDuration((int) seconds);
        }

        callRepository.save(call);
    }

    public List<Call> getCallHistory(Long userId) {
        return callRepository.findByCallerIdOrReceiverIdOrderByCreatedAtDesc(userId, userId);
    }

    public Call getCallById(Long callId) {
        return callRepository.findById(callId)
                .orElseThrow(() -> new RuntimeException("通话不存在"));
    }
}
