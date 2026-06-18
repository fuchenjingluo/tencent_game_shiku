// ────────────────────────────────────────────────────────────────────────────
// 石窟守护者 — 完整游戏数据 v2.0
// 5任务 × 2步骤 × 3选择 = 30个选择点（原20→30）
// 新增：三选一（专业/妥协/激进）、gameFlags因果链、叙事绑定、预算降到6
// ────────────────────────────────────────────────────────────────────────────
import type { Task } from '../types'

export const INITIAL_STATS = {
  reputation: 40,
  risk: 40,
  evidence: 10,
  budget: 12,  // 8→12: 纯专业路线5任务全部完成所需最低预算
}

export const TASKS: Task[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // 任务1：壁画区巡查（教学关）— difficulty 1为主
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'task_1',
    title: '壁画区巡查',
    npcKey: 'task1_npc',
    briefing:
      '第17窟西壁检测到异常湿度信号，壁画可能出现起甲脱落。请立即前往壁画监测点记录数据，然后去设备间取必要工具进行处置。',
    steps: [
      {
        id: 't1_s1',
        description: '前往壁画监测点查看并标记潮湿边界',
        locationKey: 'mural-monitor',
        choices: [
          {
            id: 't1_s1_a',
            label: '标记潮湿边界',
            desc: '使用红外热像仪精确标定潮湿蔓延边界，获得完整的分布数据。',
            style: 'professional',
            deltas: { reputation: 10, risk: -8, evidence: 4, budget: -1 },
            miniGame: { type: 'trace', difficulty: 1, prompt: '沿潮湿边界路径描摹，尽量贴近实际边界线',
              narrativeBinding: '你手持红外热像仪，正在精确标定壁画潮湿蔓延的边界线。屏住呼吸，让扫描仪的红色激光沿着水渍边缘缓缓移动。' },
            successDeltas: { evidence: 5, reputation: 3 },
            failDeltas: { evidence: -2, risk: 3 },
            setFlags: { 'mural_detailed_scan': true },
          },
          {
            id: 't1_s1_b',
            label: '壁画碎片拼接',
            desc: '蹲在壁画前，将散落的壁画碎片一片片拼回原位——千年之前的线条引导着你的手指。',
            style: 'compromise',
            deltas: { reputation: 2, risk: 3, evidence: 4, budget: 0 },
            miniGame: { type: 'puzzle', difficulty: 1, prompt: '将散落的壁画碎片拼回原位',
              narrativeBinding: '你蹲在壁画前，木框里散落着脱落的壁画残片。有些边缘已经模糊，但千年之前的线条依然引导着你的手指。每拼对一片，唐代的画师就离你更近一步。' },
            successDeltas: { evidence: 3 },
            failDeltas: { evidence: -1, risk: 3 },
            setFlags: { 'mural_basic_record': true },
          },
          {
            id: 't1_s1_c',
            label: '紧急注浆封堵',
            desc: '不等待完整数据，直接在疑似渗漏点注入保护性树脂，赌一把能否锁定渗漏源。',
            style: 'risky',
            deltas: { reputation: -2, risk: -12, evidence: 0, budget: -3 },
            miniGame: { type: 'timing', difficulty: 2, prompt: '在裂缝扩展前精准按下注浆确认键',
              narrativeBinding: '你手持注浆设备，盯着裂隙中渗出的水珠。每一秒都可能是壁画脱落的临界点——现在按，还是再观察？' },
            successDeltas: { risk: -5, reputation: 5 },
            failDeltas: { risk: 10, reputation: -3, budget: -1 },
            setFlags: { 'mural_risky_fix': true },
          },
        ],
      },
      {
        id: 't1_s2',
        description: '前往设备间取工具应对壁画病害',
        locationKey: 'equipment-desk',
        choices: [
          {
            id: 't1_s2_a',
            label: '取隔离绳和吸湿盒',
            desc: '部署物理隔离+主动吸湿设备，全面保护壁画区域，消耗较多预算。',
            style: 'professional',
            deltas: { reputation: 10, risk: -10, evidence: 3, budget: -2 },
            miniGame: { type: 'match', difficulty: 1, prompt: '配对吸湿盒型号与对应壁画区域的安装位置',
              narrativeBinding: '你打开设备间柜门，面前摆着好几种型号的吸湿盒。粉状、凝胶、活性炭——哪个型号对应哪个区域？错了反而加速腐蚀。' },
            successDeltas: { risk: -5, reputation: 5 },
            failDeltas: { reputation: -2, budget: -1 },
            setFlags: { 'deployed_barrier': true },
          },
          {
            id: 't1_s2_b',
            label: '只取补光灯',
            desc: '仅取用补光灯改善照明条件，优先确保可见度再决定后续方案——最小投入、最大灵活度。',
            style: 'compromise',
            deltas: { reputation: 1, risk: 6, evidence: 4, budget: -1 },
            miniGame: { type: 'timing', difficulty: 1, prompt: '在光源对准壁画病害区域时按下快门',
              narrativeBinding: '你举起补光灯，在斑驳的壁画上寻找探照角度。光线与壁画的氧化层形成微妙反光——就这个角度，按下快门。' },
            successDeltas: { evidence: 3, risk: -2 },
            failDeltas: { evidence: -1 },
            setFlags: { 'minimal_equip': true },
          },
          {
            id: 't1_s2_c',
            label: '使用化学加固剂',
            desc: '选择高风险化学加固方案，立即喷涂壁画表面，见效快但可能改变颜料层化学性质。',
            style: 'risky',
            deltas: { reputation: -3, risk: -15, evidence: 1, budget: -4 },
            miniGame: { type: 'calibrate', difficulty: 2, prompt: '将化学试剂浓度调至安全区间最大值',
              narrativeBinding: '你戴上手套，将加固剂原液与稀释剂按比例混合。刻度尺在昏暗灯光下难以辨认——多一点，保护力更强；多两点，颜料焕然褪色。' },
            successDeltas: { risk: -5, reputation: 8 },
            failDeltas: { risk: 12, reputation: -5, evidence: -3 },
            setFlags: { 'chemical_fix': true },
          },
        ],
      },
    ],
    completedMessage: '壁画区巡查完成！病害边界已记录，防护工具已部署到位。',
    midTaskDialog: '张主任推了推眼镜："第一步的摸底数据很有价值。现在去装备台那边，把防护设施调到位——后续几个窟室的监测工作都指望它。"',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 任务2：后室暗窟排湿 — difficulty 1~2
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'task_2',
    title: '后室暗窟排湿',
    npcKey: 'task2_npc',
    briefing:
      '后室暗窟的湿度读数一直偏高，可能已经危及岩体稳定。前往后室湿度监测点校准传感器，然后到设备间制定除湿方案。暗窟内光线很差，小心脚下。',
    steps: [
      {
        id: 't2_s1',
        description: '前往后室湿度监测点进行传感器校准',
        locationKey: 'rear-humidity',
        choices: [
          {
            id: 't2_s1_a',
            label: '进行三点校准',
            desc: '在三个标准湿度点精确校准传感器，保证数据可靠性。',
            style: 'professional',
            deltas: { reputation: 12, risk: -7, evidence: 8, budget: -1 },
            miniGame: { type: 'calibrate', difficulty: 2, prompt: '将三通道湿度值调校至目标参考值',
              narrativeBinding: '你蹲在暗窟角落，将湿度计的三个校准旋钮依次调整。33%、55%、76%——这三个数据点决定了未来一个月所有决策的依据。' },
            successDeltas: { evidence: 5, reputation: 4 },
            failDeltas: { evidence: -3, risk: 5 },
            setFlags: { 'humidity_calibrated': true },
          },
          {
            id: 't2_s1_b',
            label: '直接相信读数',
            desc: '跳过校准步骤直接采纳传感器数值——在与时间赛跑的现场工作中，快速决策有时比精准更重要。',
            style: 'compromise',
            deltas: { reputation: 2, risk: 4, evidence: 3, budget: 0 },
            miniGame: { type: 'timing', difficulty: 1, prompt: '在读数稳定瞬间按下确认键',
              narrativeBinding: '你盯着面板上跳动的湿度数字。78.3...78.7...78.5...它似乎在某个值附近徘徊。当它不再跳动时，就是你的答案。' },
            successDeltas: { evidence: 2 },
            failDeltas: { risk: 5, reputation: -1 },
            setFlags: { 'humidity_guess': true },
          },
          {
            id: 't2_s1_c',
            label: '手动采样分析',
            desc: '不使用传感器，亲自在暗窟深处用吸水纸采集样本，精确但极度耗时且危险。',
            style: 'risky',
            deltas: { reputation: 6, risk: -5, evidence: 10, budget: -2 },
            miniGame: { type: 'trace', difficulty: 3, prompt: '描摹手动采样的湿度分布等高线',
              narrativeBinding: '你贴着冰冷潮湿的岩壁，用吸水纸一寸一寸地擦拭。暗窟深处传来水滴回声——你的手电筒忽明忽暗，但你手中的湿度图谱越来越清晰。' },
            successDeltas: { evidence: 8, reputation: 6 },
            failDeltas: { risk: 8, reputation: -2 },
            setFlags: { 'humidity_manual': true },
          },
        ],
      },
      {
        id: 't2_s2',
        description: '前往设备间制定除湿方案',
        locationKey: 'equipment-desk',
        choices: [
          {
            id: 't2_s2_a',
            label: '部署低功率连续除湿',
            desc: '安装低功率除湿机持续运行，对岩体扰动小，长期效果好。',
            style: 'professional',
            deltas: { reputation: 12, risk: -12, evidence: 3, budget: -2 },
            miniGame: { type: 'calibrate', difficulty: 2, prompt: '调校除湿机输出功率至最佳区间',
              narrativeBinding: '你将除湿机的功率旋钮缓缓转动。60%——足够带走潮气；80%——可能引起温差；60%——安全但见效慢。你选择了哪个区间？' },
            successDeltas: { risk: -8, reputation: 5 },
            failDeltas: { risk: 5, budget: -2 },
            setFlags: { 'slow_dehumid': true },
          },
          {
            id: 't2_s2_b',
            label: '启动快速强除湿',
            desc: '大功率快速除湿——在长期保护和紧急排险之间选择当下最需要的方案。温差风险存在但可控。',
            style: 'compromise',
            deltas: { reputation: 2, risk: -2, evidence: 3, budget: -2 },
            miniGame: { type: 'timing', difficulty: 2, prompt: '在功率峰值区精准锁定除湿设定值',
              narrativeBinding: '除湿机的压缩机轰鸣声在暗窟中回荡。功率指针疯狂跳动——你需要在这股力量失控前，在峰值将它锁定。' },
            successDeltas: { risk: -5 },
            failDeltas: { risk: 6, budget: -1 },
            setFlags: { 'fast_dehumid': true },
          },
          {
            id: 't2_s2_c',
            label: '人工通风+吸湿包',
            desc: '放弃所有机械设备，用最原始方式：打开暗窟通风口，放置大量吸湿包。零能耗但人力密集。',
            style: 'risky',
            deltas: { reputation: 5, risk: -4, evidence: 2, budget: -1 },
            miniGame: { type: 'sequence', difficulty: 2, prompt: '排列吸湿包的最佳放置顺序',
              narrativeBinding: '你抱着一捆吸湿包在暗窟中穿行。通风口——应该放几包？低洼处——放几包？壁画正下方——放还是不放？顺序错了，湿气可能回流。' },
            successDeltas: { risk: -6, reputation: 5, budget: 1 },
            failDeltas: { risk: 10, evidence: -2 },
            setFlags: { 'manual_ventilation': true },
          },
        ],
      },
    ],
    completedMessage: '后室暗窟排湿完成！湿度已回落到安全范围，岩体状态稳定。',
    midTaskDialog: '李工看着湿度曲线缓缓下降，长舒一口气："传感器校准得不错。现在去设备间把除湿方案定下来——我倾向于多用物理通风，化学干燥剂对壁画釉面的损伤很难估量。"',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 任务3：游客动线管控 — difficulty 2
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'task_3',
    title: '游客动线管控',
    npcKey: 'task3_npc',
    briefing:
      '近期游客量激增，窟前栈道区域CO₂浓度屡次超标，可能加速壁画颜料氧化。前往入口闸机检查限流设置，然后到壁画监测点调整导览路线。',
    steps: [
      {
        id: 't3_s1',
        description: '前往入口闸机设置游客管控策略',
        locationKey: 'visitor-gate',
        choices: [
          {
            id: 't3_s1_a',
            label: '开启分批限流',
            desc: '按时间段分批入窟，每组不超过15人，间隔20分钟。',
            style: 'professional',
            deltas: { reputation: 10, risk: -9, evidence: 3, budget: -1 },
            miniGame: { type: 'timing', difficulty: 2, prompt: '在时间窗口开启时精准放行游客批次',
              narrativeBinding: '你站在入口闸机旁，看着显示屏上的倒计时。3...2...1...闸机绿灯亮起——你需要在正确的时间按下放行键，早了游客不满，晚了CO₂超标。' },
            successDeltas: { reputation: 5, risk: -5 },
            failDeltas: { risk: 5, reputation: -2 },
            setFlags: { 'batch_flow': true },
          },
          {
            id: 't3_s1_b',
            label: '保持自由进入',
            desc: '维持当前自由参观模式——游客体验与文物保护并非对立，在客流高峰过后再逐步收紧措施。',
            style: 'compromise',
            deltas: { reputation: -2, risk: 10, evidence: 2, budget: 0 },
            miniGame: { type: 'memory', difficulty: 1, prompt: '记住8个CO₂超标时间节点的读数',
              narrativeBinding: '你看着乌压压的游客涌入窟内，监测屏上的CO₂曲线不断攀升。你能记住哪些时段的读数飙到了危险区吗？' },
            successDeltas: { evidence: 2 },
            failDeltas: { risk: 8 },
            setFlags: { 'free_flow': true },
          },
          {
            id: 't3_s1_c',
            label: '临时关闭部分洞窟',
            desc: '直接关闭CO₂浓度最高的两个洞窟，强制分流游客。必然引发投诉但效果立竿见影。',
            style: 'risky',
            deltas: { reputation: -5, risk: -14, evidence: 5, budget: -2 },
            miniGame: { type: 'calibrate', difficulty: 2, prompt: '调整洞窟开放组合以平衡客流量和CO₂浓度',
              narrativeBinding: '你在控制面板上调出洞窟开放矩阵。关掉17窟和26窟——游客会抗议。但这张CO₂热力图不撒谎。你咬了咬牙，开始设置封闭时段。' },
            successDeltas: { risk: -8, reputation: 3 },
            failDeltas: { risk: 2, reputation: -8 },
            setFlags: { 'cave_closure': true },
          },
        ],
      },
      {
        id: 't3_s2',
        description: '前往壁画监测点调整导览路线',
        locationKey: 'mural-monitor',
        choices: [
          {
            id: 't3_s2_a',
            label: '调整导览停留点',
            desc: '重新规划导览路线，将停留点移至通风良好区域，减少壁画前的聚集时间。',
            style: 'professional',
            deltas: { reputation: 10, risk: -7, evidence: 3, budget: -1 },
            miniGame: { type: 'trace', difficulty: 2, prompt: '描摹新的游客导览最优路径',
              narrativeBinding: '你铺开石窟平面图，用红色马克笔重新勾画导览动线。避开壁画正面，绕行通风廊道——曲线画下去，你仿佛看到CO₂浓度正在下降。' },
            successDeltas: { reputation: 5, risk: -5 },
            failDeltas: { risk: 4 },
            setFlags: { 'rerouted_guide': true },
          },
          {
            id: 't3_s2_b',
            label: '口头提醒游客',
            desc: '安排工作人员在入口处口头提醒注意保护——人力成本低、见效快，适合临时过渡阶段的管控。',
            style: 'compromise',
            deltas: { reputation: 2, risk: 0, evidence: 3, budget: 0 },
            miniGame: { type: 'memory', difficulty: 1, prompt: '复述面向游客的文物保护提示要点',
              narrativeBinding: '你清了清嗓子，面对涌入的游客开始讲解："请大家不要触摸壁画，颜料层有千年历史——" 但你必须确保每个要点都讲到位。' },
            successDeltas: { reputation: 3 },
            failDeltas: { reputation: -1 },
            requireFlags: { 'mural_detailed_scan': false },  // 如果有详细扫描数据，则不能用口头提醒搪塞
            requireHint: '已有详细扫描数据，无法用口头提醒搪塞过去',
            setFlags: { 'verbal_warning': true },
          },
          {
            id: 't3_s2_c',
            label: '安装玻璃隔离墙',
            desc: '在壁画前安装全尺寸防弹玻璃隔离墙，物理隔绝游客呼吸。昂贵但一劳永逸。',
            style: 'risky',
            deltas: { reputation: 8, risk: -15, evidence: 2, budget: -6 },
            miniGame: { type: 'match', difficulty: 2, prompt: '配对玻璃板的尺寸与安装位置',
              narrativeBinding: '施工队送来一车不同尺寸的玻璃板。最大的那块必须挡住17窟的飞天壁画——但它的尺寸刚好吗？拼错了，玻璃墙反而可能压坏壁画。' },
            successDeltas: { risk: -5, reputation: 8, evidence: 4 },
            failDeltas: { risk: 10, budget: -3, reputation: -4 },
            setFlags: { 'glass_barrier': true },
          },
        ],
      },
    ],
    completedMessage: '游客动线管控完成！窟内空气环境恢复正常，参观秩序良好。',
    midTaskDialog: '王巡察在监控屏前低声说："限流方案暂时稳住了指标。不过壁画区那边的监测数据还在波动——你得去壁画监测点再确认一下，我怀疑是限流后参观路线改了，壁画区反而人挤了。"',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 任务4：供电柜巡检 — difficulty 2~3
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'task_4',
    title: '供电柜巡检',
    npcKey: 'task4_npc',
    briefing:
      '供电系统发出过载警报，若不及时处理可能导致监控设备离线。前往供电柜检查线路状态，再到数字档案终端完成数据校验。',
    steps: [
      {
        id: 't4_s1',
        description: '前往供电柜检查电源配置',
        locationKey: 'power-box',
        choices: [
          {
            id: 't4_s1_a',
            label: '切换备用电源',
            desc: '将关键监控设备切换到独立备用电源线路，确保稳定供电。',
            style: 'professional',
            deltas: { reputation: 12, risk: -12, evidence: 4, budget: -3 },
            miniGame: { type: 'wire', difficulty: 2, prompt: '正确连接备用电源线路的端口',
              narrativeBinding: '你打开供电柜，密密麻麻的线路像迷宫一样。红蓝黄绿四色端口——哪条线接到哪个端口？接错了，设备全毁。接对了，文物保护继续。' },
            successDeltas: { risk: -8, reputation: 5 },
            failDeltas: { risk: 8, budget: -2 },
            setFlags: { 'backup_power': true },
          },
          {
            id: 't4_s1_b',
            label: '只重启网关',
            desc: '简单重启网络网关设备快速恢复通信——非根本方案，但在断电威胁面前每一步都是争取时间。',
            style: 'compromise',
            deltas: { reputation: 2, risk: 5, evidence: 3, budget: -1 },
            miniGame: { type: 'timing', difficulty: 1, prompt: '在设备重启完成瞬间按下确认键',
              narrativeBinding: '你按下网关的重启按钮，指示灯开始闪烁。路由器正在重新建立连接——灯变绿的瞬间，就是确认的时刻。' },
            successDeltas: { risk: -3 },
            failDeltas: { risk: 5 },
            setFlags: { 'reboot_only': true },
          },
          {
            id: 't4_s1_c',
            label: '超频供电芯片',
            desc: '解锁供电芯片的频率限制，超频输出功率。短期一切正常，但芯片烧毁风险极高。',
            style: 'risky',
            deltas: { reputation: 4, risk: -10, evidence: 3, budget: -1 },
            miniGame: { type: 'calibrate', difficulty: 3, prompt: '将供电芯片频率推至极限值而不触发保护',
              narrativeBinding: '你拿出工程师调试工具，进入供电芯片的频率控制界面。1.2GHz是安全上限。1.4GHz？1.6GHz？每一次提升都是功率的飞跃，也是风险的叠加。你停在哪里？' },
            successDeltas: { risk: -5, reputation: 8 },
            failDeltas: { risk: 15, budget: -4, evidence: -5 },
            setFlags: { 'overclocked': true },
          },
        ],
      },
      {
        id: 't4_s2',
        description: '前往数字档案终端完成数据校验与补传',
        locationKey: 'archive-terminal',
        choices: [
          {
            id: 't4_s2_a',
            label: '完成校验并补传',
            desc: '全面校验近期监控数据完整性，补传断网期间缺失的记录。',
            style: 'professional',
            deltas: { reputation: 10, risk: -4, evidence: 9, budget: -1 },
            miniGame: { type: 'match', difficulty: 2, prompt: '将数据片段与对应时间段配对校验',
              narrativeBinding: '数字档案屏幕上排列着数十个数据块，每个都有自己的时间戳和传感器编号。你需要将断网期间的空白时间窗口一一补齐——就像修复一幅被打碎的壁画。' },
            successDeltas: { evidence: 5, reputation: 4 },
            failDeltas: { evidence: -3 },
            setFlags: { 'data_complete': true },
          },
          {
            id: 't4_s2_b',
            label: '只记录已上线',
            desc: '确认设备已恢复在线即止——数据缺口是真实存在的，但放弃补全不代表逃避，承认局限也是专业。',
            style: 'compromise',
            deltas: { reputation: 1, risk: 4, evidence: 3, budget: 0 },
            miniGame: { type: 'timing', difficulty: 1, prompt: '在系统上线确认提示出现时点击',
              narrativeBinding: '系统自检完成，弹出确认框："所有设备已恢复在线，确认？" 你犹豫了一下——数据缺口会留下来，但至少设备在运作了。' },
            successDeltas: { evidence: 2 },
            failDeltas: { risk: 4 },
            setFlags: { 'online_only': true },
          },
          {
            id: 't4_s2_c',
            label: 'AI自动补全数据',
            desc: '启用AI算法根据历史数据趋势自动填充缺失值。效率极高，但生成的"假数据"可能在审计中暴露。',
            style: 'risky',
            deltas: { reputation: 3, risk: -2, evidence: 12, budget: -2 },
            miniGame: { type: 'sequence', difficulty: 2, prompt: '排列数据趋势片段使AI插值结果合理',
              narrativeBinding: '你调出AI插值引擎，它需要你手动排列几个关键趋势片段作为参考。温度是从高到低还是从低到高？湿度在深夜变化大还是正午？错了，AI会生成完全错误的数据。' },
            successDeltas: { risk: -5, reputation: 5 },
            failDeltas: { risk: 12, reputation: -6, evidence: -8 },
            setFlags: { 'ai_fill': true },
          },
        ],
      },
    ],
    completedMessage: '供电柜巡检完成！设备已恢复正常供电，档案数据已完整同步。',
    midTaskDialog: '陈工擦了擦手上的机油："接线改得不错，供电总算稳住了。现在去装备台把这次巡检的记录整理归档——林院长说了，今天必须提交数字档案，他等着呢。"',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 任务5：提交数字档案（终章）— difficulty 3
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'task_5',
    title: '提交数字档案',
    npcKey: 'task5_npc',
    briefing:
      '所有巡检任务已完成，现在是最后一步：前往数字档案终端整理并提交完整的巡检数字档案。这是本次巡检的最终成果汇报。',
    steps: [
      {
        id: 't5_s1',
        description: '前往数字档案终端整理巡检资料',
        locationKey: 'archive-terminal',
        choices: [
          {
            id: 't5_s1_a',
            label: '提交完整档案包',
            desc: '将全部巡检数据、照片、处置记录打包提交，形成完整的文物保护档案。',
            style: 'professional',
            deltas: { reputation: 18, risk: -6, evidence: 15, budget: -2 },
            miniGame: { type: 'sequence', difficulty: 3, prompt: '按时间顺序排列所有巡检事件的档案条目',
              narrativeBinding: '你将五个任务的档案文件铺在数字桌面上。壁画扫描→暗窟排湿→游客管控→供电巡检→现在这一份——你需要按时间线排列全天的巡检记录，让未来任何接手的人都能看懂。' },
            successDeltas: { reputation: 8, evidence: 5 },
            failDeltas: { evidence: -5, reputation: -2 },
            setFlags: { 'full_archive': true },
          },
          {
            id: 't5_s1_b',
            label: '只提交简报',
            desc: '提交一份简要总结——在时间紧迫的巡检收官阶段，清晰比详尽更重要。事后可补交完整报告。',
            style: 'compromise',
            deltas: { reputation: 4, risk: 3, evidence: 5, budget: 0 },
            miniGame: { type: 'sequence', difficulty: 2, prompt: '排列简报的目录结构顺序',
              narrativeBinding: '你在终端的摘要模板上快速填入标题：壁画区→后室暗窟→游客管控→供电→总结。一份干净但单薄的汇报。' },
            successDeltas: { reputation: 3, evidence: 2 },
            failDeltas: { reputation: -2 },
            setFlags: { 'brief_only': true },
          },
          {
            id: 't5_s1_c',
            label: '制作多媒体汇报',
            desc: '整理所有红外图像、3D扫描和视频记录，制作可视化的多媒体数据档案。华丽但有数据泄露风险。',
            style: 'risky',
            deltas: { reputation: 12, risk: 5, evidence: 20, budget: -3 },
            miniGame: { type: 'match', difficulty: 3, prompt: '将红外图像、3D扫描和视频正确关联到对应任务',
              narrativeBinding: '你戴上VR眼镜，将无人机拍摄的暗窟3D模型与热成像数据叠加。每一个温度异常区都被高亮——但你也在想，这些数据公开后会不会被不法分子利用？' },
            successDeltas: { evidence: 10, reputation: 10 },
            failDeltas: { risk: 10, reputation: -5, evidence: -8 },
            setFlags: { 'multimedia_report': true },
          },
        ],
      },
      {
        id: 't5_s2',
        description: '向文保主任汇报最终成果',
        locationKey: 'director',
        choices: [
          {
            id: 't5_s2_a',
            label: '做完整汇报展示',
            desc: '全面展示所有巡检数据、分析结果和保护建议，展现专业水准。',
            style: 'professional',
            deltas: { reputation: 15, risk: -5, evidence: 5, budget: 0 },
            miniGame: { type: 'sequence', difficulty: 2, prompt: '按逻辑顺序组织汇报内容的章节',
              narrativeBinding: '你站在会议桌前，主任和专家组注视着投影屏。现状→问题→措施→效果→建议——五个部分，哪个先讲？你的汇报结构决定了他们对整个巡检的认知。' },
            successDeltas: { reputation: 10 },
            failDeltas: { reputation: -3 },
            setFlags: { 'full_presentation': true },
          },
          {
            id: 't5_s2_b',
            label: '口头简要汇报',
            desc: '口头简述关键发现和处置结果，简洁高效。',
            style: 'compromise',
            deltas: { reputation: 5, risk: 2, evidence: 4, budget: 0 },
            miniGame: { type: 'memory', difficulty: 1, prompt: '记住并复述本次巡检的关键数据摘要',
              narrativeBinding: '"主任，今天我们有三个重点发现——"林院长打断你："先说数据，再说判断。"你深吸一口气，在脑中快速搜索着关键数字。\'壁画区湿度最高值是多少？暗窟排湿后稳定在多少？\'院长的追问像连珠炮，但你有备而来——你真的记住了吗？' },
            successDeltas: { reputation: 3 },
            failDeltas: { reputation: -1 },
            setFlags: { 'verbal_report': true },
          },
          {
            id: 't5_s2_c',
            label: '提交书面建议书',
            desc: '不口头汇报，直接提交一份详细的书面建议书——包括明年的文物保护预算申请10万元。大胆但可能得罪主任。',
            style: 'risky',
            deltas: { reputation: 3, risk: -8, evidence: 8, budget: 0 },
            miniGame: { type: 'wire', difficulty: 3, prompt: '连接建议书的论点与对应的数据支撑',
              narrativeBinding: '你坐在桌前奋笔疾书。每一条建议背后都需要数据支撑："请求10万元预算"——连上"暗窟三年湿度趋势"；"人员增编"——连上"CO₂超标数据"。连线越精准，建议越有力。' },
            successDeltas: { reputation: 12, risk: -5, budget: 3 },
            failDeltas: { reputation: -8, evidence: -3 },
            setFlags: { 'written_proposal': true },
          },
        ],
      },
    ],
    completedMessage: '数字档案提交完毕！本次巡检的所有成果已正式归档，感谢你的辛勤付出。',
    midTaskDialog: '林院长的声音从对讲机里传来："前期的数据报告我看过了，完成度很高。现在去装备台把最后的数据归档填完——这一趟巡检下来，我下午要在院务会上用的。"',
  },
]

