const { request } = require('../../utils/request')
const app = getApp()

Page({
  data: { familyName: '', familyId: null },

  onLogin() {
    wx.login({
      success: async ({ code }) => {
        const res = await request('/auth/wechat', 'POST', { code })
        app.globalData.token = res.token
        wx.showToast({ title: '登录成功' })
      }
    })
  },

  async onCreateFamily() {
    const res = await request('/families', 'POST', { name: this.data.familyName })
    app.globalData.familyId = res.id
    this.setData({ familyId: res.id })
    wx.showToast({ title: '家庭已创建' })
  },

  bindName(e) {
    this.setData({ familyName: e.detail.value })
  }
})
