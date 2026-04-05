package com.chatapp.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class LoginRequest {
    private String username;
    private String password;
    
    // 图片验证码字段
    private String captchaId;
    private String captchaCode;
    
    // 智穗号字段
    private String smartCode;
}
