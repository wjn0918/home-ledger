const { request } = require('../../utils/request')
const { syncFamilies, switchFamily } = require('../../utils/family')
const app = getApp()

Page({
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
    familyMembers: [],
    loginTab: 'wechat',
    userInfo: null, // Add userInfo to store nickname/avatar
    currentFamilyName: '未选择',
    isFamilyOwner: false
  },

  resetLoginState() {
    app.globalData.token = ''
    app.globalData.familyId = null
    app.globalData.userId = null
    wx.removeStorageSync('token')
    wx.removeStorageSync('familyId')
    wx.removeStorageSync('userId')
    wx.removeStorageSync('nickname')
    wx.removeStorageSync('avatarUrl')
    this.setData({
      loggedIn: false,
      familyId: null,
      userId: null,
      nickname: '',
      families: [],
      familyIndex: 0,
      familyMembers: [],
      joinRequests: [],
      currentFamilyName: '未选择',
      isFamilyOwner: false
    })
  },

  handleUnauthorized() {
    this.resetLoginState()
    wx.showToast({ title: '登录已失效，请重新登录', icon: 'none' })
  },

  async onShow() {
    const token = app.globalData.token || wx.getStorageSync('token')
    const familyId = app.globalData.familyId || wx.getStorageSync('familyId') || null
    const userId = app.globalData.userId || wx.getStorageSync('userId') || null
    const nickname = wx.getStorageSync('nickname') || null
    const avatarUrl = wx.getStorageSync('avatarUrl') || ''
    this.setData({ loggedIn: !!token, familyId, userId, nickname, userInfo: { avatarUrl } })
    if (!token) return
    try {
      const data = await syncFamilies(app)
      const familyIndex = data.families.findIndex((f) => f.id === data.selectedFamilyId)
      const currentFamily = data.families[familyIndex] || null
      this.setData({ 
        familyId: data.selectedFamilyId, 
        families: data.families, 
        familyIndex: familyIndex >= 0 ? familyIndex : 0,
        currentFamilyName: currentFamily ? currentFamily.name : '未加入家庭'
      })
      await this.loadJoinRequests()
      if (data.selectedFamilyId) {
        await this.loadFamilyMembers()
      }
    } catch (e) {
      if (e.statusCode === 401) this.handleUnauthorized()
    }
  },

  showCreateFamilyModal() {
    if (!this.data.loggedIn) return wx.showToast({ title: '请先登录', icon: 'none' })
    wx.showModal({
      title: '创建新家庭',
      editable: true,
      placeholderText: '请输入家庭名称',
      success: async (res) => {
        if (res.confirm && res.content) {
          this.setData({ familyName: res.content })
          await this.onCreateFamily()
        }
      }
    })
  },

  showJoinFamilyModal() {
    if (!this.data.loggedIn) return wx.showToast({ title: '请先登录', icon: 'none' })
    wx.showModal({
      title: '加入家庭',
      editable: true,
      placeholderText: '请输入家庭ID',
      success: async (res) => {
        if (res.confirm && res.content) {
          this.setData({ joinFamilyId: res.content })
          await this.onJoinFamily()
        }
      }
    })
  },

  setLoginState(res) {
    app.globalData.token = res.token
    app.globalData.userId = res.user_id
    wx.setStorageSync('token', res.token)
    wx.setStorageSync('userId', res.user_id)
    if (res.nickname) {
      wx.setStorageSync('nickname', res.nickname)
    }
    if (res.avatar_url) {
      wx.setStorageSync('avatarUrl', res.avatar_url)
    }
    this.setData({
      loggedIn: true,
      userId: res.user_id,
      nickname: res.nickname || '',
      userInfo: { avatarUrl: res.avatar_url || wx.getStorageSync('avatarUrl') || '' }
    })
    // 登录后自动刷新数据
    this.onShow()
  },

  onLoginTabTap(e) { this.setData({ loginTab: e.currentTarget.dataset.tab }) },

  onLogin() {
    wx.getUserProfile({
      desc: '用于完善会员资料',
      success: (profileRes) => {
        const wechatNickname = profileRes.userInfo.nickName
        const wechatAvatarUrl = profileRes.userInfo.avatarUrl
        wx.login({
          success: async ({ code }) => {
            try {
              const res = await request('/auth/wechat', 'POST', { code })
              // 如果微信获取到了昵称且后端没返回（或后端返回的是默认值），可以更新一下
              this.setLoginState(res)
              await this.updateWechatProfile({
                nickname: wechatNickname,
                avatarUrl: wechatAvatarUrl
              })
              wx.showToast({ title: '微信登录成功', icon: 'none' })
            } catch (error) {
              wx.showToast({ title: '登录失败', icon: 'none' })
            }
          },
          fail: () => wx.showToast({ title: '微信登录失败', icon: 'none' })
        })
      },
      fail: () => {
        // 用户拒绝授权昵称，降级为普通登录
        wx.login({
          success: async ({ code }) => {
            try {
              const res = await request('/auth/wechat', 'POST', { code })
              this.setLoginState(res)
              wx.showToast({ title: '微信登录成功', icon: 'none' })
            } catch (error) {
              wx.showToast({ title: '登录失败', icon: 'none' })
            }
          }
        })
      }
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

  async updateNickname(newNickname) {
    try {
      await request(`/users/me?nickname=${encodeURIComponent(newNickname)}`, 'PUT')
      wx.setStorageSync('nickname', newNickname)
      this.setData({ nickname: newNickname })
    } catch (e) {
      console.error('更新昵称失败', e)
    }
  },

  async updateWechatProfile({ nickname, avatarUrl }) {
    const safeNickname = (nickname || '').trim()
    const shouldUpdateNickname = !!safeNickname
    const shouldUpdateAvatar = !!avatarUrl
    if (!shouldUpdateNickname && !shouldUpdateAvatar) return

    try {
      const query = []
      if (shouldUpdateNickname) query.push(`nickname=${encodeURIComponent(safeNickname)}`)
      if (shouldUpdateAvatar) query.push(`avatar_url=${encodeURIComponent(avatarUrl)}`)
      await request(`/users/me?${query.join('&')}`, 'PUT')

      if (shouldUpdateNickname) wx.setStorageSync('nickname', safeNickname)
      if (shouldUpdateAvatar) wx.setStorageSync('avatarUrl', avatarUrl)
      this.setData({
        nickname: shouldUpdateNickname ? safeNickname : this.data.nickname,
        userInfo: { avatarUrl: shouldUpdateAvatar ? avatarUrl : (this.data.userInfo?.avatarUrl || '') }
      })
    } catch (e) {
      console.error('更新微信资料失败', e)
    }
  },

  showEditNicknameModal() {
    wx.showModal({
      title: '修改昵称',
      editable: true,
      placeholderText: '请输入新昵称',
      content: this.data.nickname,
      success: async (res) => {
        if (res.confirm && res.content) {
          const newNickname = res.content.trim()
          if (!newNickname) return
          await this.updateNickname(newNickname)
          wx.showToast({ title: '修改成功', icon: 'success' })
        }
      }
    })
  },

  async onCreateFamily() {
    if (!this.data.loggedIn) return wx.showToast({ title: '请先登录/注册', icon: 'none' })
    if (!this.data.familyName) return wx.showToast({ title: '请输入家庭名称', icon: 'none' })
    try {
      const res = await request('/families', 'POST', { name: this.data.familyName })
      app.globalData.familyId = res.id
      wx.setStorageSync('familyId', res.id)
      wx.showToast({ title: '家庭已创建' })
      await this.onShow() // Refresh data
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

  async onFamilySwitch(e) {
    const index = Number(e.detail.value)
    const target = switchFamily(app, this.data.families, index)
    if (!target) return
    this.setData({ 
      familyIndex: index, 
      familyId: target.id,
      currentFamilyName: target.name 
    })
    await this.loadFamilyMembers()
  },

  async loadFamilyMembers() {
    if (!this.data.familyId) return
    try {
      const members = await request(`/families/${this.data.familyId}/members`)
      const isOwner = members.some(m => m.id === Number(this.data.userId) && m.role === 'owner')
      this.setData({ familyMembers: members, isFamilyOwner: isOwner })
    } catch (e) {
      if (e.statusCode === 401) return this.handleUnauthorized()
      this.setData({ familyMembers: [] })
    }
  },

  onRemoveMember(e) {
    const { id, nickname } = e.currentTarget.dataset
    const isSelf = Number(id) === Number(this.data.userId)
    
    wx.showModal({
      title: isSelf ? '退出家庭' : '移除成员',
      content: isSelf ? '确定要退出当前家庭吗？' : `确定要将成员 "${nickname}" 移出家庭吗？`,
      success: async (res) => {
        if (res.confirm) {
          try {
            await request(`/families/${this.data.familyId}/members/${id}`, 'DELETE')
            wx.showToast({ title: '操作成功', icon: 'none' })
            if (isSelf) {
              // 如果是退出自己，刷新页面以重新加载家庭列表
              await this.onShow()
            } else {
              await this.loadFamilyMembers()
            }
          } catch (err) {
            wx.showToast({ title: err.data?.detail || '操作失败', icon: 'none' })
          }
        }
      }
    })
  },

  onLogout() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出当前账户吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            await request('/auth/logout', 'POST')
          } catch (e) {
            // 忽略登出接口异常，保证本地状态能被清理
          }
          this.resetLoginState()
          wx.showToast({ title: '已退出登录', icon: 'none' })
        }
      }
    })
  },

  onDeregister() {
    wx.showModal({
      title: '注销账号',
      content: '注销后将永久删除您的所有账单、家庭及相关数据，且无法找回。确定要注销吗？',
      confirmColor: '#ff4d4f',
      success: async (res) => {
        if (res.confirm) {
          try {
            await request('/users/me', 'DELETE')
            wx.showToast({ title: '账号已注销', icon: 'success' })
            this.resetLoginState()
          } catch (err) {
            wx.showToast({ title: '注销失败，请稍后重试', icon: 'none' })
          }
        }
      }
    })
  },

  bindName(e) { this.setData({ familyName: e.detail.value }) },
  bindJoinFamilyId(e) { this.setData({ joinFamilyId: e.detail.value }) },
  bindAccount(e) { this.setData({ account: e.detail.value.trim() }) },
  bindPassword(e) { this.setData({ password: e.detail.value.trim() }) },
  bindNickname(e) { this.setData({ nickname: e.detail.value.trim() }) }
})
