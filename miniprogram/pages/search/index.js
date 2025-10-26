const app = getApp();
const FormatTime = require('../../utils/formatTime.js');

Page({
  data: {
    navBarHeight: 88,
    customNavHeight: 0,
    searchValue: '',
    searchHistory: [],
    hotSearches: [
      { keyword: '科技', count: 1254 },
      { keyword: '美食', count: 987 },
      { keyword: '旅行', count: 856 },
      { keyword: '编程', count: 743 },
      { keyword: '摄影', count: 632 }
    ],
    searchResults: [],
    searching: false,
    hasMore: true,
    page: 1,
    pageSize: 10,
    activeTab: 'post', // post, user, tag
    tabs: [
      { id: 'post', name: '帖子' },
      { id: 'user', name: '用户' },
      { id: 'tag', name: '标签' }
    ]
  },

  onLoad(options) {
    this.setData({
      navBarHeight: app.globalData.navBarHeight || 88
    });

    // 加载搜索历史
    this.loadSearchHistory();
  },

  onShow() {
    // 刷新搜索历史
    this.loadSearchHistory();
  },

  // 加载搜索历史
  loadSearchHistory() {
    const history = wx.getStorageSync('searchHistory') || [];
    this.setData({ searchHistory: history });
  },

  // 保存搜索历史
  saveSearchHistory(keyword) {
    let history = wx.getStorageSync('searchHistory') || [];
    
    // 移除已存在的关键词
    history = history.filter(item => item !== keyword);
    
    // 添加到开头
    history.unshift(keyword);
    
    // 只保留最近10条
    history = history.slice(0, 10);
    
    wx.setStorageSync('searchHistory', history);
    this.setData({ searchHistory: history });
  },

  // 输入搜索内容
  onSearchInput(e) {
    this.setData({
      searchValue: e.detail.value
    });

    // 实时搜索
    if (e.detail.value.trim()) {
      this.debouncedSearch();
    } else {
      this.setData({
        searchResults: [],
        searching: false
      });
    }
  },

  // 防抖搜索
  debouncedSearch: null,

  onReady() {
    // 初始化防抖函数
    this.debouncedSearch = this.debounce(() => {
      this.doSearch();
    }, 300);
  },

  // 防抖函数
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  // 执行搜索
  async doSearch() {
    if (!this.data.searchValue.trim()) return;

    this.setData({
      searching: true,
      page: 1,
      searchResults: []
    });

    try {
      const result = await wx.cloud.callFunction({
        name: 'search',
        data: {
          action: 'search',
          keyword: this.data.searchValue,
          type: this.data.activeTab,
          page: this.data.page,
          pageSize: this.data.pageSize
        }
      });

      if (result.result && result.result.success) {
        const { results, hasMore } = result.result.data;
        
        // 格式化结果
        const formattedResults = results.map(item => {
          if (this.data.activeTab === 'post') {
            return {
              ...item,
              createTime: FormatTime.friendlyTime(item.createTime)
            };
          }
          return item;
        });

        this.setData({
          searchResults: formattedResults,
          hasMore: hasMore
        });

        // 保存搜索历史
        this.saveSearchHistory(this.data.searchValue);
      } else {
        throw new Error(result.result.message || '搜索失败');
      }
    } catch (error) {
      console.error('搜索失败:', error);
      app.showError('搜索失败，请重试');
    } finally {
      this.setData({ searching: false });
    }
  },

  // 搜索提交
  onSearchSubmit() {
    if (!this.data.searchValue.trim()) {
      app.showError('请输入搜索内容');
      return;
    }

    this.doSearch();
  },

  // 清除搜索
  onClearSearch() {
    this.setData({
      searchValue: '',
      searchResults: [],
      searching: false
    });
  },

  // 点击历史记录
  onHistoryTap(e) {
    const { keyword } = e.currentTarget.dataset;
    this.setData({
      searchValue: keyword
    });
    this.doSearch();
  },

  // 点击热门搜索
  onHotSearchTap(e) {
    const { keyword } = e.currentTarget.dataset;
    this.setData({
      searchValue: keyword
    });
    this.doSearch();
  },

  // 清除历史记录
  onClearHistory() {
    wx.showModal({
      title: '确认清除',
      content: '确定要清除搜索历史吗？',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('searchHistory');
          this.setData({ searchHistory: [] });
          app.showSuccess('已清除搜索历史');
        }
      }
    });
  },

  // 切换标签
  onTabTap(e) {
    const { tab } = e.currentTarget.dataset;
    
    if (tab === this.data.activeTab) return;

    this.setData({
      activeTab: tab,
      searchResults: [],
      page: 1
    });

    // 如果有搜索内容，重新搜索
    if (this.data.searchValue.trim()) {
      this.doSearch();
    }
  },

  // 加载更多
  onLoadMore() {
    if (!this.data.hasMore || this.data.searching) return;

    this.setData({
      page: this.data.page + 1
    });
    this.loadMoreResults();
  },

  // 加载更多结果
  async loadMoreResults() {
    this.setData({ searching: true });

    try {
      const result = await wx.cloud.callFunction({
        name: 'search',
        data: {
          action: 'search',
          keyword: this.data.searchValue,
          type: this.data.activeTab,
          page: this.data.page,
          pageSize: this.data.pageSize
        }
      });

      if (result.result && result.result.success) {
        const { results, hasMore } = result.result.data;
        
        const formattedResults = results.map(item => {
          if (this.data.activeTab === 'post') {
            return {
              ...item,
              createTime: FormatTime.friendlyTime(item.createTime)
            };
          }
          return item;
        });

        this.setData({
          searchResults: [...this.data.searchResults, ...formattedResults],
          hasMore: hasMore
        });
      }
    } catch (error) {
      console.error('加载更多失败:', error);
      app.showError('加载失败');
    } finally {
      this.setData({ searching: false });
    }
  },

  // 点击搜索结果
  onResultTap(e) {
    const { item, type } = e.currentTarget.dataset;
    
    switch (type) {
      case 'post':
        wx.navigateTo({
          url: `/pages/post-detail/index?id=${item._id}`
        });
        break;
      case 'user':
        wx.navigateTo({
          url: `/pages/profile/other?id=${item._id}`
        });
        break;
      case 'tag':
        // 跳转到标签页面
        break;
    }
  }
});