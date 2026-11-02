function showEmployeeMaint() {
    hideAllViews();
    document.getElementById('employeeAdminView').classList.remove('hidden');
    const tbody = document.getElementById('employeeTableBody');
    tbody.innerHTML = '';
    
    appData.staff.forEach(emp => {
        tbody.innerHTML += `
            <tr class="hover:bg-slate-50 border-b">
                <td class="py-2 px-4">${emp['員工編號']}</td>
                <td class="py-2 px-4 font-bold">${emp['姓名']}</td>
                <td class="py-2 px-4">${emp['所屬單位'] || ''}</td>
                <td class="py-2 px-4 text-blue-600 font-bold">${emp['所屬組別'] || '無'}</td>
                <td class="py-2 px-4 text-center">
                    <button onclick="editEmployee('${emp['員工編號']}')" class="bg-blue-50 text-blue-600 border px-3 py-1 rounded text-sm hover:bg-blue-600 hover:text-white">✏️ 編輯組別</button>
                </td>
            </tr>`;
    });
}

async function editEmployee(empId) {
    const emp = appData.staff.find(e => e['員工編號'] == empId);
    if(!emp) return;
    const newGroup = prompt(`修改 ${emp['姓名']} 的排班「所屬組別」\n\n目前：${emp['所屬組別'] || '無'}`, emp['所屬組別'] || '');
    if(newGroup !== null && newGroup !== emp['所屬組別']) {
        const res = await postAction({ action: 'update_employee', empId, updateData: { '所屬組別': newGroup } });
        if(res.status === 'success') {
            alert('名冊已更新！\n(註：主資料庫透過公式自動同步約需數十秒，請稍後重整確認)');
            location.reload();
        } else { alert('更新失敗'); }
    }
}