// ─── NPC 配置 ─────────────────────────────────────────────────────────────

export const NPC_CONFIGS: Record<string, { name: string; title: string; color: string }> = {
  task1_npc: { name: '张主任', title: '文保部主任', color: '#7a5c3a' },
  task2_npc: { name: '李工', title: '科技保护专员', color: '#3a6b7a' },
  task3_npc: { name: '王巡察', title: '洞窟安全管理员', color: '#7a3a3a' },
  task4_npc: { name: '陈工', title: '设备维护工程师', color: '#6b7a3a' },
  task5_npc: { name: '林院长', title: '研究院院长', color: '#5c3a7a' },
}

// ─── 交互点与任务步骤的映射 ───────────────────────────────────────────────

export const POINT_TASK_MAP: Record<string, { taskId: string; stepIndex: 0 | 1 }[]> = {
  'mural-monitor':    [{ taskId: 'task_1', stepIndex: 0 }, { taskId: 'task_3', stepIndex: 1 }],
  'equipment-desk':   [{ taskId: 'task_1', stepIndex: 1 }, { taskId: 'task_2', stepIndex: 1 }],
  'rear-humidity':    [{ taskId: 'task_2', stepIndex: 0 }],
  'visitor-gate':     [{ taskId: 'task_3', stepIndex: 0 }],
  'power-box':        [{ taskId: 'task_4', stepIndex: 0 }],
  'archive-terminal': [{ taskId: 'task_4', stepIndex: 1 }, { taskId: 'task_5', stepIndex: 0 }],
  'director':         [{ taskId: 'task_5', stepIndex: 1 }],
}

