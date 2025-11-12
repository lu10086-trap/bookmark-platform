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
                        ${options.showDelete ? `
                            <button onclick="window.bookmarkManager.handleDelete('${bookmark.id}')" 
                                    class="btn btn-outline" style="margin-left: 0.5rem;">
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

    // 过滤书签 - 修复搜索和筛选逻辑
    filterBookmarks(bookmarks, category, searchTerm) {
        console.log('过滤书签:', { category, searchTerm, bookmarksCount: bookmarks.length });
        
        return bookmarks.filter(bookmark => {
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
            
            console.log(`书签 "${bookmark.title}": 分类匹配=${matchesCategory}, 搜索匹配=${matchesSearch}`);
            return matchesCategory && matchesSearch;
        });
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
                        this.renderBookmarkCard(bookmark, { showDelete: true, showActions: false })
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
        
        // 移除可能存在的旧监听器
        searchBtn.replaceWith(searchBtn.cloneNode(true));
        searchInput.replaceWith(searchInput.cloneNode(true));
        
        // 重新获取元素引用
        const newSearchBtn = document.getElementById('search-btn');
        const newSearchInput = document.getElementById('search-input');
        
        newSearchBtn.addEventListener('click', performSearch);
        newSearchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                performSearch();
            }
        });
        
        // 添加输入变化监听，实时搜索或清除搜索
        newSearchInput.addEventListener('input', (e) => {
            if (e.target.value === '' && window.bookmarkManager) {
                window.bookmarkManager.searchTerm = '';
                window.bookmarkManager.loadPublicBookmarks();
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
        
        // 移除可能存在的旧监听器
        filterButtons.forEach(button => {
            button.replaceWith(button.cloneNode(true));
        });
        
        // 重新获取元素引用
        const newFilterButtons = document.querySelectorAll('.filter-btn');
        
        newFilterButtons.forEach(button => {
            button.addEventListener('click', () => {
                console.log('点击筛选按钮:', button.getAttribute('data-category'));
                
                // 更新活跃状态
                newFilterButtons.forEach(btn => btn.classList.remove('active'));
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
    
    // 等待Supabase初始化完成
    const waitForSupabase = () => {
        if (window.supabase) {
            // 如果是首页，加载书签并设置事件监听器
            if (window.location.pathname.endsWith('index.html') || window.location.pathname === '/') {
                console.log('在首页，初始化书签功能');
                window.bookmarkManager.loadPublicBookmarks();
                setupSearchAndFilters();
            }
            
            // 如果是个人中心页面，加载用户内容
            if (window.location.pathname.endsWith('profile.html')) {
                console.log('在个人中心页面，加载用户内容');
                window.bookmarkManager.loadUserContent();
            }
        } else {
            setTimeout(waitForSupabase, 100);
        }
    };
    
    waitForSupabase();
});