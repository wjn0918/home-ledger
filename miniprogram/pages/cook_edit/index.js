const RECIPE_STORAGE_KEY = 'homeLedgerRecipes'

Page({
  data: {
    name: '',
    ingredients: '',
    steps: ''
  },

  onShow() {
    getApp().setAppMode('cook')
  },

  onNameInput(e) {
    this.setData({ name: e.detail.value })
  },

  onIngredientsInput(e) {
    this.setData({ ingredients: e.detail.value })
  },

  onStepsInput(e) {
    this.setData({ steps: e.detail.value })
  },

  saveRecipe() {
    const name = this.data.name.trim()
    const ingredients = this.data.ingredients.trim()
    const steps = this.data.steps.trim()
    if (!name) return wx.showToast({ title: '请填写菜名', icon: 'none' })
    if (!ingredients) return wx.showToast({ title: '请填写食材', icon: 'none' })
    if (!steps) return wx.showToast({ title: '请填写做法', icon: 'none' })

    const now = new Date()
    const createdAt = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const recipes = wx.getStorageSync(RECIPE_STORAGE_KEY) || []
    recipes.unshift({ id: Date.now(), name, ingredients, steps, createdAt })
    wx.setStorageSync(RECIPE_STORAGE_KEY, recipes)
    wx.showToast({ title: '已加入菜谱', icon: 'success' })
    this.setData({ name: '', ingredients: '', steps: '' })
    setTimeout(() => wx.switchTab({ url: '/pages/cook_detail/index' }), 500)
  }
})
