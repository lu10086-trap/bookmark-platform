// 应用主逻辑
document.addEventListener('DOMContentLoaded', function() {
    console.log('App.js: DOM加载完成，初始化应用...');
    
    // 初始化页面
    initPage();
    
    // 设置事件监听器
    setupEventListeners();
});

function initPage() {
    console.log('初始化页面...');
    
    // 根据当前页面初始化不同的功能
    const path = window.location.pathname;
    
    if (path.endsWith('index.html') || path === '/') {
        console.log('在首页，初始化书签功能');
        // 主页 - 加载公开书签
        if (window.bookmarkManager) {
            window.bookmarkManager.loadPublicBookmarks();
        } else {
            console.error('书签管理器未初始化');
        }
    } else if (path.endsWith('add-bookmark.html')) {
        console.log('在添加书签页面');
        // 添加书签页面 - 设置表单提交
        setupAddBookmarkForm();
    } else if (path.endsWith('profile.html')) {
        console.log('在个人中心页面');
        // 个人中心页面 - 加载用户内容
        loadProfilePage();
    }
}

function setupEventListeners() {
    console.log('设置事件监听器...');
    
    // 搜索功能 - 修复：确保正确绑定事件
    const searchInput = document.getElementById('search-input');
    const searchBtn = document.getElementById('search-btn');
    
    if (searchInput && searchBtn) {
        console.log('设置搜索事件监听器');
        
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
        
        // 移除可能存在的旧监听器，避免重复绑定
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
    } else {
        console.log('搜索元素未找到，当前页面可能不需要搜索功能');
    }

    // 分类筛选 - 修复：确保正确绑定事件
    const filterButtons = document.querySelectorAll('.filter-btn');
    
    if (filterButtons.length > 0) {
        console.log('设置分类筛选事件监听器:', filterButtons.length);
        
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
    } else {
        console.log('筛选按钮未找到，当前页面可能不需要筛选功能');
    }

    // 个人中心标签页
    const profileTabs = document.querySelectorAll('.profile-tab');
    if (profileTabs.length > 0) {
        console.log('设置个人中心标签页事件监听器');
        
        profileTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.getAttribute('data-tab');
                console.log('切换标签页:', tabName);
                
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
}

function setupAddBookmarkForm() {
    const form = document.getElementById('add-bookmark-form');
    
    if (form) {
        console.log('设置添加书签表单');
        
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log('提交书签表单');
            
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) {
                    alert('请先登录');
                    if (window.authManager) {
                        window.authManager.openAuthModal('login');
                    }
                    return;
                }
                
                const formData = {
                    title: document.getElementById('bookmark-title').value,
                    url: document.getElementById('bookmark-url').value,
                    description: document.getElementById('bookmark-description').value,
                    category: document.getElementById('bookmark-category').value,
                    is_public: document.getElementById('bookmark-public').checked
                };
                
                // 验证URL格式
                try {
                    new URL(formData.url);
                } catch (urlError) {
                    alert('请输入有效的URL地址');
                    return;
                }
                
                // 处理标签
                const tagsInput = document.getElementById('bookmark-tags').value;
                if (tagsInput) {
                    formData.tags = tagsInput.split(',').map(tag => tag.trim()).filter(tag => tag);
                }
                
                console.log('提交书签数据:', formData);
                
                if (window.bookmarkManager) {
                    await window.bookmarkManager.addBookmark(formData);
                    alert('书签添加成功！');
                    form.reset();
                    
                    // 可选：跳转到首页查看新添加的书签
                    // window.location.href = 'index.html';
                } else {
                    throw new Error('书签管理器未初始化');
                }
            } catch (error) {
                console.error('添加书签错误:', error);
                alert('添加书签失败: ' + error.message);
            }
        });
    }
}

