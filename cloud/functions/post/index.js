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
      case 'getPosts': {
        const { category = 'all', page = 1, pageSize = 10 } = event
        
        let query = db.collection('posts').where({
          status: 'published'
        })

        // 分类过滤
        if (category !== 'all') {
          if (category === 'hot') {
            query = query.orderBy('likeCount', 'desc').orderBy('commentCount', 'desc')
          } else if (category === 'follow') {
            // 获取关注用户的帖子
            const followRes = await db.collection('follows').where({
              followerOpenid: openid
            }).get()
            
            const followOpenids = followRes.data.map(item => item.followedOpenid)
            followOpenids.push(openid) // 包括自己的帖子
            
            query = query.where({
              _openid: _.in(followOpenids)
            })
          } else {
            query = query.where({
              tag: category
            })
          }
        }

        // 执行查询
        const res = await query
          .orderBy('createTime', 'desc')
          .skip((page - 1) * pageSize)
          .limit(pageSize)
          .get()

        // 获取用户信息
        const postsWithUser = await Promise.all(res.data.map(async post => {
          const userRes = await db.collection('users').where({
            _openid: post._openid
          }).get()
          
          const likeRes = await db.collection('likes').where({
            postId: post._id,
            openid: openid
          }).get()

          const collectRes = await db.collection('collects').where({
            postId: post._id,
            openid: openid
          }).get()

          return {
            ...post,
            authorName: userRes.data[0]?.nickName || '匿名用户',
            authorAvatar: userRes.data[0]?.avatarUrl || '',
            isLiked: likeRes.data.length > 0,
            isCollected: collectRes.data.length > 0
          }
        }))

        return {
          success: true,
          data: {
            posts: postsWithUser,
            hasMore: res.data.length === pageSize
          }
        }
      }

      case 'getPostDetail': {
        const { postId } = event
        
        // 获取帖子详情
        const postRes = await db.collection('posts').doc(postId).get()
        if (!postRes.data) {
          throw new Error('帖子不存在')
        }

        // 增加浏览量
        await db.collection('posts').doc(postId).update({
          data: {
            viewCount: _.inc(1)
          }
        })

        // 获取用户信息
        const userRes = await db.collection('users').where({
          _openid: postRes.data._openid
        }).get()

        // 检查点赞和收藏状态
        const likeRes = await db.collection('likes').where({
          postId: postId,
          openid: openid
        }).get()

        const collectRes = await db.collection('collects').where({
          postId: postId,
          openid: openid
        }).get()

        const postDetail = {
          ...postRes.data,
          authorName: userRes.data[0]?.nickName || '匿名用户',
          authorAvatar: userRes.data[0]?.avatarUrl || '',
          authorId: userRes.data[0]?._id,
          isLiked: likeRes.data.length > 0,
          isCollected: collectRes.data.length > 0
        }

        return {
          success: true,
          data: postDetail
        }
      }

      case 'create': {
        const { content, images = [], tag = 'share', location = '', isAnonymous = false } = event
        
        const postData = {
          _openid: openid,
          content: content,
          images: images,
          tag: tag,
          location: location,
          isAnonymous: isAnonymous,
          likeCount: 0,
          commentCount: 0,
          viewCount: 0,
          shareCount: 0,
          status: 'published',
          createTime: db.serverDate(),
          updateTime: db.serverDate()
        }

        // 创建帖子
        const res = await db.collection('posts').add({
          data: postData
        })

        // 更新用户发帖数
        await db.collection('users').where({
          _openid: openid
        }).update({
          data: {
            postCount: _.inc(1)
          }
        })

        return {
          success: true,
          data: {
            postId: res._id
          }
        }
      }

      case 'likePost': {
        const { postId, isLiked } = event
        
        if (isLiked) {
          // 点赞
          await db.collection('likes').add({
            data: {
              postId: postId,
              openid: openid,
              createTime: db.serverDate()
            }
          })

          await db.collection('posts').doc(postId).update({
            data: {
              likeCount: _.inc(1)
            }
          })

          // 发送点赞消息
          const postRes = await db.collection('posts').doc(postId).get()
          if (postRes.data && postRes.data._openid !== openid) {
            await cloud.callFunction({
              name: 'message',
              data: {
                action: 'create',
                type: 'like',
                toOpenid: postRes.data._openid,
                relatedId: postId,
                content: '点赞了你的帖子'
              }
            })
          }
        } else {
          // 取消点赞
          await db.collection('likes').where({
            postId: postId,
            openid: openid
          }).remove()

          await db.collection('posts').doc(postId).update({
            data: {
              likeCount: _.inc(-1)
            }
          })
        }

        return {
          success: true
        }
      }

      case 'collectPost': {
        const { postId, isCollected } = event
        
        if (isCollected) {
          // 收藏
          await db.collection('collects').add({
            data: {
              postId: postId,
              openid: openid,
              createTime: db.serverDate()
            }
          })
        } else {
          // 取消收藏
          await db.collection('collects').where({
            postId: postId,
            openid: openid
          }).remove()
        }

        return {
          success: true
        }
      }

      case 'reportPost': {
        const { postId, reason = '' } = event
        
        await db.collection('reports').add({
          data: {
            postId: postId,
            reporterOpenid: openid,
            reason: reason,
            status: 'pending',
            createTime: db.serverDate()
          }
        })

        return {
          success: true,
          message: '举报成功，我们会尽快处理'
        }
      }

      default:
        return {
          success: false,
          message: '未知操作'
        }
    }
  } catch (error) {
    console.error('Post云函数错误:', error)
    return {
      success: false,
      message: error.message
    }
  }
}