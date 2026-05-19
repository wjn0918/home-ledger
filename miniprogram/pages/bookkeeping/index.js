const { request } = require('../../utils/request')
const { syncFamilies, switchFamily } = require('../../utils/family')
const app = getApp()

const DEFAULT_CATEGORIES = ['蔬菜', '水果', '住房', '交通']

Page({
  data: {
    amount: '',
    category: '蔬菜',
    type: 'expense',
    note: '',
    billDate: '',
    families: [],
    familyIndex: 0,
    currentFamilyName: '',
    categoryOptions: DEFAULT_CATEGORIES,
    isShared: true
  },

  async onShow() {
    if (!app.requireLogin()) return
    this.loadCategories()
    this.initTodayDate()
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

  initTodayDate() {
    if (this.data.billDate) return
    const now = new Date()
    const month = `${now.getMonth() + 1}`.padStart(2, '0')
    const day = `${now.getDate()}`.padStart(2, '0')
    this.setData({ billDate: `${now.getFullYear()}-${month}-${day}` })
  },

  loadCategories() {
    const custom = wx.getStorageSync('customCategories') || []
    const categoryOptions = [...DEFAULT_CATEGORIES, ...custom]
    const selected = categoryOptions.includes(this.data.category) ? this.data.category : categoryOptions[0]
    this.setData({
      categoryOptions,
      category: selected
    })
  },

  async onSubmit() {
    if (!app.requireLogin()) return
    if (!this.data.amount) {
      wx.showToast({ title: '请输入金额', icon: 'none' })
      return
    }
    if (!app.globalData.familyId) {
      wx.showToast({ title: '请先选择家庭', icon: 'none' })
      return
    }

    await request('/bills', 'POST', {
      family_id: app.globalData.familyId,
      amount: Number(this.data.amount),
      category: this.data.category,
      type: this.data.type,
      note: this.data.note,
      bill_date: new Date(`${this.data.billDate}T00:00:00`).toISOString(),
      is_shared: this.data.isShared
    })
    wx.showToast({ title: '记账成功' })
  },

  onFamilyChange(e) {
    const index = Number(e.detail.value)
    const target = switchFamily(app, this.data.families, index)
    if (!target) return
    this.setData({ familyIndex: index, currentFamilyName: target.name })
  },

  onCategoryTap(e) {
    const category = e.currentTarget.dataset.category
    this.setData({ category })
  },

  onDateChange(e) {
    this.setData({ billDate: e.detail.value })
  },

  bindAmount(e) { this.setData({ amount: e.detail.value }) },
  bindNote(e) { this.setData({ note: e.detail.value }) },
  onShareChange(e) { this.setData({ isShared: !!e.detail.value }) },

  onAddCategoryTap() {
    wx.showModal({
      title: '新增账单类别',
      editable: true,
      placeholderText: '例如：零食',
      success: (res) => {
        if (!res.confirm) return
        const value = (res.content || '').trim()
        if (!value) {
          wx.showToast({ title: '请输入类别名称', icon: 'none' })
          return
        }
        if (this.data.categoryOptions.includes(value)) {
          wx.showToast({ title: '类别已存在', icon: 'none' })
          this.setData({ category: value })
          return
        }
        const custom = wx.getStorageSync('customCategories') || []
        custom.push(value)
        wx.setStorageSync('customCategories', custom)
        this.loadCategories()
        this.setData({ category: value })
        wx.showToast({ title: '类别已添加', icon: 'none' })
      }
    })
  }
})
