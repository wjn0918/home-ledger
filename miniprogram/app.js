App({
  globalData: {
    token: wx.getStorageSync('token') || '',
    familyId: wx.getStorageSync('familyId') || null,
    userId: wx.getStorageSync('userId') || null,
    apiBase: '' // 动态设置
  },

  onLaunch() {
    this.initEnv()
     // 保存原始 Page 构造函数
     const originalPage = Page
     Page = function(config) {
       // 如果页面没有自定义分享，则注入默认分享
       if (!config.onShareAppMessage) {
         config.onShareAppMessage = function() {
           return {
             title: "家庭记账本",
             path: "/pages/bookkeeping/index",
             imageUrl: ""
           }
         }
       }
       // 注入默认的"分享到朋友圈"
      if (!config.onShareTimeline) {
        config.onShareTimeline = function() {
          return {
            title: "家庭记账本",
            query: "",  // 注意：朋友圈分享用 query 而不是 path
            imageUrl: ""
          }
        }
      }
       originalPage(config)
     }
  },

  initEnv() {
    // 获取当前小程序运行环境
    const accountInfo = wx.getAccountInfoSync();
    const env = accountInfo.miniProgram.envVersion;

    // 根据环境设置 apiBase
    const baseUrls = {
      develop: 'http://localhost:8000/api', // 开发版
      trial: 'https://hapi.ly1997.top/api',    // 体验版
      release: 'https://hapi.ly1997.top/api'   // 正式版
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
