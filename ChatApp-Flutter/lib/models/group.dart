/// 群组模型
class Group {
  final int id;
  final String? name;
  final String? avatar;
  final String? description;
  final int? ownerId;
  final String? ownerName;
  final int? memberCount;
  final String? groupNumber;
  final DateTime? createdAt;

  Group({
    required this.id,
    this.name,
    this.avatar,
    this.description,
    this.ownerId,
    this.ownerName,
    this.memberCount,
    this.groupNumber,
    this.createdAt,
  });

  String get displayName => name ?? '群聊$id';

  factory Group.fromJson(Map<String, dynamic> json) {
    return Group(
      id: json['id'] as int,
      name: json['name'] as String?,
      avatar: json['avatar'] as String?,
      description: json['description'] as String?,
      ownerId: json['ownerId'] as int?,
      ownerName: json['ownerName'] as String?,
      memberCount: json['memberCount'] as int?,
      groupNumber: json['groupNumber'] as String?,
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'] as String)
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'avatar': avatar,
      'description': description,
      'ownerId': ownerId,
      'ownerName': ownerName,
      'memberCount': memberCount,
      'groupNumber': groupNumber,
      'createdAt': createdAt?.toIso8601String(),
    };
  }
}

/// 群成员模型
class GroupMember {
  final int id;
  final int groupId;
  final int userId;
  final String? username;
  final String? nickname;
  final String? avatar;
  final int role; // 0-普通成员, 1-管理员, 2-群主
  final DateTime? joinedAt;

  GroupMember({
    required this.id,
    required this.groupId,
    required this.userId,
    this.username,
    this.nickname,
    this.avatar,
    this.role = 0,
    this.joinedAt,
  });

  String get displayName => nickname ?? username ?? '用户$userId';
  bool get isOwner => role == 2;
  bool get isAdmin => role >= 1;

  factory GroupMember.fromJson(Map<String, dynamic> json) {
    return GroupMember(
      id: json['id'] as int,
      groupId: json['groupId'] as int,
      userId: json['userId'] as int,
      username: json['username'] as String?,
      nickname: json['nickname'] as String?,
      avatar: json['avatar'] as String?,
      role: json['role'] as int? ?? 0,
      joinedAt: json['joinedAt'] != null
          ? DateTime.tryParse(json['joinedAt'] as String)
          : null,
    );
  }
}

/// 群消息模型
class GroupMessage {
  final int? id;
  final int groupId;
  final int senderId;
  final String? senderName;
  final String? senderAvatar;
  final String content;
  final String type;
  final DateTime? createdAt;

  GroupMessage({
    this.id,
    required this.groupId,
    required this.senderId,
    this.senderName,
    this.senderAvatar,
    required this.content,
    this.type = 'text',
    this.createdAt,
  });

  factory GroupMessage.fromJson(Map<String, dynamic> json) {
    return GroupMessage(
      id: json['id'] as int?,
      groupId: json['groupId'] as int,
      senderId: json['senderId'] as int,
      senderName: json['senderName'] as String?,
      senderAvatar: json['senderAvatar'] as String?,
      content: json['content'] as String,
      type: json['type'] as String? ?? 'text',
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'] as String)
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'groupId': groupId,
      'senderId': senderId,
      'senderName': senderName,
      'senderAvatar': senderAvatar,
      'content': content,
      'type': type,
      'createdAt': createdAt?.toIso8601String(),
    };
  }
}