// ─── 可选勘查点增益 ───────────────────────────────────────────────────────

export const BONUS_POINTS: Record<string, Partial<Record<string, number>>> = {
  'archive-terminal': { risk: -3, evidence: 8 },
  'equipment-desk':   { risk: -2, evidence: 3, budget: 2 },
  'visitor-gate':     { risk: -4, evidence: 4 },
  'power-box':        { risk: -3, evidence: 6 },
}

// ─── P2: 游客支线任务 ─────────────────────────────────────────────────────

export interface SideQuest {
  id: string
  title: string
  npcName: string
  briefing: string
  locationHint: string  // 提示玩家去哪里
  miniGame: { type: 'memory' | 'timing' | 'sequence' | 'puzzle'; difficulty: 1 | 2; prompt: string; narrativeBinding: string }
  rewards: Partial<Record<'reputation' | 'risk' | 'evidence' | 'budget', number>>
  completedMessage: string
  failedMessage: string
}

export const SIDE_QUESTS: SideQuest[] = [
  {
    id: 'sq_lost_phone',
    title: '遗失的手机',
    npcName: '焦虑的游客',
    briefing: '一位游客焦急地找到你：他的手机不小心从护栏缝隙掉进了后室暗窟的通风井。里面有他已故父亲的照片——那是他唯一没有备份的数据。他恳请你帮忙捡回。',
    locationHint: '前往后室暗窟通风井附近，用手电筒仔细搜索。',
    miniGame: {
      type: 'memory',
      difficulty: 1,
      prompt: '记住手机在暗窟中的掉落位置图案',
      narrativeBinding: '你趴在暗窟通风井边缘，用手电筒向下照去。手机屏幕的反光在黑暗中忽明忽暗——你能凭记忆锁定它的位置吗？',
    },
    rewards: { evidence: 3, reputation: 5 },
    completedMessage: '你成功找回了手机。游客感激涕零，连连道谢。他翻出父亲的照片给你看——照片里，父亲正指着石窟壁画微笑。他补充说："我爸生前就是这里的保护志愿者。"你突然觉得，这份工作的意义远不止于数据和报告。',
    failedMessage: '暗窟太暗，你没能找到手机。游客难掩失落，但你给他留下了联系方式——"找到之后我会通知你。"他点了点头，但你从他眼中看到了某种你知道永远不会愈合的东西。',
  },
  {
    id: 'sq_artifact_talk',
    title: '文物讲解',
    npcName: '好奇的游客',
    briefing: '一位戴着老花镜的游客在壁画前驻足许久，转头向你招手："年轻人，能给我讲讲这幅飞天图的故事吗？我在这个石窟前站了半小时，想知道那位画师在想什么。"',
    locationHint: '在壁画区与游客进行一场深度的文物讲解。',
    miniGame: {
      type: 'sequence',
      difficulty: 2,
      prompt: '按正确的讲解顺序讲述壁画故事',
      narrativeBinding: '你站在这位老者身旁，抬头望向千年前的飞天。从哪里开始讲？先讲颜料来源？还是先讲画师生平？或是先讲佛教东传的路线？讲述的顺序决定了老者能从这幅壁画中"看见"什么。',
    },
    rewards: { reputation: 6, evidence: 4 },
    completedMessage: '你从壁画的颜料矿物学讲到丝绸之路的佛教东传，再讲到画师可能的名字和流派。老者听完沉默片刻，缓缓掏出一个笔记本："我是省文物考古研究所的退休研究员。你今天讲的这些，比我们以前写的讲解词好太多了。"他把笔记本递给你——上面写满了老专家四十年的心得笔记。',
    failedMessage: '你讲得有点慌乱，跳过了几个关键的细节。老者温和地笑了笑："没关系，年轻人。文物讲解不是背课本，是讲故事。下次，从你最熟悉的那个细节开始。"',
  },
  {
    id: 'sq_mural_restore',
    title: '壁画拼接修复',
    npcName: '文物修复师',
    briefing: '一位戴着白手套的文物修复师从工作台后探出头，向你招手："小伙子来得正好！上个月抢救性揭取下来的飞天壁画碎片还散在修复台上。我一个人拼了三天才归位一半——你眼神好，帮我一起把剩下的碎片归位吧。这幅画要是拼不回去，下个月的敦煌学国际会议上我们可就要丢人了。"',
    locationHint: '前往壁画保护区修复台，协助修复师拼接飞天壁画碎片。',
    miniGame: {
      type: 'puzzle',
      difficulty: 1,
      prompt: '将碎片盒中的壁画残片拖放至修复框中的正确位置，还原飞天伎乐图',
      narrativeBinding: '你戴上白手套，站在修复台前。二十多块巴掌大的壁画残片散落在分格木盘里——赭石底色、青金飘带、金粉晕染……每一片都是千年前画师的一笔。光影下它们仿佛还在微微发光。你深吸一口气，从最显眼的那片飞天衣袖开始。',
    },
    rewards: { reputation: 8, evidence: 6 },
    completedMessage: '当最后一片残片精准嵌入修复框时，整幅壁画仿佛活了过来——三位飞天在空中环绕飞翔，飘带如同在微风中拂动。修复师摘下眼镜，眼眶微红："拼了四天。这幅飞天伎乐图在敦煌学文献里失踪了整整六十年，今天终于完整了。"他在修复档案上郑重签下你们两个人的名字。',
    failedMessage: '你尽力了，但还是有几块碎片对不上。修复师拍了拍你的肩膀："没关系，壁画修复是慢功夫。今天我学到了一个新角度——你刚才把飞天裙摆横过来比的那一下，给了我灵感。明天我自己继续。"他把你试过的那几块碎片单独放在一个小盘里，贴上标签："待确认"。',
  },
]

