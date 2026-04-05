package com.chatapp.config;

import com.chatapp.entity.GroupMember;
import com.chatapp.repository.GroupMemberRepository;
import com.chatapp.service.TokenService;
import com.chatapp.util.JwtUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class WebSocketChannelInterceptor implements ChannelInterceptor {

    @Autowired
    private JwtUtil jwtUtil;

    @Autowired
    private TokenService tokenService;
    
    @Autowired
    private GroupMemberRepository groupMemberRepository;

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);

        if (accessor != null && StompCommand.SUBSCRIBE.equals(accessor.getCommand())) {
            String destination = accessor.getDestination();
            String authHeader = accessor.getFirstNativeHeader("Authorization");

            // 检查是否是群组主题订阅
            if (destination != null && destination.startsWith("/topic/group/")) {
                if (authHeader == null || !authHeader.startsWith("Bearer ")) {
                    throw new RuntimeException("Missing or invalid Authorization header");
                }

                String token = authHeader.substring(7);
                
                // 尝试JWT令牌验证
                Long authenticatedUserId = null;
                if (jwtUtil.validateToken(token)) {
                    authenticatedUserId = jwtUtil.getUserIdFromToken(token);
                }
                
                // 如果JWT验证失败，尝试数据库令牌验证
                if (authenticatedUserId == null && tokenService.validateToken(token)) {
                    java.util.Optional<Long> userIdOpt = tokenService.getUserIdByToken(token);
                    if (userIdOpt.isPresent()) {
                        authenticatedUserId = userIdOpt.get();
                    }
                }
                
                if (authenticatedUserId == null) {
                    throw new RuntimeException("Invalid token");
                }

                // 提取群组ID
                String[] parts = destination.split("/");
                if (parts.length >= 4) {
                    try {
                        Long groupId = Long.parseLong(parts[3]);

                        // 检查用户是否是该群组的成员
                        List<GroupMember> groupMembers = groupMemberRepository.findByGroupId(groupId);
                        final Long finalUserId = authenticatedUserId; // 创建一个effectively final的变量
                        boolean isMember = groupMembers.stream()
                                .anyMatch(member -> member.getUserId().equals(finalUserId));
                        
                        if (!isMember) {
                            throw new RuntimeException("User is not a member of the group: " + groupId);
                        }
                    } catch (NumberFormatException e) {
                        throw new RuntimeException("Invalid group ID in destination: " + destination);
                    }
                }
            }
        }

        return message;
    }
}