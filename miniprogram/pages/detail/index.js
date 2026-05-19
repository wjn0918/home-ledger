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
  },

  async onAmountTap(e) {
    const bill = this.findBillByDatasetId(e)
    if (!bill) return
    wx.showModal({
      title: '修改金额',
      editable: true,
      placeholderText: `${bill.amount}`,
      success: async (res) => {
        if (!res.confirm) return
        const amount = Number((res.content || '').trim())
        if (!amount) return wx.showToast({ title: '金额无效', icon: 'none' })
        await this.submitBillEdit(bill, { amount })
      }
    })
  },

  async onCategoryTap(e) {
    const bill = this.findBillByDatasetId(e)
    if (!bill) return
    wx.showModal({
      title: '修改类别',
      editable: true,
      placeholderText: bill.category,
      success: async (res) => {
        if (!res.confirm) return
        const category = (res.content || '').trim()
        if (!category) return wx.showToast({ title: '类别不能为空', icon: 'none' })
        await this.submitBillEdit(bill, { category })
      }
    })
  },

  async onDateTap(e) {
    const bill = this.findBillByDatasetId(e)
    if (!bill) return
    wx.showModal({
      title: '修改日期',
      editable: true,
      placeholderText: toDay(bill.bill_date),
      success: async (res) => {
        if (!res.confirm) return
        const dateStr = (res.content || '').trim()
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return wx.showToast({ title: '日期格式应为YYYY-MM-DD', icon: 'none' })
        await this.submitBillEdit(bill, { bill_date: new Date(`${dateStr}T00:00:00`).toISOString() })
      }
    })
  },

  async onShareSwitchChange(e) {
    const bill = this.findBillByDatasetId(e)
    if (!bill) return
    await this.submitBillEdit(bill, { is_shared: !!e.detail.value })
  },

  findBillByDatasetId(e) {
    const billId = Number(e.currentTarget.dataset.id)
    return this.data.bills.find((item) => item.id === billId)
  },

  async submitBillEdit(bill, patch) {
    const payload = {
      amount: patch.amount ?? Number(bill.amount),
      category: patch.category ?? bill.category,
      bill_date: patch.bill_date ?? bill.bill_date,
      is_shared: patch.is_shared ?? bill.is_shared
    }
    await request(`/bills/${bill.id}`, 'PUT', payload)
    await this.loadFamiliesAndBills()
    wx.showToast({ title: '修改成功', icon: 'none' })
  },


})