// ─── 故事事件（特定选择触发） ──────────────────────────────────────────────

export const STORY_EVENTS: Record<string, { message: string; deltas: Partial<Record<string, number>> }> = {
  't2_s2_b': { message: '⚠️ 快速强除湿引发温差龟裂！岩壁出现细微裂纹。', deltas: { risk: 6, budget: -1 } },
  't2_s2_c': { message: '⚠️ 吸湿包放置顺序有误！后室角落出现局部冷凝水积聚。', deltas: { risk: 8, evidence: -2 } },
  't3_s1_a': { message: '分批限流引发少量游客投诉，但获得文化遗产局认可。', deltas: { risk: -2, evidence: 1, budget: -1 } },
  't3_s1_b': { message: '⚠️ CO₂浓度急剧上升！壁画表面出现凝结水珠。', deltas: { risk: 8 } },
  't3_s1_c': { message: '⚠️ 关闭洞窟引发游客强烈抗议！热搜上榜。', deltas: { risk: -2, reputation: -6 } },
  't4_s1_a': { message: '切换备用电源导致档案系统短暂延迟，数据同步受影响。', deltas: { risk: 3, evidence: -2 } },
  't4_s1_c': { message: '⚠️ 芯片超频过载！一个传感器模块已烧毁。', deltas: { risk: 12, budget: -3, evidence: -4 } },
  't4_s2_c': { message: '⚠️ AI插值数据被审计后台标记为可疑记录！', deltas: { risk: 8, reputation: -4 } },
  't1_s2_a': { message: '部署吸湿设备后后室湿度略有升高，需要持续监测。', deltas: { risk: 5 } },
  't1_s2_c': { message: '⚠️ 化学加固剂轻微改变了壁画表面光泽度！专家要求复查。', deltas: { risk: 8, reputation: -3 } },
}
