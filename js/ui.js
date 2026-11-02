function showToast(msg = "已儲存") {
    const toast = document.getElementById('statusToast');
    toast.innerText = msg;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 2500);
}

function hideAllViews() {
    ['welcomeMsg', 'publicView', 'adminView', 'employeeAdminView', 'taskAdminView', 'holidayAdminView'].forEach(id => {
        document.getElementById(id).classList.add('hidden');
    });
}

function renderPublicSidebar() {
    const list = document.getElementById('publicDeptList');
    list.innerHTML = '';
    appData.depts.forEach(d => list.innerHTML += `<li class="cursor-pointer p-2 hover:bg-slate-700 rounded transition font-bold" onclick="openPublicDept('${d['部門名稱']}')">🏥 ${d['部門名稱']}</li>`);
}

function openHolidayAdmin() {
    hideAllViews();
    document.getElementById('holidayAdminView').classList.remove('hidden');
}
