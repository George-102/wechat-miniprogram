const app = getApp();
const FormatTime = require('../../utils/formatTime.js');

Page({
  data: {
    customNavHeight: 0,
    posts: [],
    loading: false,
    hasMore: true,
    page: 1,
    pageSize: 10,
    refreshing: false,
    categories: [
      { id: 'all', name: '全部', active: true },
      { id: 'hot', name: '热门', active: false },
      { id: 'follow', name: '关注', active: false },
      { id: 'recommend', name: '推荐', active: false }
    ],
    activeCategory: 'all'
  },

  onLoad(options) {
    this.setData({
      customNavHeight: app.globalData.customNavHeight
    });

    this.loadPosts(true);
  },

  onShow() {
    // 刷新用户状态
    this.checkUserStatus();
  },

  onPullDownRefresh() {
    this.refreshPosts();
  },

  onReachBottom() {
    this.loadMorePosts();
  },

  // 检查用户状态
  checkUserStatus() {
    if (!app.globalData.isLoggedIn) {
      // 未登录，跳转到登录页
      wx.redirectTo({
        url: '/pages/auth/index'
      });
      return;
    }
  },

  // 加载帖子
  async loadPosts(showLoading = false) {
    if (this.data.loading) return;

    this.setData({ loading: true });

    if (showLoading) {
      app.showLoading('加载中...');
    }

    try {
      const result = await wx.cloud.callFunction({
        name: 'post',
        data: {
          action: 'getPosts',
          category: this.data.activeCategory,
          page: this.data.page,
          pageSize: this.data.pageSize
        }
      });

      if (result.result && result.result.success) {
        const { posts, hasMore } = result.result.data;
        
        const formattedPosts = posts.map(post => ({
          ...post,
          createTime: FormatTime.friendlyTime(post.createTime),
          isLiked: post.likes && post.likes.includes(app.globalData.userInfo._id)
        }));

        this.setData({
          posts: this.data.page === 1 ? formattedPosts : [...this.data.posts, ...formattedPosts],
          hasMore: hasMore
        });

        if (showLoading) {
          wx.hideLoading();
        }
      } else {
        throw new Error(result.result.message || '加载失败');
      }
    } catch (error) {
      console.error('加载帖子失败:', error);
      app.showError('加载失败，请重试');
      
      if (showLoading) {
        wx.hideLoading();
      }
    } finally {
      this.setData({ 
        loading: false,
        refreshing: false
      });
      wx.stopPullDownRefresh();
    }
  },

  // 刷新帖子
  refreshPosts() {
    this.setData({
      page: 1,
      refreshing: true
    });
    this.loadPosts();
  },

  // 加载更多帖子
  loadMorePosts() {
    if (!this.data.hasMore || this.data.loading) return;

    this.setData({
      page: this.data.page + 1
    });
    this.loadPosts();
  },

  // 切换分类
  onCategoryTap(e) {
    const { category } = e.currentTarget.dataset;
    
    if (category === this.data.activeCategory) return;

    // 更新分类状态
    const categories = this.data.categories.map(item => ({
      ...item,
      active: item.id === category
    }));

    this.setData({
      categories,
      activeCategory: category,
      page: 1
    });

    this.loadPosts(true);
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
    const posts = this.data.posts.map(post => {
      if (post._id === postId) {
        return {
          ...post,
          isLiked: !isLiked,
          likeCount: isLiked ? post.likeCount - 1 : post.likeCount + 1
        };
      }
      return post;
    });

    this.setData({ posts });
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
    // 可以在这里实现分享逻辑
    app.showSuccess('已生成分享卡片');
  },

  // 点击用户头像
  onAvatarTap(e) {
    const { userid } = e.detail;
    wx.navigateTo({
      url: `/pages/profile/other?id=${userid}`
    });
  },

  // 发布帖子
  onPublishTap() {
    wx.navigateTo({
      url: '/pages/publish/index'
    });
  },

  // 搜索
  onSearchTap() {
    wx.navigateTo({
      url: '/pages/search/index'
    });
  }
});