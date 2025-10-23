const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 数据库集合结构定义
const collections = {
  users: {
    description: '用户表',
    fields: {
      _openid: '用户openid',
      avatarUrl: '头像URL',
      nickName: '昵称',
      gender: '性别',
      country: '国家',
      province: '省份',
      city: '城市',
      language: '语言',
      bio: '个人简介',
      level: '等级',
      exp: '经验值',
      postCount: '发帖数',
      likeCount: '获赞数',
      followerCount: '粉丝数',
      followingCount: '关注数',
      balance: '余额',
      createTime: '创建时间',
      lastLoginTime: '最后登录时间',
      updateTime: '更新时间',
      status: '状态'
    }
  },
  posts: {
    description: '帖子表',
    fields: {
      _openid: '作者openid',
      content: '内容',
      images: '图片数组',
      tag: '标签',
      location: '位置',
      isAnonymous: '是否匿名',
      likeCount: '点赞数',
      commentCount: '评论数',
      viewCount: '浏览数',
      shareCount: '分享数',
      status: '状态',
      createTime: '创建时间',
      updateTime: '更新时间'
    }
  },
  comments: {
    description: '评论表',
    fields: {
      _openid: '评论者openid',
      postId: '帖子ID',
      content: '内容',
      parentId: '父评论ID',
      replyToName: '回复对象昵称',
      likeCount: '点赞数',
      createTime: '创建时间'
    }
  },
  likes: {
    description: '点赞表',
    fields: {
      postId: '帖子ID',
      openid: '点赞用户openid',
      createTime: '创建时间'
    }
  },
  comment_likes: {
    description: '评论点赞表',
    fields: {
      commentId: '评论ID',
      openid: '点赞用户openid',
      createTime: '创建时间'
    }
  },
  collects: {
    description: '收藏表',
    fields: {
      postId: '帖子ID',
      openid: '收藏用户openid',
      createTime: '创建时间'
    }
  },
  follows: {
    description: '关注表',
    fields: {
      followerOpenid: '关注者openid',
      followedOpenid: '被关注者openid',
      createTime: '创建时间'
    }
  },
  messages: {
    description: '消息表',
    fields: {
      fromOpenid: '发送者openid',
      toOpenid: '接收者openid',
      type: '消息类型',
      relatedId: '相关资源ID',
      title: '标题',
      content: '内容',
      isRead: '是否已读',
      createTime: '创建时间',
      readTime: '阅读时间'
    }
  },
  orders: {
    description: '订单表',
    fields: {
      _openid: '用户openid',
      orderId: '订单号',
      amount: '金额',
      description: '描述',
      status: '状态',
      createTime: '创建时间',
      payTime: '支付时间',
      expireTime: '过期时间'
    }
  },
  reports: {
    description: '举报表',
    fields: {
      postId: '被举报帖子ID',
      reporterOpenid: '举报人openid',
      reason: '举报原因',
      status: '处理状态',
      createTime: '创建时间'
    }
  },
  login_logs: {
    description: '登录日志表',
    fields: {
      openid: '用户openid',
      loginTime: '登录时间',
      logoutTime: '登出时间',
      ip: 'IP地址'
    }
  }
}

// 初始化数据库
async function initDatabase() {
  console.log('开始初始化数据库...')
  
  try {
    // 检查集合是否存在，如果不存在则创建
    for (const [collectionName, collectionInfo] of Object.entries(collections)) {
      try {
        // 尝试访问集合
        const res = await db.collection(collectionName).limit(1).get()
        console.log(`✅ 集合 ${collectionName} 已存在`)
      } catch (error) {
        if (error.errCode === -501006) {
          // 集合不存在，需要创建
          console.log(`🆕 创建集合: ${collectionName}`)
          // 在实际环境中，集合会在第一次写入时自动创建
          // 这里我们写入一条空记录来创建集合
          await db.collection(collectionName).add({
            data: {
              _init: true,
              createTime: db.serverDate()
            }
          })
          // 删除初始化记录
          await db.collection(collectionName).where({
            _init: true
          }).remove()
          console.log(`✅ 集合 ${collectionName} 创建成功`)
        } else {
          throw error
        }
      }
    }
    
    console.log('🎉 数据库初始化完成！')
    return {
      success: true,
      message: '数据库初始化成功'
    }
  } catch (error) {
    console.error('❌ 数据库初始化失败:', error)
    return {
      success: false,
      message: error.message
    }
  }
}

// 导出初始化函数
module.exports = {
  initDatabase,
  collections
}