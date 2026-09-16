const { request } = require('../../utils/request')

Page({
  data: {
    menus: [],
    loading: false,
    showDetailModal: false,
    selectedMenu: null
  },

  onShow() {
    getApp().setAppMode('cook')
    this.loadPublicMenus()
  },

  async loadPublicMenus() {
    this.setData({ loading: true })
    try {
      const menus = await request('/cook/menus/public')
      this.setData({
        menus: menus.map((menu) => ({
          ...menu,
          coverImage: menu.images && menu.images.length ? menu.images[0].image_url : ''
        }))
      })
    } catch (error) {
      wx.showToast({ title: '公开菜谱加载失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  openMenuDetail(e) {
    const menu = this.data.menus.find((item) => item.id === Number(e.currentTarget.dataset.id))
    if (!menu) return
    this.setData({ showDetailModal: true, selectedMenu: menu })
  },

  closeMenuDetail() {
    this.setData({ showDetailModal: false, selectedMenu: null })
  },

  stopDetailPropagation() {}
})