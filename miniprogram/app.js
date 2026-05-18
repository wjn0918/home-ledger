App({
  globalData: {
    token: wx.getStorageSync('token') || '',
    familyId: wx.getStorageSync('familyId') || null,
    apiBase: 'http://127.0.0.1:8000/api'
  },

  onLaunch() {
    this.requireLogin('欢迎使用家庭记账，请先登录后再使用系统功能。')
  },

  isLoggedIn() {
    const token = this.globalData.token || wx.getStorageSync('token') || ''
    this.globalData.token = token
    return !!token
  },

  requireLogin(message = '请先登录后再继续操作。') {
    if (this.isLoggedIn()) return true

    wx.showModal({
      title: '登录后可用',
      content: message,
      showCancel: false,
      success: () => {
        wx.switchTab({ url: '/pages/me/index' })
      }
    })
    return false
  }
})
