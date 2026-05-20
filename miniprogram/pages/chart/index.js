import * as echarts from '../../ec-canvas/echarts'
const { request } = require('../../utils/request')
const { syncFamilies } = require('../../utils/family')
const app = getApp()

let lineChart = null
let pieChart = null

function toDate(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function formatDay(date) {
  return date.toISOString().slice(0, 10)
}

function weekLabel(offset) {
  if (offset === 0) return '本周'
  if (offset === 1) return '上周'
  const d = new Date()
  d.setDate(d.getDate() - offset * 7)
  return `${getWeekNumber(d)}周`
}

function getWeekNumber(date) {
  const firstDay = new Date(date.getFullYear(), 0, 1)
  const diff = Math.floor((toDate(date) - toDate(firstDay)) / 86400000)
  return Math.ceil((diff + firstDay.getDay() + 1) / 7)
}

function buildPeriods(dimension) {
  const now = new Date()
  const periods = []

  if (dimension === 'week') {
    for (let i = 4; i >= 0; i--) {
      const end = new Date(now)
      const day = end.getDay() || 7
      end.setDate(end.getDate() - day + 7 - i * 7)
      const start = new Date(end)
      start.setDate(end.getDate() - 6)
      periods.push({ key: `w-${i}`, label: weekLabel(i), start: formatDay(start), end: formatDay(end) })
    }
  } else if (dimension === 'month') {
    for (let i = 4; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0)
      periods.push({ key: `m-${i}`, label: `${start.getMonth() + 1}月`, start: formatDay(start), end: formatDay(end) })
    }
  } else {
    for (let i = 4; i >= 0; i--) {
      const y = now.getFullYear() - i
      periods.push({ key: `y-${i}`, label: `${y}年`, start: `${y}-01-01`, end: `${y}-12-31` })
    }
  }
  return periods
}

function filterBillsByPeriod(bills, period) {
  return bills.filter((bill) => {
    const day = formatDay(new Date(bill.bill_date))
    return day >= period.start && day <= period.end
  })
}

