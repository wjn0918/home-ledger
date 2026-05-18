App({
  globalData: {
    token: wx.getStorageSync('token') || '',
    familyId: wx.getStorageSync('familyId') || null,
    apiBase: 'http://127.0.0.1:8000/api'
  }
})
