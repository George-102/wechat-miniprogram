// auth/index.js - 清理后的版本
const app = getApp();

Page({
  data: {
    navBarHeight: 88, 
    userInfo: null,
    isLogin: false,
    loginLoading: false,
    agreementChecked: false,
    cloudReady: false
  },

  onLoad(options) {
    // 设置导航栏高度
    this.setData({
      navBarHeight: app.globalData.navBarHeight || 88
    });
    
    this.checkCloudStatus();
    this.checkLoginStatus();
  },

  onShow() {
    this.checkCloudStatus();
    this.checkLoginStatus();
  },

    // 检查云服务状态
  checkCloudStatus() {
      if (app.globalData.cloudInitialized) {
        this.setData({ cloudReady: true });
      } else {
        // 如果云服务未就绪，延迟检查
        setTimeout(() => {
          this.checkCloudStatus();
        }, 500);
      }
  },

  checkLoginStatus() {
    const isLoggedIn = app.globalData.isLoggedIn;
    const userInfo = app.globalData.userInfo;
    
    this.setData({
      isLogin: isLoggedIn,
      userInfo: userInfo
    });

    if (isLoggedIn) {
      setTimeout(() => {
        this.redirectToHome();
      }, 1500);
    }
  },

  // 微信登录 - 完整的实现
  async onGetUserInfo(e) {
    console.log('获取用户信息事件:', e);
    
    // 检查云服务是否就绪
    if (!this.data.cloudReady) {
      wx.showToast({
        title: '服务初始化中，请稍后',
        icon: 'none'
      });
      return;
    }

    if (!this.data.agreementChecked) {
      wx.showToast({
        title: '请先同意协议',
        icon: 'none'
      });
      return;
    }

    if (e.detail.errMsg === 'getUserInfo:ok') {
      console.log('用户授权成功，用户信息:', e.detail.userInfo);
      this.setData({ loginLoading: true });
      await this.wechatLogin(e.detail.userInfo);
    } else {
      console.log('用户拒绝授权:', e.detail.errMsg);
      wx.showToast({
        title: '授权失败，请允许授权',
        icon: 'none'
      });
    }
  },

  // 微信登录核心逻辑
  async wechatLogin(userInfo) {
    try {
      console.log('开始微信登录流程');
      
      // 第一步：获取登录 code
      const loginResult = await new Promise((resolve, reject) => {
        wx.login({
          success: (res) => {
            if (res.code) {
              console.log('获取到微信登录code:', res.code);
              resolve(res);
            } else {
              reject(new Error('获取登录凭证失败: ' + res.errMsg));
            }
          },
          fail: (err) => {
            reject(new Error('wx.login 调用失败: ' + err.errMsg));
          }
        });
      });

      if (!loginResult.code) {
        throw new Error('获取登录凭证失败');
      }

      console.log('获取到登录code，调用云函数...');

      // 第二步：调用云函数
      const cloudResult = await wx.cloud.callFunction({
        name: 'auth',
        data: {
          action: 'login',
          code: loginResult.code,
          userInfo: userInfo
        }
      });

      console.log('云函数返回:', cloudResult);

      if (cloudResult.result && cloudResult.result.success) {
        const userData = cloudResult.result.data.userInfo;
        
        // 存储登录信息
        wx.setStorageSync('userInfo', userData);
        wx.setStorageSync('token', 'user-logged-in');
        
        // 更新全局状态
        app.globalData.isLoggedIn = true;
        app.globalData.userInfo = userData;

        console.log('登录成功，用户数据:', userData);
        
        wx.showToast({
          title: '登录成功',
          icon: 'success'
        });
        
        // 跳转到首页
        setTimeout(() => {
          this.redirectToHome();
        }, 1000);
      } else {
        throw new Error(cloudResult.result?.message || '登录失败');
      }
    } catch (error) {
      console.error('微信登录失败:', error);
      
      let errorMessage = '登录失败';
      if (error.errMsg && error.errMsg.includes('Cloud API isn\'t enabled')) {
        errorMessage = '云服务未初始化，请重启小程序';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      wx.showToast({
        title: errorMessage,
        icon: 'none',
        duration: 3000
      });
    } finally {
      this.setData({ loginLoading: false });
    }
  },

  // 手机号登录
  onPhoneLogin() {
    if (!this.data.agreementChecked) {
      wx.showToast({
        title: '请先同意协议',
        icon: 'none'
      });
      return;
    }

    this.showPhoneInputModal();
  },

  // 显示手机号输入弹窗
  showPhoneInputModal() {
    wx.showModal({
      title: '手机号登录',
      content: '请输入手机号进行模拟登录',
      editable: true,
      placeholderText: '请输入手机号',
      success: (res) => {
        if (res.confirm && res.content) {
          this.loginWithPhone(res.content);
        }
      }
    });
  },

  // 手机号登录实现
  async loginWithPhone(phoneNumber) {
    this.setData({ loginLoading: true });

    try {
      const mockUser = {
        _id: 'phone-user-' + Date.now(),
        _openid: 'mock-phone-openid',
        avatarUrl: '/images/default-avatar.png',
        nickName: `用户${phoneNumber.slice(-4)}`,
        phone: phoneNumber,
        gender: 0,
        level: 1,
        exp: 0,
        postCount: 0,
        likeCount: 0,
        followerCount: 0,
        followingCount: 0,
        balance: 0,
        createTime: new Date(),
        lastLoginTime: new Date(),
        status: 'active'
      };

      // 存储登录信息
      wx.setStorageSync('userInfo', mockUser);
      wx.setStorageSync('token', 'user-logged-in');
      
      // 更新全局状态
      app.globalData.isLoggedIn = true;
      app.globalData.userInfo = mockUser;

      console.log('手机号登录成功');
      wx.showToast({
        title: '登录成功',
        icon: 'success'
      });
      
      this.redirectToHome();
    } catch (error) {
      console.error('手机号登录失败:', error);
      wx.showToast({
        title: '登录失败',
        icon: 'none'
      });
    } finally {
      this.setData({ loginLoading: false });
    }
  },

  // 协议勾选
  onAgreementChange(e) {
    this.setData({
      agreementChecked: e.detail.value.length > 0
    });
  },

  // 显示协议详情
  showAgreementDetail() {
    wx.showModal({
      title: '用户协议和隐私政策',
      content: '欢迎使用我们的应用！请仔细阅读用户协议和隐私政策。',
      showCancel: false,
      confirmText: '我知道了'
    });
  },

  // 跳转到首页
  redirectToHome() {
    setTimeout(() => {
      wx.switchTab({
        url: '/pages/posts/index',
        fail: (err) => {
          console.error('跳转首页失败:', err);
          wx.reLaunch({
            url: '/pages/posts/index'
          });
        }
      });
    }, 1000);
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
    wx.removeStorageSync('token');
    wx.removeStorageSync('userInfo');
    app.globalData.isLoggedIn = false;
    app.globalData.userInfo = null;
    this.setData({
      isLogin: false,
      userInfo: null,
      agreementChecked: false
    });
    wx.showToast({
      title: '已退出登录',
      icon: 'success'
    });
  },

  // 调试方法
  testAgreement() {
    wx.showModal({
      title: '协议状态',
      content: `当前协议状态: ${this.data.agreementChecked ? '已同意' : '未同意'}`,
      showCancel: false
    });
  },

  forceAgreementTrue() {
    this.setData({
      agreementChecked: true
    });
    wx.showToast({
      title: '已同意协议',
      icon: 'success'
    });
  }
});