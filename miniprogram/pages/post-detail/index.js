const app = getApp();
const FormatTime = require('../../utils/formatTime.js');

Page({
  data: {
    customNavHeight: 0,
    navBarHeight: 88,
    postId: '',
    post: null,
    comments: [],
    loading: false,
    commentLoading: false,
    hasMore: true,
    page: 1,
    pageSize: 10,
    commentText: '',
    replyingTo: null,
    showCommentInput: false,
    liked: false,
    likeCount: 0,
    collected: false,
    shareMenu: false
  },

  onLoad(options) {
    const { id } = options;
    // 设置导航栏高度
    this.setData({
      navBarHeight: app.globalData.navBarHeight || 88,
      postId: id
    });

    this.loadPostDetail();
    this.loadComments();
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

  onPullDownRefresh() {
    this.refreshData();
  },

  onReachBottom() {
    this.loadMoreComments();
  },

  // 加载帖子详情
  async loadPostDetail() {
    this.setData({ loading: true });

    try {
      const result = await wx.cloud.callFunction({
        name: 'post',
        data: {
          action: 'getPostDetail',
          postId: this.data.postId
        }
      });

      if (result.result && result.result.success) {
        const post = result.result.data;
        this.setData({
          post: {
            ...post,
            createTime: FormatTime.friendlyTime(post.createTime)
          },
          liked: post.isLiked,
          likeCount: post.likeCount,
          collected: post.isCollected
        });
      } else {
        throw new Error(result.result.message || '加载失败');
      }
    } catch (error) {
      console.error('加载帖子详情失败:', error);
      app.showError('加载失败，请重试');
    } finally {
      this.setData({ loading: false });
      wx.stopPullDownRefresh();
    }
  },

  // 加载评论
  async loadComments(showLoading = false) {
    if (this.data.commentLoading) return;

    this.setData({ commentLoading: true });

    if (showLoading) {
      app.showLoading('加载中...');
    }

    try {
      const result = await wx.cloud.callFunction({
        name: 'comment',
        data: {
          action: 'getComments',
          postId: this.data.postId,
          page: this.data.page,
          pageSize: this.data.pageSize
        }
      });

      if (result.result && result.result.success) {
        const { comments, hasMore } = result.result.data;
        
        const formattedComments = comments.map(comment => ({
          ...comment,
          createTime: FormatTime.friendlyTime(comment.createTime),
          replies: comment.replies ? comment.replies.map(reply => ({
            ...reply,
            createTime: FormatTime.friendlyTime(reply.createTime)
          })) : []
        }));

        this.setData({
          comments: this.data.page === 1 ? formattedComments : [...this.data.comments, ...formattedComments],
          hasMore: hasMore
        });

        if (showLoading) {
          wx.hideLoading();
        }
      } else {
        throw new Error(result.result.message || '加载失败');
      }
    } catch (error) {
      console.error('加载评论失败:', error);
      app.showError('加载失败，请重试');
    } finally {
      this.setData({ commentLoading: false });
    }
  },

  // 刷新数据
  refreshData() {
    this.setData({
      page: 1
    });
    this.loadPostDetail();
    this.loadComments();
  },

  // 加载更多评论
  loadMoreComments() {
    if (!this.data.hasMore || this.data.commentLoading) return;

    this.setData({
      page: this.data.page + 1
    });
    this.loadComments();
  },

  // 点赞帖子
  async onLikePost() {
    const { liked, likeCount, postId } = this.data;
    const newLiked = !liked;
    const newLikeCount = newLiked ? likeCount + 1 : likeCount - 1;

    // 立即更新UI
    this.setData({
      liked: newLiked,
      likeCount: newLikeCount
    });

    try {
      const result = await wx.cloud.callFunction({
        name: 'post',
        data: {
          action: 'likePost',
          postId: postId,
          isLiked: newLiked
        }
      });

      if (!result.result.success) {
        // 回退状态
        this.setData({
          liked: !newLiked,
          likeCount: newLiked ? newLikeCount - 1 : newLikeCount + 1
        });
        app.showError('操作失败');
      }
    } catch (error) {
      console.error('点赞失败:', error);
      // 回退状态
      this.setData({
        liked: !newLiked,
        likeCount: newLiked ? newLikeCount - 1 : newLikeCount + 1
      });
      app.showError('操作失败');
    }
  },

  // 收藏帖子
  async onCollectPost() {
    const { collected, postId } = this.data;
    const newCollected = !collected;

    // 立即更新UI
    this.setData({ collected: newCollected });

    try {
      const result = await wx.cloud.callFunction({
        name: 'post',
        data: {
          action: 'collectPost',
          postId: postId,
          isCollected: newCollected
        }
      });

      if (result.result.success) {
        app.showSuccess(newCollected ? '收藏成功' : '已取消收藏');
      } else {
        // 回退状态
        this.setData({ collected: !newCollected });
        app.showError('操作失败');
      }
    } catch (error) {
      console.error('收藏失败:', error);
      // 回退状态
      this.setData({ collected: !newCollected });
      app.showError('操作失败');
    }
  },

  // 显示评论输入框
  onShowCommentInput() {
    this.setData({
      showCommentInput: true,
      replyingTo: null,
      commentText: ''
    });
  },

  // 回复评论
  onReplyComment(e) {
    const { comment } = e.detail;
    this.setData({
      showCommentInput: true,
      replyingTo: comment,
      commentText: `@${comment.authorName} `
    });
  },

  // 输入评论
  onCommentInput(e) {
    this.setData({
      commentText: e.detail.value
    });
  },

  // 提交评论
  async onSubmitComment() {
    const { commentText, replyingTo, postId } = this.data;

    if (!commentText.trim()) {
      app.showError('请输入评论内容');
      return;
    }

    const commentData = {
      postId: postId,
      content: commentText.trim()
    };

    if (replyingTo) {
      commentData.replyTo = replyingTo._id;
      commentData.replyToName = replyingTo.authorName;
    }

    try {
      const result = await wx.cloud.callFunction({
        name: 'comment',
        data: {
          action: 'createComment',
          ...commentData
        }
      });

      if (result.result && result.result.success) {
        this.setData({
          commentText: '',
          showCommentInput: false,
          replyingTo: null,
          page: 1
        });

        app.showSuccess(replyingTo ? '回复成功' : '评论成功');
        
        // 重新加载评论
        this.loadComments();
      } else {
        throw new Error(result.result.message || '评论失败');
      }
    } catch (error) {
      console.error('评论失败:', error);
      app.showError('评论失败，请重试');
    }
  },

  // 点赞评论
  async onLikeComment(e) {
    const { commentid, liked } = e.detail;
    
    try {
      const result = await wx.cloud.callFunction({
        name: 'comment',
        data: {
          action: 'likeComment',
          commentId: commentid,
          isLiked: liked
        }
      });

      if (!result.result.success) {
        app.showError('操作失败');
      }
    } catch (error) {
      console.error('点赞评论失败:', error);
      app.showError('操作失败');
    }
  },

  // 显示分享菜单
  onShowShareMenu() {
    this.setData({ shareMenu: true });
  },

  // 隐藏分享菜单
  onHideShareMenu() {
    this.setData({ shareMenu: false });
  },

  // 分享帖子
  onSharePost() {
    this.setData({ shareMenu: false });
    
    // 这里可以调用微信的分享功能
    app.showSuccess('已生成分享卡片');
  },

  // 复制链接
  onCopyLink() {
    const link = `https://your-domain.com/post/${this.data.postId}`;
    wx.setClipboardData({
      data: link,
      success: () => {
        app.showSuccess('链接已复制');
        this.setData({ shareMenu: false });
      }
    });
  },

  // 举报帖子
  onReportPost() {
    wx.showModal({
      title: '举报帖子',
      content: '请选择举报原因',
      confirmText: '确定举报',
      success: (res) => {
        if (res.confirm) {
          this.reportPost();
        }
      }
    });
  },

  // 执行举报
  async reportPost() {
    try {
      const result = await wx.cloud.callFunction({
        name: 'post',
        data: {
          action: 'reportPost',
          postId: this.data.postId
        }
      });

      if (result.result && result.result.success) {
        app.showSuccess('举报成功，我们会尽快处理');
      } else {
        throw new Error(result.result.message || '举报失败');
      }
    } catch (error) {
      console.error('举报失败:', error);
      app.showError('举报失败，请重试');
    }
  },

  // 点击用户头像
  onAvatarTap(e) {
    const { userid } = e.detail;
    wx.navigateTo({
      url: `/pages/profile/other?id=${userid}`
    });
  },

  // 返回上一页
  onNavigateBack() {
    wx.navigateBack();
  }
});