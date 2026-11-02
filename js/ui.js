function showToast() {
    const toast = document.getElementById('statusToast');
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 2000);
}

function hideAllViews() {
    ['welcomeMsg', 'publicView', 'adminView', 'employeeAdminView', 'taskAdminView'].forEach(id => {
        document.getElementById(id).classList.add('hidden');
    });
}

function renderPublicSidebar() {
    const list = document.getElementById('publicDeptList');
    list.innerHTML = '';
    appData.depts.forEach(d => list.innerHTML += `<li class="cursor-pointer p-2 hover:bg-slate-700 rounded transition" onclick="openPublicDept('${d['部門名稱']}')">📁 ${d['部門名稱']}</li>`);
}
