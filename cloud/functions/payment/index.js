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
      case 'unifiedOrder': {
        const { orderId, amount, description } = event
        
        // 创建订单记录
        const orderData = {
          _openid: openid,
          orderId: orderId,
          amount: amount,
          description: description,
          status: 'pending',
          createTime: db.serverDate(),
          expireTime: new Date(Date.now() + 15 * 60 * 1000) // 15分钟后过期
        }

        await db.collection('orders').add({
          data: orderData
        })

        // 这里应该调用微信支付接口生成支付参数
        // 由于需要商户号等配置，这里返回模拟数据
        const paymentData = {
          timeStamp: Math.floor(Date.now() / 1000).toString(),
          nonceStr: Math.random().toString(36).substr(2, 15),
          package: `prepay_id=模拟预支付ID_${orderId}`,
          signType: 'MD5',
          paySign: '模拟签名'
        }

        return {
          success: true,
          data: paymentData
        }
      }

      case 'balancePayment': {
        const { orderId } = event
        
        // 检查用户余额
        const userRes = await db.collection('users').where({ 
          _openid: openid 
        }).get()
        
        const orderRes = await db.collection('orders').where({ 
          orderId: orderId 
        }).get()

        if (userRes.data.length === 0 || orderRes.data.length === 0) {
          throw new Error('用户或订单不存在')
        }

        const user = userRes.data[0]
        const order = orderRes.data[0]

        // 模拟余额检查
        const balance = user.balance || 0
        if (balance < order.amount) {
          throw new Error('余额不足')
        }

        // 更新订单状态
        await db.collection('orders').where({ 
          orderId: orderId 
        }).update({
          data: {
            status: 'paid',
            payTime: db.serverDate()
          }
        })

        // 更新用户余额
        await db.collection('users').where({ 
          _openid: openid 
        }).update({
          data: {
            balance: _.inc(-order.amount)
          }
        })

        return {
          success: true
        }
      }

      case 'alipayPayment': {
        // 支付宝支付（模拟）
        return {
          success: false,
          message: '暂不支持支付宝支付'
        }
      }

      case 'checkOrderStatus': {
        const { orderId } = event
        
        const orderRes = await db.collection('orders').where({
          orderId: orderId
        }).get()

        if (orderRes.data.length === 0) {
          throw new Error('订单不存在')
        }

        return {
          success: true,
          data: {
            status: orderRes.data[0].status
          }
        }
      }

      default:
        return {
          success: false,
          message: '未知操作'
        }
    }
  } catch (error) {
    console.error('Payment云函数错误:', error)
    return {
      success: false,
      message: error.message
    }
  }
}