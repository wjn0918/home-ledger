const { request } = require('../../utils/request')
const { syncFamilies } = require('../../utils/family')
const app = getApp()

function toDay(dateStr) {
  return new Date(dateStr).toISOString().slice(0, 10)
}

function toAmount(value) {
  return Number(value || 0)
}

function groupBillsByDay(bills, currentUserId) {
  const groups = {}
  bills.forEach((bill) => {
    const ownerId = Number(bill.user_id)
    const selfId = Number(currentUserId)
    bill.creatorClass = ownerId === selfId ? "bill-self" : `bill-member-${ownerId % 4}`
    bill.x = 0 // 初始化滑动位置
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
  data: { bills: [], groupedBills: [], currentFamilyName: '', userId: null },

  async onShow() {
    if (!app.requireLogin()) return
    await this.loadFamiliesAndBills()
  },

  async loadFamiliesAndBills() {
    try {
      const data = await syncFamilies(app)
      this.setData({ currentFamilyName: data.selectedFamilyName, userId: app.globalData.userId || wx.getStorageSync("userId") || null })
      if (!data.selectedFamilyId) return
      const list = await request(`/bills?family_id=${data.selectedFamilyId}`)
      this.setData({ bills: list, groupedBills: groupBillsByDay(list, this.data.userId) })
    } catch (e) {
      wx.showToast({ title: '加载家庭信息失败', icon: 'none' })
    }
  },


  async onAmountTap(e) {
    const bill = this.findBillByDatasetId(e)
    if (!bill) return
    if (Number(bill.user_id) !== Number(this.data.userId)) return wx.showToast({ title: "仅可修改自己账单", icon: "none" })
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
    if (Number(bill.user_id) !== Number(this.data.userId)) return wx.showToast({ title: "仅可修改自己账单", icon: "none" })
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
    if (Number(bill.user_id) !== Number(this.data.userId)) return wx.showToast({ title: "仅可修改自己账单", icon: "none" })
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
    if (Number(bill.user_id) !== Number(this.data.userId)) return wx.showToast({ title: "仅可修改自己账单", icon: "none" })
    await this.submitBillEdit(bill, { is_shared: !!e.detail.value })
  },

  onSwipeChange(e) {
    // 可以在这里处理滑动互斥，即同时只允许一个项处于滑动状态
  },

  async onDeleteTap(e) {
    const bill = this.findBillByDatasetId(e)
    if (!bill) return
    if (Number(bill.user_id) !== Number(this.data.userId)) return wx.showToast({ title: "仅可删除自己账单", icon: "none" })

    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条账单吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            await request(`/bills/${bill.id}`, 'DELETE')
            await this.loadFamiliesAndBills()
            wx.showToast({ title: '删除成功', icon: 'success' })
          } catch (err) {
            wx.showToast({ title: '删除失败', icon: 'none' })
          }
        } else {
          // 如果取消，可以考虑把位置弹回去
          this.resetSwipe(bill.id)
        }
      }
    })
  },

  resetSwipe(billId) {
    const groupedBills = this.data.groupedBills.map(group => {
      group.items = group.items.map(item => {
        if (item.id === billId) {
          return { ...item, x: 0 }
        }
        return item
      })
      return group
    })
    this.setData({ groupedBills })
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
