const app = getApp();

Page({
  data: {
    customNavHeight: 0,
    content: '',
    images: [],
    maxImages: 9,
    tag: '',
    tags: [
      { id: 'share', name: '分享', color: '#007AFF' },
      { id: 'question', name: '提问', color: '#34C759' },
      { id: 'discuss', name: '讨论', color: '#FF9500' },
      { id: 'news', name: '资讯', color: '#FF3B30' }
    ],
    selectedTag: 'share',
    location: '',
    isAnonymous: false,
    publishing: false,
    wordCount: 0,
    maxWords: 1000
  },

  onLoad(options) {
    this.setData({
      customNavHeight: app.globalData.customNavHeight
    });
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

  // 输入内容
  onContentInput(e) {
    const content = e.detail.value;
    this.setData({
      content: content,
      wordCount: content.length
    });
  },

  // 选择图片
  onChooseImage() {
    const { images, maxImages } = this.data;
    const count = maxImages - images.length;

    if (count <= 0) {
      app.showError(`最多只能选择${maxImages}张图片`);
      return;
    }

    wx.chooseImage({
      count: count,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        this.setData({
          images: [...this.data.images, ...res.tempFilePaths]
        });
      }
    });
  },

  // 预览图片
  onPreviewImage(e) {
    const { index } = e.currentTarget.dataset;
    wx.previewImage({
      current: this.data.images[index],
      urls: this.data.images
    });
  },

  // 删除图片
  onDeleteImage(e) {
    const { index } = e.currentTarget.dataset;
    const images = [...this.data.images];
    images.splice(index, 1);
    this.setData({ images });
  },

  // 选择标签
  onTagTap(e) {
    const { tag } = e.currentTarget.dataset;
    this.setData({ selectedTag: tag });
  },

  // 切换匿名
  onAnonymousChange(e) {
    this.setData({
      isAnonymous: e.detail.value.length > 0
    });
  },

  // 选择位置
  onChooseLocation() {
    wx.chooseLocation({
      success: (res) => {
        this.setData({
          location: res.name
        });
      },
      fail: (error) => {
        console.error('选择位置失败:', error);
      }
    });
  },

  // 清除位置
  onClearLocation() {
    this.setData({ location: '' });
  },

  // 发布帖子
  async onPublish() {
    const { content, images, selectedTag, location, isAnonymous, publishing } = this.data;

    if (publishing) return;

    // 验证内容
    if (!content.trim()) {
      app.showError('请输入帖子内容');
      return;
    }

    if (content.length > this.data.maxWords) {
      app.showError(`内容不能超过${this.data.maxWords}字`);
      return;
    }

    this.setData({ publishing: true });
    app.showLoading('发布中...');

    try {
      // 上传图片
      let imageUrls = [];
      if (images.length > 0) {
        imageUrls = await this.uploadImages(images);
      }

      // 发布帖子
      const result = await wx.cloud.callFunction({
        name: 'post',
        data: {
          action: 'create',
          content: content.trim(),
          images: imageUrls,
          tag: selectedTag,
          location: location,
          isAnonymous: isAnonymous
        }
      });

      if (result.result && result.result.success) {
        app.showSuccess('发布成功');
        
        // 延迟跳转
        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
      } else {
        throw new Error(result.result.message || '发布失败');
      }
    } catch (error) {
      console.error('发布失败:', error);
      app.showError('发布失败，请重试');
    } finally {
      this.setData({ publishing: false });
      wx.hideLoading();
    }
  },

  // 上传图片
  async uploadImages(images) {
    const uploadTasks = images.map((imagePath, index) => {
      return new Promise((resolve, reject) => {
        const cloudPath = `posts/${Date.now()}-${Math.random().toString(36).substr(2)}-${index}.jpg`;
        
        wx.cloud.uploadFile({
          cloudPath: cloudPath,
          filePath: imagePath,
          success: (res) => {
            resolve(res.fileID);
          },
          fail: (error) => {
            reject(error);
          }
        });
      });
    });

    return await Promise.all(uploadTasks);
  },

  // 取消发布
  onCancel() {
    const { content, images } = this.data;
    
    if (content.trim() || images.length > 0) {
      wx.showModal({
        title: '确认取消',
        content: '确定要取消发布吗？已编辑的内容将丢失',
        success: (res) => {
          if (res.confirm) {
            wx.navigateBack();
          }
        }
      });
    } else {
      wx.navigateBack();
    }
  },

  // 格式化标签名称
  getTagName(tagId) {
    const tag = this.data.tags.find(t => t.id === tagId);
    return tag ? tag.name : '分享';
  }
});