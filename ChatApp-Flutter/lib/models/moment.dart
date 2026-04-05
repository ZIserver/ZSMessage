/// 朋友圈动态模型
class Moment {
  final int id;
  final int userId;
  final String? username;
  final String? nickname;
  final String? userAvatar;
  final String content;
  final List<String> images;
  final int likeCount;
  final int commentCount;
  final bool isLiked;
  final DateTime? createdAt;

  Moment({
    required this.id,
    required this.userId,
    this.username,
    this.nickname,
    this.userAvatar,
    required this.content,
    this.images = const [],
    this.likeCount = 0,
    this.commentCount = 0,
    this.isLiked = false,
    this.createdAt,
  });

  String get displayName => nickname ?? username ?? '用户$userId';

  factory Moment.fromJson(Map<String, dynamic> json) {
    List<String> images = [];
    if (json['images'] != null) {
      if (json['images'] is List) {
        images = (json['images'] as List).map((e) => e.toString()).toList();
      } else if (json['images'] is String) {
        final str = json['images'] as String;
        if (str.isNotEmpty) {
          images = str.split(',');
        }
      }
    }
    
    return Moment(
      id: json['id'] as int,
      userId: json['userId'] as int,
      username: json['username'] as String?,
      nickname: json['nickname'] as String?,
      userAvatar: json['userAvatar'] as String? ?? json['avatar'] as String?,
      content: json['content'] as String? ?? '',
      images: images,
      likeCount: json['likeCount'] as int? ?? 0,
      commentCount: json['commentCount'] as int? ?? 0,
      isLiked: json['isLiked'] as bool? ?? false,
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'] as String)
          : null,
    );
  }

  Moment copyWith({
    int? likeCount,
    bool? isLiked,
    int? commentCount,
  }) {
    return Moment(
      id: id,
      userId: userId,
      username: username,
      nickname: nickname,
      userAvatar: userAvatar,
      content: content,
      images: images,
      likeCount: likeCount ?? this.likeCount,
      commentCount: commentCount ?? this.commentCount,
      isLiked: isLiked ?? this.isLiked,
      createdAt: createdAt,
    );
  }
}

/// 评论模型
class MomentComment {
  final int id;
  final int momentId;
  final int userId;
  final String? username;
  final String? nickname;
  final String? userAvatar;
  final String content;
  final int? replyToUserId;
  final String? replyToUsername;
  final DateTime? createdAt;

  MomentComment({
    required this.id,
    required this.momentId,
    required this.userId,
    this.username,
    this.nickname,
    this.userAvatar,
    required this.content,
    this.replyToUserId,
    this.replyToUsername,
    this.createdAt,
  });

  String get displayName => nickname ?? username ?? '用户$userId';

  factory MomentComment.fromJson(Map<String, dynamic> json) {
    return MomentComment(
      id: json['id'] as int,
      momentId: json['momentId'] as int,
      userId: json['userId'] as int,
      username: json['username'] as String?,
      nickname: json['nickname'] as String?,
      userAvatar: json['userAvatar'] as String? ?? json['avatar'] as String?,
      content: json['content'] as String,
      replyToUserId: json['replyToUserId'] as int?,
      replyToUsername: json['replyToUsername'] as String?,
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'] as String)
          : null,
    );
  }
}
