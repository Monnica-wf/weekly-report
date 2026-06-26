/**
 * 本地存储管理模块 - Apple 风格周报系统
 */

class StorageManager {
    constructor() {
        this.STORAGE_KEY = 'apple_weekly_report_v2';
        this.NOTES_KEY = 'apple_weekly_notes_v2';
        this.COMMENTS_KEY = 'apple_weekly_comments_v2';
        this.SHARE_VERSION = 1;
    }

    /**
     * 获取周数
     */
    getWeekNumber(date = new Date()) {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    }

    /**
     * 获取周的日期范围
     */
    getWeekDateRange(weekNum, year) {
        const firstDayOfYear = new Date(year, 0, 1);
        const daysOffset = (weekNum - 1) * 7;
        const firstDayOfWeek = new Date(firstDayOfYear);
        firstDayOfWeek.setDate(firstDayOfYear.getDate() + daysOffset);

        const lastDayOfWeek = new Date(firstDayOfWeek);
        lastDayOfWeek.setDate(firstDayOfWeek.getDate() + 6);

        const formatDate = (d) => `${d.getMonth() + 1}月${d.getDate()}日`;

        return {
            start: formatDate(firstDayOfWeek),
            end: formatDate(lastDayOfWeek)
        };
    }

    /**
     * 获取周标识符
     */
    getWeekId(year, week) {
        return `${year}-W${String(week).padStart(2, '0')}`;
    }

