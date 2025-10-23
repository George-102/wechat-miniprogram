Component({
  properties: {
    currentExp: {
      type: Number,
      value: 0
    },
    nextLevelExp: {
      type: Number,
      value: 100
    },
    currentLevel: {
      type: Number,
      value: 1
    },
    nextLevel: {
      type: Number,
      value: 2
    },
    showInfo: {
      type: Boolean,
      value: true
    }
  },

  data: {
    progress: 0,
    animatedProgress: 0
  },

  observers: {
    'currentExp, nextLevelExp': function(currentExp, nextLevelExp) {
      const progress = Math.min((currentExp / nextLevelExp) * 100, 100);
      
      this.setData({ progress });
      
      // 动画效果
      setTimeout(() => {
        this.setData({ animatedProgress: progress });
      }, 300);
    }
  },

  methods: {
    onProgressTap() {
      this.triggerEvent('infoTap', {
        currentLevel: this.properties.currentLevel,
        currentExp: this.properties.currentExp,
        nextLevelExp: this.properties.nextLevelExp
      });
    }
  }
});