const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const db = cloud.database()
  const _ = db.command
  
  const { action } = event
  
  try {
    switch (action) {
      case 'getProfile':
        // 获取用户信息
        const userRes = await db.collection('users').where({
          _openid: wxContext.OPENID
        }).get()
        
        if (userRes.data.length === 0) {
          return { code: 404, message: '用户不存在' }
        }
        
        return {
          code: 200,
          data: userRes.data[0]
        }
        
      case 'updateProfile':
        // 更新用户资料
        const { nickname, avatar } = event
        await db.collection('users').where({
          _openid: wxContext.OPENID
        }).update({
          data: {
            nickname: nickname,
            avatar: avatar,
            updatedAt: db.serverDate()
          }
        })
        
        const updatedUser = await db.collection('users').where({
          _openid: wxContext.OPENID
        }).get()
        
        return {
          code: 200,
          data: updatedUser.data[0]
        }
        
      case 'dailySign':
        // 每日签到
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        
        // 检查今天是否已签到
        const signRes = await db.collection('signRecords').where({
          userId: wxContext.OPENID,
          signDate: db.serverDate({
            offset: 0 - today.getTime()
          })
        }).get()
        
        if (signRes.data.length > 0) {
          return { code: 400, message: '今天已经签到过了' }
        }
        
        // 记录签到
        await db.collection('signRecords').add({
          data: {
            userId: wxContext.OPENID,
            signDate: db.serverDate(),
            expReward: 5,
            createdAt: db.serverDate()
          }
        })
        
        // 增加经验
        await db.collection('users').where({
          _openid: wxContext.OPENID
        }).update({
          data: {
            experience: _.inc(5),
            updatedAt: db.serverDate()
          }
        })
        
        return {
          code: 200,
          message: '签到成功，获得5经验'
        }
        
      case 'checkSignStatus':
        // 检查签到状态
        const checkToday = new Date()
        checkToday.setHours(0, 0, 0, 0)
        
        const checkSignRes = await db.collection('signRecords').where({
          userId: wxContext.OPENID,
          signDate: db.serverDate({
            offset: 0 - checkToday.getTime()
          })
        }).get()
        
        return {
          code: 200,
          data: {
            hasSigned: checkSignRes.data.length > 0
          }
        }
        
      default:
        return { code: 400, message: '未知操作' }
    }
  } catch (error) {
    console.error('用户云函数错误:', error)
    return { code: 500, message: '服务器错误' }
  }
}