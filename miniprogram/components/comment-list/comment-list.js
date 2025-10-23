Component({
  properties: {
    comments: {
      type: Array,
      value: []
    },
    postId: {
      type: String,
      value: ''
    }
  },

  data: {
    expandedComments: new Set()
  },

  methods: {
    onReplyTap(e) {
      const { comment } = e.currentTarget.dataset;
      this.triggerEvent('reply', {
        comment: comment,
        postId: this.properties.postId
      });
    },

    onLikeComment(e) {
      const { comment } = e.currentTarget.dataset;
      this.triggerEvent('likeComment', {
        commentId: comment._id,
        isLiked: !comment.isLiked
      });
    },

    onExpandReplies(e) {
      const { commentId } = e.currentTarget.dataset;
      const { expandedComments } = this.data;
      
      if (expandedComments.has(commentId)) {
        expandedComments.delete(commentId);
      } else {
        expandedComments.add(commentId);
      }
      
      this.setData({
        expandedComments: new Set(expandedComments)
      });
    },

    onAvatarTap(e) {
      const { userId } = e.currentTarget.dataset;
      this.triggerEvent('avatarTap', { userId });
    }
  }
});