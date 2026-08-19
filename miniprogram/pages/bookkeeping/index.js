const { request } = require('../../utils/request')
const { syncFamilies, switchFamily } = require('../../utils/family')
const app = getApp()
const FALLBACK_ICONFONT_ICONS = [
  'icon-canyin', 'icon-jiaotong', 'icon-gouwu', 'icon-gongzi', 'icon-qita'
]

Page({
  data: {
    amount: '',
    category: '',
    categoryIcon: '',
    type: 'expense',
    note: '',
    billDate: '',
    isPosted: true,
    families: [],
    familyIndex: 0,
    currentFamilyName: '',
    categoryOptions: [],
    defaultIcons: [],
    isShared: true,
    pendingBills: [],
    showPendingActionModal: false,
    activePendingBill: null,
    showCategoryModal: false,
    showDetailModal: false,
    showCategorySettingsModal: false,
    showTransferModal: false,
    showEditCategoryIconModal: false,
    showAddCategoryPanel: false,
    newCategoryName: '',
    newCategoryIcon: 'other',
    editingCategoryName: '',
    editingCategoryIcon: '',
    pendingDeleteCategoryId: null,
    pendingDeleteCategoryName: '',
    pendingDeleteCount: 0,
    transferTargetCategoryId: null,
    transferOptions: [],
    showEditCategoryNameModal: false,
    editingCategoryId: null,
    editingCategoryNewName: '',
    calcExpr: '',
    lastOp: ''
  },

  async onShow() {
    this.initTodayDate()
    if (!app.isLoggedIn()) {
      await this.loadDefaultIcons()
      this.setData({
        families: [],
        familyIndex: 0,
        currentFamilyName: '体验模式',
        categoryOptions: [],
        pendingBills: []
      })
      return
    }
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
      await this.loadPendingBills()
    } catch (e) {
      if (e.statusCode === 401) {
        this.setData({
          families: [],
          familyIndex: 0,
          currentFamilyName: '体验模式',
          categoryOptions: [],
          pendingBills: []
        })
        return
      }
      wx.showToast({ title: '加载家庭信息失败', icon: 'none' })
    }
  },

  openCategoryModal() {
    this.setData({
      showCategoryModal: true,
      showDetailModal: false,
      showCategorySettingsModal: false,
      showTransferModal: false,
      showEditCategoryIconModal: false
    })
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
      note: '',
      isPosted: true
    })
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
        is_shared: this.data.isShared,
        is_posted: this.data.isPosted
      })
      wx.showToast({ title: this.data.isPosted ? '记账成功' : '已存为未入账', icon: 'success' })
      this.closeModals()
      await this.loadPendingBills()
      // 重置数据
      this.setData({ amount: '', note: '', calcExpr: '', isPosted: true })
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
    this.loadPendingBills()
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
      this.setData({ defaultIcons: FALLBACK_ICONFONT_ICONS })
    }
  },

  async loadCategories() {
    if (!app.globalData.familyId) {
      this.setData({ categoryOptions: [], category: '', categoryIcon: '' })
      return
    }
    try {
      const res = await request(`/families/${app.globalData.familyId}/categories`, 'GET')
      const categoryOptions = (res || []).map((c) => ({ id: c.id, name: c.name, icon: c.icon || '' }))
      const selectedItem = categoryOptions.find((c) => c.name === this.data.category) || categoryOptions[0] || { id: null, name: '', icon: '' }
      this.setData({
        categoryOptions,
        category: selectedItem.name,
        categoryIcon: selectedItem.icon
      })
    } catch (e) {
      wx.showToast({ title: '加载分类失败', icon: 'none' })
    }
  },

  async loadPendingBills() {
    if (!app.globalData.familyId || !app.isLoggedIn()) {
      this.setData({ pendingBills: [] })
      return
    }
    try {
      const res = await request('/bills/unposted', 'GET', { family_id: app.globalData.familyId })
      const pendingBills = (res || []).map((bill) => ({
        ...bill,
        display_date: bill.bill_date ? String(bill.bill_date).slice(0, 10) : '未设置'
      }))
      this.setData({ pendingBills })
    } catch (e) {
      this.setData({ pendingBills: [] })
    }
  },

  onDateChange(e) {
    this.setData({ billDate: e.detail.value })
  },

  bindAmount(e) { this.setData({ amount: e.detail.value }) },
  bindNote(e) { this.setData({ note: e.detail.value }) },
  onPostedChange(e) { this.setData({ isPosted: !!e.detail.value }) },
  onShareChange(e) { this.setData({ isShared: !!e.detail.value }) },

  onPendingBillTap(e) {
    const billId = Number(e.currentTarget.dataset.id)
    const activePendingBill = (this.data.pendingBills || []).find((item) => Number(item.id) === billId)
    if (!activePendingBill) return
    this.setData({
      showPendingActionModal: true,
      activePendingBill
    })
  },

  closePendingActionModal() {
    this.setData({
      showPendingActionModal: false,
      activePendingBill: null
    })
  },

  async updatePendingBill(action) {
    const bill = this.data.activePendingBill
    if (!bill) return
    const loadingText = action === 'post' ? '入账中...' : '丢弃中...'
    const payload = { action }
    if (action === 'post') {
      const now = new Date()
      const month = `${now.getMonth() + 1}`.padStart(2, '0')
      const day = `${now.getDate()}`.padStart(2, '0')
      payload.bill_date = `${now.getFullYear()}-${month}-${day}T00:00:00`
    }
    wx.showLoading({ title: loadingText })
    try {
      await request(`/bills/${bill.id}/posting`, 'POST', payload)
      wx.hideLoading()
      this.closePendingActionModal()
      await this.loadPendingBills()
      wx.showToast({ title: action === 'post' ? '已确认入账' : '已丢弃', icon: 'success' })
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: '操作失败', icon: 'none' })
    }
  },

  onPendingBillPost() {
    this.updatePendingBill('post')
  },

  onPendingBillDiscard() {
    this.updatePendingBill('discard')
  },

  onAddCategoryTap() {
    if (!app.globalData.familyId) {
      wx.showToast({ title: '请先选择家庭', icon: 'none' })
      return
    }
    this.openCategorySettingsModal()
  },

  openAddCategoryPanel() {
    this.setData({
      showAddCategoryPanel: true,
      showCategorySettingsModal: false
    })
  },

  closeAddCategoryPanel() {
    this.setData({ showAddCategoryPanel: false })
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
        newCategoryName: '',
        showAddCategoryPanel: false
      })
      wx.showToast({ title: '类别已添加', icon: 'success' })
    } catch (e) {
      wx.showToast({ title: '新增失败', icon: 'none' })
    }
  },

  openCategorySettingsModal() {
    if (!app.globalData.familyId) {
      wx.showToast({ title: '请先选择家庭', icon: 'none' })
      return
    }
    const defaultIcon = (this.data.defaultIcons && this.data.defaultIcons[0]) || 'other'
    this.setData({
      showCategorySettingsModal: true,
      showCategoryModal: false,
      showAddCategoryPanel: false,
      pendingDeleteCategoryId: null,
      pendingDeleteCategoryName: '',
      pendingDeleteCount: 0,
      transferTargetCategoryId: null,
      transferOptions: [],
      newCategoryIcon: defaultIcon,
      newCategoryName: ''
    })
  },

  onEditCategoryTap(e) {
    const categoryId = Number(e.currentTarget.dataset.id)
    const categoryName = e.currentTarget.dataset.name
    if (!app.globalData.familyId || !categoryId) return
    this.setData({
      showEditCategoryNameModal: true,
      editingCategoryId: categoryId,
      editingCategoryNewName: categoryName
    })
  },

  onEditCategoryIconTap(e) {
    const categoryId = Number(e.currentTarget.dataset.id)
    const categoryName = e.currentTarget.dataset.name
    const categoryIcon = e.currentTarget.dataset.icon || ''
    if (!app.globalData.familyId || !categoryId) return
    this.setData({
      showEditCategoryIconModal: true,
      showCategorySettingsModal: false,
      editingCategoryId: categoryId,
      editingCategoryName: categoryName,
      editingCategoryIcon: categoryIcon || (this.data.defaultIcons && this.data.defaultIcons[0]) || 'icon-qita'
    })
  },

  onEditingCategoryNameInput(e) {
    this.setData({ editingCategoryNewName: (e.detail.value || '').trim() })
  },

  closeEditCategoryNameModal() {
    this.setData({
      showEditCategoryNameModal: false,
      editingCategoryId: null,
      editingCategoryNewName: ''
    })
  },

  async onConfirmEditCategoryName() {
    const categoryId = this.data.editingCategoryId
    const newName = (this.data.editingCategoryNewName || '').trim()
    if (!categoryId) return
    if (!newName) {
      wx.showToast({ title: '请输入类别名称', icon: 'none' })
      return
    }
    const category = this.data.categoryOptions.find((c) => c.id === categoryId)
    if (!category) return
    try {
      await request(`/families/${app.globalData.familyId}/categories/${categoryId}`, 'PUT', { name: newName, icon: category.icon || '' })
      const oldName = category.name
      await this.loadCategories()
      if (this.data.category === oldName) {
        this.setData({ category: newName })
      }
      this.closeEditCategoryNameModal()
      wx.showToast({ title: '类别已更新', icon: 'success' })
    } catch (err) {
      wx.showToast({ title: '更新失败', icon: 'none' })
    }
  },

  async onDeleteCategoryTap(e) {
    const categoryId = Number(e.currentTarget.dataset.id)
    const categoryName = e.currentTarget.dataset.name
    if (!app.globalData.familyId || !categoryId) return

    try {
      const bills = await request('/bills', 'GET', { family_id: app.globalData.familyId, scope: 'family' })
      const categoryBills = (bills || []).filter((bill) => bill.category === categoryName)
      if (categoryBills.length === 0) {
        wx.showModal({
          title: '删除类别',
          content: `确定删除类别“${categoryName}”？`,
          confirmText: '删除',
          cancelText: '关闭',
          success: (res) => {
            if (res.confirm) {
              this.confirmDeleteCategory(categoryId)
            }
          }
        })
        return
      }

      const targetCandidates = this.data.categoryOptions.filter((item) => item.id !== categoryId)
      this.setData({
        pendingDeleteCategoryId: categoryId,
        pendingDeleteCategoryName: categoryName,
        pendingDeleteCount: categoryBills.length,
        transferOptions: targetCandidates,
        transferTargetCategoryId: targetCandidates.length ? targetCandidates[0].id : null
      })

      wx.showModal({
        title: '删除类别',
        content: `“${categoryName}” 下有 ${categoryBills.length} 笔账单，是否转移数据到其他类别？否则将删除该类别下所有账单。`,
        confirmText: '转移',
        cancelText: '关闭',
        success: (res) => {
          if (res.confirm) {
            if (!targetCandidates.length) {
              wx.showToast({ title: '没有可转移的目标类别', icon: 'none' })
              return
            }
            this.setData({ showTransferModal: true })
          } else {
            // 用户选择关闭，不做任何操作（避免误删）
          }
        }
      })
    } catch (err) {
      wx.showToast({ title: '获取账单数据失败', icon: 'none' })
    }
  },

  async confirmDeleteCategory(categoryId) {
    try {
      await request(`/families/${app.globalData.familyId}/categories/${categoryId}`, 'DELETE')
      await this.loadCategories()
      this.setData({ showCategorySettingsModal: false, showTransferModal: false })
      wx.showToast({ title: '类别已删除', icon: 'success' })
    } catch (err) {
      wx.showToast({ title: '删除失败', icon: 'none' })
    }
  },

  resetCategorySwipe(categoryId) {
    const categoryOptions = this.data.categoryOptions.map((item) => {
      if (item.id === categoryId) {
        return { ...item, x: 0 }
      }
      return item
    })
    this.setData({ categoryOptions })
  },

  onTransferTargetSelect(e) {
    this.setData({ transferTargetCategoryId: Number(e.currentTarget.dataset.id) })
  },

  async onConfirmTransfer() {
    const categoryId = this.data.pendingDeleteCategoryId
    const targetId = this.data.transferTargetCategoryId
    if (!categoryId || !targetId) {
      wx.showToast({ title: '请选择目标分类', icon: 'none' })
      return
    }
    if (categoryId === targetId) {
      wx.showToast({ title: '请选择不同的目标分类', icon: 'none' })
      return
    }

    try {
      await request(`/families/${app.globalData.familyId}/categories/${categoryId}?target_category_id=${targetId}`, 'DELETE')
      await this.loadCategories()
      this.setData({ showCategorySettingsModal: false, showTransferModal: false })
      wx.showToast({ title: '已转移并删除类别', icon: 'success' })
    } catch (err) {
      wx.showToast({ title: '转移失败', icon: 'none' })
    }
  },

  closeModals() {
    this.setData({
      showCategoryModal: false,
      showDetailModal: false,
      showCategorySettingsModal: false,
      showTransferModal: false,
      showEditCategoryIconModal: false,
      showPendingActionModal: false,
      activePendingBill: null,
      showEditCategoryNameModal: false,
      showAddCategoryPanel: false,
      editingCategoryName: '',
      editingCategoryIcon: '',
      editingCategoryId: null,
      editingCategoryNewName: '',
      pendingDeleteCategoryId: null,
      pendingDeleteCategoryName: '',
      pendingDeleteCount: 0,
      transferTargetCategoryId: null,
      transferOptions: [],
      isPosted: true
    })
  },

  stopBubble() {},


  onEditCategoryIconSelect(e) {
    this.setData({ editingCategoryIcon: e.currentTarget.dataset.icon || 'icon-qita' })
  },

  async onConfirmEditCategoryIcon() {
    const categoryId = this.data.editingCategoryId
    const categoryName = this.data.editingCategoryName
    const icon = this.data.editingCategoryIcon || 'icon-qita'
    if (!app.globalData.familyId || !categoryId) return
    try {
      await request(`/families/${app.globalData.familyId}/categories/${categoryId}`, 'PUT', { name: categoryName || '', icon })
      await this.loadCategories()
      if (this.data.category === categoryName) this.setData({ categoryIcon: icon })
      this.setData({ showEditCategoryIconModal: false, editingCategoryName: '', editingCategoryIcon: '', editingCategoryId: null })
      wx.showToast({ title: '图标已更新', icon: 'success' })
    } catch (err) {
      wx.showToast({ title: '更新失败', icon: 'none' })
    }
  }
})
