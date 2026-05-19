const { request } = require('../../utils/request')
const { syncFamilies, switchFamily } = require('../../utils/family')
const app = getApp()

Page({
  handleUnauthorized() {
    app.globalData.token = ""
    app.globalData.familyId = null
    wx.removeStorageSync("token")
    wx.removeStorageSync("familyId")
    this.setData({ loggedIn: false, familyId: null, joinRequests: [] })
    wx.showToast({ title: "登录已失效，请重新登录", icon: "none" })
  },
  data: {
    familyName: '',
    familyId: null,
    joinFamilyId: '',
    loggedIn: false,
    userId: null,
    joinRequests: [],
    account: '',
    password: '',
    nickname: '',
    families: [],
    familyIndex: 0,
    loginTab: 'wechat'
  },

  handleUnauthorized() {
    app.globalData.token = ''
    app.globalData.familyId = null
    app.globalData.userId = null
    wx.removeStorageSync('token')
    wx.removeStorageSync('familyId')
    wx.removeStorageSync('userId')
    this.setData({ loggedIn: false, familyId: null, joinRequests: [] })
    wx.showToast({ title: '登录已失效，请重新登录', icon: 'none' })
  },

  async onShow() {
    const token = app.globalData.token || wx.getStorageSync('token')
    const familyId = app.globalData.familyId || wx.getStorageSync('familyId') || null
    const userId = app.globalData.userId || wx.getStorageSync('userId') || null
    this.setData({ loggedIn: !!token, familyId, userId })
    if (!token) return
    try {
      const data = await syncFamilies(app)
      const familyIndex = data.families.findIndex((f) => f.id === data.selectedFamilyId)
      this.setData({ familyId: data.selectedFamilyId, families: data.families, familyIndex: familyIndex >= 0 ? familyIndex : 0 })
      await this.loadJoinRequests()
    } catch (e) {
      if (e.statusCode === 401) this.handleUnauthorized()
    }
  },

  setLoginState(res) {
    app.globalData.token = res.token
    app.globalData.userId = res.user_id
    wx.setStorageSync('token', res.token)
    wx.setStorageSync('userId', res.user_id)
    this.setData({ loggedIn: true, userId: res.user_id })
  },

  onLoginTabTap(e) { this.setData({ loginTab: e.currentTarget.dataset.tab }) },

  onLogin() {
    wx.login({
      success: async ({ code }) => {
        try {
          const res = await request('/auth/wechat', 'POST', { code })
          this.setLoginState(res)
          wx.showToast({ title: '微信登录成功', icon: 'none' })
        } catch (error) {
          wx.showToast({ title: '登录失败', icon: 'none' })
        }
      },
      fail: () => wx.showToast({ title: '微信登录失败', icon: 'none' })
    })
  },

  async onAccountLogin() {
    if (!this.data.account || !this.data.password) return wx.showToast({ title: '请输入账号和密码', icon: 'none' })
    try {
      const res = await request('/auth/login', 'POST', { account: this.data.account, password: this.data.password })
      this.setLoginState(res)
      wx.showToast({ title: '登录成功', icon: 'none' })
    } catch (error) {
      wx.showToast({ title: '账号或密码错误', icon: 'none' })
    }
  },

  async onRegister() {
    if (!this.data.account || !this.data.password) return wx.showToast({ title: '请输入账号和密码', icon: 'none' })
    try {
      const res = await request('/auth/register', 'POST', { account: this.data.account, password: this.data.password, nickname: this.data.nickname || '普通用户' })
      this.setLoginState(res)
      wx.showToast({ title: '注册并登录成功', icon: 'none' })
    } catch (error) {
      wx.showToast({ title: '注册失败，账号可能已存在', icon: 'none' })
    }
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
      if (error.statusCode === 401) return this.handleUnauthorized()
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
      if (error.statusCode === 401) return this.handleUnauthorized()
      if (error.statusCode === 404) return wx.showToast({ title: '家庭不存在', icon: 'none' })
      wx.showToast({ title: '加入失败，请重试', icon: 'none' })
    }
  },

  async loadJoinRequests() {
    if (!this.data.loggedIn) return
    try {
      const requests = await request('/families/join-requests')
      this.setData({ joinRequests: requests || [] })
    } catch (e) {
      if (e.statusCode === 401) return this.handleUnauthorized()
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
      if (err.statusCode === 401) return this.handleUnauthorized()
      wx.showToast({ title: '操作失败，请重试', icon: 'none' })
    }
  },

  onFamilySwitch(e) {
    const index = Number(e.detail.value)
    const target = switchFamily(app, this.data.families, index)
    if (!target) return
    this.setData({ familyIndex: index, familyId: target.id })
  },

  bindName(e) { this.setData({ familyName: e.detail.value }) },
  bindJoinFamilyId(e) { this.setData({ joinFamilyId: e.detail.value }) },
  bindAccount(e) { this.setData({ account: e.detail.value.trim() }) },
  bindPassword(e) { this.setData({ password: e.detail.value.trim() }) },
  bindNickname(e) { this.setData({ nickname: e.detail.value.trim() }) }
})
