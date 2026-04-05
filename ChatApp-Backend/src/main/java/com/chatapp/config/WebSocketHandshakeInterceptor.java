package com.chatapp.config;

import com.chatapp.service.TokenService;
import com.chatapp.util.JwtUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

import java.util.Map;

@Component
public class WebSocketHandshakeInterceptor implements HandshakeInterceptor {

    @Autowired
    private JwtUtil jwtUtil;
    
    @Autowired
    private TokenService tokenService;

    @Override
    public boolean beforeHandshake(ServerHttpRequest request, ServerHttpResponse response, 
                                   WebSocketHandler wsHandler, Map<String, Object> attributes) throws Exception {
        
        // 从请求头中获取Authorization
        String authHeader = request.getHeaders().getFirst("authorization");
        
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);
            
            // 尝试JWT令牌验证
            if (jwtUtil.validateToken(token)) {
                // 将用户信息存储到attributes中，供后续使用
                Long userId = jwtUtil.getUserIdFromToken(token);
                String username = jwtUtil.getUsernameFromToken(token);
                
                attributes.put("userId", userId);
                attributes.put("username", username);
                
                return true; // 允许握手
            }
            
            // 如果JWT验证失败，尝试数据库令牌验证
            if (tokenService.validateToken(token)) {
                // 从数据库获取用户ID
                java.util.Optional<Long> userIdOpt = tokenService.getUserIdByToken(token);
                if (userIdOpt.isPresent()) {
                    // 获取用户名（可能需要查询用户表）
                    // 这里我们只设置用户ID，用户名可以在其他地方获取
                    attributes.put("userId", userIdOpt.get());
                    
                    return true; // 允许握手
                }
            }
        }
        
        // SockJS需要允许无token的握手请求（如/ws/info, /ws/iframe.html等）
        // 实际的认证在STOMP CONNECT阶段通过WebSocketChannelInterceptor进行
        return true;
    }

    @Override
    public void afterHandshake(ServerHttpRequest request, ServerHttpResponse response, 
                               WebSocketHandler wsHandler, Exception exception) {
        // 握手后的处理
    }
}