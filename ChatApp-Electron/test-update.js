// 测试更新检查的脚本
const axios = require('axios');

async function testUpdateCheck() {
  console.log('=== 测试更新检查 ===\n');
  
  // 测试1：检查后端服务
  console.log('1. 检查后端服务是否启动...');
  try {
    await axios.get('https://api.zhsidc.com/api/update/check', {
      params: {
        currentVersion: '1.0.0',
        platform: 'windows'
      }
    });
    console.log('✅ 后端服务正常\n');
  } catch (error) {
    console.error('❌ 后端服务未启动或无法访问:', error.message);
    console.log('请先启动后端服务！\n');
    return;
  }
  
  // 测试2：检查是否有可用的更新
  console.log('2. 检查更新（当前版本 1.0.0）...');
  try {
    const response = await axios.get('https://api.zhsidc.com/api/update/check', {
      params: {
        currentVersion: '1.0.0',
        platform: 'windows'
      }
    });
    
    console.log('服务器响应:', JSON.stringify(response.data, null, 2));
    
    if (response.data.hasUpdate) {
      console.log('\n✅ 发现新版本:', response.data.version);
      console.log('下载地址:', response.data.downloadUrl);
      console.log('更新说明:', response.data.releaseNotes);
    } else {
      console.log('\n⚠️ 没有新版本');
      console.log('提示: 请在管理后台创建一个版本号大于 1.0.0 的版本记录');
    }
  } catch (error) {
    console.error('❌ 检查更新失败:', error.message);
    if (error.response) {
      console.log('服务器响应:', error.response.data);
    }
  }
  
  // 测试3：检查版本比较
  console.log('\n3. 测试版本比较（当前版本 1.0.1）...');
  try {
    const response = await axios.get('https://api.zhsidc.com/api/update/check', {
      params: {
        currentVersion: '1.0.0',
        platform: 'windows'
      }
    });
    
    if (response.data.hasUpdate) {
      console.log('✅ 发现新版本:', response.data.version);
    } else {
      console.log('✅ 当前已是最新版本');
    }
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  }
  
  console.log('\n=== 测试完成 ===');
}

testUpdateCheck();
