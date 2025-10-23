const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const db = cloud.database()
  const _ = db.command
  
  const { action } = event
  
  try {
    // 获取用户信息
    const userRes = await db.collection('users').where({
      _openid: wxContext.OPENID
    }).get()
    
    if (userRes.data.length === 0) {
      return { code: 401, message: '用户不存在' }
    }
    
    const user = userRes.data[0]
    
    switch (action) {
      case 'getHot':
        // 获取热门帖子
        const hotPosts = await db.collection('posts')
          .where({
            schoolId: user.schoolId,
            postType: _.in(['help', 'secondhand', 'gossip', 'dating'])
          })
          .orderBy('likeCount', 'desc')
          .orderBy('commentCount', 'desc')
          .limit(event.size || 10)
          .get()
        return {
          code: 200,
          data: hotPosts.data
        }
        
      case 'getNew':
        // 获取最新帖子
        const { page = 1, size = 20 } = event
        const newPosts = await db.collection('posts')
          .where({
            schoolId: user.schoolId,
            postType: _.in(['help', 'secondhand', 'gossip', 'dating'])
          })
          .orderBy('createdAt', 'desc')
          .skip((page - 1) * size)
          .limit(size)
          .get()
          
        // 获取总数
        const countRes = await db.collection('posts')
          .where({
            schoolId: user.schoolId,
            postType: _.in(['help', 'secondhand', 'gossip', 'dating'])
          })
          .count()
          
        return {
          code: 200,
          data: {
            list: newPosts.data,
            total: countRes.total
          }
        }
        
      case 'getDetail':
        // 获取帖子详情
        const { postId } = event
        const postRes = await db.collection('posts').doc(postId).get()
        
        if (!postRes.data) {
          return { code: 404, message: '帖子不存在' }
        }
        
        // 增加浏览量
        await db.collection('posts').doc(postId).update({
          data: {
            viewCount: _.inc(1)
          }
        })
        
        // 检查用户是否点赞
        const likeRes = await db.collection('likes').where({
          userId: wxContext.OPENID,
          postId: postId
        }).get()
        
        const post = {
          ...postRes.data,
          is_liked: likeRes.data.length > 0
        }
        
        return {
          code: 200,
          data: post
        }
        
      case 'create':
        // 创建帖子
        const { 
          postType, title, content, images, contactType, contactInfo,
          locationFrom, locationTo, itemDesc, riderGender, helpEvent, 
          detailAddress, price, isHeat, heatCoin, isRedPacket, redPacketAmount 
        } = event
        
        // 检查金币余额
        const totalCoin = (isHeat ? heatCoin : 0) + (isRedPacket ? redPacketAmount : 0)
        if (user.coinBalance < totalCoin) {
          return { code: 400, message: '金币余额不足' }
        }
        
        // 创建帖子数据
        const postData = {
          _openid: wxContext.OPENID,
          userId: wxContext.OPENID,
          schoolId: user.schoolId,
          postType: postType,
          title: title,
          content: content,
          images: images || [],
          contactType: contactType,
          contactInfo: contactInfo,
          locationFrom: locationFrom,
          locationTo: locationTo,
          itemDesc: itemDesc,
          riderGender: riderGender,
          helpEvent: helpEvent,
          detailAddress: detailAddress,
          price: price ? parseFloat(price) : null,
          likeCount: 0,
          commentCount: 0,
          viewCount: 0,
          status: 'pending',
          createdAt: db.serverDate(),
          updatedAt: db.serverDate()
        }
        
        // 设置加热时间
        if (isHeat && heatCoin > 0) {
          postData.heatEndTime = db.serverDate({
            offset: heatCoin * 5 * 60 * 1000
          })
        }
        
        // 设置红包
        if (isRedPacket && redPacketAmount > 0) {
          postData.redPacketAmount = redPacketAmount
          postData.redPacketDistributed = false
        }
        
        const postResult = await db.collection('posts').add({
          data: postData
        })
        
        // 扣除金币
        if (totalCoin > 0) {
          await db.collection('users').where({
            _openid: wxContext.OPENID
          }).update({
            data: {
              coinBalance: _.inc(-totalCoin),
              updatedAt: db.serverDate()
            }
          })
          
          // 记录金币交易
          await db.collection('coinTransactions').add({
            data: {
              _openid: wxContext.OPENID,
              userId: wxContext.OPENID,
              transactionType: 'post_publish',
              amount: -totalCoin,
              balanceAfter: user.coinBalance - totalCoin,
              relatedId: postResult._id,
              description: `发布帖子消耗${totalCoin}金币`,
              createdAt: db.serverDate()
            }
          })
        }
        
        // 更新用户发帖数
        await db.collection('users').where({
          _openid: wxContext.OPENID
        }).update({
          data: {
            postCount: _.inc(1),
            updatedAt: db.serverDate()
          }
        })
        
        return {
          code: 200,
          message: '帖子发布成功',
          data: { postId: postResult._id }
        }
        
      case 'like':
        // 点赞帖子
        const { postId: likePostId } = event
        
        // 检查是否已点赞
        const existingLike = await db.collection('likes').where({
          userId: wxContext.OPENID,
          postId: likePostId
        }).get()
        
        if (existingLike.data.length > 0) {
          // 取消点赞
          await db.collection('likes').doc(existingLike.data[0]._id).remove()
          await db.collection('posts').doc(likePostId).update({
            data: { likeCount: _.inc(-1) }
          })
          
          // 减少作者经验
          const post = await db.collection('posts').doc(likePostId).get()
          if (post.data && post.data.userId !== wxContext.OPENID) {
            await db.collection('users').where({
              _openid: post.data.userId
            }).update({
              data: { experience: _.inc(-1) }
            })
          }
        } else {
          // 点赞
          await db.collection('likes').add({
            data: {
              userId: wxContext.OPENID,
              postId: likePostId,
              createdAt: db.serverDate()
            }
          })
          await db.collection('posts').doc(likePostId).update({
            data: { likeCount: _.inc(1) }
          })
          
          // 增加作者经验
          const post = await db.collection('posts').doc(likePostId).get()
          if (post.data && post.data.userId !== wxContext.OPENID) {
            await db.collection('users').where({
              _openid: post.data.userId
            }).update({
              data: { experience: _.inc(1) }
            })
            
            // 发送点赞消息
            await db.collection('messages').add({
              data: {
                fromUserId: wxContext.OPENID,
                toUserId: post.data.userId,
                postId: likePostId,
                messageType: 'like',
                content: '点赞了你的帖子',
                isRead: false,
                createdAt: db.serverDate()
              }
            })
          }
        }
        
        const updatedPost = await db.collection('posts').doc(likePostId).get()
        return {
          code: 200,
          data: updatedPost.data
        }
        
      case 'takeOrder':
        // 接单
        const { postId: takePostId } = event
        const takePost = await db.collection('posts').doc(takePostId).get()
        
        if (!takePost.data) {
          return { code: 404, message: '帖子不存在' }
        }
        
        if (takePost.data.status !== 'pending') {
          return { code: 400, message: '订单已被接取' }
        }
        
        if (takePost.data.userId === wxContext.OPENID) {
          return { code: 400, message: '不能接取自己的订单' }
        }
        
        await db.collection('posts').doc(takePostId).update({
          data: {
            status: 'taken',
            takerId: wxContext.OPENID,
            updatedAt: db.serverDate()
          }
        })
        
        const takenPost = await db.collection('posts').doc(takePostId).get()
        return {
          code: 200,
          data: takenPost.data
        }
        
      case 'completeOrder':
        // 完成任务
        const { postId: completePostId } = event
        const completePost = await db.collection('posts').doc(completePostId).get()
        
        if (!completePost.data) {
          return { code: 404, message: '帖子不存在' }
        }
        
        if (completePost.data.userId !== wxContext.OPENID) {
          return { code: 403, message: '只有发帖人才能确认完成任务' }
        }
        
        if (completePost.data.status !== 'taken') {
          return { code: 400, message: '订单状态不正确' }
        }
        
        await db.collection('posts').doc(completePostId).update({
          data: {
            status: 'completed',
            updatedAt: db.serverDate()
          }
        })
        
        // 给接单人转账
        const income = completePost.data.price * 0.9
        await db.collection('users').where({
          _openid: completePost.data.takerId
        }).update({
          data: {
            coinBalance: _.inc(income),
            updatedAt: db.serverDate()
          }
        })
        
        // 记录交易
        await db.collection('coinTransactions').add({
          data: {
            _openid: completePost.data.takerId,
            userId: completePost.data.takerId,
            transactionType: 'order_income',
            amount: income,
            balanceAfter: 0, // 这里需要查询实际余额
            relatedId: completePostId,
            description: `订单收入${income}元`,
            createdAt: db.serverDate()
          }
        })
        
        const completedPost = await db.collection('posts').doc(completePostId).get()
        return {
          code: 200,
          data: completedPost.data
        }
        
      default:
        return { code: 400, message: '未知操作' }
    }
  } catch (error) {
    console.error('帖子云函数错误:', error)
    return { code: 500, message: '服务器错误' }
  }
}