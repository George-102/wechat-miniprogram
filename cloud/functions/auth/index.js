const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const db = cloud.database()
  const _ = db.command
  
  const { action } = event
  
  try {
    switch (action) {
      case 'getSchools':
        // 获取学校列表
        const schools = await db.collection('schools').where({
          status: 1
        }).get()
        return {
          code: 200,
          message: '获取成功',
          data: schools.data
        }
        
      case 'submitAuth':
        // 提交认证
        const { schoolId, studentId, certType, certImage } = event
        await db.collection('users').where({
          _openid: wxContext.OPENID
        }).update({
          data: {
            schoolId: schoolId,
            studentId: studentId,
            certType: certType,
            certImage: certImage,
            certStatus: 2, // 审核中
            updatedAt: db.serverDate()
          }
        })
        return {
          code: 200,
          message: '认证提交成功，等待审核'
        }
        
      case 'checkStatus':
        // 检查认证状态
        const userRes = await db.collection('users').where({
          _openid: wxContext.OPENID
        }).get()
        
        if (userRes.data.length === 0) {
          // 创建新用户
          const newUser = {
            _openid: wxContext.OPENID,
            nickname: '新用户',
            avatar: '',
            userLevel: 1,
            experience: 0,
            postCount: 0,
            coinBalance: 0,
            certStatus: 0,
            createdAt: db.serverDate(),
            updatedAt: db.serverDate()
          }
          await db.collection('users').add({ data: newUser })
          
          return {
            code: 200,
            data: {
              userInfo: newUser,
              isAuthenticated: false
            }
          }
        }
        
        const user = userRes.data[0]
        return {
          code: 200,
          data: {
            userInfo: user,
            isAuthenticated: user.certStatus === 1
          }
        }
        
      default:
        return { code: 400, message: '未知操作' }
    }
  } catch (error) {
    console.error('认证云函数错误:', error)
    return { code: 500, message: '服务器错误' }
  }
}