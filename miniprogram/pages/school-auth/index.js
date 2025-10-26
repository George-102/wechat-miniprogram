const app = getApp();

Page({
  data: {
    customNavHeight: 0,
    statusBarHeight: 0,
    schoolName: '',
    studentId: '',
    verificationType: '',
    imagePath: '',
    agreed: false,
    uploading: false
  },

  onLoad() {
    this.setData({
      customNavHeight: app.globalData.customNavHeight,
      statusBarHeight: app.globalData.systemInfo.statusBarHeight
    });
  },

  onSchoolNameInput(e) {
    this.setData({ schoolName: e.detail.value });
    this.checkCanSubmit();
  },

  onStudentIdInput(e) {
    this.setData({ studentId: e.detail.value });
    this.checkCanSubmit();
  },

  onSelectVerificationType(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({ verificationType: type });
    this.checkCanSubmit();
  },

  onAgreementChange(e) {
    this.setData({ agreed: e.detail.value.length > 0 });
    this.checkCanSubmit();
  },

  async onChooseImage() {
    try {
      const res = await wx.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera']
      });

      if (res.tempFilePaths.length > 0) {
        this.setData({ 
          imagePath: res.tempFilePaths[0],
          uploading: true
        });

        // 上传图片到云存储
        const uploadResult = await wx.cloud.uploadFile({
          cloudPath: `verification/${Date.now()}-${Math.random().toString(36).substr(2)}.jpg`,
          filePath: res.tempFilePaths[0],
        });

        this.setData({ 
          cloudImagePath: uploadResult.fileID,
          uploading: false
        });
      }
    } catch (error) {
      console.error('选择图片失败:', error);
      wx.showToast({
        title: '上传失败',
        icon: 'none'
      });
      this.setData({ uploading: false });
    }
  },

  checkCanSubmit() {
    const { schoolName, studentId, verificationType, agreed, imagePath } = this.data;
    const canSubmit = schoolName && studentId && verificationType && agreed && imagePath;
    this.setData({ canSubmit });
  },

  async onSubmitAuth() {
    if (!this.data.canSubmit) return;

    const { schoolName, studentId, verificationType, cloudImagePath } = this.data;

    try {
      wx.showLoading({ title: '提交中...' });

      // 调用认证云函数
      const result = await wx.cloud.callFunction({
        name: 'auth',
        data: {
          action: 'verifySchool',
          schoolName,
          studentId,
          verificationType,
          schoolCode: this.generateSchoolCode(schoolName),
          verificationImage: cloudImagePath
        }
      });

      wx.hideLoading();

      if (result.result.success) {
        wx.showToast({
          title: '认证信息已提交',
          icon: 'success'
        });

        // 返回上一页或跳转到首页
        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
      } else {
        throw new Error(result.result.message);
      }
    } catch (error) {
      console.error('提交认证失败:', error);
      wx.showToast({
        title: '提交失败，请重试',
        icon: 'none'
      });
    }
  },

  generateSchoolCode(schoolName) {
    // 简单的学校代码生成逻辑，实际应该使用标准学校代码
    return schoolName.replace(/[^\u4e00-\u9fa5]/g, '').slice(0, 4) + Math.random().toString(36).substr(2, 4);
  }
});