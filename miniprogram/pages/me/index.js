const { request } = require('../../utils/request')
const app = getApp()

Page({
  data: {
    familyName: '',
    familyId: null,
    loggedIn: false,
    userId: null
  },

  onShow() {
    const token = app.globalData.token || wx.getStorageSync('token')
    const familyId = app.globalData.familyId || wx.getStorageSync('familyId') || null
    this.setData({
      loggedIn: !!token,
      familyId
    })
  },

  onLogin() {
    wx.login({
      success: async ({ code }) => {
        try {
          const res = await request('/auth/wechat', 'POST', { code })
          app.globalData.token = res.token
          wx.setStorageSync('token', res.token)
          this.setData({
            loggedIn: true,
            userId: res.user_id
          })
          wx.showModal({
            title: '登录/注册成功',
            content: '已完成微信身份校验，首次登录会自动注册账号。',
            showCancel: false
          })
        } catch (error) {
          wx.showToast({ title: '登录失败', icon: 'none' })
        }
      },
      fail: () => {
        wx.showToast({ title: '微信登录失败', icon: 'none' })
      }
    })
  },

  async onCreateFamily() {
    if (!this.data.loggedIn) {
      wx.showToast({ title: '请先登录/注册', icon: 'none' })
      return
    }
    if (!this.data.familyName) {
      wx.showToast({ title: '请输入家庭名称', icon: 'none' })
      return
    }

    try {
      const res = await request('/families', 'POST', { name: this.data.familyName })
      app.globalData.familyId = res.id
      wx.setStorageSync('familyId', res.id)
      this.setData({ familyId: res.id })
      wx.showToast({ title: '家庭已创建' })
    } catch (error) {
      if (error.statusCode === 401) {
        wx.showToast({ title: '登录已失效，请重新登录', icon: 'none' })
        return
      }
      wx.showToast({ title: '创建失败，请重试', icon: 'none' })
    }
  },

  bindName(e) {
    this.setData({ familyName: e.detail.value })
  }
})
