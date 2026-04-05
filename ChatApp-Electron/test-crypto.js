const cryptoService = require('./src/services/crypto-service');

console.log('===============================');
console.log('智穗语聊 - 聊天加密测试');
console.log('===============================\n');

console.log('密钥:', 'ZSMESSAGENB114514-MESSAGEJIAMI');
console.log('加密算法: AES-256-CBC\n');

// 执行测试
cryptoService.test();

console.log('\n===============================');
console.log('测试完成！');
console.log('===============================');
