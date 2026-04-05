/// API 常量配置
class ApiConstants {
  ApiConstants._();
  
  /// 基础 URL
  static const String baseUrl = 'https://msg.v2.zhsdev.top';
  
  /// WebSocket URL
  static const String wsUrl = 'wss://msg.v2.zhsdev.top/ws';
  
  /// 连接超时时间（秒）
  static const int connectTimeout = 30;
  
  /// 接收超时时间（秒）
  static const int receiveTimeout = 30;
}

/// 认证相关路径
class AuthPaths {
  AuthPaths._();
  
  static const String login = '/api/auth/login';
  static const String register = '/api/auth/register';
  static const String captcha = '/api/auth/captcha';
  static const String sendVerificationCode = '/api/auth/send-verification-code';
  static const String sendSmsCode = '/api/auth/send-sms-code';
}

/// 用户相关路径
class UserPaths {
  UserPaths._();
  
  static const String search = '/api/users/search';
  static String getUserById(int userId) => '/api/users/$userId';
  static String updateUser(int userId) => '/api/users/$userId';
  static String uploadAvatar(int userId) => '/api/users/$userId/avatar';
}

/// 消息相关路径
class MessagePaths {
  MessagePaths._();
  
  static const String send = '/api/messages/send';
  static const String history = '/api/messages/history';
  static const String all = '/api/messages/all';
  static const String search = '/api/messages/search';
  static const String markChatAsRead = '/api/messages/markChatAsRead';
  static String recall(int messageId) => '/api/messages/recall/$messageId';
  static String markAsRead(int messageId) => '/api/messages/markAsRead/$messageId';
  static String unread(int userId) => '/api/messages/unread/$userId';
  static String sessions(int userId) => '/api/messages/sessions/$userId';
}

/// 好友相关路径
class FriendPaths {
  FriendPaths._();
  
  static const String request = '/api/friends/request';
  static const String handleRequest = '/api/friends/handle';
  static String accept(int requestId) => '/api/friends/accept/$requestId';
  static String reject(int requestId) => '/api/friends/reject/$requestId';
  static String delete(int userId, int friendId) => '/api/friends/$userId/$friendId';
  static String list(int userId) => '/api/friends/list/$userId';
  static String pending(int userId) => '/api/friends/pending/$userId';
  static String requests(int userId) => '/api/friends/pending/$userId';
  static String sent(int userId) => '/api/friends/sent/$userId';
  static String check(int userId, int friendId) => '/api/friends/check/$userId/$friendId';
}

/// 好友通知相关路径
class FriendNotificationPaths {
  FriendNotificationPaths._();
  
  static const String send = '/api/friends/notifications/send';
  static String getNotifications(int userId) => '/api/friends/notifications/$userId';
  static String unread(int userId) => '/api/friends/notifications/$userId/unread';
  static String pending(int userId) => '/api/friends/notifications/$userId/pending';
  static String markAsRead(int notificationId) => '/api/friends/notifications/$notificationId/read';
  static String markAllRead(int userId) => '/api/friends/notifications/mark-all-read/$userId';
  static String respond(int notificationId) => '/api/friends/notifications/$notificationId/respond';
}

/// 群组相关路径
class GroupPaths {
  GroupPaths._();
  
  static const String create = '/api/groups/create';
  static const String all = '/api/groups/all';
  static String getById(int id) => '/api/groups/$id';
  static String update(int groupId) => '/api/groups/$groupId';
  static const String addMembers = '/api/groups/members/add';
  static String getMembers(int groupId) => '/api/groups/$groupId/members';
  static String userGroups(int userId) => '/api/groups/user/$userId';
  static const String sendMessage = '/api/groups/messages/send';
  static String getMessages(int groupId) => '/api/groups/$groupId/messages';
  static String invite(int groupId) => '/api/groups/$groupId/invite';
  static String join(int groupId) => '/api/groups/$groupId/join';
  static String removeMember(int groupId, int userId) => '/api/groups/$groupId/members/$userId';
  static String leave(int groupId) => '/api/groups/$groupId/leave';
  static String searchByNumber(String number) => '/api/groups/search/number/$number';
  static const String searchByName = '/api/groups/search/name';
}

/// 朋友圈相关路径
class MomentPaths {
  MomentPaths._();
  
  static const String create = '/api/moments/create';
  static const String all = '/api/moments/all';
  static String user(int userId) => '/api/moments/user/$userId';
  static String getById(int id) => '/api/moments/$id';
  static String like(int id) => '/api/moments/$id/like';
  static const String addComment = '/api/moments/comments/add';
  static String comments(int momentId) => '/api/moments/$momentId/comments';
  static String delete(int id) => '/api/moments/$id';
}

/// 文件相关路径
class FilePaths {
  FilePaths._();
  
  static const String upload = '/api/files/upload';
  static String download(int fileMessageId) => '/api/files/download/$fileMessageId';
  static String history(int userId1, int userId2) => '/api/files/history/$userId1/$userId2';
}

/// 通话相关路径
class CallPaths {
  CallPaths._();
  
  static const String initiate = '/api/calls/initiate';
  static String accept(int callId) => '/api/calls/accept/$callId';
  static String reject(int callId) => '/api/calls/reject/$callId';
  static String end(int callId) => '/api/calls/end/$callId';
  static String history(int userId) => '/api/calls/history/$userId';
}

/// 公告相关路径
class AnnouncementPaths {
  AnnouncementPaths._();
  
  static const String latest = '/api/announcements/latest';
  static const String list = '/api/announcements/list';
}

/// 更新检查路径
class UpdatePaths {
  UpdatePaths._();
  
  static const String check = '/api/update/check';
  static const String changelog = '/api/update/changelog';
}
