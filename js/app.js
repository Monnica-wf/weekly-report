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
        this.currentView = 'current';

        this.init();
    }

    /**
     * 初始化应用
     */
    init() {
        this.importShareFromUrl();
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
        if (!match) return;

        try {
            const json = this.decodeSharePayload(match[1]);
            storage.importShareData(JSON.parse(json));
            history.replaceState(null, '', window.location.pathname + window.location.search);
            this.showToast('已载入分享数据');
        } catch (e) {
            console.error('导入分享数据失败:', e);
            this.showToast('分享链接无效', 'error');
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

        const modal = document.getElementById('modalOverlay');
        const title = document.getElementById('modalTitle');

        title.textContent = item
            ? (type === 'task' ? '编辑本周工作' : '编辑下周计划')
            : (type === 'task' ? '添加本周工作' : '添加下周计划');

        // 填充表单
        document.getElementById('itemTitle').value = item?.title || '';
        document.getElementById('itemContent').value = item?.content || '';
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

        modal.classList.add('active');
        document.getElementById('itemTitle').focus();
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
     * 保存事项
     */
    saveItem() {
        const title = document.getElementById('itemTitle').value.trim();
        const content = document.getElementById('itemContent').value.trim();
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
            title,
            content,
            category,
            priority,
            tags: [...this.currentTags],
            color,
            progress,
            startDate: startDate || null,
            endDate: endDate || null,
            ddl: ddl || null
        };

        if (this.editingItem) {
            storage.updateItem(this.currentYear, this.currentWeek, this.editingType, this.editingItem.id, itemData);
            this.showToast('更新成功');
        } else {
            storage.addItem(this.currentYear, this.currentWeek, this.editingType, itemData);
            this.showToast('添加成功');
        }

        this.closeModal();
        this.render();
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
    editItem(type, item) {
        this.openModal(type, item);
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

        document.getElementById('heroTasksCount').textContent = weekData.tasks.length;
        document.getElementById('heroPlansCount').textContent = weekData.harvests.length + incompleteTasks.length;
        document.getElementById('heroNotesCount').textContent = notes.length;
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

        container.innerHTML = sortedTasks.map(task => this.renderItemCard(task, 'task')).join('');
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

        // 合并手动添加的下周计划和未完成工作
        const allPlans = [...weekData.harvests, ...incompleteTasks.map(task => ({
            ...task,
            isFromIncomplete: true,
            title: `[未完成] ${task.title}`
        }))];

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

        container.innerHTML = allPlans.map(plan => this.renderItemCard(plan, 'harvest')).join('');
    }

    /**
     * 渲染事项卡片
     */
    renderItemCard(item, type) {
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

        const tagsHtml = item.tags && item.tags.length > 0
            ? `<div class="item-tags">${item.tags.map(tag => `<span class="item-tag">${this.escapeHtml(tag)}</span>`).join('')}</div>`
            : '';

        // 始终显示进度条（独立成行）
        const progressValue = item.progress !== undefined ? item.progress : 100;
        const progressHtml = `
            <div class="item-progress">
                <div class="progress-bar"><div class="progress-fill" style="width: ${progressValue}%"></div></div>
                <span class="progress-text">${progressValue}%</span>
            </div>
        `;

        const dateHtml = item.endDate
            ? `<span class="item-date"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="2" width="12" height="11" rx="2" stroke="currentColor" stroke-width="1.2"/><path d="M1 5h12M4 1v3M10 1v3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>${this.formatDate(item.endDate)}</span>`
            : '';

        // DDL 显示
        const ddlHtml = item.ddl
            ? `<span class="item-ddl"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1.2"/><path d="M7 4v3l2 1" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>DDL: ${this.formatDate(item.ddl)}</span>`
            : '';

        return `
            <div class="item-card" data-id="${item.id}">
                <div class="item-header">
                    <div class="item-title-wrapper">
                        <div class="item-color-dot" style="background: ${item.color}"></div>
                        <span class="item-title">${this.escapeHtml(item.title)}</span>
                    </div>
                    <div class="item-actions">
                        <button class="item-action-btn" onclick="app.editItem('${type}', ${JSON.stringify(item).replace(/'/g, "\\'")})" title="编辑">
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                <path d="M11.5 2.5l2 2M2 12v2h2l7.5-7.5-2-2L2 12z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </button>
                        <button class="item-action-btn delete" onclick="app.deleteItem('${type}', ${item.id})" title="删除">
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                <path d="M3 4h10M6 4V3a1 1 0 011-1h2a1 1 0 011 1v1M5 4v9a1 1 0 001 1h4a1 1 0 001-1V4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </button>
                    </div>
                </div>
                ${item.content ? `<div class="item-content">${this.escapeHtml(item.content)}</div>` : ''}
                <div class="item-meta">
                    <span class="item-category ${item.category}">${categoryLabels[item.category] || 'AI'}</span>
                    <span class="item-priority ${item.priority}">${priorityLabels[item.priority] || 'P1'}</span>
                    ${tagsHtml}
                    ${dateHtml}
                    ${ddlHtml}
                </div>
                ${progressHtml}
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
     * 渲染心得体会
     */
    renderThoughts() {
        const weekData = storage.getWeekData(this.currentYear, this.currentWeek);
        const container = document.getElementById('thoughtsList');

        // 从任务中提取包含"心得"、"体会"、"感悟"等关键词的内容
        const thoughts = [];
        weekData.tasks.forEach(task => {
            if (task.content && (
                task.content.includes('心得') ||
                task.content.includes('体会') ||
                task.content.includes('感悟') ||
                task.content.includes('总结') ||
                task.content.includes('经验')
            )) {
                thoughts.push({
                    title: task.title,
                    content: task.content
                });
            }
        });

        // 也从收获中提取
        weekData.harvests.forEach(harvest => {
            if (harvest.content) {
                thoughts.push({
                    title: harvest.title,
                    content: harvest.content
                });
            }
        });

        if (thoughts.length === 0) {
            container.innerHTML = `
                <div class="empty-state compact">
                    <p>暂无心得体会</p>
                </div>
            `;
            return;
        }

        container.innerHTML = thoughts.map(thought => `
            <div class="thought-item">
                <strong>${this.escapeHtml(thought.title)}</strong>
                ${thought.content ? `<br>${this.escapeHtml(thought.content)}` : ''}
            </div>
        `).join('');
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
