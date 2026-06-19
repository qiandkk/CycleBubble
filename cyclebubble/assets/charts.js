// assets/charts.js
(function() {
  var style = getComputedStyle(document.documentElement);
  var accent = style.getPropertyValue('--accent').trim();
  var accent2 = style.getPropertyValue('--accent2').trim();
  var accent3 = style.getPropertyValue('--accent3').trim();
  var accent4 = style.getPropertyValue('--accent4').trim();
  var ink = style.getPropertyValue('--ink').trim();
  var muted = style.getPropertyValue('--muted').trim();
  var rule = style.getPropertyValue('--rule').trim();
  var bg2 = style.getPropertyValue('--bg2').trim();

  // --- Chart: Bubble (Cycle Phase Probability) ---
  var chartBubble = echarts.init(document.getElementById('chart-bubble'), null, { renderer: 'svg' });
  chartBubble.setOption({
    animation: false,
    tooltip: {
      trigger: 'item',
      appendToBody: true,
      formatter: '{b}: {d}%'
    },
    legend: {
      bottom: 10,
      textStyle: { color: muted, fontSize: 12 },
      itemGap: 20
    },
    series: [{
      type: 'pie',
      radius: ['45%', '72%'],
      center: ['50%', '45%'],
      avoidLabelOverlap: true,
      itemStyle: {
        borderRadius: 8,
        borderColor: '#fff',
        borderWidth: 3
      },
      label: {
        show: true,
        formatter: '{b}\n{d}%',
        color: ink,
        fontSize: 12,
        lineHeight: 18
      },
      labelLine: {
        lineStyle: { color: rule }
      },
      data: [
        { value: 65, name: '黄体期', itemStyle: { color: accent } },
        { value: 20, name: '排卵期', itemStyle: { color: accent2 } },
        { value: 10, name: '卵泡期', itemStyle: { color: accent3 } },
        { value: 5, name: '月经期', itemStyle: { color: accent4 } }
      ]
    }]
  });
  window.addEventListener('resize', function() { chartBubble.resize(); });

  // --- Chart: Cycle Trend (12 months) ---
  var chartCycle = echarts.init(document.getElementById('chart-cycle'), null, { renderer: 'svg' });
  var months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
  chartCycle.setOption({
    animation: false,
    tooltip: {
      trigger: 'axis',
      appendToBody: true,
      axisPointer: { type: 'shadow' }
    },
    legend: {
      bottom: 0,
      textStyle: { color: muted, fontSize: 11 },
      itemGap: 15
    },
    grid: { top: 20, right: 20, bottom: 40, left: 50 },
    xAxis: {
      type: 'category',
      data: months,
      axisLine: { lineStyle: { color: rule } },
      axisLabel: { color: muted, fontSize: 11 }
    },
    yAxis: {
      type: 'value',
      name: '天数',
      nameTextStyle: { color: muted, fontSize: 11 },
      axisLine: { show: false },
      splitLine: { lineStyle: { color: rule, type: 'dashed' } },
      axisLabel: { color: muted, fontSize: 11 }
    },
    series: [
      {
        name: '月经期',
        type: 'bar',
        stack: 'cycle',
        data: [5, 5, 4, 5, 6, 5, 4, 5, 5, 4, 5, 5],
        itemStyle: { color: accent4, borderRadius: [0, 0, 0, 0] }
      },
      {
        name: '卵泡期',
        type: 'bar',
        stack: 'cycle',
        data: [7, 8, 7, 7, 6, 8, 7, 7, 8, 7, 7, 8],
        itemStyle: { color: accent3 }
      },
      {
        name: '排卵期',
        type: 'bar',
        stack: 'cycle',
        data: [3, 3, 4, 3, 3, 3, 4, 3, 3, 4, 3, 3],
        itemStyle: { color: accent2 }
      },
      {
        name: '黄体期',
        type: 'bar',
        stack: 'cycle',
        data: [12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12],
        itemStyle: { color: accent, borderRadius: [4, 4, 0, 0] }
      }
    ]
  });
  window.addEventListener('resize', function() { chartCycle.resize(); });

  // --- Chart: Radar (Emotion by Phase) ---
  var chartRadar = echarts.init(document.getElementById('chart-radar'), null, { renderer: 'svg' });
  chartRadar.setOption({
    animation: false,
    tooltip: {
      appendToBody: true
    },
    legend: {
      bottom: 0,
      textStyle: { color: muted, fontSize: 11 },
      itemGap: 12
    },
    radar: {
      indicator: [
        { name: '平静', max: 100 },
        { name: '愉悦', max: 100 },
        { name: '焦虑', max: 100 },
        { name: '悲伤', max: 100 },
        { name: '易怒', max: 100 },
        { name: '敏感', max: 100 }
      ],
      shape: 'circle',
      splitNumber: 4,
      axisName: { color: muted, fontSize: 11 },
      splitLine: { lineStyle: { color: rule } },
      splitArea: { show: false },
      axisLine: { lineStyle: { color: rule } }
    },
    series: [{
      type: 'radar',
      data: [
        {
          value: [70, 75, 30, 25, 20, 35],
          name: '卵泡期',
          lineStyle: { color: accent3 },
          areaStyle: { color: accent3 + '30' },
          itemStyle: { color: accent3 }
        },
        {
          value: [80, 85, 20, 15, 15, 25],
          name: '排卵期',
          lineStyle: { color: accent2 },
          areaStyle: { color: accent2 + '30' },
          itemStyle: { color: accent2 }
        },
        {
          value: [35, 30, 70, 65, 75, 80],
          name: '黄体期',
          lineStyle: { color: accent },
          areaStyle: { color: accent + '30' },
          itemStyle: { color: accent }
        },
        {
          value: [40, 35, 55, 60, 50, 70],
          name: '月经期',
          lineStyle: { color: accent4 },
          areaStyle: { color: accent4 + '30' },
          itemStyle: { color: accent4 }
        }
      ]
    }]
  });
  window.addEventListener('resize', function() { chartRadar.resize(); });

  // --- Chart: Emotion Trend (Monthly) ---
  var chartEmotion = echarts.init(document.getElementById('chart-emotion'), null, { renderer: 'svg' });
  var days = [];
  for (var i = 1; i <= 28; i++) { days.push(i + '日'); }

  // Simulated emotion scores across a 28-day cycle
  var calmData = [];
  var happyData = [];
  var anxietyData = [];
  var sadData = [];
  for (var i = 0; i < 28; i++) {
    // Menstrual phase: days 1-5
    if (i < 5) {
      calmData.push(40 + Math.random() * 15);
      happyData.push(30 + Math.random() * 15);
      anxietyData.push(50 + Math.random() * 15);
      sadData.push(55 + Math.random() * 15);
    }
    // Follicular phase: days 5-12
    else if (i < 12) {
      calmData.push(65 + Math.random() * 15);
      happyData.push(70 + Math.random() * 15);
      anxietyData.push(25 + Math.random() * 10);
      sadData.push(20 + Math.random() * 10);
    }
    // Ovulation: days 12-15
    else if (i < 15) {
      calmData.push(75 + Math.random() * 10);
      happyData.push(80 + Math.random() * 10);
      anxietyData.push(15 + Math.random() * 10);
      sadData.push(15 + Math.random() * 10);
    }
    // Luteal phase: days 15-28
    else {
      var progress = (i - 15) / 13;
      calmData.push(60 - progress * 30 + Math.random() * 10);
      happyData.push(55 - progress * 35 + Math.random() * 10);
      anxietyData.push(30 + progress * 40 + Math.random() * 10);
      sadData.push(35 + progress * 35 + Math.random() * 10);
    }
  }

  chartEmotion.setOption({
    animation: false,
    tooltip: {
      trigger: 'axis',
      appendToBody: true
    },
    legend: {
      bottom: 0,
      textStyle: { color: muted, fontSize: 11 },
      itemGap: 12
    },
    grid: { top: 20, right: 20, bottom: 40, left: 45 },
    xAxis: {
      type: 'category',
      data: days,
      axisLine: { lineStyle: { color: rule } },
      axisLabel: { color: muted, fontSize: 10, interval: 3 }
    },
    yAxis: {
      type: 'value',
      name: '情绪指数',
      nameTextStyle: { color: muted, fontSize: 11 },
      axisLine: { show: false },
      splitLine: { lineStyle: { color: rule, type: 'dashed' } },
      axisLabel: { color: muted, fontSize: 11 }
    },
    series: [
      {
        name: '平静',
        type: 'line',
        smooth: true,
        data: calmData,
        lineStyle: { color: accent4, width: 2 },
        itemStyle: { color: accent4 },
        symbol: 'none',
        areaStyle: { color: accent4 + '15' }
      },
      {
        name: '愉悦',
        type: 'line',
        smooth: true,
        data: happyData,
        lineStyle: { color: accent2, width: 2 },
        itemStyle: { color: accent2 },
        symbol: 'none',
        areaStyle: { color: accent2 + '15' }
      },
      {
        name: '焦虑',
        type: 'line',
        smooth: true,
        data: anxietyData,
        lineStyle: { color: accent, width: 2 },
        itemStyle: { color: accent },
        symbol: 'none',
        areaStyle: { color: accent + '15' }
      },
      {
        name: '悲伤',
        type: 'line',
        smooth: true,
        data: sadData,
        lineStyle: { color: accent3, width: 2 },
        itemStyle: { color: accent3 },
        symbol: 'none',
        areaStyle: { color: accent3 + '15' }
      }
    ],
    // Visual map for phase regions
    visualMap: {
      show: false,
      seriesIndex: 0,
      pieces: [
        { lte: 4, color: accent4 + '08' },
        { gt: 4, lte: 11, color: accent3 + '08' },
        { gt: 11, lte: 14, color: accent2 + '08' },
        { gt: 14, color: accent + '08' }
      ]
    }
  });
  window.addEventListener('resize', function() { chartEmotion.resize(); });

})();
