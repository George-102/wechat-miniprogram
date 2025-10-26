const app = getApp();
const FormatTime = require('../../utils/formatTime.js');

Page({
  data: {
    navBarHeight: 88, // 添加导航栏高度
    activeTab: 'all',
    customNavHeight: 0,
    activeTab: 'all', // all, unread, system
    tabs: [
      { id: 'all', name: '全部' },
      { id: 'unread', name: '未读' },
      { id: 'system', name: '系统' }
    ],
    messages: [],
    loading: false,
    hasMore: true,
    page: 1,
    pageSize: 15,
    unreadCount: 0, 
    messageIconMap: {
      comment: '💬',
      like: '❤️',
      follow: '👤',
      system: '📢',
      order: '📦',
      payment: '💰'
    }
  },

  onLoad(options) {
    // 设置导航栏高度
    this.setData({
      navBarHeight: app.globalData.navBarHeight || 88
    });

    this.loadMessages(true);
    this.getUnreadCount();
  },

  onShow() {
    // 刷新未读数量
    this.getUnreadCount();
  },

  onPullDownRefresh() {
    this.refreshMessages();
  },

  onReachBottom() {
    this.loadMoreMessages();
  },

  // 加载消息
  async loadMessages(showLoading = false) {
    if (this.data.loading) return;

    this.setData({ loading: true });

    if (showLoading) {
      app.showLoading('加载中...');
    }

    try {
      const result = await wx.cloud.callFunction({
        name: 'message',
        data: {
          action: 'getMessages',
          type: this.data.activeTab,
          page: this.data.page,
          pageSize: this.data.pageSize
        }
      });

      if (result.result && result.result.success) {
        const { messages, hasMore } = result.result.data;
        
        const formattedMessages = messages.map(msg => ({
          ...msg,
          createTime: FormatTime.chatTime(msg.createTime),
          isExpanded: false
        }));

        this.setData({
          messages: this.data.page === 1 ? formattedMessages : [...this.data.messages, ...formattedMessages],
          hasMore: hasMore
        });

        if (showLoading) {
          wx.hideLoading();
        }
      } else {
        throw new Error(result.result.message || '加载失败');
      }
    } catch (error) {
      console.error('加载消息失败:', error);
      app.showError('加载失败，请重试');
    } finally {
      this.setData({ 
        loading: false
      });
      wx.stopPullDownRefresh();
    }
  },

  // 刷新消息
  refreshMessages() {
    this.setData({
      page: 1
    });
    this.loadMessages();
  },

  // 加载更多消息
  loadMoreMessages() {
    if (!this.data.hasMore || this.data.loading) return;

    this.setData({
      page: this.data.page + 1
    });
    this.loadMessages();
  },

  // 切换标签
  onTabTap(e) {
    const { tab } = e.currentTarget.dataset;
    
    if (tab === this.data.activeTab) return;

    this.setData({
      activeTab: tab,
      page: 1,
      messages: []
    });

    this.loadMessages(true);
  },

  // 获取未读数量
  async getUnreadCount() {
    try {
      const result = await wx.cloud.callFunction({
        name: 'message',
        data: {
          action: 'getUnreadCount'
        }
      });

      if (result.result && result.result.success) {
        this.setData({
          unreadCount: result.result.data.count || 0
        });

        // 设置tabBar徽章
        if (result.result.data.count > 0) {
          wx.setTabBarBadge({
            index: 2,
            text: result.result.data.count > 99 ? '99+' : result.result.data.count.toString()
          });
        } else {
          wx.removeTabBarBadge({
            index: 2
          });
        }
      }
    } catch (error) {
      console.error('获取未读消息数失败:', error);
    }
  },

  // 标记为已读
  async markAsRead(e) {
    const { messageid } = e.currentTarget.dataset;
    
    try {
      const result = await wx.cloud.callFunction({
        name: 'message',
        data: {
          action: 'markAsRead',
          messageId: messageid
        }
      });

      if (result.result && result.result.success) {
        // 更新本地状态
        const messages = this.data.messages.map(msg => 
          msg._id === messageid ? { ...msg, isRead: true } : msg
        );

        this.setData({ messages });

        // 更新未读数量
        this.getUnreadCount();

        app.showSuccess('已标记为已读');
      }
    } catch (error) {
      console.error('标记已读失败:', error);
      app.showError('操作失败');
    }
  },

  // 删除消息
  onDeleteMessage(e) {
    const { messageid } = e.currentTarget.dataset;
    
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条消息吗？',
      success: async (res) => {
        if (res.confirm) {
          await this.deleteMessage(messageid);
        }
      }
    });
  },

  // 执行删除
  async deleteMessage(messageId) {
    try {
      const result = await wx.cloud.callFunction({
        name: 'message',
        data: {
          action: 'deleteMessage',
          messageId: messageId
        }
      });

      if (result.result && result.result.success) {
        // 从列表中移除
        const messages = this.data.messages.filter(msg => msg._id !== messageId);
        this.setData({ messages });

        app.showSuccess('删除成功');
      } else {
        throw new Error(result.result.message || '删除失败');
      }
    } catch (error) {
      console.error('删除消息失败:', error);
      app.showError('删除失败');
    }
  },

  // 点击消息
  onMessageTap(e) {
    const { message } = e.currentTarget.dataset;
    
    // 根据消息类型处理点击事件
    switch (message.type) {
      case 'comment':
        // 跳转到帖子详情
        wx.navigateTo({
          url: `/pages/post-detail/index?id=${message.relatedId}`
        });
        break;
      case 'like':
        wx.navigateTo({
          url: `/pages/post-detail/index?id=${message.relatedId}`
        });
        break;
      case 'follow':
        // 跳转到用户主页
        wx.navigateTo({
          url: `/pages/profile/other?id=${message.senderId}`
        });
        break;
      case 'system':
        // 展开/收起系统消息
        this.toggleMessageExpand(message._id);
        break;
      default:
        break;
    }

    // 标记为已读
    if (!message.isRead) {
      this.markAsRead({ currentTarget: { dataset: { messageid: message._id } } });
    }
  },

  // 切换消息展开状态
  toggleMessageExpand(messageId) {
    const messages = this.data.messages.map(msg => 
      msg._id === messageId ? { ...msg, isExpanded: !msg.isExpanded } : msg
    );

    this.setData({ messages });
  },

  // 清空消息
  onClearAll() {
    wx.showModal({
      title: '确认清空',
      content: '确定要清空所有消息吗？',
      success: async (res) => {
        if (res.confirm) {
          await this.clearAllMessages();
        }
      }
    });
  },

  // 执行清空
  async clearAllMessages() {
    try {
      const result = await wx.cloud.callFunction({
        name: 'message',
        data: {
          action: 'clearAllMessages'
        }
      });

      if (result.result && result.result.success) {
        this.setData({
          messages: [],
          page: 1
        });

        app.showSuccess('清空成功');
      } else {
        throw new Error(result.result.message || '清空失败');
      }
    } catch (error) {
      console.error('清空消息失败:', error);
      app.showError('清空失败');
    }
  },

  // 跳转到聊天
  onChatTap() {
    wx.navigateTo({
      url: '/pages/chat/list'
    });
  },

  getMessageIcon(type) {
    return this.data.messageIconMap[type] || '📨';
  }
});