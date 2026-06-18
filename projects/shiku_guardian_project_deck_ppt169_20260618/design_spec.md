# shiku_guardian_project_deck - Design Spec

## I. Project Information

| Item | Value |
| ---- | ----- |
| **Project Name** | 石窟守护者 Project Deck |
| **Canvas Format** | PPT 16:9 (1280x720) |
| **Page Count** | 10 |
| **Design Style** | General Versatile + 暗色新中式电影感游戏提案风 |
| **Target Audience** | 比赛评审、项目审核老师、游戏作品展示观众 |
| **Use Case** | 作品介绍 PPT，用于提交 PDF 或 PPTX |
| **Created Date** | 2026-06-18 |

---

## II. Canvas Specification

| Property | Value |
| -------- | ----- |
| **Format** | PPT 16:9 |
| **Dimensions** | 1280x720 |
| **viewBox** | `0 0 1280 720` |
| **Margins** | left/right 56px, top/bottom 44px |
| **Content Area** | 1168x632 |

---

## III. Visual Theme

### Theme Style

- **Style**: 暗色、电影感、文保科技、克制的新中式
- **Theme**: Dark theme
- **Tone**: 敬畏、紧张、专业、可玩

### Color Scheme

| Role | HEX | Purpose |
| ---- | --- | ------- |
| **Background** | `#12110d` | Deep cave background |
| **Secondary bg** | `#1b1811` | Panels and overlays |
| **Stone** | `#3d3322` | Dividers and earthy surfaces |
| **Primary** | `#d7bd73` | Gold title and key emphasis |
| **Accent** | `#2fb8a6` | Digital HUD and system highlights |
| **Risk** | `#b84a33` | Risk and crisis marks |
| **Body text** | `#f3ead2` | Main readable text |
| **Secondary text** | `#c8b98a` | Captions and labels |
| **Muted text** | `#8a7a55` | Footers and minor labels |
| **Border/divider** | `#5c4b2c` | Thin rules and card borders |
| **Success** | `#6aa06f` | Positive completion |
| **Warning** | `#e08a4b` | Warning and threshold |

### Gradient Scheme

Use dark linear scrims over all background images. Text areas should be readable through a high-opacity `#12110d` overlay and gold/teal accent lines.

---

## IV. Typography System

### Font Plan

**Typography direction**: CJK cultural title + clean sans body.

| Role | Chinese | English | Fallback tail |
| ---- | ------- | ------- | ------------- |
| **Title** | KaiTi | Georgia | serif |
| **Body** | Microsoft YaHei | Arial | sans-serif |
| **Emphasis** | KaiTi | Georgia | serif |
| **Code** | - | Consolas, Courier New | monospace |

**Per-role font stacks**

- Title: `KaiTi, Georgia, serif`
- Body: `"Microsoft YaHei", Arial, sans-serif`
- Emphasis: `KaiTi, Georgia, serif`
- Code: `Consolas, monospace`

### Font Size Hierarchy

**Baseline**: Body font size = 22px.

| Purpose | Size |
| ------- | ---- |
| Cover title | 76-92px |
| Page title | 34-44px |
| Subtitle | 24-30px |
| Body content | 20-24px |
| Annotation | 13-16px |
| Footer | 12px |

---

## V. Layout Principles

### Page Structure

- **Header area**: 44-122px, title plus small index/tag.
- **Content area**: 120-650px, varies between full-bleed image overlays, process flows, cards and diagrams.
- **Footer area**: 654-696px, project name and page number.

### Layout Pattern Library

- Cover and ending: full-bleed image with floating title.
- Content pages: background image + native SVG information panels.
- Process pages: arrows, nodes, and card-like modules drawn in SVG.
- System pages: HUD panels, matrix and status bars.

### Spacing Specification

| Element | Current Project |
| ------- | --------------- |
| Safe margin | 56px |
| Content block gap | 24-36px |
| Icon-text gap | 10-14px |
| Card padding | 22-28px |
| Card radius | 8px |

---

## VI. Icon Usage Specification

### Source

- **Built-in icon library**: `chunk-filled`
- **Usage method**: SVG placeholder `<use data-icon="chunk-filled/icon-name" .../>`

### Recommended Icon List

| Purpose | Icon Path | Page |
| ------- | --------- | ---- |
| Goal / decisions | `chunk-filled/target` | P03, P04 |
| Protection | `chunk-filled/shield` | P01, P10 |
| Risk | `chunk-filled/triangle-exclamation` | P06 |
| Data | `chunk-filled/database` | P07, P09 |
| Archive | `chunk-filled/archive-box` | P07 |
| Flow | `chunk-filled/route` | P03 |
| Metrics | `chunk-filled/chart-bar` | P05, P06 |
| Achievement | `chunk-filled/star` | P08 |
| Implementation | `chunk-filled/code` | P09 |
| Report | `chunk-filled/clipboard` | P08 |

---

## VII. Visualization Reference List

Catalog read: 71 templates

This deck uses custom native SVG diagrams instead of chart templates because the information is conceptual rather than numeric. Visual structures are: custom process flow, custom four-stat HUD, custom decision triad, custom mini-game grid, custom ending map, and custom technical stack diagram.

**Runners-up considered**

- `process_flow` | rejected for P03: the loop needs a circular feel plus mini-game feedback, not only a simple arrow chain.
- `icon_grid` | rejected for P05: the mini-games need narrative binding descriptions, not only parallel feature cards.
- `kpi_cards` | rejected for P06: four attributes are meters with trade-offs, not standalone executive KPIs.

