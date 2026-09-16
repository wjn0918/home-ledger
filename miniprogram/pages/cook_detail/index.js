const { request } = require('../../utils/request')
const app = getApp()

Page({
  data: {
    recipes: []
  },

  onShow() {
    getApp().setAppMode('cook')
    this.loadRecipes()
  },

  async loadRecipes() {
    if (!app.isLoggedIn() || !app.globalData.familyId) {
      this.setData({ recipes: [] })
      return
    }
    try {
      const bills = await request(`/cook/bills?family_id=${app.globalData.familyId}`)
      this.setData({
        recipes: bills.map((bill) => ({
          id: bill.id,
          name: bill.menu_name,
          createdDate: bill.cooked_at ? bill.cooked_at.slice(0, 10) : ''
        }))
      })
    } catch (error) {
      wx.showToast({ title: '菜单加载失败', icon: 'none' })
    }
  },

})
