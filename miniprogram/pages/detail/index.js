const { request } = require('../../utils/request')
const app = getApp()

Page({
  data: { bills: [] },
  async onShow() {
    if (!app.globalData.familyId) return
    const list = await request(`/bills?family_id=${app.globalData.familyId}`)
    this.setData({ bills: list })
  }
})
