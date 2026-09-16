Component({
  data: {
    mode: 'ledger',
    items: []
  },

  lifetimes: {
    attached() {
      this.updateMode(getApp().globalData.appMode)
    }
  },

  pageLifetimes: {
    show() {
      this.updateMode(getApp().globalData.appMode)
    }
  },

  methods: {
    updateMode(mode) {
      const isCookMode = mode === 'cook'
      const pages = getCurrentPages()
      const currentPage = pages[pages.length - 1]
      const currentPath = currentPage ? `/${currentPage.route}` : ''
      const items = isCookMode
        ? [
            { pagePath: '/pages/cook_home/index', text: '菜谱' },
          { pagePath: '/pages/cook_detail/index', text: '烹饪明细' },
          { pagePath: '/pages/cook_edit/index', text: '加菜' },
            { pagePath: '/pages/cook_public/index', text: '公开菜谱' },
            { pagePath: '/pages/me/index', text: '我的' }
          ]
        : [
            { pagePath: '/pages/bookkeeping/index', text: '记账' },
            { pagePath: '/pages/detail/index', text: '明细' },
            { pagePath: '/pages/chart/index', text: '图表' },
            { pagePath: '/pages/me/index', text: '我的' }
          ]
      this.setData({
        mode: isCookMode ? 'cook' : 'ledger',
        items,
        selected: items.findIndex((item) => item.pagePath === currentPath)
      })
    },

    onItemTap(e) {
      const { path } = e.currentTarget.dataset
      const pages = getCurrentPages()
      const currentPage = pages[pages.length - 1]
      if (currentPage && `/${currentPage.route}` === path) return
      wx.switchTab({ url: path })
    }
  }
})