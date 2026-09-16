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
    recipeCoverBase64: ''
  },

  onSwitchAppMode() {
    getApp().switchAppMode()
  },

  onAddRecipe() {
    this.setData({ showAddRecipeModal: true })
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
    const readablePath = filePath.replace(
      /^(https?):\/\/tmp\//,
      'wxfile://tmp/'
    )
    wx.getFileSystemManager().readFile({
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
        name,
        ingredients,
        steps,
        is_public: false,
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
        recipeCoverBase64: ''
      })
      wx.showToast({ title: '已加入菜谱', icon: 'success' })
    } catch (error) {
      wx.showToast({ title: error.statusCode === 403 ? '无权操作当前家庭' : '保存失败，请重试', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  onShow() {
    getApp().setAppMode('cook')
  }
})