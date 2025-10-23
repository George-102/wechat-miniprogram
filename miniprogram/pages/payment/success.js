const app = getApp();

Page({
  data: {
    customNavHeight: 0,
    orderInfo: null,
    success: false
  },

  onLoad(options) {
    this.setData({
      customNavHeight: app.globalData.customNavHeight
    });

    const { orderId, amount } = options;
    this.setData({
      orderInfo: {
        id: orderId,
        amount: amount ? (amount / 100).toFixed(2) : '0.00'
      },
      success: true
    });

    // 自动跳转倒计时
    this.startRedirectCountdown();
  },

  // 开始跳转倒计时
  startRedirectCountdown() {
    let countdown = 5;
    
    const timer = setInterval(() => {
      countdown--;
      
      if (countdown <= 0) {
        clearInterval(timer);
        this.redirectToHome();
      }
    }, 1000);
  },

  // 查看订单
  onViewOrder() {
    wx.redirectTo({
      url: `/pages/order/detail?id=${this.data.orderInfo.id}`
    });
  },

  // 返回首页
  onBackToHome() {
    this.redirectToHome();
  },

  // 跳转到首页
  redirectToHome() {
    wx.switchTab({
      url: '/pages/posts/index'
    });
  },

  // 继续购物/浏览
  onContinue() {
    wx.navigateBack({
      delta: 2
    });
  }
});