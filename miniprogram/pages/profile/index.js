const app = getApp();
const FormatTime = require('../../utils/formatTime.js');

Page({
  data: {
    customNavHeight: 0,
    userInfo: null,
    stats: {
      posts: 0,
      likes: 0,
      followers: 0,
      following: 0
    },
    menus: [
      {
        id: 'myPosts',
        name: '我的帖子',
        icon: '📝',
        color: '#007AFF'
      },
      {
        id: 'myComments',
        name: '我的评论',
        icon: '💬',
        color: '#34C759'
      },
      {
        id: 'myLikes',
        name: '我的点赞',
        icon: '❤️',
        color: '#FF3B30'
      },
      {
        id: 'myOrders',
        name: '我的订单',
        icon: '📦',
        color: '#5856D6'
      },
      {
        id: 'settings',
        name: '设置',
        icon: '⚙️',
        color: '#8E8E93'
      },
      {
        id: 'about',
        name: '关于我们',
        icon: 'ℹ️',
        color: '#FF9500'
      }
    ],
    level: 1,
    exp: 0,
    nextLevelExp: 100,
    progress: 0
  },

  onLoad(options) {
    this.setData({
      customNavHeight: app.globalData.customNavHeight
    });
  },

  onShow() {
    this.loadUserData();
  },

  onPullDownRefresh() {
    this.loadUserData();
  },

  // 加载用户数据
  async loadUserData() {
  if (!app.globalData.isLoggedIn) {
    wx.redirectTo({
      url: '/pages/auth/index'
    });
    return;
  }

  app.showLoading('加载中...');

  try {
    // 使用 getUserInfo 而不是 getProfile
    const result = await wx.cloud.callFunction({
      name: 'user',
      data: {
        action: 'getUserInfo'
      }
    });

    if (result.result && result.result.success) {
      const userInfo = result.result.data;
      
      // 构建统计信息
      const stats = {
        posts: userInfo.postCount || 0,
        likes: userInfo.likeCount || 0,
        followers: userInfo.followerCount || 0,
        following: userInfo.followingCount || 0
      };

      // 构建等级信息
      const levelInfo = {
        level: userInfo.level || 1,
        exp: userInfo.exp || 0,
        nextLevelExp: userInfo.nextLevelExp || 100
      };

      this.setData({
        userInfo: userInfo,
        stats: stats,
        level: levelInfo.level,
        exp: levelInfo.exp,
        nextLevelExp: levelInfo.nextLevelExp,
        progress: Math.min((levelInfo.exp / levelInfo.nextLevelExp) * 100, 100)
      });

      wx.setStorageSync('userInfo', userInfo);
      app.globalData.userInfo = userInfo;
    } else {
      throw new Error(result.result.message || '加载失败');
    }
  } catch (error) {
    console.error('加载用户数据失败:', error);
    app.showError('加载失败，请重试');
  } finally {
    wx.hideLoading();
    wx.stopPullDownRefresh();
  }
},

  // 点击菜单项
  onMenuTap(e) {
    const { id } = e.currentTarget.dataset;
    
    switch (id) {
      case 'myPosts':
        wx.navigateTo({
          url: '/pages/profile/posts'
        });
        break;
      case 'myComments':
        wx.navigateTo({
          url: '/pages/profile/comments'
        });
        break;
      case 'myLikes':
        wx.navigateTo({
          url: '/pages/profile/likes'
        });
        break;
      case 'myOrders':
        wx.navigateTo({
          url: '/pages/orders/index'
        });
        break;
      case 'settings':
        wx.navigateTo({
          url: '/pages/settings/index'
        });
        break;
      case 'about':
        wx.navigateTo({
          url: '/pages/about/index'
        });
        break;
    }
  },

  // 编辑资料
  onEditProfile() {
    wx.navigateTo({
      url: '/pages/profile/edit'
    });
  },

  // 点击头像
  onAvatarTap() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        this.uploadAvatar(res.tempFilePaths[0]);
      }
    });
  },

  // 上传头像
  async uploadAvatar(tempFilePath) {
    app.showLoading('上传中...');

    try {
      // 上传到云存储
      const uploadResult = await wx.cloud.uploadFile({
        cloudPath: `avatars/${Date.now()}-${Math.random().toString(36).substr(2)}.jpg`,
        filePath: tempFilePath
      });

      // 更新用户头像
      const result = await wx.cloud.callFunction({
        name: 'user',
        data: {
          action: 'updateAvatar',
          avatarUrl: uploadResult.fileID
        }
      });

      if (result.result && result.result.success) {
        // 更新本地数据
        const userInfo = { ...this.data.userInfo, avatarUrl: uploadResult.fileID };
        this.setData({ userInfo });
        wx.setStorageSync('userInfo', userInfo);
        app.globalData.userInfo = userInfo;

        app.showSuccess('头像更新成功');
      } else {
        throw new Error(result.result.message || '更新失败');
      }
    } catch (error) {
      console.error('上传头像失败:', error);
      app.showError('上传失败，请重试');
    } finally {
      wx.hideLoading();
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

    // 跳转到登录页
    wx.redirectTo({
      url: '/pages/auth/index'
    });

    app.showSuccess('已退出登录');
  }
});