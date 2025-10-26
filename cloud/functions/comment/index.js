const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

exports.main = async (event) => {
  const { action } = event
  const wxContext = cloud.getWXContext()
  const { OPENID: openid } = wxContext

  try {
    switch (action) {
      case 'getComments': {
        const { postId, page = 1, pageSize = 10 } = event
        
        // 获取顶级评论
        const commentsRes = await db.collection('comments')
          .where({
            postId: postId,
            parentId: ''
          })
          .orderBy('createTime', 'desc')
          .skip((page - 1) * pageSize)
          .limit(pageSize)
          .get()

        // 获取评论的用户信息和回复
        const commentsWithDetails = await Promise.all(commentsRes.data.map(async comment => {
          // 获取评论用户信息
          const userRes = await db.collection('users').where({
            _openid: comment._openid
          }).get()

          // 获取点赞状态
          const likeRes = await db.collection('comment_likes').where({
            commentId: comment._id,
            openid: openid
          }).get()

          // 获取回复
          const repliesRes = await db.collection('comments')
            .where({
              parentId: comment._id
            })
            .orderBy('createTime', 'asc')
            .get()

          // 获取回复的用户信息
          const repliesWithUser = await Promise.all(repliesRes.data.map(async reply => {
            const replyUserRes = await db.collection('users').where({
              _openid: reply._openid
            }).get()

            return {
              ...reply,
              authorName: replyUserRes.data[0]?.nickName || '匿名用户',
              authorAvatar: replyUserRes.data[0]?.avatarUrl || ''
            }
          }))

          return {
            ...comment,
            authorName: userRes.data[0]?.nickName || '匿名用户',
            authorAvatar: userRes.data[0]?.avatarUrl || '',
            isLiked: likeRes.data.length > 0,
            replies: repliesWithUser
          }
        }))

        return {
          success: true,
          data: {
            comments: commentsWithDetails,
            hasMore: commentsRes.data.length === pageSize
          }
        }
      }

      case 'createComment': {
        const { postId, content, replyTo = '', replyToName = '' } = event
        
        const commentData = {
          _openid: openid,
          postId: postId,
          content: content,
          parentId: replyTo, // 空字符串表示顶级评论
          replyToName: replyToName,
          likeCount: 0,
          createTime: db.serverDate()
        }

        // 创建评论
        const res = await db.collection('comments').add({
          data: commentData
        })

        // 更新帖子评论数
        await db.collection('posts').doc(postId).update({
          data: {
            commentCount: _.inc(1)
          }
        })

        // 发送评论消息
        if (replyTo) {
          // 回复评论，通知被回复者
          const parentComment = await db.collection('comments').doc(replyTo).get()
          if (parentComment.data && parentComment.data._openid !== openid) {
            await cloud.callFunction({
              name: 'message',
              data: {
                action: 'create',
                type: 'comment_reply',
                toOpenid: parentComment.data._openid,
                relatedId: postId,
                content: '回复了你的评论'
              }
            })
          }
        } else {
          // 评论帖子，通知帖子作者
          const postRes = await db.collection('posts').doc(postId).get()
          if (postRes.data && postRes.data._openid !== openid) {
            await cloud.callFunction({
              name: 'message',
              data: {
                action: 'create',
                type: 'comment',
                toOpenid: postRes.data._openid,
                relatedId: postId,
                content: '评论了你的帖子'
              }
            })
          }
        }

        return {
          success: true,
          data: {
            commentId: res._id
          }
        }
      }

      case 'likeComment': {
        const { commentId, isLiked } = event
        
        if (isLiked) {
          // 点赞评论
          await db.collection('comment_likes').add({
            data: {
              commentId: commentId,
              openid: openid,
              createTime: db.serverDate()
            }
          })

          await db.collection('comments').doc(commentId).update({
            data: {
              likeCount: _.inc(1)
            }
          })

          // 发送点赞消息
          const commentRes = await db.collection('comments').doc(commentId).get()
          if (commentRes.data && commentRes.data._openid !== openid) {
            await cloud.callFunction({
              name: 'message',
              data: {
                action: 'create',
                type: 'comment_like',
                toOpenid: commentRes.data._openid,
                relatedId: commentRes.data.postId,
                content: '点赞了你的评论'
              }
            })
          }
        } else {
          // 取消点赞评论
          await db.collection('comment_likes').where({
            commentId: commentId,
            openid: openid
          }).remove()

          await db.collection('comments').doc(commentId).update({
            data: {
              likeCount: _.inc(-1)
            }
          })
        }

        return {
          success: true
        }
      }

      default:
        return {
          success: false,
          message: '未知操作'
        }
    }
  } catch (error) {
    console.error('Comment云函数错误:', error)
    return {
      success: false,
      message: error.message
    }
  }
}