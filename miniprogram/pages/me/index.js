const { request } = require('../../utils/request')
const { syncFamilies } = require('../../utils/family')
const app = getApp()

Page({
  data: {
    familyName: '',
    familyId: null,
    joinFamilyId: '',
    loggedIn: false,
    userId: null,
    joinRequests: []
  },

  async onShow() {
    const token = app.globalData.token || wx.getStorageSync('token')
    const familyId = app.globalData.familyId || wx.getStorageSync('familyId') || null
    this.setData({ loggedIn: !!token, familyId })
    if (!token) {
      wx.showModal({
        title: '请先登录',
        content: '未登录无法进入系统，请先完成微信登录/注册。',
        showCancel: false
      })
      return
    }

    try {
      const data = await syncFamilies(app)
      this.setData({ familyId: data.selectedFamilyId })
      await this.loadJoinRequests()
    } catch (e) {
      // ignore refresh failure
    }
  },

  onLogin() {
    wx.login({
      success: async ({ code }) => {
        try {
          const res = await request('/auth/wechat', 'POST', { code })
          app.globalData.token = res.token
          wx.setStorageSync('token', res.token)
          this.setData({ loggedIn: true, userId: res.user_id })
          wx.showModal({
            title: '登录/注册成功',
            content: '已完成微信身份校验，首次登录会自动注册账号。',
            showCancel: false
          })
        } catch (error) {
          wx.showToast({ title: '登录失败', icon: 'none' })
        }
      },
      fail: () => wx.showToast({ title: '微信登录失败', icon: 'none' })
    })
  },

  async onCreateFamily() {
    if (!this.data.loggedIn) return wx.showToast({ title: '请先登录/注册', icon: 'none' })
    if (!this.data.familyName) return wx.showToast({ title: '请输入家庭名称', icon: 'none' })

    try {
      const res = await request('/families', 'POST', { name: this.data.familyName })
      app.globalData.familyId = res.id
      wx.setStorageSync('familyId', res.id)
      this.setData({ familyId: res.id })
      wx.showToast({ title: '家庭已创建' })
    } catch (error) {
      wx.showToast({ title: '创建失败，请重试', icon: 'none' })
    }
  },

  async onJoinFamily() {
    if (!this.data.loggedIn) return wx.showToast({ title: '请先登录/注册', icon: 'none' })
    if (!this.data.joinFamilyId) return wx.showToast({ title: '请输入家庭ID', icon: 'none' })

    try {
      const res = await request(`/families/join?family_id=${Number(this.data.joinFamilyId)}`, 'POST')
      const data = await syncFamilies(app)
      this.setData({ familyId: data.selectedFamilyId, joinFamilyId: '' })
      wx.showToast({ title: res.message || '申请已提交', icon: 'none' })
    } catch (error) {
      if (error.statusCode === 404) {
        wx.showToast({ title: '家庭不存在', icon: 'none' })
        return
      }
      wx.showToast({ title: '加入失败，请重试', icon: 'none' })
    }
  },

  async loadJoinRequests() {
    if (!this.data.loggedIn) return
    try {
      const requests = await request('/families/join-requests')
      this.setData({ joinRequests: requests || [] })
    } catch (e) {
      this.setData({ joinRequests: [] })
    }
  },

  async onReviewRequest(e) {
    const { id, approve } = e.currentTarget.dataset
    try {
      const res = await request(`/families/join-requests/${id}/review`, 'POST', { approve })
      wx.showToast({ title: res.message || '操作成功', icon: 'none' })
      await this.loadJoinRequests()
    } catch (err) {
      wx.showToast({ title: '操作失败，请重试', icon: 'none' })
    }
  },

  bindName(e) { this.setData({ familyName: e.detail.value }) },
  bindJoinFamilyId(e) { this.setData({ joinFamilyId: e.detail.value }) }
})
