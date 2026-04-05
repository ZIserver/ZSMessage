package com.chatapp.config;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.nio.file.Paths;

@Configuration
@RequiredArgsConstructor
public class WebMvcConfig implements WebMvcConfigurer {

    @Value("${file.upload-dir:./uploads}")
    private String uploadDir;
    
    @Value("${app.update-dir:./updates}")
    private String updateDir;
    
    private final TokenInterceptor tokenInterceptor;

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        // 获取绝对路径
        String uploadAbsolutePath = Paths.get(uploadDir).toAbsolutePath().toString();
        String updateAbsolutePath = Paths.get(updateDir).toAbsolutePath().toString();
        String avatarAbsolutePath = Paths.get("./uploads/avatars").toAbsolutePath().toString();
        
        // 映射 /uploads/** 到实际文件目录
        registry.addResourceHandler("/uploads/**")
                .addResourceLocations("file:" + uploadAbsolutePath + "/")
                .setCachePeriod(3600); // 缓存1小时
        
        // 映射 /updates/** 到安装包目录
        registry.addResourceHandler("/updates/**")
                .addResourceLocations("file:" + updateAbsolutePath + "/")
                .setCachePeriod(3600);
        
        // 映射 /api/avatars/** 到头像目录
        registry.addResourceHandler("/api/avatars/**")
                .addResourceLocations("file:" + avatarAbsolutePath + "/")
                .setCachePeriod(3600);
        
        System.out.println("[静态资源] 映射 /uploads/** -> " + uploadAbsolutePath);
        System.out.println("[静态资源] 映射 /updates/** -> " + updateAbsolutePath);
        System.out.println("[静态资源] 映射 /api/avatars/** -> " + avatarAbsolutePath);
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        // 允许所有API路由跨域访问（包括官网调用）
        registry.addMapping("/api/**")
                .allowedOrigins("*")
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                .allowedHeaders("*")
                .maxAge(3600);
        
        // 允许跨域访问静态资源
        registry.addMapping("/uploads/**")
                .allowedOrigins("*")
                .allowedMethods("GET", "HEAD")
                .allowedHeaders("*")
                .maxAge(3600);
        
        // 允许跨域访问安装包
        registry.addMapping("/updates/**")
                .allowedOrigins("*")
                .allowedMethods("GET", "HEAD")
                .allowedHeaders("*")
                .maxAge(3600);
        
        // 允许跨域访问头像
        registry.addMapping("/api/avatars/**")
                .allowedOrigins("*")
                .allowedMethods("GET", "HEAD")
                .allowedHeaders("*")
                .maxAge(3600);
    }
    
    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        // 添加Token验证拦截器
        registry.addInterceptor(tokenInterceptor)
                .addPathPatterns("/api/**")
                .excludePathPatterns(
                        "/api/auth/login",                // 登录不需要Token
                        "/api/auth/register",             // 注册不需要Token
                        "/api/auth/captcha",              // 获取验证码不需要Token
                        "/api/auth/check-need-captcha",   // 检查验证码不需要Token
                        "/api/auth/send-verification-code", // 发送邮箱验证码不需要Token
                        "/api/auth/send-sms-code",        // 发送短信验证码不需要Token
                        "/api/developer/register",        // 开发者注册不需要Token
                        "/api/developer/check-registered", // 检查是否已注册不需要Token
                        "/api/developer/**",              // 开发者接口由DeveloperController自己处理认证
                        "/api/oauth/apps/**",             // OAuth应用管理接口支持开发者Token
                        "/api/appeals/submit",            // 申诉提交不需要Token
                        "/api/admin/**",                  // 管理员接口由AdminAuthFilter处理
                        "/api/announcements/**",          // 公告公开访问
                        "/api/version/**",                // 版本检查公开访问
                        "/api/update/**",                 // 更新检查公开访问
                        "/api/users/smartcode/**",        // 智穗号查询公开访问
                        "/api/avatars/**",                // 头像访问不需要Token
                        "/uploads/**",                    // 静态资源公开访问
                        "/updates/**"                     // 安装包公开访问
                );
    }
}
