App({
  globalData: {
    token: wx.getStorageSync('token') || '',
    familyId: wx.getStorageSync('familyId') || null,
    userId: wx.getStorageSync('userId') || null,
    apiBase: '' // 动态设置
  },

  onLaunch() {
    this.initEnv()
  },

  initEnv() {
    // 获取当前小程序运行环境
    const accountInfo = wx.getAccountInfoSync();
    const env = accountInfo.miniProgram.envVersion;

    // 根据环境设置 apiBase
    const baseUrls = {
      develop: 'http://192.168.3.51:8000/api', // 开发版
      trial: 'https://hapi.catpd.cn/api',    // 体验版
      release: 'https://hapi.catpd.cn/api'   // 正式版
    };

    this.globalData.apiBase = baseUrls[env] || baseUrls.release;
    console.log('Current API Base:', this.globalData.apiBase);
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