    /**
     * 获取所有数据
     */
    getAllData() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            return data ? JSON.parse(data) : {};
        } catch (e) {
            console.error('读取数据失败:', e);
            return {};
        }
    }

    /**
     * 导出可分享数据
     */
    exportShareData() {
        const notes = this.getAllNotes();
        const safeNotes = {};

        for (const weekId in notes) {
            safeNotes[weekId] = notes[weekId].map(note => {
                const isLink = note.kind === 'link' || note.type === 'link';
                return {
                    id: note.id,
                    name: note.name,
                    size: note.size || 0,
                    type: note.type || (isLink ? 'link' : 'file'),
                    kind: isLink ? 'link' : 'file',
                    url: isLink ? (note.url || note.content || '') : null,
                    uploadedAt: note.uploadedAt
                };
            });
        }

        return {
            version: this.SHARE_VERSION,
            exportedAt: new Date().toISOString(),
            reports: this.getAllData(),
            notes: safeNotes,
            comments: this.getAllComments()
        };
    }

    /**
     * 导入分享数据
     */
    importShareData(shareData) {
        if (!shareData || typeof shareData !== 'object') {
            throw new Error('分享数据无效');
        }

        this.saveAllData(shareData.reports || {});
        localStorage.setItem(this.NOTES_KEY, JSON.stringify(shareData.notes || {}));
        localStorage.setItem(this.COMMENTS_KEY, JSON.stringify(shareData.comments || {}));
    }

    /**
     * 保存所有数据
     */
    saveAllData(data) {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
        } catch (e) {
            console.error('保存数据失败:', e);
        }
    }

    /**
     * 获取指定周的数据
     */
    getWeekData(year, week) {
        const weekId = this.getWeekId(year, week);
        const allData = this.getAllData();
        return allData[weekId] || {
            tasks: [],
            harvests: [],
            notes: [],
            thoughts: ''
        };
    }

    /**
     * 保存周数据
     */
    saveWeekData(year, week, data) {
        const weekId = this.getWeekId(year, week);
        const allData = this.getAllData();
        allData[weekId] = data;
        this.saveAllData(allData);
    }

    /**
     * 保存本周心得
     */
    saveThoughts(year, week, thoughts) {
        const weekData = this.getWeekData(year, week);
        weekData.thoughts = thoughts;
        this.saveWeekData(year, week, weekData);
    }

    /**
     * 获取本周心得
     */
    getThoughts(year, week) {
        const weekData = this.getWeekData(year, week);
        return weekData.thoughts || '';
    }

    /**
     * 保存指定周的数据
     */
    saveWeekData(year, week, weekData) {
        const weekId = this.getWeekId(year, week);
        const allData = this.getAllData();
        allData[weekId] = weekData;
        this.saveAllData(allData);
    }

    /**
     * 添加事项
     */
    addItem(year, week, type, item) {
        const weekData = this.getWeekData(year, week);
        const newItem = {
            id: Date.now() + Math.random(),
            title: item.title,
            projectName: item.projectName || '',
            content: item.content || '',
            reflection: item.reflection || '',
            category: item.category || 'ai',
            priority: item.priority || 'p1',
            tags: item.tags || [],
            color: item.color || '#0A84FF',
            progress: item.progress !== undefined ? item.progress : 100,
            startDate: item.startDate || null,
            endDate: item.endDate || null,
            ddl: item.ddl || null,
            milestones: item.milestones || [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        if (type === 'task') {
            weekData.tasks.push(newItem);
        } else if (type === 'harvest') {
            weekData.harvests.push(newItem);
        }

        this.saveWeekData(year, week, weekData);
        return newItem;
    }

    /**
     * 更新事项
     */
    updateItem(year, week, type, itemId, updates) {
        const weekData = this.getWeekData(year, week);
        const items = type === 'task' ? weekData.tasks : weekData.harvests;
        const index = items.findIndex(item => item.id === itemId);

        if (index !== -1) {
            items[index] = {
                ...items[index],
                ...updates,
                updatedAt: new Date().toISOString()
            };
            this.saveWeekData(year, week, weekData);
            return items[index];
        }
        return null;
    }

    /**
     * 删除事项
     */
    deleteItem(year, week, type, itemId) {
        const weekData = this.getWeekData(year, week);
        if (type === 'task') {
            weekData.tasks = weekData.tasks.filter(item => item.id !== itemId);
        } else if (type === 'harvest') {
            weekData.harvests = weekData.harvests.filter(item => item.id !== itemId);
        }
        this.saveWeekData(year, week, weekData);
    }

    /**
     * 获取总体统计
     */
    getOverallStats() {
        const allData = this.getAllData();
        let totalWeeks = 0;
        let totalTasks = 0;
        let totalHarvests = 0;

        for (const weekId in allData) {
            const week = allData[weekId];
            if (week.tasks.length > 0 || week.harvests.length > 0) {
                totalWeeks++;
                totalTasks += week.tasks.length;
                totalHarvests += week.harvests.length;
            }
        }

        return { totalWeeks, totalTasks, totalHarvests };
    }

    /**
     * 获取历史周报列表
     */
    getHistoryWeeks() {
        const allData = this.getAllData();
        const history = [];

        for (const weekId in allData) {
            const week = allData[weekId];
            if (week.tasks.length > 0 || week.harvests.length > 0) {
                const match = weekId.match(/(\d{4})-W(\d{2})/);
                if (match) {
                    const year = parseInt(match[1]);
                    const weekNum = parseInt(match[2]);
                    const dateRange = this.getWeekDateRange(weekNum, year);

                    history.push({
                        weekId,
                        year,
                        weekNum,
                        dateRange,
                        tasksCount: week.tasks.length,
                        harvestsCount: week.harvests.length
                    });
                }
            }
        }

        // 按时间倒序排列
        history.sort((a, b) => {
            if (a.year !== b.year) return b.year - a.year;
            return b.weekNum - a.weekNum;
        });

        return history;
    }

    /**
     * 获取趋势数据（最近12周）
     */
    getTrendData() {
        const history = this.getHistoryWeeks();
        return history.slice(0, 12).reverse();
    }

    /**
     * 保存笔记文件信息
     */
    saveNote(year, week, noteData) {
        const allNotes = this.getAllNotes();
        const weekId = this.getWeekId(year, week);

        if (!allNotes[weekId]) {
            allNotes[weekId] = [];
        }

        const note = {
            id: Date.now() + Math.random(),
            name: noteData.name,
            size: noteData.size || 0,
            type: noteData.type || 'link',
            content: noteData.content || '',
            url: noteData.url || null,
            kind: noteData.kind || 'file',
            uploadedAt: new Date().toISOString()
        };

        allNotes[weekId].push(note);
        localStorage.setItem(this.NOTES_KEY, JSON.stringify(allNotes));
        return note;
    }

    /**
     * 获取所有笔记
     */
    getAllNotes() {
        try {
            const notes = localStorage.getItem(this.NOTES_KEY);
            return notes ? JSON.parse(notes) : {};
        } catch (e) {
            return {};
        }
    }

    /**
     * 获取指定周的笔记
     */
    getWeekNotes(year, week) {
        const weekId = this.getWeekId(year, week);
        const allNotes = this.getAllNotes();
        return allNotes[weekId] || [];
    }

    /**
     * 删除笔记
     */
    deleteNote(year, week, noteId) {
        const weekId = this.getWeekId(year, week);
        const allNotes = this.getAllNotes();

        if (allNotes[weekId]) {
            allNotes[weekId] = allNotes[weekId].filter(note => note.id !== noteId);
            localStorage.setItem(this.NOTES_KEY, JSON.stringify(allNotes));
        }
    }

    /**
     * 获取笔记总数
     */
    getTotalNotes() {
        const allNotes = this.getAllNotes();
        let total = 0;
        for (const weekId in allNotes) {
            total += allNotes[weekId].length;
        }
        return total;
    }

    /**
     * 评论相关方法
     */

    /**
     * 获取所有评论
     */
    getAllComments() {
        try {
            const comments = localStorage.getItem(this.COMMENTS_KEY);
            return comments ? JSON.parse(comments) : {};
        } catch (e) {
            console.error('读取评论失败:', e);
            return {};
        }
    }

    /**
     * 获取指定周的评论
     */
    getWeekComments(year, week) {
        const weekId = this.getWeekId(year, week);
        const allComments = this.getAllComments();
        return allComments[weekId] || [];
    }

    /**
     * 添加评论
     */
    addComment(year, week, comment) {
        const allComments = this.getAllComments();
        const weekId = this.getWeekId(year, week);

        if (!allComments[weekId]) {
            allComments[weekId] = [];
        }

        const newComment = {
            id: Date.now() + Math.random(),
            author: comment.author || '匿名用户',
            content: comment.content,
            createdAt: new Date().toISOString(),
            replies: []
        };

        allComments[weekId].push(newComment);
        localStorage.setItem(this.COMMENTS_KEY, JSON.stringify(allComments));
        return newComment;
    }

    /**
     * 回复评论
     */
    replyToComment(year, week, commentId, reply) {
        const allComments = this.getAllComments();
        const weekId = this.getWeekId(year, week);

        if (allComments[weekId]) {
            const comment = allComments[weekId].find(c => c.id === commentId);
            if (comment) {
                comment.replies.push({
                    id: Date.now() + Math.random(),
                    author: reply.author || '匿名用户',
                    content: reply.content,
                    createdAt: new Date().toISOString()
                });
                localStorage.setItem(this.COMMENTS_KEY, JSON.stringify(allComments));
                return comment;
            }
        }
        return null;
    }

    /**
     * 删除评论
     */
    deleteComment(year, week, commentId) {
        const allComments = this.getAllComments();
        const weekId = this.getWeekId(year, week);

        if (allComments[weekId]) {
            allComments[weekId] = allComments[weekId].filter(c => c.id !== commentId);
            localStorage.setItem(this.COMMENTS_KEY, JSON.stringify(allComments));
        }
    }

    /**
     * 获取评论总数
     */
    getTotalComments() {
        const allComments = this.getAllComments();
        let total = 0;
        for (const weekId in allComments) {
            total += allComments[weekId].length;
        }
        return total;
    }

    /**
     * 获取评论统计汇总
     */
    getCommentStats() {
        const allComments = this.getAllComments();
        let totalComments = 0;
        let totalReplies = 0;
        let latestComment = null;
        const authors = new Set();

        for (const weekId in allComments) {
            allComments[weekId].forEach(comment => {
                totalComments++;
                authors.add(comment.author || '匿名用户');
                if (!latestComment || new Date(comment.createdAt) > new Date(latestComment.createdAt)) {
                    latestComment = comment;
                }

                const replies = comment.replies || [];
                totalReplies += replies.length;
                replies.forEach(reply => authors.add(reply.author || '匿名用户'));
            });
        }

        return {
            totalComments,
            totalReplies,
            totalParticipants: authors.size,
            latestComment
        };
    }
}

// 创建全局实例
const storage = new StorageManager();
