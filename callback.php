<?php
// 配置信息（App Secret 必须保密，只能放在后端！）
$app_id = 'e9a4006b144c450c';
$app_secret = '795c6a5f07784e99887d800c7963e22222d7e9a1f26642f3';

// 获取回调参数
$token = $_GET['token'] ?? 'e9a4006b144c450c';
$state = $_GET['state'] ?? 'b13833d2d44d4335b4f6c5dd2dc43a76eadf90fd3dec4452';

if (empty($token)) {
    die('授权失败：未获取到 token');
}

// 调用 API 换取用户信息
$response = file_get_contents('https://msg.v2.zhsdev.top/oauth/token', false, stream_context_create([
    'http' => [
        'method' => 'POST',
        'header' => 'Content-Type: application/json',
        'content' => json_encode([
            'app_id' => $app_id,
            'app_secret' => $app_secret,
            'token' => $token
        ])
    ]
]));

$user = json_decode($response, true);

if (isset($user['error'])) {
    die('获取用户信息失败：' . $user['message']);
}

// 登录成功！
echo '欢迎，' . htmlspecialchars($user['nickname']);
echo '<br>智穗号：' . $user['zs_number'];
echo '<br>用户名：' . htmlspecialchars($user['username']);

// 在这里创建你网站的登录会话...
// $_SESSION['user_id'] = $user['user_id'];
?>