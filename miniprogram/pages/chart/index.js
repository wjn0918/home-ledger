const { request } = require('../../utils/request')
const app = getApp()

Page({
  data: { rows: [] },
  async onShow() {
    if (!app.globalData.familyId) return
    const rows = await request(`/charts/summary?family_id=${app.globalData.familyId}`)
    this.setData({ rows })
  }
})
