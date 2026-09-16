const RECIPE_STORAGE_KEY = 'homeLedgerRecipes'
const { request } = require('../../utils/request')
const app = getApp()

Page({
  data: {
    showAddRecipeModal: false,
    recipeName: '',
    recipeIngredients: '',
    recipeSteps: '',
    recipeCoverImage: '',
    recipeCoverBase64: '',
    recipeIsPublic: false,
    recipeCategories: [],
    recipeCategoryIndex: 0,
    menuCategories: [],
    hasFamily: false,
    selectedCategoryId: null,
    menuRows: [],
    menuCount: 0,
    showAddCategoryModal: false,
    newCategoryName: '',
    newCategoryIcon: '',
    showMenuDetailModal: false,
    menuDetailEditing: false,
    selectedMenu: null,
    detailName: '',
    detailIngredients: '',
    detailSteps: '',
    detailIsPublic: false,
    detailCoverImage: '',
    detailCoverBase64: '',
    detailCoverChanged: false
  },

  onSwitchAppMode() {
    getApp().switchAppMode()
  },

  onAddRecipe() {
    this.setData({
      showAddRecipeModal: true,
      recipeCategoryIndex: 0
    })
  },

  onAddCategory() {
    this.setData({ showAddCategoryModal: true, newCategoryName: '', newCategoryIcon: '' })
  },

  closeAddCategoryModal() {
    this.setData({ showAddCategoryModal: false })
  },

  stopCategoryModalPropagation() {},

  onNewCategoryNameInput(e) {
    this.setData({ newCategoryName: e.detail.value })
  },

  onNewCategoryIconInput(e) {
    this.setData({ newCategoryIcon: e.detail.value })
  },

  async saveCategory() {
    const name = this.data.newCategoryName.trim()
    if (!name) return wx.showToast({ title: '请输入分类名称', icon: 'none' })
    if (!app.isLoggedIn() || !app.globalData.familyId) {
      return wx.showToast({ title: '请先登录并选择家庭', icon: 'none' })
    }

    wx.showLoading({ title: '保存中' })
    try {
      const category = await request(
        `/cook/categories?family_id=${app.globalData.familyId}`,
        'POST',
        { name, icon: this.data.newCategoryIcon.trim() }
      )
      this.setData({ showAddCategoryModal: false })
      await this.loadMenus()
      this.setData({ selectedCategoryId: category.id })
      this.refreshMenuRows(category.id)
      wx.showToast({ title: '分类已添加', icon: 'success' })
    } catch (error) {
      wx.showToast({ title: error.statusCode === 400 ? '分类名称已存在' : '添加失败，请重试', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  closeAddRecipeModal() {
    this.setData({ showAddRecipeModal: false })
  },

  stopModalPropagation() {},

  onRecipeNameInput(e) {
    this.setData({ recipeName: e.detail.value })
  },

  onRecipeIngredientsInput(e) {
    this.setData({ recipeIngredients: e.detail.value })
  },

  onRecipeStepsInput(e) {
    this.setData({ recipeSteps: e.detail.value })
  },

  onRecipePublicChange(e) {
    this.setData({ recipeIsPublic: e.detail.value })
  },

  onDetailPublicChange(e) {
    this.setData({ detailIsPublic: e.detail.value })
  },

  onRecipeCategoryChange(e) {
    this.setData({ recipeCategoryIndex: Number(e.detail.value) })
  },

  selectMenuCategory(e) {
    const categoryId = e.currentTarget.dataset.categoryId
    this.setData({ selectedCategoryId: categoryId === '' ? null : Number(categoryId) })
    this.refreshMenuRows(categoryId === '' ? null : Number(categoryId))
  },

  openMenuDetail(e) {
    const menu = (this.data.menus || []).find((item) => item.id === Number(e.currentTarget.dataset.id))
    if (!menu) return
    this.setData({
      showMenuDetailModal: true,
      menuDetailEditing: false,
      selectedMenu: menu,
      detailName: menu.name,
      detailIngredients: menu.ingredients,
      detailSteps: menu.steps,
      detailIsPublic: !!menu.is_public,
      detailCoverImage: menu.coverImage || '',
      detailImageLoaded: false,
      detailCoverBase64: '',
      detailCoverChanged: false
    })
  },

  closeMenuDetailModal() {
    this.setData({ showMenuDetailModal: false, menuDetailEditing: false })
  },

  onMenuImageLoad(e) {
    const menuId = Number(e.currentTarget.dataset.id)
    const menus = this.data.menus || []
    const menuIndex = menus.findIndex((menu) => menu.id === menuId)
    if (menuIndex < 0) return
    this.setData({ [`menus[${menuIndex}].imageLoaded`]: true })
  },

  onDetailImageLoad() {
    this.setData({ detailImageLoaded: true })
  },

  enterMenuEdit() {
    this.setData({ menuDetailEditing: true })
  },

  stopMenuDetailPropagation() {},

  onDetailNameInput(e) {
    this.setData({ detailName: e.detail.value })
  },

  onDetailIngredientsInput(e) {
    this.setData({ detailIngredients: e.detail.value })
  },

  onDetailStepsInput(e) {
    this.setData({ detailSteps: e.detail.value })
  },

  chooseDetailCover() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const file = res.tempFiles[0]
        if (!file || !file.tempFilePath) return
        const mimeType = file.fileType === 'png' ? 'image/png' : 'image/jpeg'
        wx.compressImage({
          src: file.tempFilePath,
          quality: 80,
          success: (result) => this.readDetailCoverAsBase64(result.tempFilePath, mimeType),
          fail: () => this.readDetailCoverAsBase64(file.tempFilePath, mimeType)
        })
      }
    })
  },

  readDetailCoverAsBase64(filePath, mimeType) {
    const readFile = (readablePath) => wx.getFileSystemManager().readFile({
      filePath: readablePath,
      success: (res) => {
        const base64 = wx.arrayBufferToBase64(res.data)
        this.setData({
          detailCoverImage: filePath,
          detailCoverBase64: `data:${mimeType};base64,${base64}`,
          detailCoverChanged: true
        })
      },
      fail: () => wx.showToast({ title: '读取封面图失败', icon: 'none' })
    })

    if (/^https?:\/\/tmp\//.test(filePath)) {
      wx.downloadFile({
        url: filePath,
        success: (res) => readFile(res.tempFilePath),
        fail: () => wx.showToast({ title: '读取封面图失败', icon: 'none' })
      })
      return
    }

    readFile(filePath)
  },

  removeDetailCover() {
    this.setData({ detailCoverImage: '', detailCoverBase64: '', detailCoverChanged: true })
  },

  async saveMenuEdit() {
    const name = this.data.detailName.trim()
    const ingredients = this.data.detailIngredients.trim()
    const steps = this.data.detailSteps.trim()
    if (!name || !ingredients || !steps) {
      return wx.showToast({ title: '请完整填写菜单内容', icon: 'none' })
    }
    wx.showLoading({ title: '保存中' })
    try {
      const payload = {
        name,
        ingredients,
        steps,
        is_public: this.data.detailIsPublic
      }
      if (this.data.detailCoverChanged) {
        payload.image_urls = this.data.detailCoverBase64 ? [this.data.detailCoverBase64] : []
      }
      await request(`/cook/menus/${this.data.selectedMenu.id}`, 'PUT', payload)
      this.setData({ showMenuDetailModal: false, menuDetailEditing: false })
      await this.loadMenus()
      wx.showToast({ title: '已保存', icon: 'success' })
    } catch (error) {
      wx.showToast({ title: '保存失败，请重试', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  deleteMenu() {
    if (!this.data.selectedMenu) return
    wx.showModal({
      title: '删除菜单',
      content: `删除“${this.data.selectedMenu.name}”后，相关的做菜记录也会一并删除，确定继续吗？`,
      confirmColor: '#c24132',
      success: async (result) => {
        if (!result.confirm) return
        wx.showLoading({ title: '删除中' })
        try {
          await request(`/cook/menus/${this.data.selectedMenu.id}`, 'DELETE')
          this.setData({ showMenuDetailModal: false, menuDetailEditing: false })
          await this.loadMenus()
          wx.showToast({ title: '菜单已删除', icon: 'success' })
        } catch (error) {
          wx.showToast({ title: '删除失败，请重试', icon: 'none' })
        } finally {
          wx.hideLoading()
        }
      }
    })
  },

  async recordCooked() {
    if (!this.data.selectedMenu) return
    wx.showLoading({ title: '记录中' })
    try {
      await request('/cook/bills', 'POST', {
        family_id: app.globalData.familyId,
        menu_id: this.data.selectedMenu.id
      })
      this.setData({ showMenuDetailModal: false })
      wx.showToast({ title: '已记录今天做过', icon: 'success' })
    } catch (error) {
      wx.showToast({ title: '记录失败，请重试', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  normalizeMenu(menu) {
    const coverImage = menu.images && menu.images.length ? menu.images[0].image_url : ''
    return {
      ...menu,
      coverImage,
      imageLoaded: false,
      createdDate: menu.created_at ? menu.created_at.slice(0, 10) : ''
    }
  },

  refreshMenuRows(categoryId = this.data.selectedCategoryId) {
    const menus = this.data.menus || []
    const filtered = menus.filter((menu) => menu.category_id === categoryId)
    const rows = []
    for (let index = 0; index < filtered.length; index += 2) {
      rows.push(filtered.slice(index, index + 2))
    }
    this.setData({ menuRows: rows })
  },

  async loadMenus() {
    if (!app.isLoggedIn() || !app.globalData.familyId) {
      this.setData({ hasFamily: false, menuCategories: [], menus: [], menuRows: [], menuCount: 0 })
      return
    }

    try {
      const familyId = app.globalData.familyId
      const [categories, menus] = await Promise.all([
        request(`/cook/categories?family_id=${familyId}`),
        request(`/cook/menus?family_id=${familyId}`)
      ])
      const normalizedMenus = menus.map((menu) => this.normalizeMenu(menu))
      const hasUncategorized = normalizedMenus.some((menu) => menu.category_id === null)
      const menuCategories = hasUncategorized
        ? [...categories, { id: null, name: '未分类', icon: '' }]
        : categories
      const selectedExists = menuCategories.some((category) => category.id === this.data.selectedCategoryId)
      const selectedCategoryId = selectedExists
        ? this.data.selectedCategoryId
        : (menuCategories.length ? menuCategories[0].id : null)
      this.setData({
        hasFamily: true,
        menus: normalizedMenus,
        menuCategories,
        selectedCategoryId,
        menuCount: normalizedMenus.length,
        recipeCategories: categories
      })
      this.refreshMenuRows(selectedCategoryId)
    } catch (error) {
      wx.showToast({ title: '菜单加载失败', icon: 'none' })
    }
  },

  chooseRecipeCover() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const sourcePath = res.tempFiles[0] && res.tempFiles[0].tempFilePath
        if (!sourcePath) return

        const mimeType = res.tempFiles[0].fileType === 'png' ? 'image/png' : 'image/jpeg'
        wx.compressImage({
          src: sourcePath,
          quality: 80,
          success: (compressRes) => this.readCoverAsBase64(compressRes.tempFilePath, mimeType),
          fail: () => this.readCoverAsBase64(sourcePath, mimeType)
        })
      }
    })
  },

  readCoverAsBase64(filePath, mimeType) {
    const readFile = (readablePath) => wx.getFileSystemManager().readFile({
      filePath: readablePath,
      success: (res) => {
        const base64 = wx.arrayBufferToBase64(res.data)
        this.setData({
          recipeCoverImage: filePath,
          recipeCoverBase64: `data:${mimeType};base64,${base64}`
        })
      },
      fail: (error) => {
        console.error('读取封面图失败', error)
        wx.showToast({ title: '读取封面图失败', icon: 'none' })
      }
    })

    if (/^https?:\/\/tmp\//.test(filePath)) {
      wx.downloadFile({
        url: filePath,
        success: (res) => readFile(res.tempFilePath),
        fail: (error) => {
          console.error('下载临时封面图失败', error)
          wx.showToast({ title: '读取封面图失败', icon: 'none' })
        }
      })
      return
    }

    readFile(filePath)
  },

  removeRecipeCover() {
    this.setData({ recipeCoverImage: '', recipeCoverBase64: '' })
  },

  async saveRecipe() {
    const name = this.data.recipeName.trim()
    const ingredients = this.data.recipeIngredients.trim()
    const steps = this.data.recipeSteps.trim()
    if (!name) return wx.showToast({ title: '请填写菜名', icon: 'none' })
    if (!ingredients) return wx.showToast({ title: '请填写食材', icon: 'none' })
    if (!steps) return wx.showToast({ title: '请填写做法', icon: 'none' })
    if (!app.isLoggedIn()) return wx.showToast({ title: '请先登录', icon: 'none' })
    if (!app.globalData.familyId) return wx.showToast({ title: '请先选择家庭', icon: 'none' })

    wx.showLoading({ title: '保存中' })
    try {
      const savedMenu = await request('/cook/menus', 'POST', {
        family_id: app.globalData.familyId,
        category_id: this.data.recipeCategories[this.data.recipeCategoryIndex]
          ? this.data.recipeCategories[this.data.recipeCategoryIndex].id
          : null,
        name,
        ingredients,
        steps,
        is_public: this.data.recipeIsPublic,
        image_urls: this.data.recipeCoverBase64 ? [this.data.recipeCoverBase64] : []
      })

      const createdAt = savedMenu.created_at
        ? savedMenu.created_at.slice(0, 10)
        : new Date().toISOString().slice(0, 10)
      const recipes = wx.getStorageSync(RECIPE_STORAGE_KEY) || []
      recipes.unshift({
        id: savedMenu.id,
        name: savedMenu.name,
        ingredients: savedMenu.ingredients,
        steps: savedMenu.steps,
        coverImage: this.data.recipeCoverImage,
        createdAt
      })
      wx.setStorageSync(RECIPE_STORAGE_KEY, recipes)

      this.setData({
        showAddRecipeModal: false,
        recipeName: '',
        recipeIngredients: '',
        recipeSteps: '',
        recipeCoverImage: '',
        recipeCoverBase64: '',
        recipeIsPublic: false
      })
      await this.loadMenus()
      wx.showToast({ title: '已加入菜谱', icon: 'success' })
    } catch (error) {
      wx.showToast({ title: error.statusCode === 403 ? '无权操作当前家庭' : '保存失败，请重试', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  onShow() {
    getApp().setAppMode('cook')
    this.loadMenus()
  }
})