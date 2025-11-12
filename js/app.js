// 应用主逻辑
document.addEventListener('DOMContentLoaded', function() {
    // 初始化页面
    initPage();
    
    // 设置事件监听器
    setupEventListeners();
});

function initPage() {
    // 根据当前页面初始化不同的功能
    const path = window.location.pathname;
    
    if (path.endsWith('index.html') || path === '/') {
        // 主页 - 加载公开书签
        bookmarkManager.loadPublicBookmarks();
    } else if (path.endsWith('add-bookmark.html')) {
        // 添加书签页面 - 设置表单提交
        setupAddBookmarkForm();
    } else if (path.endsWith('profile.html')) {
        // 个人中心页面 - 加载用户内容
        loadProfilePage();
    }
}

function setupEventListeners() {
    // 搜索功能
    const searchInput = document.getElementById('search-input');
    const searchBtn = document.getElementById('search-btn');
    
    if (searchInput && searchBtn) {
        const performSearch = () => {
            bookmarkManager.searchTerm = searchInput.value.trim();
            bookmarkManager.loadPublicBookmarks();
        };
        
        searchBtn.addEventListener('click', performSearch);
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                performSearch();
            }
        });
    }

    // 分类筛选
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            // 更新活跃状态
            filterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            // 更新当前分类并重新加载
            bookmarkManager.currentCategory = button.getAttribute('data-category');
            bookmarkManager.loadPublicBookmarks();
        });
    });

    // 个人中心标签页
    const profileTabs = document.querySelectorAll('.profile-tab');
    profileTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.getAttribute('data-tab');
            
            // 更新活跃标签
            profileTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // 显示对应内容
            const tabPanes = document.querySelectorAll('.tab-pane');
            tabPanes.forEach(pane => {
                pane.classList.remove('active');
                if (pane.id === tabName) {
                    pane.classList.add('active');
                }
            });
        });
    });
}

function setupAddBookmarkForm() {
    const form = document.getElementById('add-bookmark-form');
    
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                alert('请先登录');
                authManager.openAuthModal('login');
                return;
            }
            
            const formData = {
                title: document.getElementById('bookmark-title').value,
                url: document.getElementById('bookmark-url').value,
                description: document.getElementById('bookmark-description').value,
                category: document.getElementById('bookmark-category').value,
                is_public: document.getElementById('bookmark-public').checked
            };
            
            // 处理标签
            const tagsInput = document.getElementById('bookmark-tags').value;
            if (tagsInput) {
                formData.tags = tagsInput.split(',').map(tag => tag.trim()).filter(tag => tag);
            }
            
            try {
                await bookmarkManager.addBookmark(formData);
                alert('书签添加成功！');
                form.reset();
            } catch (error) {
                alert('添加书签失败: ' + error.message);
            }
        });
    }
}

function loadProfilePage() {
    // 检查用户是否登录
    supabase.auth.getUser().then(({ data: { user } }) => {
        if (!user) {
            // 未登录，重定向到首页
            window.location.href = 'index.html';
            return;
        }
        
        // 加载用户资料
        loadUserProfile(user.id);
        
        // 加载用户内容
        bookmarkManager.loadUserContent();
        
        // 设置编辑资料功能
        setupEditProfile(user.id);
    });
}

async function loadUserProfile(userId) {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();
            
        if (error) throw error;
        
        // 更新UI
        const usernameEl = document.getElementById('profile-username');
        const bioEl = document.getElementById('profile-bio');
        const avatarEl = document.getElementById('user-avatar');
        
        if (usernameEl) usernameEl.textContent = data.username || '用户';
        if (bioEl) bioEl.textContent = data.bio || '这个人很懒，什么都没有写...';
        if (avatarEl && data.avatar_url) {
            avatarEl.style.backgroundImage = `url(${data.avatar_url})`;
            avatarEl.textContent = '';
        }
        
        // 填充编辑表单
        const editUsername = document.getElementById('edit-username');
        const editBio = document.getElementById('edit-bio');
        const editWebsite = document.getElementById('edit-website');
        
        if (editUsername) editUsername.value = data.username || '';
        if (editBio) editBio.value = data.bio || '';
        if (editWebsite) editWebsite.value = data.website || '';
        
    } catch (error) {
        console.error('加载用户资料错误:', error);
    }
}

function setupEditProfile(userId) {
    const editBtn = document.getElementById('edit-profile-btn');
    const editModal = document.getElementById('edit-profile-modal');
    const editForm = document.getElementById('edit-profile-form');
    
    if (editBtn && editModal) {
        editBtn.addEventListener('click', () => {
            editModal.classList.remove('hidden');
        });
    }
    
    if (editForm) {
        editForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const updates = {
                username: document.getElementById('edit-username').value,
                bio: document.getElementById('edit-bio').value,
                website: document.getElementById('edit-website').value,
                updated_at: new Date().toISOString()
            };
            
            try {
                const { error } = await supabase
                    .from('profiles')
                    .update(updates)
                    .eq('id', userId);
                    
                if (error) throw error;
                
                // 关闭模态框并重新加载资料
                editModal.classList.add('hidden');
                loadUserProfile(userId);
                alert('资料更新成功！');
                
            } catch (error) {
                alert('更新资料失败: ' + error.message);
            }
        });
    }
}