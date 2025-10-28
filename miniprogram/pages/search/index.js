const app = getApp();
const FormatTime = require('../../utils/formatTime.js');

Page({
  data: {
    customNavHeight: 0,
    searchKeyword: '',
    searchResult: null,
    activeTab: 'realtime', // realtime, history
    loading: false,
    hotTags: [
      { id: 1, name: '求助', count: 1234 },
      { id: 2, name: '交友', count: 856 },
      { id: 3, name: '闲置', count: 642 },
      { id: 4, name: '跑腿', count: 521 },
      { id: 5, name: '吃瓜', count: 487 }
    ],
    searchHistory: [],
    autoFocus: true
  },

  onLoad(options) {
    this.setData({
      customNavHeight: app.globalData.customNavHeight
    });

    // 加载搜索历史
    this.loadSearchHistory();
  },

  onShow() {
    // 检查登录状态
    if (!app.globalData.isLoggedIn) {
      wx.redirectTo({
        url: '/pages/auth/index'
      });
      return;
    }
  },

  // 加载搜索历史
  loadSearchHistory() {
    const history = wx.getStorageSync('searchHistory') || [];
    this.setData({
      searchHistory: history
    });
  },

  // 保存搜索历史
  saveSearchHistory(keyword) {
    if (!keyword.trim()) return;

    let history = wx.getStorageSync('searchHistory') || [];
    
    // 移除已存在的关键词
    history = history.filter(item => item !== keyword);
    
    // 添加到开头
    history.unshift(keyword);
    
    // 限制历史记录数量
    if (history.length > 10) {
      history = history.slice(0, 10);
    }
    
    wx.setStorageSync('searchHistory', history);
    this.setData({
      searchHistory: history
    });
  },

  // 搜索输入
  onSearchInput(e) {
    this.setData({
      searchKeyword: e.detail.value
    });
  },

  // 确认搜索
  onSearchConfirm() {
    const keyword = this.data.searchKeyword.trim();
    if (!keyword) {
      app.showError('请输入搜索关键词');
      return;
    }

    this.saveSearchHistory(keyword);
    this.performSearch(keyword);
  },

  // 执行搜索
  async performSearch(keyword) {
    this.setData({
      loading: true,
      searchResult: null
    });

    try {
      const result = await wx.cloud.callFunction({
        name: 'search',
        data: {
          action: 'search',
          keyword: keyword,
          type: 'post',
          page: 1,
          pageSize: 20
        }
      });

      if (result.result && result.result.success) {
        const posts = result.result.data.results.map(post => ({
          ...post,
          createTime: FormatTime.friendlyTime(post.createTime)
        }));

        this.setData({
          searchResult: {
            posts: posts,
            hasMore: result.result.data.hasMore
          },
          loading: false
        });
      } else {
        throw new Error(result.result.message || '搜索失败');
      }
    } catch (error) {
      console.error('搜索失败:', error);
      app.showError('搜索失败，请重试');
      this.setData({
        loading: false
      });
    }
  },

  // 切换标签
  onTabSwitch(e) {
    const { tab } = e.currentTarget.dataset;
    if (tab === this.data.activeTab) return;

    this.setData({
      activeTab: tab
    });

    // 这里可以根据标签重新搜索
    if (this.data.searchKeyword) {
      this.performSearch(this.data.searchKeyword);
    }
  },

  // 点击热门标签
  onHotTagTap(e) {
    const { tag } = e.currentTarget.dataset;
    this.setData({
      searchKeyword: tag
    });
    this.performSearch(tag);
  },

  // 点击历史记录
  onHistoryItemTap(e) {
    const { keyword } = e.currentTarget.dataset;
    this.setData({
      searchKeyword: keyword
    });
    this.performSearch(keyword);
  },

  // 删除单个历史记录
  onDeleteHistoryItem(e) {
    const { keyword } = e.currentTarget.dataset;
    let history = this.data.searchHistory.filter(item => item !== keyword);
    
    wx.setStorageSync('searchHistory', history);
    this.setData({
      searchHistory: history
    });

    e.stopPropagation(); // 阻止事件冒泡
  },

  // 清空搜索历史
  onClearHistory() {
    wx.showModal({
      title: '确认清空',
      content: '确定要清空搜索历史吗？',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('searchHistory');
          this.setData({
            searchHistory: []
          });
          app.showSuccess('已清空搜索历史');
        }
      }
    });
  },

  // 取消搜索
  onCancelSearch() {
    wx.navigateBack();
  },

  // 返回上一页
  onNavigateBack() {
    wx.navigateBack();
  },

  // 点赞帖子
  async onLikePost(e) {
    const { postid, liked } = e.detail;
    
    try {
      const result = await wx.cloud.callFunction({
        name: 'post',
        data: {
          action: 'likePost',
          postId: postid,
          isLiked: liked
        }
      });

      if (!result.result.success) {
        // 回退状态
        this.rollbackLikeStatus(postid, liked);
        app.showError('操作失败');
      }
    } catch (error) {
      console.error('点赞失败:', error);
      this.rollbackLikeStatus(postid, liked);
      app.showError('操作失败');
    }
  },

  // 回退点赞状态
  rollbackLikeStatus(postId, isLiked) {
    if (!this.data.searchResult) return;

    const posts = this.data.searchResult.posts.map(post => {
      if (post._id === postId) {
        return {
          ...post,
          isLiked: !isLiked,
          likeCount: isLiked ? post.likeCount - 1 : post.likeCount + 1
        };
      }
      return post;
    });

    this.setData({
      'searchResult.posts': posts
    });
  },

  // 评论帖子
  onCommentPost(e) {
    const { postid } = e.detail;
    wx.navigateTo({
      url: `/pages/post-detail/index?id=${postid}`
    });
  },

  // 分享帖子
  onSharePost(e) {
    const { postid } = e.detail;
    app.showSuccess('已生成分享卡片');
  },

  // 点击用户头像
  onAvatarTap(e) {
    const { userid } = e.detail;
    wx.navigateTo({
      url: `/pages/profile/other?id=${userid}`
    });
  }
});