// 个人中心页面特定功能
document.addEventListener('DOMContentLoaded', function() {
    // 确保用户已登录
    supabase.auth.getUser().then(({ data: { user } }) => {
        if (!user) {
            window.location.href = 'index.html';
            return;
        }
        
        // 初始化个人中心
        initProfilePage(user.id);
    });
});

async function initProfilePage(userId) {
    // 加载用户资料
    await loadUserProfile(userId);
    
    // 加载用户的书签和收藏
    await bookmarkManager.loadUserContent();
    
    // 设置标签页切换
    setupProfileTabs();
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
        });
    });
}