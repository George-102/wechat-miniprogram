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
      case 'getMessages': {
        const { type = 'all', page = 1, pageSize = 15 } = event
        
        let query = db.collection('messages').where({
          toOpenid: openid
        })

        // 根据类型过滤
        if (type === 'unread') {
          query = query.where({ isRead: false })
        } else if (type === 'system') {
          query = query.where({ type: 'system' })
        }

        const res = await query
          .orderBy('createTime', 'desc')
          .skip((page - 1) * pageSize)
          .limit(pageSize)
          .get()

        // 获取发送者信息
        const messagesWithSender = await Promise.all(res.data.map(async message => {
          if (message.fromOpenid && message.fromOpenid !== 'system') {
            const userRes = await db.collection('users').where({
              _openid: message.fromOpenid
            }).get()
            return {
              ...message,
              senderName: userRes.data[0]?.nickName || '未知用户',
              senderAvatar: userRes.data[0]?.avatarUrl || ''
            }
          }
          return message
        }))

        return {
          success: true,
          data: {
            messages: messagesWithSender,
            hasMore: res.data.length === pageSize
          }
        }
      }

      case 'getUnreadCount': {
        const res = await db.collection('messages').where({
          toOpenid: openid,
          isRead: false
        }).count()

        return {
          success: true,
          data: {
            count: res.total
          }
        }
      }

      case 'create': {
        const { type, toOpenid, relatedId = '', content } = event
        
        // 获取发送者信息
        const fromUserRes = await db.collection('users').where({
          _openid: openid
        }).get()

        const messageData = {
          fromOpenid: openid,
          toOpenid: toOpenid,
          type: type,
          relatedId: relatedId,
          title: getMessageTitle(type, fromUserRes.data[0]?.nickName),
          content: content,
          isRead: false,
          createTime: db.serverDate()
        }

        await db.collection('messages').add({
          data: messageData
        })

        return {
          success: true
        }
      }

      case 'markAsRead': {
        const { messageId } = event
        
        await db.collection('messages').doc(messageId).update({
          data: {
            isRead: true,
            readTime: db.serverDate()
          }
        })

        return {
          success: true
        }
      }

      case 'deleteMessage': {
        const { messageId } = event
        
        await db.collection('messages').doc(messageId).remove()

        return {
          success: true
        }
      }

      case 'clearAllMessages': {
        const res = await db.collection('messages').where({
          toOpenid: openid
        }).get()

        const deletePromises = res.data.map(msg => {
          return db.collection('messages').doc(msg._id).remove()
        })

        await Promise.all(deletePromises)

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
    console.error('Message云函数错误:', error)
    return {
      success: false,
      message: error.message
    }
  }
}

// 根据消息类型生成标题
function getMessageTitle(type, fromUserName) {
  const titles = {
    'like': `${fromUserName} 点赞了你的帖子`,
    'comment': `${fromUserName} 评论了你的帖子`,
    'comment_reply': `${fromUserName} 回复了你的评论`,
    'comment_like': `${fromUserName} 点赞了你的评论`,
    'follow': `${fromUserName} 关注了你`,
    'system': '系统通知'
  }
  return titles[type] || '新消息'
}