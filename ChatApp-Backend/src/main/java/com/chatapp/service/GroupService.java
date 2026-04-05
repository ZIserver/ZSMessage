package com.chatapp.service;

import com.chatapp.entity.ChatGroup;
import com.chatapp.entity.GroupAnnouncement;
import com.chatapp.entity.GroupMember;
import com.chatapp.entity.GroupMessage;
import com.chatapp.entity.GroupNotification;
import com.chatapp.repository.ChatGroupRepository;
import com.chatapp.repository.GroupAnnouncementRepository;
import com.chatapp.repository.GroupMemberRepository;
import com.chatapp.repository.GroupMessageRepository;
import com.chatapp.repository.GroupNotificationRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class GroupService {

    // 群号起始值
    private static final Long GROUP_NUMBER_START = 10000001L;
    
    @Autowired
    private ChatGroupRepository chatGroupRepository;

    @Autowired
    private GroupMemberRepository groupMemberRepository;

    @Autowired
    private GroupMessageRepository groupMessageRepository;

    @Autowired
    private GroupNotificationRepository groupNotificationRepository;
    
    @Autowired
    private GroupAnnouncementRepository groupAnnouncementRepository;

    /**
     * 创建群组（自动生成群号和邀请码）
     */
    @Transactional
    public ChatGroup createGroup(ChatGroup group) {
        // 生成群号
        if (group.getGroupNumber() == null) {
            group.setGroupNumber(generateGroupNumber());
        }
        // 生成邀请码
        if (group.getInviteCode() == null) {
            group.setInviteCode(generateInviteCode());
        }
        return chatGroupRepository.save(group);
    }
    
    /**
     * 生成新群号
     */
    private synchronized Long generateGroupNumber() {
        Long maxNumber = chatGroupRepository.findMaxGroupNumber();
        if (maxNumber == null || maxNumber < GROUP_NUMBER_START) {
            return GROUP_NUMBER_START;
        }
        return maxNumber + 1;
    }
    
    /**
     * 生成唯一邀请码 (8位随机字符)
     */
    private String generateInviteCode() {
        String code;
        do {
            code = UUID.randomUUID().toString().replace("-", "").substring(0, 8).toUpperCase();
        } while (chatGroupRepository.findByInviteCode(code).isPresent());
        return code;
    }
    
    /**
     * 根据邀请码查找群
     */
    public ChatGroup getGroupByInviteCode(String inviteCode) {
        return chatGroupRepository.findByInviteCode(inviteCode).orElse(null);
    }
    
    /**
     * 重新生成群邀请码
     */
    @Transactional
    public ChatGroup regenerateInviteCode(Long groupId) {
        ChatGroup group = chatGroupRepository.findById(groupId).orElse(null);
        if (group != null) {
            group.setInviteCode(generateInviteCode());
            return chatGroupRepository.save(group);
        }
        return null;
    }
    
    /**
     * 根据群号查找群
     */
    public ChatGroup getGroupByNumber(Long groupNumber) {
        return chatGroupRepository.findByGroupNumber(groupNumber).orElse(null);
    }
    
    /**
     * 按群名搜索群
     */
    public List<ChatGroup> searchGroupsByName(String keyword) {
        return chatGroupRepository.findByGroupNameContainingIgnoreCase(keyword);
    }

    public List<ChatGroup> getAllGroups() {
        return chatGroupRepository.findAll();
    }

    public ChatGroup getGroupById(Long id) {
        return chatGroupRepository.findById(id).orElse(null);
    }

    public GroupMember addMember(GroupMember member) {
        return groupMemberRepository.save(member);
    }

    public List<GroupMember> getGroupMembers(Long groupId) {
        return groupMemberRepository.findByGroupId(groupId);
    }

    public List<GroupMember> getUserGroups(Long userId) {
        return groupMemberRepository.findByUserId(userId);
    }

    public GroupMessage sendGroupMessage(GroupMessage message) {
        return groupMessageRepository.save(message);
    }

    public List<GroupMessage> getGroupMessages(Long groupId) {
        return groupMessageRepository.findByGroupIdOrderByCreatedAtAsc(groupId);
    }
    
    // 根据ID获取群消息
    public GroupMessage getGroupMessageById(Long messageId) {
        return groupMessageRepository.findById(messageId).orElse(null);
    }

    // 检查用户是否是群主
    public boolean isGroupOwner(Long groupId, Long userId) {
        ChatGroup group = chatGroupRepository.findById(groupId).orElse(null);
        return group != null && group.getOwnerId().equals(userId);
    }

    // 检查用户是否是管理员或群主
    public boolean isAdminOrOwner(Long groupId, Long userId) {
        if (isGroupOwner(groupId, userId)) {
            return true;
        }
        List<GroupMember> members = groupMemberRepository.findByGroupId(groupId);
        return members.stream().anyMatch(m -> 
            m.getUserId().equals(userId) && "ADMIN".equals(m.getRole())
        );
    }

    // 获取群成员信息
    public GroupMember getGroupMember(Long groupId, Long userId) {
        return groupMemberRepository.findByGroupIdAndUserId(groupId, userId).orElse(null);
    }

    // 移除群成员
    @Transactional
    public void removeMember(Long groupId, Long userId) {
        groupMemberRepository.deleteByGroupIdAndUserId(groupId, userId);
    }

    // 更新群成员角色
    public GroupMember updateMemberRole(Long groupId, Long userId, String role) {
        GroupMember member = getGroupMember(groupId, userId);
        if (member != null) {
            member.setRole(role);
            return groupMemberRepository.save(member);
        }
        return null;
    }

    // 更新群组设置
    public ChatGroup updateGroup(ChatGroup group) {
        return chatGroupRepository.save(group);
    }

    // 创建群组通知
    public GroupNotification createNotification(GroupNotification notification) {
        return groupNotificationRepository.save(notification);
    }

    // 获取用户的群组通知
    public List<GroupNotification> getUserNotifications(Long userId) {
        return groupNotificationRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }

    // 获取未读通知
    public List<GroupNotification> getUnreadNotifications(Long userId) {
        return groupNotificationRepository.findByUserIdAndIsReadOrderByCreatedAtDesc(userId, false);
    }

    // 标记通知为已读
    public void markNotificationAsRead(Long notificationId) {
        Optional<GroupNotification> notification = groupNotificationRepository.findById(notificationId);
        if (notification.isPresent()) {
            GroupNotification n = notification.get();
            n.setIsRead(true);
            groupNotificationRepository.save(n);
        }
    }

    // 获取群组的加入请求
    public List<GroupNotification> getGroupJoinRequests(Long groupId) {
        return groupNotificationRepository.findByGroupIdAndNotificationTypeOrderByCreatedAtDesc(groupId, "JOIN_REQUEST");
    }
    
    // 标记群组消息为已读
    @Transactional
    public int markGroupMessagesAsReadByGroup(Long groupId, Long userId) {
        List<GroupMessage> unreadMessages = groupMessageRepository.findByGroupIdAndSenderIdNotAndIsReadFalse(groupId, userId);
        for (GroupMessage message : unreadMessages) {
            message.setIsRead(true);
            groupMessageRepository.save(message);
        }
        return unreadMessages.size();
    }
    
    // ==================== 群公告相关方法 ====================
    
    /**
     * 发布群公告
     */
    public GroupAnnouncement createAnnouncement(GroupAnnouncement announcement) {
        return groupAnnouncementRepository.save(announcement);
    }
    
    /**
     * 获取群的所有公告
     */
    public List<GroupAnnouncement> getGroupAnnouncements(Long groupId) {
        return groupAnnouncementRepository.findByGroupIdOrderByPinnedAndTime(groupId);
    }
    
    /**
     * 获取群的置顶公告
     */
    public List<GroupAnnouncement> getPinnedAnnouncements(Long groupId) {
        return groupAnnouncementRepository.findByGroupIdAndIsPinnedTrueAndIsDeletedFalseOrderByCreatedAtDesc(groupId);
    }
    
    /**
     * 更新公告
     */
    public GroupAnnouncement updateAnnouncement(GroupAnnouncement announcement) {
        return groupAnnouncementRepository.save(announcement);
    }
    
    /**
     * 删除公告（软删除）
     */
    @Transactional
    public void deleteAnnouncement(Long announcementId) {
        groupAnnouncementRepository.findById(announcementId).ifPresent(a -> {
            a.setIsDeleted(true);
            groupAnnouncementRepository.save(a);
        });
    }
    
    /**
     * 置顶/取消置顶公告
     */
    @Transactional
    public GroupAnnouncement toggleAnnouncementPin(Long announcementId) {
        return groupAnnouncementRepository.findById(announcementId).map(a -> {
            a.setIsPinned(!a.getIsPinned());
            return groupAnnouncementRepository.save(a);
        }).orElse(null);
    }
    
    /**
     * 获取公告详情
     */
    public GroupAnnouncement getAnnouncementById(Long announcementId) {
        return groupAnnouncementRepository.findById(announcementId).orElse(null);
    }
    
    /**
     * 获取群公告数量
     */
    public long getAnnouncementCount(Long groupId) {
        return groupAnnouncementRepository.countByGroupIdAndIsDeletedFalse(groupId);
    }
}
