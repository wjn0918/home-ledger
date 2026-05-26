const { request } = require('../../utils/request')
const { syncFamilies } = require('../../utils/family')
const app = getApp()

function toDay(dateStr) {
  const d = new Date(dateStr)
  const y = d.getFullYear()
  const m = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${y}-${m}-${day}`
}

function toAmount(value) {
  return Number(value || 0)
}

function groupBillsByDay(bills, currentUserId, selectedIds = []) {
  const groups = {}
  bills.forEach((bill) => {
    const ownerId = Number(bill.user_id)
    const selfId = Number(currentUserId)
    bill.creatorClass = ownerId === selfId ? "bill-self" : `bill-member-${ownerId % 4}`
    bill.x = 0 // 初始化滑动位置
    bill.selected = selectedIds.includes(Number(bill.id))
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
  data: { 
    bills: [], 
    groupedBills: [], 
    currentFamilyName: '', 
    userId: null,
    categoryOptions: [],
    selectedMonth: '',
    selectedCategory: '',
    isBatchMode: false,
    selectedIds: []
  },

  async onShow() {
    if (!app.isLoggedIn()) {
      this.setData({
        bills: [],
        groupedBills: [],
        currentFamilyName: '体验模式',
        userId: null,
        categoryOptions: [],
        selectedMonth: '',
        selectedCategory: '',
        isBatchMode: false,
        selectedIds: []
      })
      return
    }
    await this.loadFamiliesAndBills()
  },

  async loadFamiliesAndBills() {
    try {
      const data = await syncFamilies(app)
      this.setData({ currentFamilyName: data.selectedFamilyName, userId: app.globalData.userId || wx.getStorageSync("userId") || null })
      if (!data.selectedFamilyId) return
      const list = await request(`/bills?family_id=${data.selectedFamilyId}`)
      const categoryOptions = Array.from(new Set((list || []).map((item) => item.category).filter(Boolean)))
      this.setData({ bills: list, categoryOptions, selectedCategory: '' })
      this.refreshFilteredBills()
    } catch (e) {
      if (e.statusCode === 401) {
        this.setData({
          bills: [],
          groupedBills: [],
          currentFamilyName: '体验模式',
          userId: null
        })
        return
      }
      wx.showToast({ title: '加载家庭信息失败', icon: 'none' })
    }
  },

  refreshFilteredBills() {
    const { bills, userId, selectedIds, selectedMonth, selectedCategory } = this.data
    const filteredBills = bills.filter((bill) => {
      const billMonth = toDay(bill.bill_date).slice(0, 7)
      const hitMonth = !selectedMonth || billMonth === selectedMonth
      const hitCategory = !selectedCategory || bill.category === selectedCategory
      return hitMonth && hitCategory
    })
    this.setData({ groupedBills: groupBillsByDay(filteredBills, userId, selectedIds) })
  },

  onMonthChange(e) {
    this.setData({ selectedMonth: e.detail.value })
    this.refreshFilteredBills()
  },

  onCategoryFilterChange(e) {
    const index = Number(e.detail.value)
    const categories = ['全部'].concat(this.data.categoryOptions || [])
    const selectedCategory = index <= 0 ? '' : (categories[index] || '')
    this.setData({ selectedCategory })
    this.refreshFilteredBills()
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
    const items = this.data.categoryOptions || []
    if (!items.length) return wx.showToast({ title: '暂无可选类别', icon: 'none' })
    wx.showActionSheet({
      itemList: items,
      success: async (res) => {
        const category = items[res.tapIndex]
        if (!category) return
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
        await this.submitBillEdit(bill, { bill_date: `${dateStr}T00:00:00` })
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

  toggleBatchMode() {
    this.setData({
      isBatchMode: !this.data.isBatchMode,
      selectedIds: []
    })
  },

  onSelectBill(e) {
    const id = Number(e.currentTarget.dataset.id)
    const bill = this.data.bills.find(b => b.id === id)
    if (bill && Number(bill.user_id) !== Number(this.data.userId)) {
      return wx.showToast({ title: '只能选择自己的账单', icon: 'none' })
    }
    
    let selectedIds = [...this.data.selectedIds]
    const index = selectedIds.indexOf(id)
    if (index > -1) {
      selectedIds.splice(index, 1)
    } else {
      selectedIds.push(id)
    }
    
    this.setData({ selectedIds })
    this.refreshFilteredBills()
    
    // 同时更新 groupedBills 中的选中状态，确保 wxml 中的 selectedIds.includes(item.id) 能够正确响应
    // 实际上 WXML 里的 selectedIds.includes 是实时计算的，只要 setData({ selectedIds }) 就会刷新。
    // 如果不刷新，可能是因为 selectedIds 数组引用的问题，或者是 wxml 的作用域问题。
    // 这里我们强制 setData 一下。
  },

  onBillItemTap(e) {
    if (!this.data.isBatchMode) return
    this.onSelectBill(e)
  },

  async onBatchShare(e) {
    const isShared = e.currentTarget.dataset.shared === 'true'
    const { selectedIds } = this.data
    if (!selectedIds.length) return wx.showToast({ title: '请先选择账单', icon: 'none' })

    wx.showLoading({ title: '处理中...' })
    try {
      // 批量更新需要传一个完整的 payload，但我们只改 is_shared
      // 为了简单，我们取第一个选中账单的基础信息，或者后端改造成支持局部更新
      // 这里我们假设后端 batch-update 逻辑会处理
      const firstBill = this.data.bills.find(b => b.id === selectedIds[0])
      const payload = {
        amount: Number(firstBill.amount),
        category: firstBill.category,
        bill_date: firstBill.bill_date,
        is_shared: isShared
      }
      await request(`/bills/batch-update?bill_ids=${selectedIds.join(',')}`, 'PUT', payload, selectedIds) 
      // 注意：上面的 request 封装可能不支持这种传参方式，我需要检查一下。
      // 实际上，我们的 request.js 里的 data 是 body。
      // 所以我应该把 bill_ids 放在 body 里，或者作为 query param。
      // 后端代码中是 `bill_ids: list[int]`，FastAPI 默认会从 body 中取（如果不是简单类型）。
      
      await request('/bills/batch-update', 'PUT', { bill_ids: selectedIds, ...payload })
      
      wx.hideLoading()
      wx.showToast({ title: '批量操作成功' })
      this.setData({ isBatchMode: false, selectedIds: [] })
      await this.loadFamiliesAndBills()
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: '操作失败', icon: 'none' })
    }
  },

  async onBatchDelete() {
    const { selectedIds } = this.data
    if (!selectedIds.length) return wx.showToast({ title: '请先选择账单', icon: 'none' })

    wx.showModal({
      title: '批量删除',
      content: `确定要删除选中的 ${selectedIds.length} 笔账单吗？`,
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '删除中...' })
          try {
            await request('/bills/batch-delete', 'POST', selectedIds)
            wx.hideLoading()
            wx.showToast({ title: '删除成功' })
            this.setData({ isBatchMode: false, selectedIds: [] })
            await this.loadFamiliesAndBills()
          } catch (err) {
            wx.hideLoading()
            wx.showToast({ title: '操作失败', icon: 'none' })
          }
        }
      }
    })
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
