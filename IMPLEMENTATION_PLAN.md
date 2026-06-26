# 周报系统时间线功能实现方案

## 需求概述

在周报系统中添加时间线功能，用于展示和管理每个工作项的关键里程碑节点。

## 功能需求

### 1. 里程碑节点管理
- 每个工作项可以添加多个里程碑节点
- 每个节点包含：
  - 节点名称（如：需求评审、开发完成、测试中、验收通过）
  - 预期完成日期
  - 实际完成日期（可选）
  - 状态：已完成 / 进行中 / 待完成

### 2. 时间线可视化
- 位置：Hero 概览区域下方
- 样式：水平时间线，按日期排序
- 颜色标识：
  - ✅ 已完成：绿色节点
  - 🟡 进行中：黄色节点
  - ⏳ 待完成：灰色节点
  - ❌ 已逾期：红色节点（超过预期日期但未完成）

### 3. 编辑功能增强
- 在现有的编辑模态框中添加"里程碑管理"区域
- 支持添加、编辑、删除里程碑
- 支持标记里程碑为"已完成"

## 数据结构设计

### 工作项数据结构扩展

```javascript
{
  id: number,
  title: string,
  content: string,
  category: string,
  priority: string,
  tags: array,
  color: string,
  progress: number,
  startDate: string,
  endDate: string,
  ddl: string,
  // 新增字段
  milestones: [
    {
      id: number,
      title: string,        // 里程碑名称
      expectedDate: string, // 预期日期
      actualDate: string,   // 实际日期（可选）
      status: 'completed' | 'in_progress' | 'pending', // 状态
      createdAt: string
    }
  ],
  // 新增字段：编辑历史
  editHistory: [
    {
      timestamp: string,
      field: string,      // 修改的字段
      oldValue: any,
      newValue: any
    }
  ]
}
```

## UI 设计

### 1. 时间线模块位置

```
┌─────────────────────────────────────────┐
│         Hero 概览区域（现有）             │
├─────────────────────────────────────────┤
│  📅 时间线                                │
│  ┌────────────────────────────────────┐ │
│  │ ●─────────●─────────○─────────○    │ │
│  │ 已完成    已完成    进行中    待完成 │ │
│  └────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│         本周工作列表（现有）              │
└─────────────────────────────────────────┘
```

### 2. 时间线卡片设计

```
工作项：安全工单进线链路优化
├── ● 06/20 需求评审（已完成）
├── ● 06/22 开发完成（已完成）
├── 🟡 06/25 测试中（进行中）
└── ○ 06/28 验收上线（待完成）
```

### 3. 编辑模态框增强

在现有模态框底部添加"里程碑管理"区域：

```
┌──────────────────────────────────────┐
│  编辑本周工作                         │
├──────────────────────────────────────┤
│  标题：[                        ]    │
│  详细内容：                           │
│  [                            ]      │
│  ...                                 │
├──────────────────────────────────────┤
│  📌 里程碑节点                        │
│  ┌──────────────────────────────┐   │
│  │ 需求评审  06/20  ✅ 已完成    │   │
│  │ 开发完成  06/22  ✅ 已完成    │   │
│  │ 测试中    06/25  🟡 进行中    │   │
│  │                              │   │
│  │ [+ 添加里程碑]               │   │
│  └──────────────────────────────┘   │
├──────────────────────────────────────┤
│         [取消]  [保存]               │
└──────────────────────────────────────┘
```

## 实现步骤

### 第一阶段：数据层修改

1. **修改 `storage.js`**
   - 扩展 `addItem` 方法，支持里程碑数据
   - 扩展 `updateItem` 方法，支持里程碑更新
   - 添加 `addMilestone` 方法
   - 添加 `updateMilestone` 方法
   - 添加 `deleteMilestone` 方法

### 第二阶段：UI 层修改

2. **修改 `index.html`**
   - 在 Hero 区域下方添加时间线模块容器
   - 在编辑模态框中添加里程碑编辑区域

3. **修改 `app.js`**
   - 添加 `renderTimeline()` 方法
   - 添加 `openMilestoneEditor()` 方法
   - 添加 `addMilestone()` 方法
   - 添加 `updateMilestoneStatus()` 方法
   - 添加 `deleteMilestone()` 方法
   - 修改 `openModal()` 方法，加载里程碑数据
   - 修改 `saveItem()` 方法，保存里程碑数据

4. **修改 `style.css`**
   - 添加时间线样式
   - 添加里程碑节点样式
   - 添加里程碑编辑器样式

### 第三阶段：交互优化

5. **添加交互功能**
   - 时间线节点点击跳转到对应工作项
   - 节点悬浮显示详细信息
   - 快速标记里程碑完成状态
   - 时间线按日期智能排序

## 技术细节

### 时间线渲染逻辑

```javascript
renderTimeline() {
  const weekData = storage.getWeekData(this.currentYear, this.currentWeek);

  // 收集所有里程碑
  const allMilestones = [];
  weekData.tasks.forEach(task => {
    if (task.milestones && task.milestones.length > 0) {
      task.milestones.forEach(m => {
        allMilestones.push({
          ...m,
          taskTitle: task.title,
          taskId: task.id,
          taskColor: task.color
        });
      });
    }
  });

  // 按日期排序
  allMilestones.sort((a, b) =>
    new Date(a.expectedDate) - new Date(b.expectedDate)
  );

  // 渲染时间线
  return allMilestones.map(m => this.renderMilestoneNode(m));
}
```

### 里程碑状态计算

```javascript
getMilestoneStatus(milestone) {
  const today = new Date();
  const expectedDate = new Date(milestone.expectedDate);

  if (milestone.status === 'completed') {
    return 'completed'; // 绿色
  }

  if (milestone.status === 'in_progress') {
    return 'in_progress'; // 黄色
  }

  if (expectedDate < today) {
    return 'overdue'; // 红色（逾期）
  }

  return 'pending'; // 灰色（待完成）
}
```

## 文件修改清单

| 文件 | 修改内容 |
|------|---------|
| `js/storage.js` | 添加里程碑相关方法 |
| `js/app.js` | 添加时间线渲染和里程碑管理逻辑 |
| `index.html` | 添加时间线模块和里程碑编辑UI |
| `css/style.css` | 添加时间线和里程碑样式 |

## 兼容性考虑

- 已有数据没有 `milestones` 字段，需要做兼容处理
- 首次编辑时自动初始化 `milestones` 为空数组
- 不影响现有功能的使用

## 后续扩展

- 支持里程碑模板（快速添加常用里程碑）
- 支持里程碑提醒（浏览器通知）
- 支持里程碑统计（完成率、逾期率）
- 支持甘特图视图
