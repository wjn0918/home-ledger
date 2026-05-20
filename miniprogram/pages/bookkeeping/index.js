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
    isShared: true,
    showCategoryModal: false,
    showDetailModal: false,
    calcExpr: '',
    lastOp: ''
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

  openCategoryModal() {
    this.setData({ showCategoryModal: true, showDetailModal: false })
  },

  onCategorySelect(e) {
    const category = e.currentTarget.dataset.category
    this.setData({ 
      category, 
      showCategoryModal: false, 
      showDetailModal: true,
      amount: '',
      calcExpr: '',
      note: ''
    })
  },

  closeModals() {
    this.setData({ showCategoryModal: false, showDetailModal: false })
  },

  stopBubble() {},

  onCalcInput(e) {
    const val = e.currentTarget.dataset.val
    let { calcExpr, amount } = this.data

    if (val === 'back') {
      calcExpr = calcExpr.slice(0, -1)
    } else if (val === '=') {
      amount = this.evaluateExpr(calcExpr)
      calcExpr = amount
    } else if (['+', '-'].includes(val)) {
      if (!calcExpr) return
      const lastChar = calcExpr.slice(-1)
      if (['+', '-'].includes(lastChar)) {
        calcExpr = calcExpr.slice(0, -1) + val
      } else {
        // 先计算之前的结果显示在 amount
        amount = this.evaluateExpr(calcExpr)
        calcExpr += val
      }
    } else {
      // 数字或点
      calcExpr += val
      // 实时计算当前能算出的结果显示在 amount
      amount = this.evaluateExpr(calcExpr)
    }

    this.setData({ calcExpr, amount })
  },

  evaluateExpr(expr) {
    if (!expr) return '0.00'
    // 移除末尾的操作符再计算
    let cleanExpr = expr
    if (['+', '-'].includes(expr.slice(-1))) {
      cleanExpr = expr.slice(0, -1)
    }
    try {
      // 简单的加减计算逻辑，避免使用 eval
      const parts = cleanExpr.split(/([+-])/)
      let res = parseFloat(parts[0] || 0)
      for (let i = 1; i < parts.length; i += 2) {
        const op = parts[i]
        const val = parseFloat(parts[i + 1] || 0)
        if (op === '+') res += val
        else if (op === '-') res -= val
      }
      return res.toFixed(2)
    } catch (e) {
      return '0.00'
    }
  },

  async onSubmit() {
    if (!app.requireLogin()) return
    
    // 提交前先结算表达式
    const finalAmount = this.evaluateExpr(this.data.calcExpr)
    if (Number(finalAmount) <= 0) {
      wx.showToast({ title: '金额必须大于0', icon: 'none' })
      return
    }

    if (!app.globalData.familyId) {
      wx.showToast({ title: '请先选择家庭', icon: 'none' })
      return
    }

    try {
      await request('/bills', 'POST', {
        family_id: app.globalData.familyId,
        amount: Number(finalAmount),
        category: this.data.category,
        type: this.data.type,
        note: this.data.note,
        bill_date: new Date(`${this.data.billDate}T00:00:00`).toISOString(),
        is_shared: this.data.isShared
      })
      wx.showToast({ title: '记账成功', icon: 'success' })
      this.closeModals()
      // 重置数据
      this.setData({ amount: '', note: '', calcExpr: '' })
    } catch (err) {
      wx.showToast({ title: '提交失败', icon: 'none' })
    }
  },

  onFamilyChange(e) {
    const index = Number(e.detail.value)
    const target = switchFamily(app, this.data.families, index)
    if (!target) return
    this.setData({ familyIndex: index, currentFamilyName: target.name })
  },

  onCategoryTap(e) {
    // 废弃，改用 onCategorySelect
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
