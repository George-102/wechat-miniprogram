const app = getApp();
const FormatTime = require('../../utils/formatTime.js');

Page({
  data: {
    customNavHeight: 0,
    userInfo: null,
    isLogin: false,
    loginLoading: false,
    authMethods: [
      {
        id: 'wechat',
        name: '微信一键登录',
        icon: '💬',
        color: '#09BB07',
        description: '快速安全，推荐使用'
      },
      {
        id: 'phone',
        name: '手机号登录',
        icon: '📱',
        color: '#007AFF',
        description: '验证码登录'
      }
    ],
    agreement: {
      checked: false,
      links: [
        {
          name: '用户协议',
          url: '/pages/webview/index?url=https://your-domain.com/agreement'
        },
        {
          name: '隐私政策',
          url: '/pages/webview/index?url=https://your-domain.com/privacy'
        }
      ]
    }
  },

  onLoad(options) {
    this.setData({
      customNavHeight: app.globalData.customNavHeight
    });

    // 检查登录状态
    this.checkLoginStatus();
  },

  onShow() {
    // 页面显示时重新检查登录状态
    this.checkLoginStatus();
  },

  checkLoginStatus() {
    const isLoggedIn = app.globalData.isLoggedIn;
    const userInfo = app.globalData.userInfo;
    
    this.setData({
      isLogin: isLoggedIn,
      userInfo: userInfo
    });

    if (isLoggedIn) {
      // 已登录，延迟跳转
      setTimeout(() => {
        this.redirectToHome();
      }, 1500);
    }
  },

  // 微信登录
  onWechatLogin() {
    if (!this.data.agreement.checked) {
      app.showError('请先阅读并同意用户协议和隐私政策');
      return;
    }

    this.setData({ loginLoading: true });

    wx.login({
      success: (res) => {
        if (res.code) {
          this.loginWithCode(res.code);
        } else {
          console.error('登录失败:', res);
          app.showError('登录失败，请重试');
          this.setData({ loginLoading: false });
        }
      },
      fail: (err) => {
        console.error('微信登录失败:', err);
        app.showError('登录失败，请检查网络');
        this.setData({ loginLoading: false });
      }
    });
  },

  // 使用 code 登录
  async loginWithCode(code) {
    try {
      const result = await wx.cloud.callFunction({
        name: 'auth',
        data: {
          action: 'login',
          code: code
        }
      });

      if (result.result && result.result.success) {
        const { token, userInfo } = result.result.data;
        
        // 存储登录信息
        wx.setStorageSync('token', token);
        wx.setStorageSync('userInfo', userInfo);
        
        // 更新全局状态
        app.globalData.isLoggedIn = true;
        app.globalData.userInfo = userInfo;

        app.showSuccess('登录成功');
        
        // 跳转到首页
        setTimeout(() => {
          this.redirectToHome();
        }, 1000);
      } else {
        throw new Error(result.result.message || '登录失败');
      }
    } catch (error) {
      console.error('登录失败:', error);
      app.showError('登录失败，请重试');
    } finally {
      this.setData({ loginLoading: false });
    }
  },

  // 手机号登录
  onPhoneLogin() {
    if (!this.data.agreement.checked) {
      app.showError('请先阅读并同意用户协议和隐私政策');
      return;
    }

    wx.navigateTo({
      url: '/pages/phone-login/index'
    });
  },

  // 协议勾选
  onAgreementChange(e) {
    this.setData({
      'agreement.checked': e.detail.value.length > 0
    });
  },

  // 跳转到首页
  redirectToHome() {
    wx.switchTab({
      url: '/pages/posts/index'
    });
  },

  // 跳转协议页面
  onAgreementTap(e) {
    const { url } = e.currentTarget.dataset;
    wx.navigateTo({
      url: url
    });
  },

  // 用户信息授权
  onGetUserInfo(e) {
    const { userInfo } = e.detail;
    if (userInfo) {
      // 更新用户信息
      this.updateUserInfo(userInfo);
    }
  },

  // 更新用户信息
  async updateUserInfo(userInfo) {
    try {
      const result = await wx.cloud.callFunction({
        name: 'user',
        data: {
          action: 'updateUserInfo',
          userInfo: userInfo
        }
      });

      if (result.result && result.result.success) {
        // 更新本地存储
        wx.setStorageSync('userInfo', userInfo);
        app.globalData.userInfo = userInfo;
        
        app.showSuccess('信息更新成功');
      }
    } catch (error) {
      console.error('更新用户信息失败:', error);
    }
  },

  // 退出登录
  onLogout() {
    wx.showModal({
      title: '确认退出',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          this.logout();
        }
      }
    });
  },

  logout() {
    // 清除本地存储
    wx.removeStorageSync('token');
    wx.removeStorageSync('userInfo');
    
    // 更新全局状态
    app.globalData.isLoggedIn = false;
    app.globalData.userInfo = null;

    this.setData({
      isLogin: false,
      userInfo: null
    });

    app.showSuccess('已退出登录');
  }
});