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
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
      return;
    }

    wx.cloud.init({
      env: 'your-cloud-env-id', // 替换为您的云环境ID
      traceUser: true,
    });

    this.globalData.cloudInitialized = true;
    console.log('云开发初始化成功');
  },

  // 获取系统信息
  getSystemInfo() {
    try {
      const systemInfo = wx.getSystemInfoSync();
      this.globalData.systemInfo = systemInfo;
      
      // 设置自定义状态栏高度
      const { statusBarHeight, platform } = systemInfo;
      this.globalData.customNavHeight = statusBarHeight + 44;
      
      console.log('系统信息:', systemInfo);
    } catch (error) {
      console.error('获取系统信息失败:', error);
    }
  },

  // 检查登录状态
  checkLoginStatus() {
    const token = wx.getStorageSync('token');
    const userInfo = wx.getStorageSync('userInfo');
    
    if (token && userInfo) {
      this.globalData.userInfo = userInfo;
      this.globalData.isLoggedIn = true;
      console.log('用户已登录', userInfo);
    } else {
      this.globalData.isLoggedIn = false;
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
    customNavHeight: 0,
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
      version: '1.0.0',
      apiBaseUrl: 'https://your-api-domain.com'
    }
  }
});