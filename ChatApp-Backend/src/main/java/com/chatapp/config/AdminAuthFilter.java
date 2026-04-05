package com.chatapp.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * 管理员认证过滤器
 * 用于保护 /api/admin/** 接口
 */
@Component
public class AdminAuthFilter extends OncePerRequestFilter {
    
    @Value("${admin.token:ADMIN_SECRET_TOKEN_CHANGE_ME}")
    private String adminToken;
    
    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        
        String requestPath = request.getRequestURI();
        
        // 只对 /api/admin/** 路径进行验证
        if (requestPath.startsWith("/api/admin/")) {
            String authHeader = request.getHeader("Admin-Token");
            
            // 验证管理员Token
            if (authHeader == null || !authHeader.equals(adminToken)) {
                response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                response.setContentType("application/json");
                response.setCharacterEncoding("UTF-8");
                response.getWriter().write("{\"error\":\"未授权：需要管理员权限\",\"code\":\"ADMIN_AUTH_REQUIRED\"}");
                return;
            }
        }
        
        filterChain.doFilter(request, response);
    }
}