---

## VIII. Image Resource List

| Filename | Dimensions | Ratio | Purpose | Type | Layout pattern | Acquire Via | Status | Reference | text_policy | page_role |
| -------- | ---------- | ----- | ------- | ---- | -------------- | ----------- | ------ | --------- | ----------- | --------- |
| cover_key_art.png | 1672x941 | 1.78 | Cover and closing hero background | Background | #1 Full-bleed background with floating title + #29 Two-stop scrim | user | Existing | generated key art with officer and murals | none | hero_page |
| bg_cave_mural.png | 1672x941 | 1.78 | Heritage atmosphere background | Background | #57 Full-bleed image with extreme low opacity as texture wash + #38 Background image + annotation cards | user | Existing | cave mural with negative space | none | local |
| bg_infrared_scan.png | 1672x941 | 1.78 | Risk and inspection background | Background | #42 Background image + glassmorphism UI panels + #65 Image with NO text | user | Existing | mural damage scan | none | local |
| bg_digital_archive.png | 1672x941 | 1.78 | Archive, endings and technology background | Background | #42 Background image + glassmorphism UI panels + #44 Background image + native network diagram | user | Existing | digital archive room | none | local |

At least one content page uses image-as-canvas patterns (#38, #42, #44), because the deck needs atmospheric backgrounds while keeping all Chinese labels editable in SVG.

---

## IX. Content Outline

### Part 1: Concept

#### Slide 01 - Cover
- **Layout**: Full-screen key art + dark scrim + centered title.
- **Title**: 石窟守护者
- **Subtitle**: 数字文物保护模拟游戏 Project Deck
- **Visualization**: none
- **Content**: Game identity and premise.

#### Slide 02 - Why This Game
- **Layout**: Cave mural background + three tension statements.
- **Title**: 千年遗产，没有重来的机会
- **Content**:
  - 敦煌壁画正在经历起甲、剥落、潮湿、游客与设备压力。
  - 玩家不是旁观者，而是现场数字文保管理员。
  - 游戏把保护伦理、资源限制与风险处置压进每一次选择。

#### Slide 03 - Core Loop
- **Layout**: Circular flow over cave background.
- **Title**: 核心循环：探索 → 决策 → 操作 → 回响
- **Content**:
  - 俯视角探索石窟。
  - 监测点触发任务。
  - 三选一决策后进入叙事绑定小游戏。
  - 四项属性改变并影响结局。

#### Slide 04 - Decision Philosophy
- **Layout**: Three path comparison.
- **Title**: 三选一不是正确答案，而是价值取舍
- **Content**:
  - 专业方案：花预算、降风险、提声誉与证据。
  - 妥协方案：省资源、留隐患，适合撑住局面。
  - 激进方案：见效快、代价高，可能触发反噬。

### Part 2: Systems

#### Slide 05 - Mini-Games
- **Layout**: 8 mini-game tiles over infrared scan background.
- **Title**: 操作即叙事：8 种小游戏都对应真实文保动作
- **Content**:
  - 描摹、记忆、配对、时机、校准、接线、排序、拼图。
  - 每种操作都绑定具体任务语境。

#### Slide 06 - Four-Stat Economy
- **Layout**: HUD meter dashboard over scan background.
- **Title**: 四维经济：声誉、风险、证据、预算
- **Content**:
  - 玩家需要在四项指标之间寻找动态平衡。
  - 风险达到 80 会强制提前结束。
  - 属性转化系统提供绝境中的博弈空间。

#### Slide 07 - Mission Scale
- **Layout**: Mission matrix and count equation over archive background.
- **Title**: 5 项任务 × 2 步骤 × 3 选择 = 30 个决策点
- **Content**:
  - 从壁画起甲到暗窟渗水，再到数字档案提交。
  - 每个决策点都会写入因果链。

#### Slide 08 - Endings and Replay
- **Layout**: Six ending map with achievement layer.
- **Title**: 六种结局，让玩家看见自己的因果链
- **Content**:
  - 石窟守护者、激进改革者、勉力维持者、档案专家、吹哨人、石窟之殇。
  - 18 个成就、挑战模式、NG+ 支撑复玩。

### Part 3: Production

#### Slide 09 - Implementation
- **Layout**: Tech stack architecture over archive background.
- **Title**: 技术实现：React UI + Phaser 世界 + TypeScript 数据层
- **Content**:
  - Phaser 负责场景、角色、交互和小游戏。
  - React 负责 HUD、对话、报告和面板。
  - TypeScript 数据层管理任务、选择、结局和存档。

#### Slide 10 - Closing
- **Layout**: Key art return + final statement.
- **Title**: 让保护成为一种可被体验的选择
- **Content**:
  - 游戏不把文物保护简化为宣传口号，而是让玩家在压力中理解它。

---

## X. Speaker Notes Requirements

- **Filename**: match SVG names.
- **Total duration**: 5-8 minutes.
- **Notes style**: conversational Chinese, suitable for project defense.
- **Purpose**: inform, persuade, and make the project memorable.

---

## XI. Technical Constraints Reminder

1. viewBox: `0 0 1280 720`
2. Background uses `<rect>` and `<image>` elements.
3. Text wrapping uses `<tspan>`.
4. Transparency uses `fill-opacity`, `stroke-opacity` and gradient stop opacity.
5. Forbidden: `mask`, `<style>`, `class`, `foreignObject`, `textPath`, `animate`, `script`, `iframe`.
6. Images reference files under `../images/`.
7. Icons use one library only: `chunk-filled`.
