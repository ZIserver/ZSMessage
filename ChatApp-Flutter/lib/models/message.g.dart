// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'message.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Message _$MessageFromJson(Map<String, dynamic> json) => Message(
      id: json['id'] as int?,
      senderId: json['senderId'] as int,
      receiverId: json['receiverId'] as int,
      content: json['content'] as String,
      type: json['type'] as String? ?? 'text',
      timestamp: json['timestamp'] == null
          ? null
          : DateTime.parse(json['timestamp'] as String),
      isRead: json['isRead'] as bool?,
      isRecalled: json['isRecalled'] as bool?,
      fileName: json['fileName'] as String?,
      fileSize: json['fileSize'] as int?,
      filePath: json['filePath'] as String?,
      senderName: json['senderName'] as String?,
      senderAvatar: json['senderAvatar'] as String?,
    );

Map<String, dynamic> _$MessageToJson(Message instance) => <String, dynamic>{
      'id': instance.id,
      'senderId': instance.senderId,
      'receiverId': instance.receiverId,
      'content': instance.content,
      'type': instance.type,
      'timestamp': instance.timestamp?.toIso8601String(),
      'isRead': instance.isRead,
      'isRecalled': instance.isRecalled,
      'fileName': instance.fileName,
      'fileSize': instance.fileSize,
      'filePath': instance.filePath,
      'senderName': instance.senderName,
      'senderAvatar': instance.senderAvatar,
    };
