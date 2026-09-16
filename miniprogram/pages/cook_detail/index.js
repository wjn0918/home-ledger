const RECIPE_STORAGE_KEY = 'homeLedgerRecipes'

Page({
  data: {
    recipes: []
  },

  onShow() {
    getApp().setAppMode('cook')
    this.loadRecipes()
  },

  loadRecipes() {
    const recipes = wx.getStorageSync(RECIPE_STORAGE_KEY) || []
    this.setData({ recipes })
  },

  onDeleteRecipe(e) {
    const id = Number(e.currentTarget.dataset.id)
    wx.showModal({
      title: '删除菜谱',
      content: '确定删除这道菜吗？',
      success: (res) => {
        if (!res.confirm) return
        const recipes = this.data.recipes.filter((item) => item.id !== id)
        wx.setStorageSync(RECIPE_STORAGE_KEY, recipes)
        this.setData({ recipes })
        wx.showToast({ title: '已删除', icon: 'success' })
      }
    })
  }
})
