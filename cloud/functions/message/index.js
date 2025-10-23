const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const db = cloud.database()
  const _ = db.command
  
  const { action } = event
  
  try {
    switch (action) {
      case 'getList':
        // 获取消息列表
        const { type } = event
        
        let query = db.collection('messages').where({
          toUserId: wxContext.OPENID
        })
        
        if (type === 'like') {
          query = query.where({ messageType: 'like' })
        } else if (type === 'comment') {
          query = query.where({ messageType: 'comment' })
        }
        
        const messages = await query
          .orderBy('createdAt', 'desc')
          .get()
        
        // 获取发送者信息和帖子信息
        for (let message of messages.data) {
          const userRes = await db.collection('users').where({
            _openid: message.fromUserId
          }).get()
          message.user = userRes.data[0] || {}
          
          const postRes = await db.collection('posts').doc(message.postId).get()
          message.post = postRes.data || {}
        }
        
        return {
          code: 200,
          data: messages.data
        }
        
      case 'markAsRead':
        // 标记消息为已读
        const { messageId } = event
        
        if (messageId) {
          // 标记单条消息
          await db.collection('messages').doc(messageId).update({
            data: {
              isRead: true
            }
          })
        } else {
          // 标记所有消息
          const { type: markType } = event
          let updateQuery = db.collection('messages').where({
            toUserId: wxContext.OPENID,
            isRead: false
          })
          
          if (markType) {
            updateQuery = updateQuery.where({ messageType: markType })
          }
          
          const unreadMessages = await updateQuery.get()
          
          for (let message of unreadMessages.data) {
            await db.collection('messages').doc(message._id).update({
              data: {
                isRead: true
              }
            })
          }
        }
        
        return { code: 200, message: '标记成功' }
        
      default:
        return { code: 400, message: '未知操作' }
    }
  } catch (error) {
    console.error('消息云函数错误:', error)
    return { code: 500, message: '服务器错误' }
  }
}