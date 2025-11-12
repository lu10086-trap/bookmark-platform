// 等待Supabase可用的函数
function getSupabase() {
    if (typeof window.supabase === 'undefined') {
        throw new Error('Supabase未初始化，请刷新页面重试');
    }
    return window.supabase;
}

// 书签管理功能
class BookmarkManager {
    constructor() {
        this.currentCategory = 'all';
        this.searchTerm = '';
        this.bookmarks = [];
        this.isSubmitting = false;
    }

    // 等待Supabase就绪
    async waitForSupabase() {
        return new Promise((resolve) => {
            const check = () => {
                if (window.supabase) {
                    resolve();
                } else {
                    setTimeout(check, 100);
                }
            };
            check();
        });
    }

    // 获取公开书签
    async getPublicBookmarks() {
        try {
            await this.waitForSupabase();
            const supabase = getSupabase();
            
            const { data, error } = await supabase
                .from('bookmarks')
                .select(`
                    *,
                    profiles:user_id (username),
                    favorites!left (id)
                `)
                .eq('is_public', true)
                .order('created_at', { ascending: false });

            if (error) throw error;

            this.bookmarks = data || [];
            return this.bookmarks;
        } catch (error) {
            console.error('获取书签错误:', error);
            return [];
        }
    }

    // 获取用户的书签
    async getUserBookmarks(userId) {
        try {
            await this.waitForSupabase();
            const supabase = getSupabase();
            
            const { data, error } = await supabase
                .from('bookmarks')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('获取用户书签错误:', error);
            return [];
        }
    }

    // 获取用户的收藏
    async getUserFavorites(userId) {
        try {
            await this.waitForSupabase();
            const supabase = getSupabase();
            
            const { data, error } = await supabase
                .from('favorites')
                .select(`
                    bookmarks (
                        *,
                        profiles:user_id (username)
                    )
                `)
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (error) throw error;

            // 提取书签数据并过滤掉null值
            return data ? data.map(item => item.bookmarks).filter(bookmark => bookmark !== null) : [];
        } catch (error) {
            console.error('获取收藏错误:', error);
            return [];
        }
    }

    // 添加书签
    async addBookmark(bookmarkData) {
        if (this.isSubmitting) {
            throw new Error('请勿重复提交，正在处理中...');
        }
        
        this.isSubmitting = true;
        
        try {
            await this.waitForSupabase();
            const supabase = getSupabase();
            
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('请先登录');

            const { data, error } = await supabase
                .from('bookmarks')
                .insert([{
                    ...bookmarkData,
                    user_id: user.id
                }])
                .select()
                .single();

            if (error) throw error;
            
            // 成功添加后，重新加载书签列表
            if (window.location.pathname.endsWith('index.html') || window.location.pathname === '/') {
                this.loadPublicBookmarks();
            }
            
            return data;
        } catch (error) {
            console.error('添加书签错误:', error);
            throw error;
        } finally {
            this.isSubmitting = false;
        }
    }

    // 更新书签
    async updateBookmark(bookmarkId, updates) {
        try {
            await this.waitForSupabase();
            const supabase = getSupabase();
            
            const { data, error } = await supabase
                .from('bookmarks')
                .update(updates)
                .eq('id', bookmarkId)
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('更新书签错误:', error);
            throw error;
        }
    }

    // 删除书签
    async deleteBookmark(bookmarkId) {
        try {
            await this.waitForSupabase();
            const supabase = getSupabase();
            
            const { error } = await supabase
                .from('bookmarks')
                .delete()
                .eq('id', bookmarkId);

            if (error) throw error;
            return true;
        } catch (error) {
            console.error('删除书签错误:', error);
            throw error;
        }
    }

    // 添加/取消收藏
    async toggleFavorite(bookmarkId) {
        try {
            await this.waitForSupabase();
            const supabase = getSupabase();
            
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('请先登录');

            // 检查是否已经收藏
            const { data: existing } = await supabase
                .from('favorites')
                .select('id')
                .eq('user_id', user.id)
                .eq('bookmark_id', bookmarkId)
                .single();

            if (existing) {
                // 取消收藏
                const { error } = await supabase
                    .from('favorites')
                    .delete()
                    .eq('id', existing.id);
                
                if (error) throw error;
                return false;
            } else {
                // 添加收藏
                const { error } = await supabase
                    .from('favorites')
                    .insert([{
                        user_id: user.id,
                        bookmark_id: bookmarkId
                    }]);
                
                if (error) throw error;
                return true;
            }
        } catch (error) {
            console.error('收藏操作错误:', error);
            throw error;
        }
    }

