// app.js
App({
  onLaunch(options) {
    console.log('小程序初始化', options);
    
    // 检查新版本
    this.checkUpdate();
    
    // 初始化云开发
    this.initCloud();
    
    // 获取系统信息
    this.getSystemInfo();
    
    // 检查登录状态
    this.checkLoginStatus();
  },

  onShow(options) {
    console.log('小程序显示', options);
    
    // 更新用户状态
    this.updateUserStatus();
  },

  onHide() {
    console.log('小程序隐藏');
  },

  onError(error) {
    console.error('小程序错误:', error);
    // 错误上报
    this.reportError(error);
  },

  // 检查更新
  checkUpdate() {
    if (wx.canIUse('getUpdateManager')) {
      const updateManager = wx.getUpdateManager();
      
      updateManager.onCheckForUpdate((res) => {
        console.log('是否有新版本', res.hasUpdate);
      });

      updateManager.onUpdateReady(() => {
        wx.showModal({
          title: '更新提示',
          content: '新版本已准备好，是否重启应用？',
          success: (res) => {
            if (res.confirm) {
              updateManager.applyUpdate();
            }
          }
        });
      });

      updateManager.onUpdateFailed(() => {
        wx.showToast({
          title: '更新失败',
          icon: 'none'
        });
      });
    }
  },

  // 初始化云开发
  initCloud() {
    console.log('开始初始化云开发...');
    
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
      wx.showModal({
        title: '提示',
        content: '当前微信版本过低，无法使用云能力，请升级到最新微信版本后重试。',
        showCancel: false
      });
      return;
    }

    try {
      // 方法1：使用具体的环境ID（推荐）
      wx.cloud.init({
        env: 'cloud1-3gaqjuvuf331ae24', 
        traceUser: true,
      });

      // 验证云开发是否初始化成功
      console.log('云开发初始化配置:', wx.cloud);
      console.log('云开发环境状态:', wx.cloud.constructor === Function);
      
      this.globalData.cloudInitialized = true;
      console.log('云开发初始化成功');
      
      // 测试云开发功能
      this.testCloudFunction();
      
    } catch (error) {
      console.error('云开发初始化失败:', error);
      this.globalData.cloudInitialized = false;
      
      wx.showToast({
        title: '云服务初始化失败',
        icon: 'none'
      });
    }
  },

  // 测试云函数调用
  async testCloudFunction() {
    try {
      console.log('测试云函数调用...');
      // 调用一个简单的云函数来验证
      const result = await wx.cloud.callFunction({
        name: 'user',
        data: {
          action: 'getUserInfo'
        }
      });
      console.log('云函数测试调用成功:', result);
    } catch (error) {
      console.log('云函数测试调用失败（可能是正常的，如果用户未登录）:', error);
    }
  },

  // 获取系统信息
  getSystemInfo() {
    try {
      const systemInfo = wx.getSystemInfoSync();
      console.log('系统信息:', systemInfo);
      
      // 获取状态栏高度
      const statusBarHeight = systemInfo.statusBarHeight;
      
      // 计算导航栏高度（状态栏高度 + 44px）
      const navBarHeight = statusBarHeight + 44;
      
      this.globalData.systemInfo = systemInfo;
      this.globalData.statusBarHeight = statusBarHeight;
      this.globalData.navBarHeight = navBarHeight;
      this.globalData.customNavHeight = navBarHeight;
      
      console.log('状态栏高度:', statusBarHeight);
      console.log('导航栏总高度:', navBarHeight);
      
    } catch (error) {
      console.error('获取系统信息失败:', error);
      // 设置默认值
      this.globalData.statusBarHeight = 44;
      this.globalData.navBarHeight = 88;
      this.globalData.customNavHeight = 88;
    }
  },

  // 检查登录状态
  checkLoginStatus() {
    // 等待云开发初始化完成
    if (!this.globalData.cloudInitialized) {
      console.log('云开发未初始化，延迟检查登录状态');
      setTimeout(() => {
        this.checkLoginStatus();
      }, 1000);
      return;
    }

    const token = wx.getStorageSync('token');
    const userInfo = wx.getStorageSync('userInfo');
    
    console.log('检查登录状态:', { 
      hasToken: !!token, 
      hasUserInfo: !!userInfo,
      cloudInitialized: this.globalData.cloudInitialized 
    });
    
    if (token && userInfo) {
      this.globalData.userInfo = userInfo;
      this.globalData.isLoggedIn = true;
      console.log('用户已登录', userInfo);
    } else {
      this.globalData.isLoggedIn = false;
      this.globalData.userInfo = null;
      console.log('用户未登录');
    }
  },

  // 更新用户状态
  updateUserStatus() {
    if (this.globalData.isLoggedIn) {
      // 同步用户信息
      this.syncUserInfo();
    }
  },

  // 在 app.js 中添加全局登录状态监控
  watchLoginStatus() {
  // 监控存储变化
  wx.onStorageChanged && wx.onStorageChanged((res) => {
    if (res.key === 'userInfo' || res.key === 'token') {
      this.checkLoginStatus();
    }
  });
},

  // 同步用户信息
  async syncUserInfo() {
    try {
      // 调用云函数同步用户信息
      const result = await wx.cloud.callFunction({
        name: 'user',
        data: {
          action: 'getUserInfo'
        }
      });
      
      if (result.result && result.result.success) {
        this.globalData.userInfo = result.result.data;
        wx.setStorageSync('userInfo', result.result.data);
      }
    } catch (error) {
      console.error('同步用户信息失败:', error);
    }
  },

  // 错误上报
  reportError(error) {
    // 可以集成错误监控平台
    console.error('错误上报:', error);
    
    wx.reportAnalytics('error', {
      error: error.message || '未知错误',
      stack: error.stack || ''
    });
  },

  // 显示加载提示
  showLoading(title = '加载中...') {
    wx.showLoading({
      title: title,
      mask: true
    });
  },

  // 隐藏加载提示
  hideLoading() {
    wx.hideLoading();
  },

  // 显示成功提示
  showSuccess(message, duration = 1500) {
    wx.showToast({
      title: message,
      icon: 'success',
      duration: duration
    });
  },

  // 显示错误提示
  showError(message, duration = 2000) {
    wx.showToast({
      title: message,
      icon: 'none',
      duration: duration
    });
  },

  // 网络状态检查
  checkNetworkStatus() {
    return new Promise((resolve) => {
      wx.getNetworkType({
        success: (res) => {
          const networkType = res.networkType;
          this.globalData.networkType = networkType;
          resolve(networkType !== 'none');
        },
        fail: () => {
          resolve(false);
        }
      });
    });
  },

  // 全局数据
  globalData: {
    userInfo: null,
    isLoggedIn: false,
    systemInfo: null,
    statusBarHeight: 20,
    customNavHeight: 64,
    cloudInitialized: false,
    networkType: 'wifi',
    
    // 颜色配置
    colors: {
      primary: '#007AFF',
      success: '#34C759',
      warning: '#FF9500',
      danger: '#FF3B30',
      textPrimary: '#1A1A1A',
      textSecondary: '#666666',
      textTertiary: '#999999',
      background: '#F8F9FA',
      cardBackground: '#FFFFFF'
    },
    
    // 配置信息
    config: {
      appName: '高端社交',
      version: '1.0.0'
    }
  }
});