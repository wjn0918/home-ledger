const { request } = require('../../utils/request')
const { syncFamilies, switchFamily } = require('../../utils/family')
const app = getApp()

Page({
  data: { amount: '', category: '餐饮', type: 'expense', note: '', families: [], familyIndex: 0, currentFamilyName: '' },
  async onShow() {
    if (!app.requireLogin()) return
    try {
      const data = await syncFamilies(app)
      const familyIndex = data.families.findIndex((f) => f.id === data.selectedFamilyId)
      this.setData({
        families: data.families,
        familyIndex: familyIndex >= 0 ? familyIndex : 0,
        currentFamilyName: data.selectedFamilyName
      })
    } catch (e) {
      wx.showToast({ title: '加载家庭信息失败', icon: 'none' })
    }
  },
  async onSubmit() {
    if (!app.requireLogin()) return
    await request('/bills', 'POST', {
      family_id: app.globalData.familyId,
      amount: Number(this.data.amount),
      category: this.data.category,
      type: this.data.type,
      note: this.data.note,
      bill_date: new Date().toISOString()
    })
    wx.showToast({ title: '记账成功' })
  },
  onFamilyChange(e) {
    const index = Number(e.detail.value)
    const target = switchFamily(app, this.data.families, index)
    if (!target) return
    this.setData({ familyIndex: index, currentFamilyName: target.name })
  },
  bindAmount(e) { this.setData({ amount: e.detail.value }) },
  bindCategory(e) { this.setData({ category: e.detail.value }) },
  bindNote(e) { this.setData({ note: e.detail.value }) }
})
