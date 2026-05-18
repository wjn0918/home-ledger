const app = getApp()

function request(url, method = 'GET', data = {}) {
  return new Promise((resolve, reject) => {
    const token = app.globalData.token || wx.getStorageSync('token') || ''

    wx.request({
      url: `${app.globalData.apiBase}${url}`,
      method,
      data,
      header: {
        Authorization: token ? `Bearer ${token}` : ''
      },
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data)
          return
        }
        reject({
          statusCode: res.statusCode,
          data: res.data
        })
      },
      fail: (error) => reject({
        statusCode: 0,
        data: error
      })
    })
  })
}

module.exports = { request }
