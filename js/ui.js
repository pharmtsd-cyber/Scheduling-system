function hideAllViews() {
    document.getElementById('welcomeMsg').classList.add('hidden');
    document.getElementById('publicView').classList.add('hidden');
    document.getElementById('adminView').classList.add('hidden');
    document.getElementById('employeeAdminView').classList.add('hidden');
}

function renderSidebars() {
    const pubList = document.getElementById('publicDeptList');
    pubList.innerHTML = '';
    appData.depts.forEach(d => {
        pubList.innerHTML += `<li class="cursor-pointer p-2 hover:bg-slate-700 rounded transition mb-1" onclick="openPublicDept('${d['部門名稱']}')">📁 ${d['部門名稱']}</li>`;
    });
}