Page({
  data: {
    currentFamilyName: '',
    statScope: 'family',
    scopeOptions: ['家庭', '本人'],
    bills: [],
    dimensionOptions: ['周', '月', '年'],
    dimensionIndex: 0,
    periodOptions: [],
    periodIndex: 4,
    totalExpense: '0.00',
    linePoints: [],
    ranking: [],
    memberStats: [],
    startDate: '',
    endDate: '',
    ecLine: {
      onInit: function (canvas, width, height, dpr) {
        lineChart = echarts.init(canvas, null, {
          width: width,
          height: height,
          devicePixelRatio: dpr
        })
        canvas.setChart(lineChart)
        return lineChart
      }
    },
    ecPie: {
      onInit: function (canvas, width, height, dpr) {
        pieChart = echarts.init(canvas, null, {
          width: width,
          height: height,
          devicePixelRatio: dpr
        })
        canvas.setChart(pieChart)
        return pieChart
      }
    }
  },

  async onShow() {
    if (!app.requireLogin()) return
    await this.loadFamiliesAndChart()
  },

  onUnload() {
    lineChart = null
    pieChart = null
  },

  async loadFamiliesAndChart() {
    try {
      const data = await syncFamilies(app)
      this.setData({ currentFamilyName: data.selectedFamilyName })
      if (!data.selectedFamilyId) return
      await this.reloadBillsAndMetrics(data.selectedFamilyId)
    } catch (e) {
      wx.showToast({ title: '加载图表失败', icon: 'none' })
    }
  },

  async reloadBillsAndMetrics(familyId) {
    const bills = await request(`/bills?family_id=${familyId}&scope=${this.data.statScope}`)
    this.setData({ bills })
    this.buildPeriodsAndStats()
  },

  buildPeriodsAndStats() {
    const dimMap = ['week', 'month', 'year']
    const dimension = dimMap[this.data.dimensionIndex]
    const periodOptions = buildPeriods(dimension)
    const periodIndex = Math.min(this.data.periodIndex, periodOptions.length - 1)
    this.setData({ periodOptions, periodIndex })
    this.calcStats()
  },

  calcStats() {
    let period = this.data.periodOptions[this.data.periodIndex]
    if (this.data.periodIndex === -1) {
      if (!this.data.startDate || !this.data.endDate) return
      period = { start: this.data.startDate, end: this.data.endDate }
    }
    if (!period) return

    const list = filterBillsByPeriod(this.data.bills, period).filter((b) => b.type === 'expense')
    const total = list.reduce((sum, b) => sum + Number(b.amount || 0), 0)

    // 1. 每日支出趋势
    const byDay = {}
    list.forEach((b) => {
      const day = formatDay(new Date(b.bill_date))
      byDay[day] = (byDay[day] || 0) + Number(b.amount || 0)
    })
    
    const sortedDays = Object.keys(byDay).sort()
    const lineLabels = sortedDays.map(day => day.slice(5)).slice(-15)
    const lineData = sortedDays.map(day => byDay[day].toFixed(2)).slice(-15)

    this.updateLineChart(lineLabels, lineData)

    // 2. 分类排行
    const byCategory = {}
    list.forEach((b) => {
      byCategory[b.category] = (byCategory[b.category] || 0) + Number(b.amount || 0)
    })
    const ranking = Object.keys(byCategory)
      .map((c) => ({ category: c, amount: byCategory[c].toFixed(2) }))
      .sort((a, b) => Number(b.amount) - Number(a.amount))
    
    const maxCatAmount = ranking.length > 0 ? Number(ranking[0].amount) : 1
    ranking.forEach(item => {
      item.percentage = (Number(item.amount) / maxCatAmount * 100).toFixed(0)
    })

    // 3. 家庭成员统计
    let memberStats = []
    if (this.data.statScope === 'family') {
      const byMember = {}
      list.forEach((b) => {
        const name = b.creator_nickname || `用户${b.user_id}`
        byMember[name] = (byMember[name] || 0) + Number(b.amount || 0)
      })
      memberStats = Object.keys(byMember)
        .map(name => ({
          name: name,
          value: Number(byMember[name].toFixed(2))
        }))
        .sort((a, b) => b.value - a.value)
      
      this.updatePieChart(memberStats)
    }

    this.setData({ 
      totalExpense: total.toFixed(2), 
      linePoints: sortedDays, // 用于判断是否有数据显示 empty-chart
      ranking,
      memberStats 
    })
  },

  updateLineChart(labels, data) {
    if (!lineChart) {
      setTimeout(() => this.updateLineChart(labels, data), 500)
      return
    }
    const option = {
      grid: { left: '10%', right: '10%', bottom: '15%', top: '15%', containLabel: true },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      xAxis: {
        type: 'category',
        data: labels,
        axisLine: { lineStyle: { color: '#999' } },
        axisLabel: { color: '#666', fontSize: 10 }
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { type: 'dashed', color: '#eee' } },
        axisLabel: { color: '#666', fontSize: 10 }
      },
      series: [{
        data: data,
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        itemStyle: { color: '#3963bc' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(57, 99, 188, 0.3)' },
            { offset: 1, color: 'rgba(57, 99, 188, 0)' }
          ])
        }
      }]
    }
    lineChart.setOption(option)
  },

  updatePieChart(data) {
    if (!pieChart) {
      setTimeout(() => this.updatePieChart(data), 500)
      return
    }
    const option = {
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      legend: { bottom: '0', left: 'center', itemWidth: 10, itemHeight: 10, textStyle: { fontSize: 10 } },
      series: [{
        name: '支出占比',
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['50%', '45%'],
        avoidLabelOverlap: false,
        itemStyle: { borderRadius: 10, borderColor: '#fff', borderWidth: 2 },
        label: { show: false, position: 'center' },
        emphasis: { label: { show: true, fontSize: 14, fontWeight: 'bold' } },
        labelLine: { show: false },
        data: data
      }]
    }
    pieChart.setOption(option)
  },

  onDimensionTabTap(e) {
    this.setData({ dimensionIndex: Number(e.currentTarget.dataset.index), periodIndex: 4 })
    this.buildPeriodsAndStats()
  },

  onPeriodTabTap(e) {
    this.setData({ periodIndex: Number(e.currentTarget.dataset.index) })
    this.calcStats()
  },

  onCustomPeriodTap() {
    this.setData({ periodIndex: -1 })
    if (this.data.startDate && this.data.endDate) {
      this.calcStats()
    }
  },

  onStartDateChange(e) {
    this.setData({ startDate: e.detail.value })
    if (this.data.endDate) this.calcStats()
  },

  onEndDateChange(e) {
    this.setData({ endDate: e.detail.value })
    if (this.data.startDate) this.calcStats()
  },

  async onScopeTabTap(e) {
    const index = Number(e.currentTarget.dataset.index)
    this.setData({ statScope: index === 1 ? "self" : "family" })
    if (app.globalData.familyId) await this.reloadBillsAndMetrics(app.globalData.familyId)
  }
})