    // 渲染书签卡片
    renderBookmarkCard(bookmark, options = {}) {
        const isFavorited = bookmark.favorites && bookmark.favorites.length > 0;
        const tags = bookmark.tags ? bookmark.tags.join(', ') : '';
        
        // 安全处理URL
        let urlHostname = '';
        try {
            urlHostname = new URL(bookmark.url).hostname;
        } catch (e) {
            urlHostname = '无效URL';
        }
        
        // 检查当前用户是否是书签的所有者
        const isOwner = options.isOwner || false;
        
        return `
            <div class="bookmark-card" data-id="${bookmark.id}">
                <div class="bookmark-header">
                    <div>
                        <h3 class="bookmark-title">
                            <a href="${bookmark.url}" target="_blank" rel="noopener">
                                ${bookmark.title}
                            </a>
                        </h3>
                        <div class="bookmark-url">${urlHostname}</div>
                    </div>
                    ${options.showActions !== false ? `
                        <button class="favorite-btn ${isFavorited ? 'favorited' : ''}" 
                                onclick="window.bookmarkManager.handleFavorite('${bookmark.id}')">
                            ${isFavorited ? '❤️' : '🤍'}
                        </button>
                    ` : ''}
                </div>
                
                ${bookmark.description ? `
                    <p class="bookmark-description">${bookmark.description}</p>
                ` : ''}
                
                <div class="bookmark-meta">
                    <div>
                        ${bookmark.category ? `
                            <span class="bookmark-category">${bookmark.category}</span>
                        ` : ''}
                        ${tags ? `<span class="bookmark-tags">• ${tags}</span>` : ''}
                    </div>
                    <div class="bookmark-actions">
                        <span>by ${bookmark.profiles?.username || '未知用户'}</span>
                        ${isOwner ? `
                            <div style="display: flex; gap: 0.5rem;">
                                <button onclick="window.bookmarkManager.handleEdit('${bookmark.id}')" 
                                        class="btn btn-outline" style="font-size: 0.75rem;">
                                    编辑
                                </button>
                                <button onclick="window.bookmarkManager.handleDelete('${bookmark.id}')" 
                                        class="btn btn-outline" style="font-size: 0.75rem;">
                                    删除
                                </button>
                            </div>
                        ` : ''}
                        ${options.showDelete && !isOwner ? `
                            <button onclick="window.bookmarkManager.handleDelete('${bookmark.id}')" 
                                    class="btn btn-outline" style="margin-left: 0.5rem; font-size: 0.75rem;">
                                删除
                            </button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    // 处理收藏
    async handleFavorite(bookmarkId) {
        try {
            await this.toggleFavorite(bookmarkId);
            // 重新加载书签
            if (window.location.pathname.includes('profile.html')) {
                this.loadUserContent();
            } else {
                this.loadPublicBookmarks();
            }
        } catch (error) {
            alert(error.message);
        }
    }

    // 处理删除
    async handleDelete(bookmarkId) {
        if (confirm('确定要删除这个书签吗？')) {
            try {
                await this.deleteBookmark(bookmarkId);
                // 重新加载内容
                this.loadUserContent();
            } catch (error) {
                alert(error.message);
            }
        }
    }

    // 处理编辑
    async handleEdit(bookmarkId) {
        try {
            // 获取书签详情
            const { data: bookmark, error } = await supabase
                .from('bookmarks')
                .select('*')
                .eq('id', bookmarkId)
                .single();

            if (error) throw error;

            // 打开编辑模态框
            this.openEditModal(bookmark);
        } catch (error) {
            alert('获取书签详情失败: ' + error.message);
        }
    }

    // 打开编辑书签模态框
    openEditModal(bookmark) {
        // 创建或获取编辑模态框
        let modal = document.getElementById('edit-bookmark-modal');
        
        if (!modal) {
            // 创建编辑模态框
            modal = document.createElement('div');
            modal.id = 'edit-bookmark-modal';
            modal.className = 'modal hidden';
            modal.innerHTML = `
                <div class="modal-content">
                    <button class="close-btn">&times;</button>
                    <h2>编辑书签</h2>
                    <form id="edit-bookmark-form" class="bookmark-form">
                        <div class="form-group">
                            <label for="edit-bookmark-title">标题 *</label>
                            <input type="text" id="edit-bookmark-title" required>
                        </div>
                        
                        <div class="form-group">
                            <label for="edit-bookmark-url">网址 *</label>
                            <input type="url" id="edit-bookmark-url" required>
                        </div>
                        
                        <div class="form-group">
                            <label for="edit-bookmark-description">描述</label>
                            <textarea id="edit-bookmark-description" rows="3"></textarea>
                        </div>
                        
                        <div class="form-group">
                            <label for="edit-bookmark-category">分类</label>
                            <select id="edit-bookmark-category">
                                <option value="">选择分类</option>
                                <option value="technology">技术</option>
                                <option value="design">设计</option>
                                <option value="education">教育</option>
                                <option value="entertainment">娱乐</option>
                                <option value="business">商业</option>
                                <option value="news">新闻</option>
                                <option value="other">其他</option>
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label for="edit-bookmark-tags">标签（用逗号分隔）</label>
                            <input type="text" id="edit-bookmark-tags" placeholder="JavaScript, 教程, 前端">
                        </div>
                        
                        <div class="form-group checkbox-group">
                            <input type="checkbox" id="edit-bookmark-public">
                            <label for="edit-bookmark-public">公开此书签</label>
                        </div>
                        
                        <button type="submit" class="btn btn-primary">保存更改</button>
                    </form>
                </div>
            `;
            document.body.appendChild(modal);

            // 设置事件监听器
            this.setupEditModalEvents();
        }

        // 填充表单数据
        document.getElementById('edit-bookmark-title').value = bookmark.title || '';
        document.getElementById('edit-bookmark-url').value = bookmark.url || '';
        document.getElementById('edit-bookmark-description').value = bookmark.description || '';
        document.getElementById('edit-bookmark-category').value = bookmark.category || '';
        document.getElementById('edit-bookmark-tags').value = bookmark.tags ? bookmark.tags.join(', ') : '';
        document.getElementById('edit-bookmark-public').checked = bookmark.is_public || false;

        // 存储当前编辑的书签ID
        modal.dataset.bookmarkId = bookmark.id;

        // 显示模态框
        modal.classList.remove('hidden');
    }

    // 设置编辑模态框事件
    setupEditModalEvents() {
        const modal = document.getElementById('edit-bookmark-modal');
        const closeBtn = modal.querySelector('.close-btn');
        const form = document.getElementById('edit-bookmark-form');

        // 关闭按钮
        closeBtn.addEventListener('click', () => {
            modal.classList.add('hidden');
        });

        // 点击背景关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.add('hidden');
            }
        });

        // 表单提交
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const bookmarkId = modal.dataset.bookmarkId;
            const updates = {
                title: document.getElementById('edit-bookmark-title').value.trim(),
                url: document.getElementById('edit-bookmark-url').value.trim(),
                description: document.getElementById('edit-bookmark-description').value.trim(),
                category: document.getElementById('edit-bookmark-category').value,
                is_public: document.getElementById('edit-bookmark-public').checked,
                updated_at: new Date().toISOString()
            };

            // 处理标签
            const tagsInput = document.getElementById('edit-bookmark-tags').value;
            if (tagsInput) {
                updates.tags = tagsInput.split(',').map(tag => tag.trim()).filter(tag => tag);
            }

            try {
                await this.updateBookmark(bookmarkId, updates);
                modal.classList.add('hidden');
                alert('书签更新成功！');
                
                // 重新加载内容
                if (window.location.pathname.includes('profile.html')) {
                    this.loadUserContent();
                } else {
                    this.loadPublicBookmarks();
                }
            } catch (error) {
                alert('更新书签失败: ' + error.message);
            }
        });
    }

    // 过滤书签 - 修复搜索和筛选逻辑
    filterBookmarks(bookmarks, category, searchTerm) {
        console.log('过滤书签:', { category, searchTerm, bookmarksCount: bookmarks.length });
        
        // 如果没有搜索词和分类筛选，返回所有书签
        if ((!searchTerm || searchTerm.trim() === '') && category === 'all') {
            console.log('无搜索条件，返回所有书签');
            return bookmarks;
        }
        
        const filtered = bookmarks.filter(bookmark => {
            // 分类筛选
            const matchesCategory = category === 'all' || bookmark.category === category;
            
            // 搜索筛选 - 修复搜索逻辑
            let matchesSearch = true;
            if (searchTerm && searchTerm.trim() !== '') {
                const term = searchTerm.toLowerCase().trim();
                matchesSearch = 
                    (bookmark.title && bookmark.title.toLowerCase().includes(term)) ||
                    (bookmark.description && bookmark.description.toLowerCase().includes(term)) ||
                    (bookmark.tags && Array.isArray(bookmark.tags) && 
                     bookmark.tags.some(tag => tag && tag.toLowerCase().includes(term)));
            }
            
            return matchesCategory && matchesSearch;
        });
        
        console.log(`过滤结果: 从 ${bookmarks.length} 个书签中筛选出 ${filtered.length} 个`);
        return filtered;
    }

    // 加载公开书签
    async loadPublicBookmarks() {
        const container = document.getElementById('bookmarks-container');
        const loading = document.getElementById('loading');
        
        if (!container) {
            console.log('书签容器未找到，可能不在首页');
            return;
        }
        
        if (loading) loading.classList.remove('hidden');
        
        try {
            const bookmarks = await this.getPublicBookmarks();
            console.log('获取到的书签数量:', bookmarks.length);
            
            const filtered = this.filterBookmarks(bookmarks, this.currentCategory, this.searchTerm);
            console.log('过滤后的书签数量:', filtered.length);
            
            if (filtered.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <h3>没有找到书签</h3>
                        <p>${this.searchTerm || this.currentCategory !== 'all' ? '尝试调整搜索条件或分类筛选' : '成为第一个添加书签的人吧！'}</p>
                        <a href="add-bookmark.html" class="btn btn-primary">添加书签</a>
                    </div>
                `;
            } else {
                container.innerHTML = filtered.map(bookmark => 
                    this.renderBookmarkCard(bookmark)
                ).join('');
            }
        } catch (error) {
            console.error('加载书签错误:', error);
            container.innerHTML = `
                <div class="error-state">
                    <h3>加载失败</h3>
                    <p>${error.message}</p>
                    <button onclick="window.bookmarkManager.loadPublicBookmarks()" class="btn btn-outline">
                        重新加载
                    </button>
                </div>
            `;
        } finally {
            if (loading) loading.classList.add('hidden');
        }
    }

    // 加载用户内容
    async loadUserContent() {
        try {
            await this.waitForSupabase();
            const supabase = getSupabase();
            
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                console.log('用户未登录，无法加载用户内容');
                return;
            }

            const myBookmarksContainer = document.getElementById('my-bookmarks-container');
            const myFavoritesContainer = document.getElementById('my-favorites-container');

            console.log('加载用户内容，容器状态:', {
                bookmarksContainer: !!myBookmarksContainer,
                favoritesContainer: !!myFavoritesContainer
            });

            // 加载用户的书签
            if (myBookmarksContainer) {
                const userBookmarks = await this.getUserBookmarks(user.id);
                console.log('用户书签数量:', userBookmarks.length);
                
                if (userBookmarks.length === 0) {
                    myBookmarksContainer.innerHTML = '<div class="empty-state"><h3>暂无书签</h3><p>您还没有添加任何书签</p><a href="add-bookmark.html" class="btn btn-primary">添加书签</a></div>';
                } else {
                    myBookmarksContainer.innerHTML = userBookmarks.map(bookmark => 
                        this.renderBookmarkCard(bookmark, { 
                            showDelete: true, 
                            showActions: false,
                            isOwner: true  // 在个人中心显示的书签都是用户自己的
                        })
                    ).join('');
                }
            }

            // 加载用户的收藏
            if (myFavoritesContainer) {
                const userFavorites = await this.getUserFavorites(user.id);
                console.log('用户收藏数量:', userFavorites.length);
                
                if (userFavorites.length === 0) {
                    myFavoritesContainer.innerHTML = '<div class="empty-state"><h3>暂无收藏</h3><p>您还没有收藏任何书签</p></div>';
                } else {
                    myFavoritesContainer.innerHTML = userFavorites.map(bookmark => 
                        this.renderBookmarkCard(bookmark, { showActions: false })
                    ).join('');
                }
            }

            // 更新统计信息
            this.updateProfileStats(user.id);
        } catch (error) {
            console.error('加载用户内容错误:', error);
            
            // 显示错误信息
            const myBookmarksContainer = document.getElementById('my-bookmarks-container');
            const myFavoritesContainer = document.getElementById('my-favorites-container');
            
            if (myBookmarksContainer) {
                myBookmarksContainer.innerHTML = '<div class="error-state"><h3>加载失败</h3><p>无法加载书签数据</p><button onclick="window.bookmarkManager.loadUserContent()" class="btn btn-outline">重新加载</button></div>';
            }
            if (myFavoritesContainer) {
                myFavoritesContainer.innerHTML = '<div class="error-state"><h3>加载失败</h3><p>无法加载收藏数据</p><button onclick="window.bookmarkManager.loadUserContent()" class="btn btn-outline">重新加载</button></div>';
            }
        }
    }

    // 更新个人资料统计
    async updateProfileStats(userId) {
        const bookmarksCount = document.getElementById('bookmarks-count');
        const favoritesCount = document.getElementById('favorites-count');

        if (bookmarksCount || favoritesCount) {
            try {
                const [bookmarks, favorites] = await Promise.all([
                    this.getUserBookmarks(userId),
                    this.getUserFavorites(userId)
                ]);

                if (bookmarksCount) {
                    bookmarksCount.textContent = `${bookmarks.length} 书签`;
                }
                if (favoritesCount) {
                    favoritesCount.textContent = `${favorites.length} 收藏`;
                }
            } catch (error) {
                console.error('更新统计信息错误:', error);
            }
        }
    }
}

// 初始化书签管理器
window.bookmarkManager = new BookmarkManager();

// 设置搜索和筛选事件监听器
function setupSearchAndFilters() {
    console.log('设置搜索和筛选事件监听器...');
    
    // 搜索功能 - 修复搜索逻辑
    const searchInput = document.getElementById('search-input');
    const searchBtn = document.getElementById('search-btn');
    
    if (searchInput && searchBtn) {
        console.log('找到搜索元素，设置事件监听器');
        
        const performSearch = () => {
            const searchTerm = searchInput.value.trim();
            console.log('执行搜索:', searchTerm);
            
            if (window.bookmarkManager) {
                window.bookmarkManager.searchTerm = searchTerm;
                window.bookmarkManager.loadPublicBookmarks();
            } else {
                console.error('书签管理器未初始化');
            }
        };
        
        // 直接绑定事件，不克隆元素
        searchBtn.addEventListener('click', performSearch);
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                performSearch();
            }
        });
        
        // 添加输入变化监听，实时搜索或清除搜索
        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.trim();
            if (window.bookmarkManager) {
                window.bookmarkManager.searchTerm = searchTerm;
                // 添加防抖，避免频繁搜索
                clearTimeout(window.searchTimeout);
                window.searchTimeout = setTimeout(() => {
                    window.bookmarkManager.loadPublicBookmarks();
                }, 300);
            }
        });
        
        console.log('搜索功能设置完成');
    } else {
        console.log('搜索元素未找到，当前页面可能不需要搜索功能');
    }

    // 分类筛选功能 - 修复筛选逻辑
    const filterButtons = document.querySelectorAll('.filter-btn');
    
    if (filterButtons.length > 0) {
        console.log('找到筛选按钮:', filterButtons.length);
        
        filterButtons.forEach(button => {
            button.addEventListener('click', () => {
                console.log('点击筛选按钮:', button.getAttribute('data-category'));
                
                // 更新活跃状态
                filterButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                
                // 更新当前分类并重新加载
                const category = button.getAttribute('data-category');
                if (window.bookmarkManager) {
                    window.bookmarkManager.currentCategory = category;
                    window.bookmarkManager.loadPublicBookmarks();
                } else {
                    console.error('书签管理器未初始化');
                }
            });
        });
        
        console.log('分类筛选功能设置完成');
    } else {
        console.log('筛选按钮未找到，当前页面可能不需要筛选功能');
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM加载完成，初始化书签管理器...');
    
    // 立即设置搜索和筛选事件监听器
    if (window.location.pathname.endsWith('index.html') || window.location.pathname === '/') {
        console.log('在首页，立即设置搜索和筛选事件');
        setupSearchAndFilters();
    }
    
    // 等待Supabase初始化完成
    const waitForSupabase = () => {
        if (window.supabase) {
            console.log('Supabase已初始化，开始加载数据');
            
            // 如果是首页，加载书签
            if (window.location.pathname.endsWith('index.html') || window.location.pathname === '/') {
                console.log('在首页，加载书签数据');
                window.bookmarkManager.loadPublicBookmarks();
            }
            
            // 如果是个人中心页面，加载用户内容
            if (window.location.pathname.endsWith('profile.html')) {
                console.log('在个人中心页面，加载用户内容');
                window.bookmarkManager.loadUserContent();
            }
        } else {
            console.log('等待Supabase初始化...');
            setTimeout(waitForSupabase, 100);
        }
    };
    
    waitForSupabase();
});