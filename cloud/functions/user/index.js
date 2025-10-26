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

  console.log('User云函数被调用:', { action, openid })

  try {
    switch (action) {
      case 'getUserInfo': {
        console.log('获取用户信息，OpenID:', openid)
        
        const userRes = await db.collection('users').where({
          _openid: openid
        }).get()

        console.log('用户查询结果:', userRes)

        if (userRes.data.length === 0) {
          // 如果用户不存在，创建一个默认用户
          console.log('用户不存在，创建默认用户')
          const defaultUser = {
            _openid: openid,
            avatarUrl: '/images/default-avatar.png',
            nickName: '微信用户',
            gender: 0,
            bio: '这个人很懒，什么都没写~',
            level: 1,
            exp: 0,
            postCount: 0,
            likeCount: 0,
            followerCount: 0,
            followingCount: 0,
            balance: 0,
            createTime: db.serverDate(),
            lastLoginTime: db.serverDate(),
            status: 'active'
          }

          try {
            const addRes = await db.collection('users').add({
              data: defaultUser
            })
            console.log('默认用户创建成功:', addRes)
            return {
              success: true,
              data: { ...defaultUser, _id: addRes._id }
            }
          } catch (createError) {
            console.error('创建默认用户失败:', createError)
            throw new Error('用户不存在且创建失败: ' + createError.message)
          }
        }

        return {
          success: true,
          data: userRes.data[0]
        }
      }

      case 'getOrCreateUser': {
        const { userInfo } = event
        
        console.log('获取或创建用户:', { userInfo, openid })

        const userRes = await db.collection('users').where({
          _openid: openid
        }).get()

        let userData

        if (userRes.data.length === 0) {
          // 创建新用户
          const newUser = {
            _openid: openid,
            avatarUrl: userInfo?.avatarUrl || '/images/default-avatar.png',
            nickName: userInfo?.nickName || '微信用户',
            gender: userInfo?.gender || 0,
            country: userInfo?.country || '',
            province: userInfo?.province || '',
            city: userInfo?.city || '',
            language: userInfo?.language || 'zh_CN',
            bio: '这个人很懒，什么都没写~',
            level: 1,
            exp: 0,
            postCount: 0,
            likeCount: 0,
            followerCount: 0,
            followingCount: 0,
            balance: 0,
            createTime: db.serverDate(),
            lastLoginTime: db.serverDate(),
            updateTime: db.serverDate(),
            status: 'active'
          }

          const addRes = await db.collection('users').add({
            data: newUser
          })
          userData = { ...newUser, _id: addRes._id }
        } else {
          // 更新用户信息
          userData = userRes.data[0]
          await db.collection('users').where({
            _openid: openid
          }).update({
            data: {
              lastLoginTime: db.serverDate(),
              updateTime: db.serverDate(),
              ...(userInfo && {
                avatarUrl: userInfo.avatarUrl,
                nickName: userInfo.nickName,
                gender: userInfo.gender
              })
            }
          })
        }

        return {
          success: true,
          data: userData
        }
      }

      case 'updateUserInfo': {
        const { userInfo } = event
        
        await db.collection('users').where({
          _openid: openid
        }).update({
          data: {
            ...userInfo,
            updateTime: db.serverDate()
          }
        })

        return {
          success: true,
          message: '用户信息更新成功'
        }
      }

      default:
        return {
          success: false,
          message: '未知操作'
        }
    }
  } catch (error) {
    console.error('User云函数错误:', error)
    return {
      success: false,
      message: error.message
    }
  }
}