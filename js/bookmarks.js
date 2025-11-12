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
        this.isSubmitting = false; // 添加防重复提交标志
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

            // 提取书签数据
            return data ? data.map(item => item.bookmarks) : [];
        } catch (error) {
            console.error('获取收藏错误:', error);
            return [];
        }
    }

    // 添加书签
    async addBookmark(bookmarkData) {
        // 防重复提交检查
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
            // 无论成功失败，都重置提交状态
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
        
        return `
            <div class="bookmark-card" data-id="${bookmark.id}">
                <div class="bookmark-header">
                    <div>
                        <h3 class="bookmark-title">
                            <a href="${bookmark.url}" target="_blank" rel="noopener">
                                ${bookmark.title}
                            </a>
                        </h3>
                        <div class="bookmark-url">${new URL(bookmark.url).hostname}</div>
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
                        ${tags ? `• ${tags}` : ''}
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

    // 过滤书签
    filterBookmarks(bookmarks, category, searchTerm) {
        return bookmarks.filter(bookmark => {
            const matchesCategory = category === 'all' || bookmark.category === category;
            const matchesSearch = !searchTerm || 
                bookmark.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                bookmark.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                bookmark.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
            
            return matchesCategory && matchesSearch;
        });
    }

    // 加载公开书签
    async loadPublicBookmarks() {
        const container = document.getElementById('bookmarks-container');
        const loading = document.getElementById('loading');
        
        if (loading) loading.classList.remove('hidden');
        
        try {
            const bookmarks = await this.getPublicBookmarks();
            const filtered = this.filterBookmarks(bookmarks, this.currentCategory, this.searchTerm);
            
            if (container) {
                if (filtered.length === 0) {
                    container.innerHTML = '<p class="no-results">没有找到书签</p>';
                } else {
                    container.innerHTML = filtered.map(bookmark => 
                        this.renderBookmarkCard(bookmark)
                    ).join('');
                }
            }
        } catch (error) {
            console.error('加载书签错误:', error);
            if (container) {
                container.innerHTML = '<p class="error">加载书签时出错</p>';
            }
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
            if (!user) return;

            const myBookmarksContainer = document.getElementById('my-bookmarks-container');
            const myFavoritesContainer = document.getElementById('my-favorites-container');

            // 加载用户的书签
            if (myBookmarksContainer) {
                const userBookmarks = await this.getUserBookmarks(user.id);
                myBookmarksContainer.innerHTML = userBookmarks.length === 0 ? 
                    '<p class="no-results">您还没有添加任何书签</p>' :
                    userBookmarks.map(bookmark => 
                        this.renderBookmarkCard(bookmark, { showDelete: true })
                    ).join('');
            }

            // 加载用户的收藏
            if (myFavoritesContainer) {
                const userFavorites = await this.getUserFavorites(user.id);
                myFavoritesContainer.innerHTML = userFavorites.length === 0 ? 
                    '<p class="no-results">您还没有收藏任何书签</p>' :
                    userFavorites.map(bookmark => 
                        this.renderBookmarkCard(bookmark)
                    ).join('');
            }

            // 更新统计信息
            this.updateProfileStats(user.id);
        } catch (error) {
            console.error('加载用户内容错误:', error);
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

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    // 如果是首页，加载书签
    if (window.location.pathname.endsWith('index.html') || window.location.pathname === '/') {
        window.bookmarkManager.loadPublicBookmarks();
    }
    
    // 设置搜索和筛选事件
    const searchInput = document.getElementById('search-input');
    const searchBtn = document.getElementById('search-btn');
    const filterButtons = document.querySelectorAll('.filter-btn');
    
    if (searchInput && searchBtn) {
        const performSearch = () => {
            window.bookmarkManager.searchTerm = searchInput.value.trim();
            window.bookmarkManager.loadPublicBookmarks();
        };
        
        searchBtn.addEventListener('click', performSearch);
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                performSearch();
            }
        });
    }

    // 分类筛选
    if (filterButtons.length > 0) {
        filterButtons.forEach(button => {
            button.addEventListener('click', () => {
                // 更新活跃状态
                filterButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                
                // 更新当前分类并重新加载
                window.bookmarkManager.currentCategory = button.getAttribute('data-category');
                window.bookmarkManager.loadPublicBookmarks();
            });
        });
    }
});