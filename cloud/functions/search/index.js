const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

exports.main = async (event) => {
  const { action, keyword, type = 'post', page = 1, pageSize = 10 } = event
  const wxContext = cloud.getWXContext()
  const { OPENID: openid } = wxContext

  try {
    if (action !== 'search') {
      return {
        success: false,
        message: '未知操作'
      }
    }

    const skip = (page - 1) * pageSize

    switch (type) {
      case 'post': {
        // 搜索帖子
        const res = await db.collection('posts')
          .where({
            status: 'published',
            content: db.RegExp({
              regexp: keyword,
              options: 'i'
            })
          })
          .orderBy('createTime', 'desc')
          .skip(skip)
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

          return {
            ...post,
            authorName: userRes.data[0]?.nickName || '匿名用户',
            authorAvatar: userRes.data[0]?.avatarUrl || '',
            isLiked: likeRes.data.length > 0
          }
        }))

        return {
          success: true,
          data: {
            results: postsWithUser,
            hasMore: res.data.length === pageSize
          }
        }
      }

      case 'user': {
        // 搜索用户
        const res = await db.collection('users')
          .where({
            nickName: db.RegExp({
              regexp: keyword,
              options: 'i'
            })
          })
          .skip(skip)
          .limit(pageSize)
          .get()

        // 检查关注状态
        const usersWithFollowStatus = await Promise.all(res.data.map(async user => {
          const followRes = await db.collection('follows').where({
            followerOpenid: openid,
            followedOpenid: user._openid
          }).get()

          return {
            ...user,
            isFollowing: followRes.data.length > 0
          }
        }))

        return {
          success: true,
          data: {
            results: usersWithFollowStatus,
            hasMore: res.data.length === pageSize
          }
        }
      }

      case 'tag': {
        // 搜索标签
        const tagRes = await db.collection('posts')
          .where({
            status: 'published',
            tag: db.RegExp({
              regexp: keyword,
              options: 'i'
            })
          })
          .count()

        // 获取相关帖子
        const postsRes = await db.collection('posts')
          .where({
            status: 'published',
            tag: db.RegExp({
              regexp: keyword,
              options: 'i'
            })
          })
          .orderBy('createTime', 'desc')
          .skip(skip)
          .limit(pageSize)
          .get()

        // 构建标签结果
        const tagResults = [{
          _id: `tag_${keyword}`,
          name: keyword,
          postCount: tagRes.total,
          isHot: tagRes.total > 100,
          type: 'tag'
        }]

        return {
          success: true,
          data: {
            results: tagResults,
            hasMore: false
          }
        }
      }

      default:
        return {
          success: false,
          message: '未知搜索类型'
        }
    }
  } catch (error) {
    console.error('Search云函数错误:', error)
    return {
      success: false,
      message: error.message
    }
  }
}