Component({
  properties: {
    contactInfo: {
      type: Object,
      value: {}
    },
    buttonText: {
      type: String,
      value: '联系卖家'
    },
    buttonType: {
      type: String,
      value: 'primary' // primary, secondary, outline
    },
    disabled: {
      type: Boolean,
      value: false
    }
  },

  methods: {
    onContactTap() {
      if (this.properties.disabled) return;
      
      this.triggerEvent('contact', {
        contactInfo: this.properties.contactInfo
      });
    },

    onPhoneTap() {
      if (this.properties.contactInfo.phone) {
        wx.makePhoneCall({
          phoneNumber: this.properties.contactInfo.phone
        });
      }
    },

    onWechatTap() {
      if (this.properties.contactInfo.wechat) {
        wx.setClipboardData({
          data: this.properties.contactInfo.wechat,
          success: () => {
            wx.showToast({
              title: '微信号已复制',
              icon: 'success'
            });
          }
        });
      }
    }
  }
});