const { request } = require('../../utils/request')
const app = getApp()

Page({
  data: { amount: '', category: '餐饮', type: 'expense', note: '' },
  async onSubmit() {
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
  bindAmount(e) { this.setData({ amount: e.detail.value }) },
  bindCategory(e) { this.setData({ category: e.detail.value }) },
  bindNote(e) { this.setData({ note: e.detail.value }) }
})
