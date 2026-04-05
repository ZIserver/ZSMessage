package com.chatapp.dto;

import com.chatapp.entity.User;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class AuthResponse {
    private String token;
    private Long userId;
    private String username;
    private String nickname;
    private User user; // 包含完整用户信息，包括状态
    private String banReason; // 封禁原因
}
