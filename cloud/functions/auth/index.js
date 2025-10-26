const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

exports.main = async (event) => {
  const { action, code, userInfo: clientUserInfo, schoolInfo } = event;
  const wxContext = cloud.getWXContext()
  const { OPENID: openid, APPID: appid } = wxContext

  console.log('Auth云函数被调用:', { action, openid, appid, hasUserInfo: !!clientUserInfo, hasCode: !!code, schoolInfo })

  try {
    if (!action) {
      throw new Error('未指定操作类型 (action)')
    }

    switch (action) {
      case 'login': {
        console.log('开始处理登录请求，OpenID:', openid)

        if (!openid) {
          throw new Error('无法获取用户OpenID，用户登录态异常')
        }

        let userRes
        try {
          userRes = await db.collection('users').where({
            _openid: openid
          }).get()
          console.log('用户查询完成，是否存在:', userRes.data.length > 0)
        } catch (dbError) {
          console.error('数据库查询失败:', dbError)
          userRes = { data: [] }
        }

        let userData

        // 处理新用户
        if (userRes.data.length === 0) {
          console.log('创建新用户记录')
          
          // 构建基础用户信息
          const baseUserInfo = {
            _openid: openid,
            avatarUrl: clientUserInfo ? clientUserInfo.avatarUrl : '/images/default-avatar.png',
            nickName: clientUserInfo ? clientUserInfo.nickName : `用户${openid.slice(-6)}`,
            gender: clientUserInfo ? clientUserInfo.gender : 0,
            country: clientUserInfo ? clientUserInfo.country : '',
            province: clientUserInfo ? clientUserInfo.province : '',
            city: clientUserInfo ? clientUserInfo.city : '',
            language: clientUserInfo ? clientUserInfo.language : 'zh_CN',
          }

          // 添加学校认证信息
          const schoolAuthInfo = schoolInfo ? {
            // 学校认证相关字段
            schoolName: schoolInfo.schoolName || '',
            studentId: schoolInfo.studentId || '',
            verificationStatus: schoolInfo ? 'pending' : 'unverified', // pending, verified, rejected
            verificationType: schoolInfo?.verificationType || '', // studentCard, admissionLetter, etc.
            verificationTime: schoolInfo ? db.serverDate() : null,
            // 学校隔离相关
            schoolCode: schoolInfo?.schoolCode || '',
          } : {
            verificationStatus: 'unverified',
            schoolName: '',
            studentId: '',
          }

          const newUser = {
            ...baseUserInfo,
            ...schoolAuthInfo,
            // 用户等级和经验系统
            bio: '欢迎来到校园社交平台！',
            level: 1,
            levelName: '小学生',
            exp: 0,
            nextLevelExp: 100,
            // 统计信息
            postCount: 0,
            likeCount: 0,
            followerCount: 0,
            followingCount: 0,
            // 金币系统
            balance: 0,
            goldCoins: 0,
            // 时间信息
            createTime: db.serverDate(),
            lastLoginTime: db.serverDate(),
            updateTime: db.serverDate(),
            dailyLoginTime: db.serverDate(), // 用于每日登录奖励
            status: 'active'
          }

          try {
            const addRes = await db.collection('users').add({
              data: newUser
            })
            console.log('新用户创建成功，数据库ID:', addRes._id)
            userData = { ...newUser, _id: addRes._id }
          } catch (createError) {
            console.error('创建用户记录失败:', createError)
            throw new Error(`创建用户失败: ${createError.message}`)
          }
        } else {
          // 处理老用户
          console.log('用户已存在，更新最后登录时间')
          userData = userRes.data[0]
          
          const updateData = {
            lastLoginTime: db.serverDate(),
            updateTime: db.serverDate()
          }
          
          // 检查每日登录奖励
          const lastLogin = userData.lastLoginTime;
          const now = new Date();
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const lastLoginDate = lastLogin ? new Date(lastLogin) : null;
          
          if (!lastLoginDate || lastLoginDate < today) {
            // 每日登录奖励
            updateData.exp = _.inc(5); // 每日登录获得5经验
            updateData.dailyLoginTime = db.serverDate();
            console.log('发放每日登录奖励：5经验');
          }
          
          // 如果提供了新的用户信息，则更新
          if (clientUserInfo) {
            console.log('检测到新的用户信息，更新资料')
            updateData.avatarUrl = clientUserInfo.avatarUrl
            updateData.nickName = clientUserInfo.nickName
            updateData.gender = clientUserInfo.gender
            updateData.country = clientUserInfo.country
            updateData.province = clientUserInfo.province
            updateData.city = clientUserInfo.city
            updateData.language = clientUserInfo.language
          }
          
          // 如果有学校信息，更新学校认证状态
          if (schoolInfo) {
            updateData.schoolName = schoolInfo.schoolName
            updateData.studentId = schoolInfo.studentId
            updateData.verificationStatus = 'pending'
            updateData.verificationType = schoolInfo.verificationType
            updateData.verificationTime = db.serverDate()
            updateData.schoolCode = schoolInfo.schoolCode
          }
          
          try {
            await db.collection('users').where({
              _openid: openid
            }).update({
              data: updateData
            })
            console.log('用户信息更新成功')
            // 将更新的数据合并到返回结果中
            userData = { ...userData, ...updateData }
          } catch (updateError) {
            console.error('更新用户信息失败:', updateError)
          }
        }

        console.log('登录流程完成，返回用户数据')
        return {
          success: true,
          data: {
            userInfo: userData
          }
        }
      }

      case 'verifySchool': {
        // 学校认证验证逻辑
        const { schoolName, studentId, verificationType, schoolCode } = event;
        
        // 这里可以添加学校认证的实际验证逻辑
        // 比如调用学校API验证学号等
        
        const verificationResult = {
          verified: true, // 模拟验证通过
          message: '认证信息已提交，等待审核'
        };
        
        // 更新用户认证状态
        await db.collection('users').where({
          _openid: openid
        }).update({
          data: {
            schoolName,
            studentId,
            verificationType,
            schoolCode,
            verificationStatus: 'pending',
            verificationTime: db.serverDate(),
            updateTime: db.serverDate()
          }
        });
        
        return {
          success: true,
          data: verificationResult
        };
      }

      default:
        console.error('未知的操作类型:', action)
        return {
          success: false,
          message: `未知操作: ${action}`
        }
    }
  } catch (error) {
    console.error('Auth云函数执行异常:', error)
    return {
      success: false,
      message: error.message
    }
  }
}