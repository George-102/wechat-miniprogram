const app = getApp();

Page({
  data: {
    customNavHeight: 0,
    orderInfo: null,
    paymentMethods: [
      { id: 'wechat', name: '微信支付', icon: '💳', description: '推荐使用', selected: true },
      { id: 'balance', name: '余额支付', icon: '💰', description: '余额：0.00元', selected: false }
    ],
    agreeProtocol: false,
    paying: false
  },

  onLoad(options) {
    this.setData({
      customNavHeight: app.globalData.customNavHeight
    });

    // 获取订单信息，这里假设从options中获取订单id，然后从云函数获取订单详情
    const { orderId } = options;
    if (orderId) {
      this.loadOrderInfo(orderId);
    } else {
      // 如果没有订单id，可以使用模拟数据
      this.setData({
        orderInfo: {
          id: orderId || '1234567890',
          title: '测试商品',
          description: '这是一个测试商品描述',
          amount: 100, // 单位：分
          createTime: new Date().toISOString(),
            formattedAmount: (100 / 100).toFixed(2)
        }
      });
    }
  },

  // 加载订单信息
  async loadOrderInfo(orderId) {
    try {
      const result = await wx.cloud.callFunction({
        name: 'order',
        data: {
          action: 'getOrder',
          orderId: orderId
        }
      });

      if (result.result && result.result.success) {
        this.setData({
          orderInfo:{ result.result.data,
          formattedAmount: (result.result.data.amount / 100).toFixed(2)}
        });
      } else {
        throw new Error(result.result.message || '加载订单失败');
      }
    } catch (error) {
      console.error('加载订单失败:', error);
      app.showError('加载订单失败，请重试');
    }
  },

  // 选择支付方式
  onSelectPayment(e) {
    const { methodId } = e.currentTarget.dataset;
    const paymentMethods = this.data.paymentMethods.map(method => ({
      ...method,
      selected: method.id === methodId
    }));

    this.setData({ paymentMethods });
  },

  // 协议勾选
  onAgreeChange(e) {
    this.setData({
      agreeProtocol: e.detail.value.length > 0
    });
  },

  // 确认支付
  async onConfirmPayment() {
    const { orderInfo, paymentMethods, agreeProtocol, paying } = this.data;

    if (paying) return;

    if (!agreeProtocol) {
      app.showError('请先同意支付协议');
      return;
    }

    const selectedMethod = paymentMethods.find(method => method.selected);
    if (!selectedMethod) {
      app.showError('请选择支付方式');
      return;
    }

    this.setData({ paying: true });
    app.showLoading('支付中...');

    try {
      let result;
      if (selectedMethod.id === 'wechat') {
        result = await this.wechatPayment();
      } else if (selectedMethod.id === 'balance') {
        result = await this.balancePayment();
      }

      if (result && result.success) {
        app.showSuccess('支付成功');
        
        // 延迟跳转
        setTimeout(() => {
          wx.redirectTo({
            url: `/pages/payment/success?orderId=${orderInfo.id}`
          });
        }, 1500);
      } else {
        throw new Error(result?.message || '支付失败');
      }
    } catch (error) {
      console.error('支付失败:', error);
      app.showError('支付失败，请重试');
    } finally {
      this.setData({ paying: false });
      wx.hideLoading();
    }
  },

  // 微信支付
  async wechatPayment() {
    // 这里调用云函数生成微信支付参数
    const result = await wx.cloud.callFunction({
      name: 'payment',
      data: {
        action: 'unifiedOrder',
        orderId: this.data.orderInfo.id,
        amount: this.data.orderInfo.amount
      }
    });

    if (result.result && result.result.success) {
      const paymentData = result.result.data;
      
      // 调用微信支付
      return new Promise((resolve, reject) => {
        wx.requestPayment({
          ...paymentData,
          success: (res) => {
            resolve({ success: true });
          },
          fail: (err) => {
            reject(err);
          }
        });
      });
    } else {
      throw new Error(result.result.message || '支付参数生成失败');
    }
  },

  // 余额支付
  async balancePayment() {
    // 调用云函数进行余额支付
    const result = await wx.cloud.callFunction({
      name: 'payment',
      data: {
        action: 'balancePayment',
        orderId: this.data.orderInfo.id
      }
    });

    if (result.result && result.result.success) {
      return { success: true };
    } else {
      throw new Error(result.result.message || '余额支付失败');
    }
  },

  // 取消支付
  onCancelPayment() {
    wx.showModal({
      title: '确认取消',
      content: '确定要取消支付吗？',
      success: (res) => {
        if (res.confirm) {
          wx.navigateBack();
        }
      }
    });
  },

  // 查看协议
  onViewProtocol() {
    wx.navigateTo({
      url: '/pages/webview/index?url=https://your-domain.com/payment-protocol'
    });
  }
});