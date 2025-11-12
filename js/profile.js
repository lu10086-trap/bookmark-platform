// 个人中心页面特定功能
document.addEventListener('DOMContentLoaded', function() {
    console.log('Profile.js: DOM加载完成，初始化个人中心...');
    
    // 确保用户已登录
    supabase.auth.getUser().then(({ data: { user } }) => {
        if (!user) {
            console.log('用户未登录，重定向到首页');
            window.location.href = 'index.html';
            return;
        }
        
        console.log('用户已登录，初始化个人中心:', user.id);
        // 初始化个人中心
        initProfilePage(user.id);
    }).catch(error => {
        console.error('检查用户登录状态错误:', error);
        window.location.href = 'index.html';
    });
});

async function initProfilePage(userId) {
    console.log('初始化个人中心页面:', userId);
    
    try {
        // 加载用户资料
        await loadUserProfile(userId);
        
        // 加载用户的书签和收藏
        await window.bookmarkManager.loadUserContent();
        
        // 设置标签页切换
        setupProfileTabs();
        
        // 设置编辑资料功能
        setupEditProfile(userId);
        
        console.log('个人中心初始化完成');
    } catch (error) {
        console.error('初始化个人中心错误:', error);
    }
}

// 加载用户资料
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

function setupProfileTabs() {
    const tabs = document.querySelectorAll('.profile-tab');
    const panes = document.querySelectorAll('.tab-pane');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.getAttribute('data-tab');
            
            // 更新活跃标签
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // 显示对应内容
            panes.forEach(pane => {
                pane.classList.remove('active');
                if (pane.id === targetTab) {
                    pane.classList.add('active');
                }
            });
            
            // 重新加载对应标签的内容
            if (targetTab === 'my-bookmarks') {
                window.bookmarkManager.loadUserContent();
            } else if (targetTab === 'my-favorites') {
                window.bookmarkManager.loadUserContent();
            }
        });
    });
}

// 设置编辑资料功能
function setupEditProfile(userId) {
    console.log('设置编辑资料功能:', userId);
    
    const editBtn = document.getElementById('edit-profile-btn');
    const editModal = document.getElementById('edit-profile-modal');
    const editForm = document.getElementById('edit-profile-form');
    const closeBtn = document.querySelector('#edit-profile-modal .close');
    
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
    } else {
        // 如果没有找到close-btn类，尝试查找其他关闭按钮
        const fallbackCloseBtn = document.querySelector('#edit-profile-modal .close');
        if (fallbackCloseBtn && editModal) {
            fallbackCloseBtn.addEventListener('click', () => {
                editModal.classList.add('hidden');
            });
        }
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
                username: document.getElementById('edit-username').value.trim(),
                bio: document.getElementById('edit-bio').value.trim(),
                website: document.getElementById('edit-website').value.trim(),
                updated_at: new Date().toISOString()
            };
            
            // 验证用户名
            if (!updates.username || updates.username === '') {
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