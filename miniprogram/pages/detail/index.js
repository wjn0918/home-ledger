const { request } = require('../../utils/request')
const { syncFamilies, switchFamily } = require('../../utils/family')
const app = getApp()

function toDay(dateStr) {
  return new Date(dateStr).toISOString().slice(0, 10)
}

function toAmount(value) {
  return Number(value || 0)
}

function groupBillsByDay(bills) {
  const groups = {}
  bills.forEach((bill) => {
    const day = toDay(bill.bill_date)
    if (!groups[day]) {
      groups[day] = { day, total: 0, items: [] }
    }
    groups[day].items.push(bill)
    groups[day].total += toAmount(bill.amount)
  })

  return Object.values(groups)
    .sort((a, b) => (a.day < b.day ? 1 : -1))
    .map((group) => ({ ...group, total: group.total.toFixed(2) }))
}

Page({
  data: { bills: [], groupedBills: [], families: [], familyIndex: 0, currentFamilyName: '' },

  async onShow() {
    if (!app.requireLogin()) return
    await this.loadFamiliesAndBills()
  },

  async loadFamiliesAndBills() {
    try {
      const data = await syncFamilies(app)
      const familyIndex = data.families.findIndex((f) => f.id === data.selectedFamilyId)
      this.setData({
        families: data.families,
        familyIndex: familyIndex >= 0 ? familyIndex : 0,
        currentFamilyName: data.selectedFamilyName
      })
      if (!data.selectedFamilyId) return
      const list = await request(`/bills?family_id=${data.selectedFamilyId}`)
      this.setData({ bills: list, groupedBills: groupBillsByDay(list) })
    } catch (e) {
      wx.showToast({ title: '加载家庭信息失败', icon: 'none' })
    }
  },

  async onFamilyChange(e) {
    const index = Number(e.detail.value)
    const target = switchFamily(app, this.data.families, index)
    if (!target) return
    this.setData({ familyIndex: index, currentFamilyName: target.name })
    const list = await request(`/bills?family_id=${target.id}`)
    this.setData({ bills: list, groupedBills: groupBillsByDay(list) })
  }
})
