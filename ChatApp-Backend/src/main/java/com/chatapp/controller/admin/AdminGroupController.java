package com.chatapp.controller.admin;

import com.chatapp.entity.ChatGroup;
import com.chatapp.entity.GroupMember;
import com.chatapp.entity.GroupMessage;
import com.chatapp.repository.ChatGroupRepository;
import com.chatapp.repository.GroupMemberRepository;
import com.chatapp.repository.GroupMessageRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 管理员 - 群聊管理控制器
 */
@RestController
@RequestMapping("/api/admin/groups")
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
public class AdminGroupController {
    
    private final ChatGroupRepository groupRepository;
    private final GroupMemberRepository memberRepository;
    private final GroupMessageRepository messageRepository;
    
    /**
     * 获取所有群组
     */
    @GetMapping("/list")
    public ResponseEntity<?> getAllGroups() {
        try {
            List<ChatGroup> groups = groupRepository.findAll();
            return ResponseEntity.ok(groups);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }
    
    /**
     * 获取群组详情（包含成员）
     */
    @GetMapping("/{groupId}")
    public ResponseEntity<?> getGroupDetail(@PathVariable Long groupId) {
        try {
            ChatGroup group = groupRepository.findById(groupId)
                    .orElseThrow(() -> new RuntimeException("群组不存在"));
            List<GroupMember> members = memberRepository.findByGroupId(groupId);
            
            Map<String, Object> response = new HashMap<>();
            response.put("group", group);
            response.put("members", members);
            response.put("memberCount", members.size());
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }
    
    /**
     * 删除群组
     */
    @DeleteMapping("/{groupId}")
    public ResponseEntity<?> deleteGroup(@PathVariable Long groupId) {
        try {
            // 删除群组消息
            messageRepository.deleteByGroupId(groupId);
            // 删除群组成员
            memberRepository.deleteByGroupId(groupId);
            // 删除群组
            groupRepository.deleteById(groupId);
            
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }
    
    /**
     * 移除群成员
     */
    @DeleteMapping("/{groupId}/members/{userId}")
    public ResponseEntity<?> removeMember(@PathVariable Long groupId, @PathVariable Long userId) {
        try {
            memberRepository.deleteByGroupIdAndUserId(groupId, userId);
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }
    
    /**
     * 获取群组统计信息
     */
    @GetMapping("/statistics")
    public ResponseEntity<?> getStatistics() {
        try {
            long totalGroups = groupRepository.count();
            long totalMembers = memberRepository.count();
            long totalMessages = messageRepository.count();
            
            Map<String, Object> stats = new HashMap<>();
            stats.put("totalGroups", totalGroups);
            stats.put("totalMembers", totalMembers);
            stats.put("totalMessages", totalMessages);
            stats.put("avgMembersPerGroup", totalGroups > 0 ? (double) totalMembers / totalGroups : 0);
            
            return ResponseEntity.ok(stats);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }
}
