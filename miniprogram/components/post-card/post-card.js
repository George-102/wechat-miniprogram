Component({
  properties: {
    postData: {
      type: Object,
      value: {}
    },
    showActions: {
      type: Boolean,
      value: true
    }
  },

  data: {
    isLiked: false,
    likeCount: 0,
    isExpanded: false
  },

  observers: {
    'postData': function(postData) {
      if (postData) {
        this.setData({
          likeCount: postData.likeCount || 0,
          isLiked: postData.isLiked || false
        });
      }
    }
  },

  methods: {
    onLikeTap() {
      const { isLiked, likeCount } = this.data;
      const newIsLiked = !isLiked;
      const newLikeCount = newIsLiked ? likeCount + 1 : likeCount - 1;
      
      this.setData({
        isLiked: newIsLiked,
        likeCount: newLikeCount
      });
      
      this.triggerEvent('like', {
        postId: this.properties.postData._id,
        isLiked: newIsLiked
      });
    },

    onCommentTap() {
      this.triggerEvent('comment', {
        postId: this.properties.postData._id
      });
    },

    onShareTap() {
      this.triggerEvent('share', {
        postId: this.properties.postData._id
      });
    },

    onAvatarTap() {
      this.triggerEvent('avatarTap', {
        userId: this.properties.postData.authorId
      });
    },

    onContentTap() {
      if (this.properties.postData.content && this.properties.postData.content.length > 100) {
        this.setData({
          isExpanded: !this.data.isExpanded
        });
      }
    },

    onImageTap(e) {
      const { index } = e.currentTarget.dataset;
      this.triggerEvent('imageTap', {
        imageList: this.properties.postData.images || [],
        currentIndex: index
      });
    }
  }
});