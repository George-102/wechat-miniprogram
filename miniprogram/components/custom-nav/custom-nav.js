Component({
  properties: {
    title: {
      type: String,
      value: ''
    },
    showBack: {
      type: Boolean,
      value: false
    }
  },

  data: {
    statusBarHeight: 44,
    navBarHeight: 88
  },

  lifetimes: {
    attached() {
      this.setNavBarInfo();
    }
  },

  methods: {
    setNavBarInfo() {
      const app = getApp();
      this.setData({
        statusBarHeight: app.globalData.statusBarHeight || 44,
        navBarHeight: app.globalData.navBarHeight || 88
      });
    },

    onBack() {
      wx.navigateBack();
    }
  }
});