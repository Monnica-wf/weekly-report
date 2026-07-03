/**
 * 周报应用主逻辑 - Apple 风格
 */

class WeeklyReportApp {
    constructor() {
        this.currentDate = new Date();
        this.currentYear = this.currentDate.getFullYear();
        this.currentWeek = storage.getWeekNumber(this.currentDate);
        this.editingItem = null;
        this.editingType = null;
        this.currentTags = [];
        this.currentMilestones = [];
        this.currentView = 'current';

        this.init();
    }

    /**
     * 初始化应用
     */
    async init() {
        const importedFromShare = this.importShareFromUrl();
        if (!importedFromShare) {
            await this.loadPublishedData();
        }
        this.syncAllMilestonesToNextWeekTasks();
        this.cleanupAutoPlanThoughts();
        this.bindEvents();
        this.render();
        this.setDefaultDates();
    }

    /**
     * 绑定事件
     */
    bindEvents() {
        // 导航切换
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const view = item.dataset.view;
                this.switchView(view);
            });
        });

        // 周导航
        document.getElementById('prevWeek').addEventListener('click', () => this.changeWeek(-1));
        document.getElementById('nextWeek').addEventListener('click', () => this.changeWeek(1));
        document.getElementById('todayBtn').addEventListener('click', () => this.goToCurrentWeek());

        // 添加按钮
        document.getElementById('shareReportBtn').addEventListener('click', () => this.shareReport());
        document.getElementById('exportPublishDataBtn').addEventListener('click', () => this.exportPublishData());
        document.getElementById('addTaskBtn').addEventListener('click', () => this.openModal('task'));
        document.getElementById('addHarvestBtn').addEventListener('click', () => this.openModal('harvest'));

        // 模态框
        document.getElementById('closeModal').addEventListener('click', () => this.closeModal());
        document.getElementById('cancelBtn').addEventListener('click', () => this.closeModal());
        document.getElementById('saveBtn').addEventListener('click', () => this.saveItem());
        document.getElementById('modalOverlay').addEventListener('click', (e) => {
            if (e.target.id === 'modalOverlay') this.closeModal();
        });

        // 进度滑块
        document.getElementById('itemProgress').addEventListener('input', (e) => {
            document.getElementById('progressValue').textContent = e.target.value + '%';
            this.toggleDDLField(parseInt(e.target.value));
        });

        // 标签输入
        document.getElementById('tagInput').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.addTag(e.target.value.trim());
                e.target.value = '';
            }
        });

        // 笔记上传
        document.getElementById('uploadNoteBtn').addEventListener('click', () => {
            document.getElementById('noteInput').click();
        });
        document.getElementById('addNoteLinkBtn').addEventListener('click', () => this.addNoteLink());
        document.getElementById('noteInput').addEventListener('change', (e) => this.handleNoteUpload(e));

        // 评论提交
        document.getElementById('submitCommentBtn').addEventListener('click', () => this.submitComment());
        document.getElementById('commentContent').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                this.submitComment();
            }
        });

        // 里程碑添加按钮
        document.getElementById('addMilestoneBtn').addEventListener('click', () => this.addMilestone());

        // 心得体会编辑按钮
        document.getElementById('editThoughtsBtn').addEventListener('click', () => this.showThoughtsInput());
        document.getElementById('saveThoughtsBtn').addEventListener('click', () => this.saveThoughts());
        document.getElementById('cancelThoughtsBtn').addEventListener('click', () => this.hideThoughtsInput());
        document.getElementById('weekThoughts').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                this.saveThoughts();
            }
            if (e.key === 'Escape') {
                this.hideThoughtsInput();
            }
        });

        // 键盘快捷键
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && document.getElementById('modalOverlay').classList.contains('active')) {
                this.closeModal();
            }
        });
    }

    /**
     * 设置默认日期
     */
    setDefaultDates() {
        const today = new Date();
        const dateStr = today.toISOString().split('T')[0];
        document.getElementById('itemEndDate').value = dateStr;
    }

    /**
     * 从分享链接导入数据
     */
    importShareFromUrl() {
        const match = window.location.hash.slice(1).match(/(?:^|&)share=([^&]+)/);
        if (!match) return false;

        try {
            const json = this.decodeSharePayload(match[1]);
            storage.importShareData(JSON.parse(json));
            history.replaceState(null, '', window.location.pathname + window.location.search);
            this.showToast('已载入分享数据');
            return true;
        } catch (e) {
            console.error('导入分享数据失败:', e);
            this.showToast('分享链接无效', 'error');
            return false;
        }
    }

    /**
     * 加载 GitHub Pages 上发布的数据
     */
    async loadPublishedData() {
        try {
            const response = await fetch(`data/report.json?v=${Date.now()}`, { cache: 'no-store' });
            if (!response.ok) return;

            const publishedData = await response.json();
            const publishedVersion = publishedData.publishedAt || publishedData.exportedAt || '';
            const shouldImport = !storage.hasLocalContent();

            if (!shouldImport) return;

            storage.importShareData(publishedData);
            storage.setPublishedVersion(publishedVersion);
        } catch (e) {
            console.info('未加载公开发布数据:', e.message);
        }
    }

    /**
     * 生成并复制分享链接
     */
    async shareReport() {
        try {
            const payload = this.encodeSharePayload(JSON.stringify(storage.exportShareData()));
            const shareUrl = `${window.location.href.split('#')[0]}#share=${payload}`;

            if (shareUrl.length > 18000) {
                this.showToast('内容太多，链接会过长，请减少文件笔记后再分享', 'error');
                return;
            }

            await this.copyText(shareUrl);
            this.showToast('分享链接已复制');
        } catch (e) {
            console.error('生成分享链接失败:', e);
            this.showToast('生成分享链接失败', 'error');
        }
    }

    /**
     * 导出用于 GitHub Pages 的发布数据
     */
    exportPublishData() {
        const data = JSON.stringify(storage.exportPublishedData(), null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'report.json';
        link.click();
        URL.revokeObjectURL(url);
        this.showToast('已导出 report.json');
    }

    /**
     * 切换视图
     */
    switchView(view) {
        this.currentView = view;

        // 更新导航状态
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.view === view);
        });

        // 切换视图显示
        document.querySelectorAll('.view').forEach(v => {
            v.classList.remove('active');
        });
        document.getElementById(view + 'View').classList.add('active');

        // 刷新对应视图
        if (view === 'stats') {
            this.renderStats();
        }
    }

    /**
     * 切换周
     */
    changeWeek(delta) {
        this.currentWeek += delta;

        if (this.currentWeek > 52) {
            this.currentWeek = 1;
            this.currentYear++;
        } else if (this.currentWeek < 1) {
            this.currentWeek = 52;
            this.currentYear--;
        }

        this.render();
    }

    /**
     * 回到当前周
     */
    goToCurrentWeek() {
        this.currentDate = new Date();
        this.currentYear = this.currentDate.getFullYear();
        this.currentWeek = storage.getWeekNumber(this.currentDate);
        this.render();
    }

    /**
     * 打开模态框
     */
    openModal(type, item = null) {
        this.editingType = type;
        this.editingItem = item;
        this.currentTags = item ? [...item.tags] : [];
        this.currentMilestones = item?.milestones ? [...item.milestones] : [];

        const modal = document.getElementById('modalOverlay');
        const title = document.getElementById('modalTitle');

        title.textContent = item
            ? (type === 'task' ? '编辑本周工作' : '编辑下周计划')
            : (type === 'task' ? '添加本周工作' : '添加下周计划');

        // 获取已有项目列表
        this.updateProjectSelect(item?.projectName || '');

        // 填充表单
        document.getElementById('itemProjectName').value = item?.projectName || '';
        document.getElementById('itemTitle').value = item?.title || '';
        document.getElementById('itemContent').value = item?.content || '';
        document.getElementById('itemReflection').value = item?.reflection || '';
        document.getElementById('itemCategory').value = item?.category || 'ai';
        document.getElementById('itemPriority').value = item?.priority || 'p1';
        const progressValue = item?.progress !== undefined ? item.progress : 100;
        document.getElementById('itemProgress').value = progressValue;
        document.getElementById('progressValue').textContent = progressValue + '%';
        document.getElementById('itemStartDate').value = item?.startDate || '';
        document.getElementById('itemEndDate').value = item?.endDate || '';
        document.getElementById('itemDDL').value = item?.ddl || '';

        // 显示/隐藏 DDL 字段
        this.toggleDDLField(progressValue);

        // 设置颜色
        const colorValue = item?.color || '#0A84FF';
        document.querySelector(`input[name="itemColor"][value="${colorValue}"]`).checked = true;

        // 渲染标签
        this.renderTags();

        // 渲染里程碑
        this.renderMilestones();

        modal.classList.add('active');
        document.getElementById('itemProjectSelect').focus();
    }

    /**
     * 更新项目选择下拉框
     */
    updateProjectSelect(currentProject = '') {
        const allData = storage.getAllData();
        const projects = new Set();

        // 收集所有项目名称
        for (const weekId in allData) {
            const week = allData[weekId];
            week.tasks.forEach(task => {
                if (task.projectName) {
                    projects.add(task.projectName);
                }
            });
            week.harvests.forEach(harvest => {
                if (harvest.projectName) {
                    projects.add(harvest.projectName);
                }
            });
        }

        const select = document.getElementById('itemProjectSelect');
        select.innerHTML = '<option value="">选择已有项目...</option>';

        projects.forEach(project => {
            const option = document.createElement('option');
            option.value = project;
            option.textContent = project;
            if (project === currentProject) {
                option.selected = true;
            }
            select.appendChild(option);
        });

        // 监听选择变化
        select.onchange = () => {
            if (select.value) {
                document.getElementById('itemProjectName').value = select.value;
            }
        };
    }

    /**
     * 切换 DDL 字段显示
     */
    toggleDDLField(progress) {
        const ddlGroup = document.getElementById('ddlGroup');
        const ddlInput = document.getElementById('itemDDL');

        if (progress < 100) {
            ddlGroup.style.display = 'block';
            ddlInput.required = true;
        } else {
            ddlGroup.style.display = 'none';
            ddlInput.required = false;
        }
    }

    /**
     * 关闭模态框
     */
    closeModal() {
        document.getElementById('modalOverlay').classList.remove('active');
        this.editingItem = null;
        this.editingType = null;
        this.currentTags = [];
        this.currentMilestones = [];

        // 重置表单
        document.getElementById('itemForm').reset();
        document.getElementById('progressValue').textContent = '100%';
        document.getElementById('ddlGroup').style.display = 'none';
    }

    /**
     * 添加标签
     */
    addTag(tagText) {
        if (tagText && !this.currentTags.includes(tagText) && this.currentTags.length < 5) {
            this.currentTags.push(tagText);
            this.renderTags();
        }
    }

    /**
     * 移除标签
     */
    removeTag(index) {
        this.currentTags.splice(index, 1);
        this.renderTags();
    }

    /**
     * 渲染标签
     */
    renderTags() {
        const container = document.getElementById('tagsContainer');
        container.innerHTML = this.currentTags.map((tag, index) => `
            <span class="tag-item">
                ${this.escapeHtml(tag)}
                <button class="tag-remove" onclick="app.removeTag(${index})">×</button>
            </span>
        `).join('');
    }

    /**
     * 添加里程碑
     */
    addMilestone() {
        const today = new Date().toISOString().split('T')[0];
        this.currentMilestones.push({
            id: Date.now() + Math.random(),
            title: '',
            expectedDate: today,
            status: 'pending',
            addToNextWeek: false  // 新增：是否加入下周计划
        });
        this.renderMilestones();
    }

    /**
     * 删除里程碑
     */
    removeMilestone(index) {
        this.currentMilestones.splice(index, 1);
        this.renderMilestones();
    }

    /**
     * 更新里程碑
     */
    updateMilestone(index, field, value) {
        this.currentMilestones[index][field] = value;

        // 如果勾选了"加入下周计划"，自动设置状态为待完成
        if (field === 'addToNextWeek' && value) {
            this.currentMilestones[index].status = 'pending';
        }
    }

    /**
     * 渲染里程碑编辑列表
     */
    renderMilestones() {
        const container = document.getElementById('milestonesList');

        if (this.currentMilestones.length === 0) {
            container.innerHTML = '<div class="empty-state compact"><p>暂无里程碑</p></div>';
            return;
        }

        container.innerHTML = this.currentMilestones.map((milestone, index) => `
            <div class="milestone-edit-item">
                <input type="text"
                       value="${this.escapeHtml(milestone.title)}"
                       placeholder="里程碑名称"
                       onchange="app.updateMilestone(${index}, 'title', this.value)"
                       class="milestone-title-input">
                <input type="date"
                       value="${milestone.expectedDate}"
                       onchange="app.updateMilestone(${index}, 'expectedDate', this.value)"
                       class="milestone-date-input">
                <select class="milestone-status-select"
                        onchange="app.updateMilestone(${index}, 'status', this.value)">
                    <option value="pending" ${milestone.status === 'pending' ? 'selected' : ''}>待完成</option>
                    <option value="in_progress" ${milestone.status === 'in_progress' ? 'selected' : ''}>进行中</option>
                    <option value="completed" ${milestone.status === 'completed' ? 'selected' : ''}>已完成</option>
                </select>
                <label class="milestone-checkbox-label">
                    <input type="checkbox"
                           ${milestone.addToNextWeek ? 'checked' : ''}
                           onchange="app.updateMilestone(${index}, 'addToNextWeek', this.checked)">
                    <span>加入下周计划</span>
                </label>
                <button class="milestone-delete-btn" onclick="app.removeMilestone(${index})" title="删除">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M3 4h10M6 4V3a1 1 0 011-1h2a1 1 0 011 1v1M5 4v9a1 1 0 001 1h4a1 1 0 001-1V4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </button>
            </div>
        `).join('');
    }

    /**
     * 保存事项
     */
    saveItem() {
        const projectName = document.getElementById('itemProjectName').value.trim();
        const title = document.getElementById('itemTitle').value.trim();
        const content = document.getElementById('itemContent').value.trim();
        const reflection = document.getElementById('itemReflection').value.trim();
        const category = document.getElementById('itemCategory').value;
        const priority = document.getElementById('itemPriority').value;
        const progress = parseInt(document.getElementById('itemProgress').value);
        const startDate = document.getElementById('itemStartDate').value;
        const endDate = document.getElementById('itemEndDate').value;
        const ddl = document.getElementById('itemDDL').value;
        const color = document.querySelector('input[name="itemColor"]:checked').value;

        if (!title) {
            this.showToast('请输入标题', 'error');
            document.getElementById('itemTitle').focus();
            return;
        }

        // 如果进度未完成，必须设置 DDL
        if (progress < 100 && !ddl) {
            this.showToast('未完成工作必须设置截止日期', 'error');
            document.getElementById('itemDDL').focus();
            return;
        }

        const itemData = {
            projectName,
            title,
            content,
            reflection,
            category,
            priority,
            tags: [...this.currentTags],
            color,
            progress,
            startDate: startDate || null,
            endDate: endDate || null,
            ddl: ddl || null,
            milestones: this.currentMilestones.filter(m => m.title.trim())
        };

        if (this.editingItem) {
            storage.updateItem(this.currentYear, this.currentWeek, this.editingType, this.editingItem.id, itemData);
            this.showToast('更新成功');
        } else {
            storage.addItem(this.currentYear, this.currentWeek, this.editingType, itemData);
            this.showToast('添加成功');
        }

        if (this.editingType === 'task') {
            this.syncMilestonesToNextWeekTasks(this.currentYear, this.currentWeek);
        }

        this.closeModal();
        this.render();
    }

    /**
     * 获取相邻周，沿用当前应用的 52 周滚动逻辑
     */
    getAdjacentWeek(year, week, delta = 1) {
        let targetYear = year;
        let targetWeek = week + delta;

        while (targetWeek > 52) {
            targetWeek -= 52;
            targetYear++;
        }

        while (targetWeek < 1) {
            targetWeek += 52;
            targetYear--;
        }

        return { year: targetYear, week: targetWeek };
    }

    /**
     * 获取当前应用口径下的周起止日期
     */
    getWeekBoundaryDates(year, week) {
        const firstDayOfYear = new Date(year, 0, 1);
        const start = new Date(firstDayOfYear);
        start.setDate(firstDayOfYear.getDate() + (week - 1) * 7);
        start.setHours(0, 0, 0, 0);

        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);

        return { start, end };
    }

    colorWithAlpha(color, alpha = 0.08) {
        if (!color || typeof color !== 'string' || !color.startsWith('#')) {
            return 'rgba(92, 184, 168, 0.08)';
        }

        const hex = color.replace('#', '');
        if (hex.length !== 6) {
            return `${color}14`;
        }

        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);

        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    /**
     * 项目颜色统一入口：本周工作、下周计划、时间线都用同一套规则
     */
    getProjectColor(projectName) {
        const colorPalette = [
            { primary: '#5cb8a8', secondary: 'rgba(92, 184, 168, 0.06)' },
            { primary: '#c47a4a', secondary: 'rgba(196, 122, 74, 0.06)' },
            { primary: '#7a8ac4', secondary: 'rgba(122, 138, 196, 0.06)' },
            { primary: '#5ac48a', secondary: 'rgba(90, 196, 138, 0.06)' },
            { primary: '#c47a9a', secondary: 'rgba(196, 122, 154, 0.06)' },
            { primary: '#5aa8c4', secondary: 'rgba(90, 168, 196, 0.06)' }
        ];
        const key = projectName || '未分类';
        let hash = 0;

        for (let i = 0; i < key.length; i++) {
            hash = ((hash << 5) - hash) + key.charCodeAt(i);
            hash |= 0;
        }

        return colorPalette[Math.abs(hash) % colorPalette.length];
    }

    /**
     * 将本周勾选“加入下周计划”的里程碑同步为下一周的本周工作
     */
    syncMilestonesToNextWeekTasks(year, week) {
        const sourceWeekData = storage.getWeekData(year, week);
        const next = this.getAdjacentWeek(year, week, 1);
        const nextWeekData = storage.getWeekData(next.year, next.week);

        const generatedTasks = [];

        sourceWeekData.tasks.forEach(task => {
            (task.milestones || []).forEach(milestone => {
                if (!milestone.addToNextWeek || !milestone.title?.trim()) return;

                const syncKey = `${storage.getWeekId(year, week)}:${task.id}:${milestone.id}`;
                generatedTasks.push({
                    id: `milestone-${syncKey}`,
                    title: milestone.title,
                    projectName: task.projectName || '',
                    content: `来自本周工作：${task.title}`,
                    reflection: '',
                    category: task.category || 'ai',
                    priority: task.priority || 'p1',
                    tags: [...(task.tags || [])],
                    color: task.color || '#0A84FF',
                    progress: milestone.status === 'completed' ? 100 : 0,
                    startDate: milestone.expectedDate || null,
                    endDate: null,
                    ddl: milestone.expectedDate || null,
                    milestones: [],
                    fromMilestone: true,
                    isFromMilestone: false,
                    isSyncedMilestoneTask: true,
                    sourceWeekId: storage.getWeekId(year, week),
                    sourceTaskId: task.id,
                    sourceTaskTitle: task.title,
                    sourceMilestoneId: milestone.id,
                    syncKey,
                    milestoneStatus: milestone.status,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                });
            });
        });

        const sourceWeekId = storage.getWeekId(year, week);
        const existingManualTasks = (nextWeekData.tasks || []).filter(task => {
            if (!task.fromMilestone && !task.isFromMilestone && !task.isSyncedMilestoneTask) return true;
            return task.sourceWeekId !== sourceWeekId;
        });

        const existingGeneratedByKey = {};
        (nextWeekData.tasks || []).forEach(task => {
            if ((task.fromMilestone || task.isFromMilestone) && task.syncKey) {
                existingGeneratedByKey[task.syncKey] = task;
            }
        });

        nextWeekData.tasks = [
            ...existingManualTasks,
            ...generatedTasks.map(task => ({
                ...task,
                createdAt: existingGeneratedByKey[task.syncKey]?.createdAt || task.createdAt
            }))
        ];

        // 清理旧版本误同步到“下周计划”的里程碑项
        nextWeekData.harvests = (nextWeekData.harvests || []).filter(plan => {
            if (!plan.fromMilestone && !plan.isFromMilestone) return true;
            if (plan.sourceWeekId && plan.sourceWeekId !== storage.getWeekId(year, week)) return true;
            return false;
        });

        storage.saveWeekData(next.year, next.week, nextWeekData);
    }

    /**
     * 载入时修复旧数据：把历史里程碑计划同步到下一周工作
     */
    syncAllMilestonesToNextWeekTasks() {
        const allData = storage.getAllData();
        Object.keys(allData).forEach(weekId => {
            const match = weekId.match(/^(\d{4})-W(\d{2})$/);
            if (!match) return;

            const year = Number(match[1]);
            const week = Number(match[2]);
            const weekData = allData[weekId];
            const hasMilestoneSync = (weekData.tasks || []).some(task =>
                (task.milestones || []).some(milestone => milestone.addToNextWeek)
            );

            if (hasMilestoneSync) {
                this.syncMilestonesToNextWeekTasks(year, week);
            }
        });
    }

    /**
     * 清理旧版本误进入心得体会的自动计划文案
     */
    cleanupAutoPlanThoughts() {
        const allData = storage.getAllData();
        let changed = false;

        Object.entries(allData).forEach(([weekId, weekData]) => {
            if (typeof weekData.thoughts === 'string' &&
                /来自本周工作[:：]|来自[:：]/.test(weekData.thoughts)) {
                weekData.thoughts = '';
                allData[weekId] = weekData;
                changed = true;
            }
        });

        if (changed) {
            storage.saveAllData(allData);
        }
    }

    /**
     * 删除事项
     */
    deleteItem(type, itemId) {
        if (confirm('确定要删除这条记录吗？')) {
            storage.deleteItem(this.currentYear, this.currentWeek, type, itemId);
            this.showToast('已删除');
            this.render();
        }
    }

    /**
     * 编辑事项
     */
    editItem(type, itemId) {
        const weekData = storage.getWeekData(this.currentYear, this.currentWeek);
        const items = type === 'task' ? weekData.tasks : weekData.harvests;
        const item = items.find(i => i.id === itemId);

        if (item) {
            this.openModal(type, item);
        }
    }

    /**
     * 处理笔记上传
     */
    handleNoteUpload(event) {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        Array.from(files).forEach(file => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const noteData = {
                    name: file.name,
                    size: file.size,
                    type: file.type,
                    content: e.target.result
                };

                storage.saveNote(this.currentYear, this.currentWeek, noteData);
                this.showToast('上传成功');
                this.render();
            };
            reader.readAsDataURL(file);
        });

        event.target.value = '';
    }

    /**
     * 添加链接笔记
     */
    addNoteLink() {
        const rawUrl = prompt('请输入笔记链接');
        if (!rawUrl) return;

        const url = this.normalizeUrl(rawUrl.trim());
        if (!this.isValidUrl(url)) {
            this.showToast('请输入有效链接', 'error');
            return;
        }

        const name = prompt('给这个链接起个名字（可选）')?.trim() || url;
        storage.saveNote(this.currentYear, this.currentWeek, {
            name,
            type: 'link',
            kind: 'link',
            url
        });

        this.showToast('链接已添加');
        this.render();
    }

    /**
     * 删除笔记
     */
    deleteNote(noteId) {
        if (confirm('确定要删除这个笔记吗？')) {
            storage.deleteNote(this.currentYear, this.currentWeek, noteId);
            this.showToast('已删除');
            this.render();
        }
    }

    /**
     * 下载笔记
     */
    downloadNote(note) {
        if (note.kind === 'link' || note.type === 'link') {
            window.open(note.url || note.content, '_blank', 'noopener');
            return;
        }

        const link = document.createElement('a');
        link.href = note.content;
        link.download = note.name;
        link.click();
    }

    /**
     * 提交评论
     */
    submitComment() {
        const author = document.getElementById('commentAuthor').value.trim() || '匿名用户';
        const content = document.getElementById('commentContent').value.trim();

        if (!content) {
            this.showToast('请输入评论内容', 'error');
            document.getElementById('commentContent').focus();
            return;
        }

        storage.addComment(this.currentYear, this.currentWeek, {
            author,
            content
        });

        // 清空输入
        document.getElementById('commentAuthor').value = '';
        document.getElementById('commentContent').value = '';

        this.showToast('评论发布成功');
        this.renderComments();
    }

    /**
     * 删除评论
     */
    deleteComment(commentId) {
        if (confirm('确定要删除这条评论吗？')) {
            storage.deleteComment(this.currentYear, this.currentWeek, commentId);
            this.showToast('评论已删除');
            this.renderComments();
        }
    }

    /**
     * 提交回复
     */
    submitReply(commentId, replyInput) {
        const author = '匿名用户'; // 回复默认匿名
        const content = replyInput.value.trim();

        if (!content) {
            this.showToast('请输入回复内容', 'error');
            replyInput.focus();
            return;
        }

        storage.replyToComment(this.currentYear, this.currentWeek, commentId, {
            author,
            content
        });

        this.showToast('回复成功');
        this.renderComments();
    }

    /**
     * 显示提示
     */
    showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        const toastMessage = document.getElementById('toastMessage');

        toastMessage.textContent = message;
        toast.className = 'toast ' + type;
        toast.classList.add('show');

        setTimeout(() => {
            toast.classList.remove('show');
        }, 2500);
    }

    /**
     * 渲染页面
     */
    render() {
        this.renderWeekDisplay();
        this.renderHeroMetrics();
        this.renderTimeline();
        this.renderTasks();
        this.renderHarvests();
        this.renderNotes();
        this.renderThoughts();
        this.renderComments();
        this.renderHistory();
        this.renderStats();
    }

    /**
     * 渲染周显示
     */
    renderWeekDisplay() {
        const dateRange = storage.getWeekDateRange(this.currentWeek, this.currentYear);

        document.getElementById('currentWeekTitle').textContent = `${this.currentYear}年第${this.currentWeek}周`;
        document.getElementById('currentWeekDates').textContent = `${dateRange.start} - ${dateRange.end}`;
        document.getElementById('sidebarWeek').textContent = `第${this.currentWeek}周`;
    }

    /**
     * 渲染顶部概览数据
     */
    renderHeroMetrics() {
        const weekData = storage.getWeekData(this.currentYear, this.currentWeek);
        const notes = storage.getWeekNotes(this.currentYear, this.currentWeek);
        const incompleteTasks = weekData.tasks.filter(task => {
            const progress = task.progress !== undefined ? task.progress : 100;
            return progress < 100;
        });
        const nextWeekMilestonePlans = this.getCurrentWeekMilestonePlans();

        // 下周计划总数 = 手动添加的计划 + 未完成工作 + 本周勾选同步的里程碑计划
        const totalPlans = weekData.harvests.length + incompleteTasks.length + nextWeekMilestonePlans.length;

        document.getElementById('heroTasksCount').textContent = weekData.tasks.length;
        document.getElementById('heroPlansCount').textContent = totalPlans;
        document.getElementById('heroNotesCount').textContent = notes.length;
    }

    /**
     * 渲染时间线
     */
    renderTimeline() {
        const container = document.getElementById('timelineList');
        const countEl = document.getElementById('milestonesCount');

        // 收集全部周报里的里程碑和由上周同步过来的计划，保持时间线连续
        const allData = storage.getAllData();
        const milestoneMap = new Map();

        Object.entries(allData).forEach(([weekId, weekData]) => {
            (weekData.tasks || []).forEach(task => {
                (task.milestones || []).forEach(m => {
                    if (!m.expectedDate) return;

                    const event = {
                        ...m,
                        taskTitle: task.title,
                        taskProjectName: task.projectName || '',
                        taskId: task.id,
                        taskColor: task.color,
                        weekId
                    };
                    const key = `${event.taskProjectName}|${event.title}|${event.expectedDate}|${m.id || ''}`;
                    milestoneMap.set(key, event);
                });

                if (task.isSyncedMilestoneTask && (task.ddl || task.startDate)) {
                    const expectedDate = task.ddl || task.startDate;
                    const event = {
                        id: task.sourceMilestoneId || task.id,
                        title: task.title,
                        expectedDate,
                        status: task.milestoneStatus || (task.progress >= 100 ? 'completed' : 'pending'),
                        taskTitle: task.sourceTaskTitle || task.title,
                        taskProjectName: task.projectName || '',
                        taskId: task.id,
                        taskColor: task.color,
                        sourceWeekId: task.sourceWeekId,
                        weekId,
                        isSyncedMilestoneTask: true
                    };
                    const key = `${event.taskProjectName}|${event.title}|${event.expectedDate}|${event.id || ''}`;
                    if (!milestoneMap.has(key)) {
                        milestoneMap.set(key, event);
                    }
                }
            });
        });

        const allMilestones = Array.from(milestoneMap.values());
        countEl.textContent = allMilestones.length;

        if (allMilestones.length === 0) {
            container.innerHTML = `
                <div class="timeline-empty">
                    <p>暂无里程碑节点，编辑工作项时可添加里程碑</p>
                </div>
            `;
            return;
        }

        // 按日期排序
        allMilestones.sort((a, b) => new Date(a.expectedDate) - new Date(b.expectedDate));

        // 获取日期范围
        const dates = allMilestones.map(m => new Date(m.expectedDate).getTime());
        const currentWeekDates = this.getWeekBoundaryDates(this.currentYear, this.currentWeek);
        const minDate = new Date(Math.min(...dates, currentWeekDates.start.getTime()));
        const maxDate = new Date(Math.max(...dates, currentWeekDates.end.getTime()));

        // 扩展范围
        minDate.setHours(0, 0, 0, 0);
        maxDate.setHours(23, 59, 59, 999);

        const totalDays = Math.ceil((maxDate - minDate) / (1000 * 60 * 60 * 24)) + 1;

        // 计算节点位置
        const minTime = minDate.getTime();
        const timeRange = totalDays * 24 * 60 * 60 * 1000;
        const timelineWidth = Math.max(960, totalDays * 118);
        const currentWeekStartPosition = Math.max(0, Math.min(100, ((currentWeekDates.start.getTime() - minTime) / timeRange) * 100));

        const milestonePositions = allMilestones.map((milestone, index) => {
            const milestoneTime = new Date(milestone.expectedDate).getTime();
            const position = ((milestoneTime - minTime) / timeRange) * 100;
            const leftPercent = Math.max(2, Math.min(98, position));
            return {
                index,
                leftPercent,
                milestone,
                level: 0,
                cardOffset: 0
            };
        });

        // 检测并处理重叠：同一天或相近日期的卡片垂直错层，避免遮挡
        const LEVEL_GAP = 96;
        for (let i = 0; i < milestonePositions.length; i++) {
            const current = milestonePositions[i];
            const usedLevels = new Set();

            for (let j = 0; j < i; j++) {
                const prev = milestonePositions[j];
                const distance = Math.abs(current.leftPercent - prev.leftPercent);

                if (distance < 16) {
                    usedLevels.add(prev.level);
                }
            }

            let level = 0;
            while (usedLevels.has(level)) {
                level++;
            }

            current.level = level;
            current.cardOffset = level * LEVEL_GAP;
        }

        // 轻微横向错位，减少同日多卡片在视觉上压在同一条线上
        milestonePositions.forEach(pos => {
            if (pos.level > 0) {
                const direction = pos.level % 2 === 0 ? 1 : -1;
                const shift = direction * Math.min(5, 2 + pos.level);
                pos.leftPercent = Math.max(2, Math.min(98, pos.leftPercent + shift));
            }
        });

        // 生成日期刻度
        const dateMarks = [];
        const step = totalDays <= 3 ? 1 : Math.ceil(totalDays / 4);
        for (let i = 0; i < totalDays; i += step) {
            const date = new Date(minDate);
            date.setDate(date.getDate() + i);
            const position = totalDays === 1 ? 50 : (i / (totalDays - 1)) * 100;
            dateMarks.push({
                label: `${date.getMonth() + 1}/${date.getDate()}`,
                position: position
            });
        }

        // 计算容器高度
        const maxOffset = Math.max(...milestonePositions.map(p => p.cardOffset));
        const containerHeight = 160 + maxOffset;

        // 渲染时间轴
        container.innerHTML = `
            <div class="timeline-horizontal">
                <div class="timeline-scroll-inner" style="width: ${timelineWidth}px;">
                    <div class="timeline-axis-area">
                        <div class="timeline-nodes" style="height: ${containerHeight}px;">
                            ${milestonePositions.map(pos => {
                                const milestone = pos.milestone;
                                const status = this.getMilestoneStatus(milestone);
                                const projectColor = this.getProjectColor(milestone.taskProjectName);
                                const connectorHeight = 20 + pos.cardOffset;
                                const taskIdArg = JSON.stringify(milestone.taskId);

                                return `
                                    <div class="timeline-node ${status}"
                                         style="left: ${pos.leftPercent}%; --task-color: ${projectColor.primary}; --task-bg: ${projectColor.secondary}; --connector-height: ${connectorHeight}px;"
                                         onclick='app.editItem("task", ${taskIdArg})'
                                         title="${this.escapeHtml(milestone.taskProjectName || milestone.taskTitle)} - ${this.escapeHtml(milestone.title)}">
                                        <div class="timeline-node-card">
                                            ${milestone.taskProjectName ? `<div class="timeline-node-project">${this.escapeHtml(milestone.taskProjectName)}</div>` : ''}
                                            <div class="timeline-node-title">${this.escapeHtml(milestone.title)}</div>
                                            <div class="timeline-node-date">${this.formatDate(milestone.expectedDate)}</div>
                                        </div>
                                        <div class="timeline-node-connector"></div>
                                        <div class="timeline-node-dot"></div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                        <div class="timeline-axis"></div>
                    </div>
                    <div class="timeline-dates">
                        ${dateMarks.map(mark => `
                            <span class="timeline-date-mark" style="left: ${mark.position}%;">${mark.label}</span>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;

        const scroller = container.querySelector('.timeline-horizontal');
        if (scroller) {
            requestAnimationFrame(() => {
                scroller.scrollLeft = Math.max(0, (timelineWidth * currentWeekStartPosition / 100) - 32);
            });
        }
    }

    /**
     * 获取状态标签文本
     */
    getStatusLabel(status) {
        const labels = {
            completed: '已完成',
            in_progress: '进行中',
            pending: '待完成',
            overdue: '已逾期'
        };
        return labels[status] || '待完成';
    }

    /**
     * 获取里程碑状态
     */
    getMilestoneStatus(milestone) {
        if (milestone.status === 'completed') {
            return 'completed'; // 绿色
        }

        if (milestone.status === 'in_progress') {
            return 'in_progress'; // 黄色
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const expectedDate = new Date(milestone.expectedDate);
        expectedDate.setHours(0, 0, 0, 0);

        if (expectedDate < today) {
            return 'overdue'; // 红色（逾期）
        }

        return 'pending'; // 灰色（待完成）
    }

    /**
     * 获取当前周勾选“加入下周计划”的里程碑，仅用于本周的下周计划展示
     */
    getCurrentWeekMilestonePlans() {
        const weekData = storage.getWeekData(this.currentYear, this.currentWeek);
        const plans = [];

        weekData.tasks.forEach(task => {
            (task.milestones || []).forEach(milestone => {
                if (!milestone.addToNextWeek || !milestone.title?.trim()) return;

                plans.push({
                    id: `display-milestone-${task.id}-${milestone.id}`,
                    title: milestone.title,
                    projectName: task.projectName || '',
                    content: `来自本周工作：${task.title}`,
                    color: task.color,
                    progress: milestone.status === 'completed' ? 100 : 0,
                    startDate: milestone.expectedDate || null,
                    endDate: null,
                    ddl: milestone.expectedDate || null,
                    milestones: [],
                    isFromMilestone: true,
                    sourceTaskId: task.id,
                    sourceTaskTitle: task.title,
                    category: task.category || 'ai',
                    priority: task.priority || 'p1',
                    tags: [],
                    milestoneStatus: milestone.status
                });
            });
        });

        return plans;
    }

    /**
     * 渲染任务列表
     */
    renderTasks() {
        const weekData = storage.getWeekData(this.currentYear, this.currentWeek);
        const container = document.getElementById('tasksList');
        const countEl = document.getElementById('tasksCount');

        // 按完成度从高到低排序
        const sortedTasks = [...weekData.tasks].sort((a, b) => {
            const progressA = a.progress !== undefined ? a.progress : 100;
            const progressB = b.progress !== undefined ? b.progress : 100;
            return progressB - progressA; // 从高到低
        });

        countEl.textContent = sortedTasks.length;

        if (sortedTasks.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">
                        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                            <rect x="8" y="8" width="32" height="32" rx="8" stroke="currentColor" stroke-width="2"/>
                            <path d="M18 24l4 4 8-8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </div>
                    <p>本周还没有工作记录</p>
                    <button class="link-btn" onclick="app.openModal('task')">添加第一条工作</button>
                </div>
            `;
            return;
        }

        // 按项目分组
        const projectGroups = {};

        sortedTasks.forEach(task => {
            const projectKey = task.projectName || '__no_project__';
            if (!projectGroups[projectKey]) {
                projectGroups[projectKey] = {
                    name: task.projectName || '未分类',
                    tasks: [],
                    color: this.getProjectColor(task.projectName)
                };
            }
            projectGroups[projectKey].tasks.push(task);
        });

        // 渲染项目分组
        container.innerHTML = Object.entries(projectGroups).map(([key, group]) => `
            <div class="project-group" style="--project-color: ${group.color.primary}; --project-bg: ${group.color.secondary};">
                <div class="project-header">
                    <div class="project-indicator">
                        <div class="project-dot"></div>
                        <h3 class="project-title">${this.escapeHtml(group.name)}</h3>
                    </div>
                    <span class="project-count">${group.tasks.length} 项工作</span>
                </div>
                <div class="project-tasks">
                    ${group.tasks.map(task => this.renderItemCard(task, 'task', group.color)).join('')}
                </div>
            </div>
        `).join('');
    }

    /**
     * 渲染收获列表（下周计划）
     */
    renderHarvests() {
        const weekData = storage.getWeekData(this.currentYear, this.currentWeek);
        const container = document.getElementById('harvestsList');
        const countEl = document.getElementById('harvestsCount');

        // 获取本周未完成的工作（进度<100%）
        const incompleteTasks = weekData.tasks.filter(task => {
            const progress = task.progress !== undefined ? task.progress : 100;
            return progress < 100;
        });
        const nextWeekMilestonePlans = this.getCurrentWeekMilestonePlans();

        // 合并手动添加的下周计划、未完成工作、当前周勾选同步的里程碑计划
        const allPlans = [
            ...weekData.harvests,
            ...incompleteTasks.map(task => ({
                ...task,
                isFromIncomplete: true,
                title: `[未完成] ${task.title}`
            })),
            ...nextWeekMilestonePlans
        ];

        countEl.textContent = allPlans.length;

        if (allPlans.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">
                        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                            <rect x="6" y="10" width="36" height="32" rx="4" stroke="currentColor" stroke-width="2"/>
                            <path d="M6 18h36M14 6v8M34 6v8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        </svg>
                    </div>
                    <p>暂无下周计划</p>
                    <button class="link-btn" onclick="app.openModal('harvest')">添加下周计划</button>
                </div>
            `;
            return;
        }

        // 按项目分组（和本周工作使用相同的颜色系统）
        const projectGroups = {};

        allPlans.forEach(plan => {
            const projectKey = plan.projectName || '__no_project__';
            if (!projectGroups[projectKey]) {
                projectGroups[projectKey] = {
                    name: plan.projectName || '未分类',
                    plans: [],
                    color: this.getProjectColor(plan.projectName)
                };
            }
            projectGroups[projectKey].plans.push(plan);
        });

        // 渲染项目分组
        container.innerHTML = Object.entries(projectGroups).map(([key, group]) => `
            <div class="project-group" style="--project-color: ${group.color.primary}; --project-bg: ${group.color.secondary};">
                <div class="project-header">
                    <div class="project-indicator">
                        <div class="project-dot"></div>
                        <h3 class="project-title">${this.escapeHtml(group.name)}</h3>
                    </div>
                    <span class="project-count">${group.plans.length} 项计划</span>
                </div>
                <div class="project-tasks">
                    ${group.plans.map(plan => this.renderItemCard(plan, 'harvest', group.color)).join('')}
                </div>
            </div>
        `).join('');
    }

    /**
     * 渲染事项卡片
     */
    renderItemCard(item, type, projectColor = null) {
        const categoryLabels = {
            ai: 'AI',
            c_product: 'C端产品'
        };

        const priorityLabels = {
            p0: 'P0',
            p1: 'P1',
            p2: 'P2',
            p3: 'P3'
        };

        // 使用项目颜色或自定义颜色
        const color = projectColor ? projectColor.primary : item.color;

        // 日期和DDL
        const dateHtml = item.endDate
            ? `<span class="item-date">${this.formatDate(item.endDate)}</span>`
            : '';

        const ddlHtml = item.ddl
            ? `<span class="item-ddl">DDL: ${this.formatDate(item.ddl)}</span>`
            : '';

        // 进度
        const progressValue = item.progress !== undefined ? item.progress : 100;
        const itemIdArg = JSON.stringify(item.id);

        // 如果是旧版下周计划里的里程碑项，点击编辑源任务；同步到本周工作后的任务直接编辑自身
        const editAction = item.isFromMilestone && type !== 'task' && item.sourceTaskId
            ? `onclick="app.editItem('task', ${item.sourceTaskId})"`
            : `onclick='app.editItem("${type}", ${itemIdArg})'`;

        // 如果是旧版下周计划里的里程碑项，不显示删除按钮（因为它是自动生成的）
        const deleteBtn = item.isFromMilestone && type !== 'task'
            ? ''
            : `<button class="item-action-btn delete" onclick='app.deleteItem("${type}", ${itemIdArg})' title="删除">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M3 4h10M6 4V3a1 1 0 011-1h2a1 1 0 011 1v1M5 4v9a1 1 0 001 1h4a1 1 0 001-1V4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
               </button>`;

        return `
            <div class="item-card" data-id="${item.id}" style="--item-color: ${color};">
                <div class="item-color-stripe" style="background: ${color};"></div>
                <div class="item-header">
                    <div class="item-title-line">
                        <span class="item-title">${this.escapeHtml(item.title)}</span>
                        <span class="item-tag-item ${item.category}">${categoryLabels[item.category] || 'AI'}</span>
                        <span class="item-tag-item priority ${item.priority}">${priorityLabels[item.priority] || 'P1'}</span>
                    </div>
                    <div class="item-actions">
                        <button class="item-action-btn" ${editAction} title="编辑">
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                <path d="M11.5 2.5l2 2M2 12v2h2l7.5-7.5-2-2L2 12z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </button>
                        ${deleteBtn}
                    </div>
                </div>
                ${item.content ? `<div class="item-content">${this.escapeHtml(item.content)}</div>` : ''}
                ${item.reflection ? `<div class="item-reflection">💡 ${this.escapeHtml(item.reflection)}</div>` : ''}
                <div class="item-footer">
                    <div class="item-dates">
                        ${dateHtml}
                        ${ddlHtml}
                    </div>
                    <div class="item-progress-mini">
                        <div class="progress-bar-mini"><div class="progress-fill-mini" style="width: ${progressValue}%"></div></div>
                        <span>${progressValue}%</span>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * 渲染笔记列表
     */
    renderNotes() {
        const notes = storage.getWeekNotes(this.currentYear, this.currentWeek);
        const container = document.getElementById('notesList');

        if (notes.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">
                        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                            <path d="M12 8h24a4 4 0 014 4v24a4 4 0 01-4 4H12a4 4 0 01-4-4V12a4 4 0 014-4z" stroke="currentColor" stroke-width="2"/>
                            <path d="M16 20h16M16 28h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        </svg>
                    </div>
                    <p>暂无笔记文件或链接</p>
                    <button class="link-btn" onclick="document.getElementById('noteInput').click()">上传第一个笔记</button>
                </div>
            `;
            return;
        }

        container.innerHTML = notes.map(note => {
            const iconClass = this.getFileIconClass(note.type);
            const isLink = note.kind === 'link' || note.type === 'link';
            return `
                <div class="note-card" onclick='app.downloadNote(${JSON.stringify(note).replace(/'/g, "\\'")})'>
                    <div class="note-icon ${iconClass}">
                        ${isLink
                            ? `<svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                                <path d="M10 7l2-2a4 4 0 015.657 5.657L15 13.314M14 17l-2 2a4 4 0 01-5.657-5.657L9 10.686" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                              </svg>`
                            : `<svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                                <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z" stroke="currentColor" stroke-width="1.5"/>
                                <path d="M13 2v7h7" stroke="currentColor" stroke-width="1.5"/>
                              </svg>`}
                    </div>
                    <div class="note-name">${this.escapeHtml(note.name)}</div>
                    <div class="note-size">${isLink ? '链接' : this.formatFileSize(note.size)}</div>
                    <div class="note-actions" onclick="event.stopPropagation()">
                        <button class="item-action-btn" onclick="app.downloadNote(${JSON.stringify(note).replace(/'/g, "\\'")})" title="下载">
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                ${isLink
                                    ? `<path d="M6 5l1.5-1.5a3 3 0 014.25 4.25L10 9.5M10 11l-1.5 1.5a3 3 0 01-4.25-4.25L6 6.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>`
                                    : `<path d="M8 11V3M5 8l3 3 3-3M3 13h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`}
                            </svg>
                        </button>
                        <button class="item-action-btn delete" onclick="app.deleteNote(${note.id})" title="删除">
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                <path d="M3 4h10M6 4V3a1 1 0 011-1h2a1 1 0 011 1v1M5 4v9a1 1 0 001 1h4a1 1 0 001-1V4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * 获取文件图标类
     */
    getFileIconClass(type) {
        if (type === 'link') return 'link';
        if (type.includes('pdf')) return 'pdf';
        if (type.includes('word') || type.includes('document')) return 'doc';
        if (type.includes('image')) return 'image';
        return 'text';
    }

    /**
     * 显示心得输入框
     */
    showThoughtsInput() {
        const inputArea = document.getElementById('thoughtsInputArea');
        inputArea.style.display = 'block';
        document.getElementById('weekThoughts').focus();
    }

    /**
     * 隐藏心得输入框
     */
    hideThoughtsInput() {
        const inputArea = document.getElementById('thoughtsInputArea');
        inputArea.style.display = 'none';
    }

    /**
     * 渲染心得体会
     */
    renderThoughts() {
        const weekData = storage.getWeekData(this.currentYear, this.currentWeek);
        const container = document.getElementById('thoughtsList');
        const textarea = document.getElementById('weekThoughts');

        // 加载本周心得
        const weekThoughts = storage.getThoughts(this.currentYear, this.currentWeek);
        textarea.value = weekThoughts;

        // 从工作项的“心得体会”字段中提取内容，不再从计划或普通工作内容里自动提取
        const taskThoughts = [];
        weekData.tasks.forEach(task => {
            if (task.reflection) {
                taskThoughts.push({
                    title: task.title,
                    content: task.reflection,
                    projectName: task.projectName || ''
                });
            }
        });

        // 如果没有本周心得和任务心得
        if (!weekThoughts && taskThoughts.length === 0) {
            container.innerHTML = `
                <div class="empty-state compact">
                    <p>暂无心得体会</p>
                </div>
            `;
            return;
        }

        // 构建心得列表HTML
        let thoughtsHtml = '';

        // 显示本周心得（如果有）
        if (weekThoughts) {
            thoughtsHtml += `
                <div class="thought-item week-thought">
                    <div class="thought-item-header">
                        <div class="thought-badge">本周心得</div>
                        <button class="thought-delete-btn" onclick="app.deleteThoughts()" title="删除">
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                <path d="M3 4h10M6 4V3a1 1 0 011-1h2a1 1 0 011 1v1M5 4v9a1 1 0 001 1h4a1 1 0 001-1V4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </button>
                    </div>
                    <div class="thought-content">${this.escapeHtml(weekThoughts)}</div>
                </div>
            `;
        }

        // 显示从任务提取的心得（如果有）
        if (taskThoughts.length > 0) {
            thoughtsHtml += taskThoughts.map(thought => `
                <div class="thought-item task-thought">
                    <div class="thought-header">
                        ${thought.projectName ? `<span class="thought-project">${this.escapeHtml(thought.projectName)}</span>` : ''}
                        <strong class="thought-title">${this.escapeHtml(thought.title)}</strong>
                    </div>
                    <div class="thought-content">${this.escapeHtml(thought.content)}</div>
                </div>
            `).join('');
        }

        container.innerHTML = thoughtsHtml;
    }

    /**
     * 保存本周心得
     */
    saveThoughts() {
        const textarea = document.getElementById('weekThoughts');
        const thoughts = textarea.value.trim();

        if (!thoughts) {
            this.showToast('请输入心得体会', 'error');
            textarea.focus();
            return;
        }

        storage.saveThoughts(this.currentYear, this.currentWeek, thoughts);
        this.showToast('心得已保存');
        this.hideThoughtsInput();
        this.renderThoughts();
    }

    /**
     * 删除本周心得
     */
    deleteThoughts() {
        if (confirm('确定要删除本周心得吗？')) {
            storage.saveThoughts(this.currentYear, this.currentWeek, '');
            this.showToast('心得已删除');
            this.renderThoughts();
        }
    }

    /**
     * 渲染评论列表
     */
    renderComments() {
        const comments = storage.getWeekComments(this.currentYear, this.currentWeek);
        const container = document.getElementById('commentsList');
        const countEl = document.getElementById('commentsCount');

        countEl.textContent = comments.length;

        if (comments.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">
                        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                            <path d="M8 12h32a4 4 0 014 4v16a4 4 0 01-4 4h-8l-8 8-8-8H8a4 4 0 01-4-4V16a4 4 0 014-4z" stroke="currentColor" stroke-width="2"/>
                            <path d="M12 22h24M12 30h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        </svg>
                    </div>
                    <p>还没有人评论，来发表你的看法吧</p>
                </div>
            `;
            return;
        }

        container.innerHTML = comments.map(comment => {
            const avatar = comment.author.charAt(0).toUpperCase();
            const repliesHtml = comment.replies && comment.replies.length > 0
                ? `<div class="replies-section">
                    ${comment.replies.map(reply => {
                        const replyAvatar = reply.author.charAt(0).toUpperCase();
                        return `
                            <div class="reply-item">
                                <div class="reply-header">
                                    <div class="reply-author">
                                        <div class="reply-avatar">${replyAvatar}</div>
                                        <span class="reply-name">${this.escapeHtml(reply.author)}</span>
                                    </div>
                                    <span class="reply-date">${this.formatDateTime(reply.createdAt)}</span>
                                </div>
                                <div class="reply-content">${this.escapeHtml(reply.content)}</div>
                            </div>
                        `;
                    }).join('')}
                   </div>`
                : '';

            return `
                <div class="comment-card">
                    <div class="comment-header">
                        <div class="comment-author">
                            <div class="comment-avatar">${avatar}</div>
                            <div>
                                <div class="comment-name">${this.escapeHtml(comment.author)}</div>
                                <div class="comment-date">${this.formatDateTime(comment.createdAt)}</div>
                            </div>
                        </div>
                        <div class="comment-actions">
                            <button class="comment-action-btn delete" onclick="app.deleteComment(${comment.id})" title="删除">
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                    <path d="M3 4h10M6 4V3a1 1 0 011-1h2a1 1 0 011 1v1M5 4v9a1 1 0 001 1h4a1 1 0 001-1V4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                    <div class="comment-content">${this.escapeHtml(comment.content)}</div>
                    ${repliesHtml}
                    <div class="reply-input-area">
                        <input type="text" placeholder="写下你的回复..." id="reply-${comment.id}" maxlength="300">
                        <button onclick="app.submitReply(${comment.id}, document.getElementById('reply-${comment.id}'))">回复</button>
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * 渲染历史周报
     */
    renderHistory() {
        const history = storage.getHistoryWeeks();
        const container = document.getElementById('historyTimeline');

        if (history.length === 0) {
            container.innerHTML = `
                <div class="empty-state large">
                    <div class="empty-icon">
                        <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                            <circle cx="32" cy="32" r="24" stroke="currentColor" stroke-width="2"/>
                            <path d="M32 18v18l10 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </div>
                    <h3>还没有历史周报</h3>
                    <p>开始记录你的第一周周报吧</p>
                </div>
            `;
            return;
        }

        container.innerHTML = history.map(week => `
            <div class="timeline-item" onclick="app.jumpToWeek(${week.year}, ${week.weekNum})">
                <div class="timeline-info">
                    <div class="timeline-week">${week.year}年第${week.weekNum}周</div>
                    <div class="timeline-dates">${week.dateRange.start} - ${week.dateRange.end}</div>
                </div>
                <div class="timeline-stats">
                    <div class="timeline-stat">
                        <div class="timeline-stat-value">${week.tasksCount}</div>
                        <div class="timeline-stat-label">工作</div>
                    </div>
                    <div class="timeline-stat">
                        <div class="timeline-stat-value">${week.harvestsCount}</div>
                        <div class="timeline-stat-label">收获</div>
                    </div>
                </div>
            </div>
        `).join('');
    }

    /**
     * 跳转到指定周
     */
    jumpToWeek(year, week) {
        this.currentYear = year;
        this.currentWeek = week;
        this.switchView('current');
        this.render();
    }

    /**
     * 渲染统计数据
     */
    renderStats() {
        const stats = storage.getOverallStats();
        const totalNotes = storage.getTotalNotes();
        const commentStats = storage.getCommentStats();

        document.getElementById('statWeeks').textContent = stats.totalWeeks;
        document.getElementById('statTasks').textContent = stats.totalTasks;
        document.getElementById('statHarvests').textContent = stats.totalHarvests;
        document.getElementById('statNotes').textContent = totalNotes;
        document.getElementById('statComments').textContent = commentStats.totalComments;

        // 渲染趋势图
        this.renderTrendChart();
        this.renderCommentSummary(commentStats);
    }

    /**
     * 渲染评论统计总结
     */
    renderCommentSummary(commentStats) {
        const container = document.getElementById('commentSummary');
        const latest = commentStats.latestComment;

        container.innerHTML = `
            <div class="comment-summary-item">
                <span>回复数</span>
                <strong>${commentStats.totalReplies}</strong>
            </div>
            <div class="comment-summary-item">
                <span>参与者</span>
                <strong>${commentStats.totalParticipants}</strong>
            </div>
            <div class="comment-summary-item wide">
                <span>最新评论</span>
                <strong>${latest ? this.escapeHtml(latest.author) : '暂无'}</strong>
                <p>${latest ? this.escapeHtml(latest.content) : '还没有收到评论'}</p>
            </div>
        `;
    }

    /**
     * 渲染趋势图
     */
    renderTrendChart() {
        const trendData = storage.getTrendData();
        const container = document.getElementById('trendChart');

        if (trendData.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>暂无数据</p></div>';
            return;
        }

        const maxValue = Math.max(...trendData.map(d => d.tasksCount + d.harvestsCount), 1);

        container.innerHTML = `
            <div style="display: flex; gap: 8px; height: 100%; align-items: flex-end;">
                ${trendData.map(d => {
                    const height = ((d.tasksCount + d.harvestsCount) / maxValue) * 160;
                    return `
                        <div style="flex: 1; text-align: center;">
                            <div class="chart-bar ${d.tasksCount + d.harvestsCount > 0 ? 'has-data' : ''}"
                                 style="height: ${Math.max(height, 20)}px;"
                                 title="工作: ${d.tasksCount}, 收获: ${d.harvestsCount}">
                            </div>
                            <div class="chart-label">W${d.weekNum}</div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    /**
     * 格式化日期
     */
    formatDate(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        return `${date.getMonth() + 1}月${date.getDate()}日`;
    }

    /**
     * 格式化日期时间
     */
    formatDateTime(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${month}月${day}日 ${hours}:${minutes}`;
    }

    /**
     * 格式化文件大小
     */
    formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    /**
     * 规范化链接
     */
    normalizeUrl(url) {
        if (!/^https?:\/\//i.test(url)) {
            return `https://${url}`;
        }
        return url;
    }

    /**
     * 判断是否为有效链接
     */
    isValidUrl(url) {
        try {
            const parsed = new URL(url);
            return parsed.protocol === 'http:' || parsed.protocol === 'https:';
        } catch (e) {
            return false;
        }
    }

    /**
     * 编码分享数据
     */
    encodeSharePayload(text) {
        const bytes = new TextEncoder().encode(text);
        let binary = '';
        bytes.forEach(byte => {
            binary += String.fromCharCode(byte);
        });

        return btoa(binary)
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/g, '');
    }

    /**
     * 解码分享数据
     */
    decodeSharePayload(payload) {
        const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
        const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
        const binary = atob(padded);
        const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
        return new TextDecoder().decode(bytes);
    }

    /**
     * 复制文本
     */
    async copyText(text) {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
            return;
        }

        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        textarea.remove();
    }

    /**
     * HTML转义
     */
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// 初始化应用
const app = new WeeklyReportApp();
