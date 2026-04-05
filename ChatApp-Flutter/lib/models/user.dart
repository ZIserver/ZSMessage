import 'package:json_annotation/json_annotation.dart';

part 'user.g.dart';

/// 用户模型
@JsonSerializable()
class User {
  final int id;
  final String username;
  final String? nickname;
  final String? avatar;
  final String? bio;
  final String? email;
  final bool? emailVerified;
  final bool? online;
  final int? status;
  final String? phone;
  final bool? phoneVerified;
  final int? zsNumber;
  final int? gender;
  final String? region;
  final DateTime? createdAt;
  final DateTime? updatedAt;
  
  User({
    required this.id,
    required this.username,
    this.nickname,
    this.avatar,
    this.bio,
    this.email,
    this.emailVerified,
    this.online,
    this.status,
    this.phone,
    this.phoneVerified,
    this.zsNumber,
    this.gender,
    this.region,
    this.createdAt,
    this.updatedAt,
  });
  
  /// 显示名称（优先昵称）
  String get displayName => nickname?.isNotEmpty == true ? nickname! : username;
  
  /// 获取完整头像 URL
  String? get avatarUrl {
    if (avatar == null || avatar!.isEmpty) return null;
    if (avatar!.startsWith('http')) return avatar;
    return 'https://api.zhsidc.com$avatar';
  }
  
  factory User.fromJson(Map<String, dynamic> json) => _$UserFromJson(json);
  
  Map<String, dynamic> toJson() => _$UserToJson(this);
  
  User copyWith({
    int? id,
    String? username,
    String? nickname,
    String? avatar,
    String? bio,
    String? email,
    bool? emailVerified,
    bool? online,
    int? status,
    String? phone,
    bool? phoneVerified,
    int? zsNumber,
    int? gender,
    String? region,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return User(
      id: id ?? this.id,
      username: username ?? this.username,
      nickname: nickname ?? this.nickname,
      avatar: avatar ?? this.avatar,
      bio: bio ?? this.bio,
      email: email ?? this.email,
      emailVerified: emailVerified ?? this.emailVerified,
      online: online ?? this.online,
      status: status ?? this.status,
      phone: phone ?? this.phone,
      phoneVerified: phoneVerified ?? this.phoneVerified,
      zsNumber: zsNumber ?? this.zsNumber,
      gender: gender ?? this.gender,
      region: region ?? this.region,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }
}
