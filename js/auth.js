function login() {
    const id = document.getElementById('loginId').value.trim();
    const user = appData.staff.find(s => s['員工編號'] == id);
    if(user) {
        currentUser = user;
        sessionStorage.setItem('loggedInUser', id);
        document.getElementById('loginArea').classList.add('hidden');
        document.getElementById('userInfo').classList.remove('hidden');
        document.getElementById('userNameDisplay').innerText = user['姓名'];
        
        const auth = appData.auths.find(a => a['員工編號'] == id);
        if(auth && auth['可排班部門']) {
            allowedDepts = auth['可排班部門'].split(',');
            document.getElementById('adminMenu').classList.remove('hidden');
            
            const adminList = document.getElementById('adminDeptList');
            adminList.innerHTML = '';
            appData.depts.forEach(d => {
                if(allowedDepts.includes(d['部門名稱'])) {
                    adminList.innerHTML += `<li class="cursor-pointer p-2 hover:bg-slate-600 rounded text-blue-200 mb-1 font-bold" onclick="openAdminDept('${d['部門名稱']}')">📝 管理 ${d['部門名稱']}</li>`;
                }
            });
        }
    } else if(!sessionStorage.getItem('loggedInUser')) {
        alert('查無此編號');
    }
}

function logout() {
    sessionStorage.removeItem('loggedInUser');
    location.reload();
}
