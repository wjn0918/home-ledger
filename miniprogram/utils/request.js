const app = getApp()

function request(url, method = 'GET', data = {}) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${app.globalData.apiBase}${url}`,
      method,
      data,
      header: {
        'Authorization': app.globalData.token ? `Bearer ${app.globalData.token}` : ''
      },
      success: (res) => resolve(res.data),
      fail: reject
    })
  })
}

module.exports = { request }