function loadProfilePage() {
    console.log('加载个人中心页面');
    
    // 检查用户是否登录
    supabase.auth.getUser().then(({ data: { user } }) => {
        if (!user) {
            console.log('用户未登录，重定向到首页');
            // 未登录，重定向到首页
            window.location.href = 'index.html';
            return;
        }
        
        console.log('用户已登录，加载个人资料:', user.id);
        // 加载用户资料
        loadUserProfile(user.id);
        
        // 加载用户内容
        if (window.bookmarkManager) {
            window.bookmarkManager.loadUserContent();
        } else {
            console.error('书签管理器未初始化');
        }
        
        // 设置编辑资料功能 - 确保只设置一次
        setupEditProfile(user.id);
    }).catch(error => {
        console.error('检查用户登录状态错误:', error);
        window.location.href = 'index.html';
    });
}

async function loadUserProfile(userId) {
    try {
        console.log('加载用户资料:', userId);
        
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();
            
        if (error) throw error;
        
        console.log('用户资料数据:', data);
        
        // 更新UI
        const usernameEl = document.getElementById('profile-username');
        const bioEl = document.getElementById('profile-bio');
        const avatarEl = document.getElementById('user-avatar');
        
        if (usernameEl) {
            usernameEl.textContent = data.username || '用户';
            console.log('设置用户名:', data.username);
        }
        if (bioEl) {
            bioEl.textContent = data.bio || '这个人很懒，什么都没有写...';
        }
        if (avatarEl && data.avatar_url) {
            avatarEl.style.backgroundImage = `url(${data.avatar_url})`;
            avatarEl.textContent = '';
        } else if (avatarEl && data.username) {
            // 如果没有头像，显示用户名首字母
            avatarEl.textContent = data.username.charAt(0).toUpperCase();
            avatarEl.style.backgroundImage = '';
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
    console.log('设置编辑资料功能:', userId);
    
    const editBtn = document.getElementById('edit-profile-btn');
    const editModal = document.getElementById('edit-profile-modal');
    const editForm = document.getElementById('edit-profile-form');
    const closeBtn = document.querySelector('#edit-profile-modal .close-btn');
    
    if (editBtn && editModal) {
        editBtn.addEventListener('click', () => {
            console.log('打开编辑资料模态框');
            editModal.classList.remove('hidden');
        });
    }
    
    // 关闭模态框
    if (closeBtn && editModal) {
        closeBtn.addEventListener('click', () => {
            editModal.classList.add('hidden');
        });
    }
    
    // 点击模态框背景关闭
    if (editModal) {
        editModal.addEventListener('click', (e) => {
            if (e.target === editModal) {
                editModal.classList.add('hidden');
            }
        });
    }
    
    if (editForm) {
        editForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log('提交编辑资料表单');
            
            const updates = {
                username: document.getElementById('edit-username').value,
                bio: document.getElementById('edit-bio').value,
                website: document.getElementById('edit-website').value,
                updated_at: new Date().toISOString()
            };
            
            // 验证用户名
            if (!updates.username || updates.username.trim() === '') {
                alert('用户名不能为空');
                return;
            }
            
            try {
                const { error } = await supabase
                    .from('profiles')
                    .update(updates)
                    .eq('id', userId);
                    
                if (error) throw error;
                
                console.log('资料更新成功');
                // 关闭模态框并重新加载资料
                editModal.classList.add('hidden');
                loadUserProfile(userId);
                alert('资料更新成功！');
                
            } catch (error) {
                console.error('更新资料错误:', error);
                alert('更新资料失败: ' + error.message);
            }
        });
    }
}

// 添加全局错误处理
window.addEventListener('error', function(e) {
    console.error('全局错误:', e.error);
});

window.addEventListener('unhandledrejection', function(e) {
    console.error('未处理的Promise拒绝:', e.reason);
});

// 确保bookmarkManager可用
if (!window.bookmarkManager) {
    console.warn('bookmarkManager未定义，等待初始化...');
    // 可以在这里添加一个等待机制或创建默认管理器
}