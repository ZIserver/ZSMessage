package com.chatapp.util;

import java.util.HashMap;
import java.util.Map;

/**
 * 测试类型转换工具类的功能
 */
public class TypeConversionTest {
    public static void main(String[] args) {
        System.out.println("Testing TypeConvertUtil...");
        
        // 测试 Integer 转 Long
        Map<String, Object> testData = new HashMap<>();
        testData.put("id1", 123);  // Integer
        testData.put("id2", 456L); // Long
        testData.put("id3", "789"); // String
        
        // 使用旧的方式（会导致错误）
        System.out.println("\n--- 测试旧的转换方式 ---");
        try {
            // 这种方式在某些情况下会出错：Integer不能转换为Long
            Long id1_old = (Long) testData.get("id1"); // 这里会产生 ClassCastException
            System.out.println("Old way - id1: " + id1_old);
        } catch (ClassCastException e) {
            System.out.println("旧方式转换失败: " + e.getMessage());
        }
        
        // 使用新的工具类
        System.out.println("\n--- 测试新的转换方式 ---");
        Long id1_new = TypeConvertUtil.toLong(testData.get("id1"));
        Long id2_new = TypeConvertUtil.toLong(testData.get("id2"));
        Long id3_new = TypeConvertUtil.toLong(testData.get("id3"));
        
        System.out.println("新方式 - id1(Integer): " + id1_new);
        System.out.println("新方式 - id2(Long): " + id2_new);
        System.out.println("新方式 - id3(String): " + id3_new);
        
        // 测试 null 值
        Long nullValue = TypeConvertUtil.toLong(null);
        System.out.println("新方式 - null: " + nullValue);
        
        // 测试无效字符串
        Long invalidValue = TypeConvertUtil.toLong("not_a_number");
        System.out.println("新方式 - 无效字符串: " + invalidValue);
        
        System.out.println("\n类型转换工具类测试完成！");
    }
}