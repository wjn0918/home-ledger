const { request } = require('../../utils/request')
const { syncFamilies, switchFamily } = require('../../utils/family')
const app = getApp()
const FALLBACK_SVG_ICONS = [
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path fill='%23ff8f1f' d='M7 2v8a2 2 0 0 0 2 2v10h2V2H9v6H8V2Zm8 0c-2 0-4 2-4 5v7h3v8h2V2z'/></svg>",
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path fill='%234a90e2' d='M5 16a2 2 0 1 0 0 4a2 2 0 0 0 0-4m14 0a2 2 0 1 0 0 4a2 2 0 0 0 0-4M5 4h14a2 2 0 0 1 2 2v9h-2a3 3 0 0 0-6 0H11a3 3 0 0 0-6 0H3V6a2 2 0 0 1 2-2'/></svg>",
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path fill='%23ff5a7a' d='M6 7h12l-1 13H7zm3-3h6l1 2H8z'/></svg>",
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path fill='%2328c76f' d='M3 6h18v12H3zm9 2a3 3 0 0 0-3 3h2a1 1 0 1 1 1 1a3 3 0 0 0 0 6v1h2v-1a3 3 0 0 0 0-6a1 1 0 1 1 1-1h2a3 3 0 0 0-3-3V7h-2z'/></svg>",
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><circle cx='12' cy='12' r='10' fill='%2399a2ad'/><circle cx='12' cy='8' r='1.5' fill='white'/><circle cx='12' cy='12' r='1.5' fill='white'/><circle cx='12' cy='16' r='1.5' fill='white'/></svg>"
]

Page({
  data: {
    amount: '',
    category: '',
    categoryIcon: '',
    type: 'expense',
    note: '',
    billDate: '',
    families: [],
    familyIndex: 0,
    currentFamilyName: '',
    categoryOptions: [],
    defaultIcons: [],
    isShared: true,
    showCategoryModal: false,
    showDetailModal: false,
    showAddCategoryModal: false,
    newCategoryName: '',
    newCategoryIcon: 'other',
    calcExpr: '',
    lastOp: ''
  },

  async onShow() {
    if (!app.requireLogin()) return
    this.initTodayDate()
    try {
      const data = await syncFamilies(app)
      const familyIndex = data.families.findIndex((f) => f.id === data.selectedFamilyId)
      this.setData({
        families: data.families,
        familyIndex: familyIndex >= 0 ? familyIndex : 0,
        currentFamilyName: data.selectedFamilyName
      })
      await this.loadDefaultIcons()
      await this.loadCategories()
    } catch (e) {
      wx.showToast({ title: '加载家庭信息失败', icon: 'none' })
    }
  },

  openCategoryModal() {
    this.setData({ showCategoryModal: true, showDetailModal: false })
  },

  onCategorySelect(e) {
    const category = e.currentTarget.dataset.category
    const categoryIcon = e.currentTarget.dataset.icon || ''
    this.setData({ 
      category,
      categoryIcon,
      showCategoryModal: false, 
      showDetailModal: true,
      amount: '',
      calcExpr: '',
      note: ''
    })
  },

  closeModals() {
    this.setData({ showCategoryModal: false, showDetailModal: false, showAddCategoryModal: false })
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
        category_icon: this.data.categoryIcon,
        type: this.data.type,
        note: this.data.note,
        bill_date: `${this.data.billDate}T00:00:00`,
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
    this.loadCategories()
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

  async loadDefaultIcons() {
    try {
      const res = await request('/categories/default-icons', 'GET')
      this.setData({ defaultIcons: (res || []).map((x) => x.icon) })
    } catch (e) {
      this.setData({ defaultIcons: FALLBACK_SVG_ICONS })
    }
  },

  async loadCategories() {
    if (!app.globalData.familyId) return
    try {
      const res = await request(`/families/${app.globalData.familyId}/categories`, 'GET')
      const categoryOptions = (res || []).map((c) => ({ name: c.name, icon: c.icon || '' }))
      const selectedItem = categoryOptions.find((c) => c.name === this.data.category) || categoryOptions[0] || { name: '', icon: '' }
      this.setData({
        categoryOptions,
        category: selectedItem.name,
        categoryIcon: selectedItem.icon
      })
    } catch (e) {
      wx.showToast({ title: '加载分类失败', icon: 'none' })
    }
  },

  onDateChange(e) {
    this.setData({ billDate: e.detail.value })
  },

  bindAmount(e) { this.setData({ amount: e.detail.value }) },
  bindNote(e) { this.setData({ note: e.detail.value }) },
  onShareChange(e) { this.setData({ isShared: !!e.detail.value }) },

  onAddCategoryTap() {
    if (!app.globalData.familyId) {
      wx.showToast({ title: '请先选择家庭', icon: 'none' })
      return
    }
    const defaultIcon = (this.data.defaultIcons && this.data.defaultIcons[0]) || 'other'
    this.setData({
      showAddCategoryModal: true,
      showCategoryModal: false,
      newCategoryName: '',
      newCategoryIcon: defaultIcon
    })
  },

  onNewCategoryNameInput(e) {
    this.setData({ newCategoryName: (e.detail.value || '').trim() })
  },

  onNewCategoryIconSelect(e) {
    this.setData({ newCategoryIcon: e.currentTarget.dataset.icon || 'other' })
  },

  async onConfirmAddCategory() {
    const value = (this.data.newCategoryName || '').trim()
    if (!value) {
      wx.showToast({ title: '请输入类别名称', icon: 'none' })
      return
    }
    const icon = this.data.newCategoryIcon || 'other'
    try {
      await request(`/families/${app.globalData.familyId}/categories`, 'POST', { name: value, icon })
      await this.loadCategories()
      this.setData({
        category: value,
        categoryIcon: icon,
        showAddCategoryModal: false
      })
      wx.showToast({ title: '类别已添加', icon: 'success' })
    } catch (e) {
      wx.showToast({ title: '新增失败', icon: 'none' })
    }
  },

  async onCategoryLongPress(e) {
    const category = e.currentTarget.dataset.category
    const currentIcon = e.currentTarget.dataset.icon || ''
    if (!app.globalData.familyId || !category) return
    const iconList = (this.data.defaultIcons.length ? this.data.defaultIcons : ['other']).slice(0, 6)
    wx.showActionSheet({
      itemList: iconList.map((i) => `${i}${i === currentIcon ? '（当前）' : ''}`),
      success: async (res) => {
        const icon = iconList[res.tapIndex]
        try {
          await request(`/families/${app.globalData.familyId}/categories`, 'POST', { name: category, icon })
          await this.loadCategories()
          if (this.data.category === category) this.setData({ categoryIcon: icon })
          wx.showToast({ title: '图标已更新', icon: 'success' })
        } catch (err) {
          wx.showToast({ title: '更新失败', icon: 'none' })
        }
      }
    })
  }
})
