const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const db = cloud.database()
  const _ = db.command
  
  const { action } = event
  
  try {
    switch (action) {
      case 'getByPost':
        // 获取帖子评论
        const { postId } = event
        
        // 获取父评论
        const parentComments = await db.collection('comments')
          .where({
            postId: postId,
            parentId: _.eq(null)
          })
          .orderBy('createdAt', 'desc')
          .get()
        
        // 为每个父评论获取子评论
        for (let comment of parentComments.data) {
          const subComments = await db.collection('comments')
            .where({
              parentId: comment._id
            })
            .orderBy('createdAt', 'asc')
            .get()
          
          comment.sub_comments = subComments.data
          
          // 检查用户点赞状态
          const likeRes = await db.collection('likes').where({
            userId: wxContext.OPENID,
            commentId: comment._id
          }).get()
          comment.is_liked = likeRes.data.length > 0
          
          // 检查子评论点赞状态
          for (let subComment of comment.sub_comments) {
            const subLikeRes = await db.collection('likes').where({
              userId: wxContext.OPENID,
              commentId: subComment._id
            }).get()
            subComment.is_liked = subLikeRes.data.length > 0
          }
        }
        
        return {
          code: 200,
          data: parentComments.data
        }
        
      case 'create':
        // 创建评论
        const { postId: commentPostId, content, parentId } = event
        
        const commentData = {
          postId: commentPostId,
          userId: wxContext.OPENID,
          parentId: parentId || null,
          content: content,
          likeCount: 0,
          createdAt: db.serverDate()
        }
        
        const commentResult = await db.collection('comments').add({
          data: commentData
        })
        
        // 更新帖子评论数
        await db.collection('posts').doc(commentPostId).update({
          data: {
            commentCount: _.inc(1)
          }
        })
        
        // 获取完整的评论信息
        const fullComment = await db.collection('comments').doc(commentResult._id).get()
        
        // 发送评论消息
        const post = await db.collection('posts').doc(commentPostId).get()
        if (post.data && post.data.userId !== wxContext.OPENID) {
          await db.collection('messages').add({
            data: {
              fromUserId: wxContext.OPENID,
              toUserId: post.data.userId,
              postId: commentPostId,
              commentId: commentResult._id,
              messageType: 'comment',
              content: content,
              isRead: false,
              createdAt: db.serverDate()
            }
          })
        }
        
        // 如果是回复评论，也给被回复用户发送消息
        if (parentId) {
          const parentComment = await db.collection('comments').doc(parentId).get()
          if (parentComment.data && parentComment.data.userId !== wxContext.OPENID) {
            await db.collection('messages').add({
              data: {
                fromUserId: wxContext.OPENID,
                toUserId: parentComment.data.userId,
                postId: commentPostId,
                commentId: commentResult._id,
                messageType: 'comment',
                content: content,
                isRead: false,
                createdAt: db.serverDate()
              }
            })
          }
        }
        
        return {
          code: 200,
          data: fullComment.data
        }
        
      case 'like':
        // 点赞评论
        const { commentId } = event
        
        // 检查是否已点赞
        const existingCommentLike = await db.collection('likes').where({
          userId: wxContext.OPENID,
          commentId: commentId
        }).get()
        
        if (existingCommentLike.data.length > 0) {
          // 取消点赞
          await db.collection('likes').doc(existingCommentLike.data[0]._id).remove()
          await db.collection('comments').doc(commentId).update({
            data: { likeCount: _.inc(-1) }
          })
          
          // 减少作者经验
          const comment = await db.collection('comments').doc(commentId).get()
          if (comment.data) {
            await db.collection('users').where({
              _openid: comment.data.userId
            }).update({
              data: { experience: _.inc(-1) }
            })
          }
        } else {
          // 点赞
          await db.collection('likes').add({
            data: {
              userId: wxContext.OPENID,
              commentId: commentId,
              createdAt: db.serverDate()
            }
          })
          await db.collection('comments').doc(commentId).update({
            data: { likeCount: _.inc(1) }
          })
          
          // 增加作者经验
          const comment = await db.collection('comments').doc(commentId).get()
          if (comment.data) {
            await db.collection('users').where({
              _openid: comment.data.userId
            }).update({
              data: { experience: _.inc(1) }
            })
          }
        }
        
        const updatedComment = await db.collection('comments').doc(commentId).get()
        return {
          code: 200,
          data: updatedComment.data
        }
        
      default:
        return { code: 400, message: '未知操作' }
    }
  } catch (error) {
    console.error('评论云函数错误:', error)
    return { code: 500, message: '服务器错误' }
  }
}