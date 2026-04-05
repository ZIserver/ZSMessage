// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'user.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

User _$UserFromJson(Map<String, dynamic> json) => User(
      id: json['id'] as int,
      username: json['username'] as String,
      nickname: json['nickname'] as String?,
      avatar: json['avatar'] as String?,
      bio: json['bio'] as String?,
      email: json['email'] as String?,
      emailVerified: json['emailVerified'] as bool?,
      online: json['online'] as bool?,
      status: json['status'] as int?,
      phone: json['phone'] as String?,
      phoneVerified: json['phoneVerified'] as bool?,
      zsNumber: json['zsNumber'] as int?,
      createdAt: json['createdAt'] == null
          ? null
          : DateTime.parse(json['createdAt'] as String),
      updatedAt: json['updatedAt'] == null
          ? null
          : DateTime.parse(json['updatedAt'] as String),
    );

Map<String, dynamic> _$UserToJson(User instance) => <String, dynamic>{
      'id': instance.id,
      'username': instance.username,
      'nickname': instance.nickname,
      'avatar': instance.avatar,
      'bio': instance.bio,
      'email': instance.email,
      'emailVerified': instance.emailVerified,
      'online': instance.online,
      'status': instance.status,
      'phone': instance.phone,
      'phoneVerified': instance.phoneVerified,
      'zsNumber': instance.zsNumber,
      'createdAt': instance.createdAt?.toIso8601String(),
      'updatedAt': instance.updatedAt?.toIso8601String(),
    };
