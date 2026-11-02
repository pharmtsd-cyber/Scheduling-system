function showTaskMaint() {
    hideAllViews(); document.getElementById('taskAdminView').classList.remove('hidden');
    const tbody = document.getElementById('taskTableBody');
    tbody.innerHTML = '';
    appData.tasks.filter(t => t['部門名稱'] === currentDept).forEach(t => {
        tbody.innerHTML += `<tr class="border-b"><td class="p-2">${t['工作名稱']}</td><td class="p-2">${t['預設類別']}</td>
        <td class="p-2"><button onclick="deleteTask('${t['工作名稱']}')" class="text-red-500 font-bold hover:underline">刪除</button></td></tr>`;
    });
}

async function addTask() {
    const name = prompt("輸入新工作名稱：");
    if(name) {
        await postAction({ action: 'add_task', taskName: name, category: '常規', dept: currentDept });
        showTaskMaint();
    }
}

async function deleteTask(name) {
    if(confirm(`刪除工作 [${name}]？`)) {
        await postAction({ action: 'delete_task', taskName: name, dept: currentDept });
        showTaskMaint();
    }
}

function showEmployeeMaint() {
    hideAllViews(); document.getElementById('employeeAdminView').classList.remove('hidden');
    const tbody = document.getElementById('empTableBody');
    tbody.innerHTML = '';
    appData.staff.forEach(emp => {
        tbody.innerHTML += `<tr class="border-b"><td class="p-2">${emp['員工編號']}</td><td class="p-2 font-bold">${emp['姓名']}</td><td class="p-2 text-blue-600">${emp['所屬組別'] || '無'}</td><td class="p-2"><button onclick="editEmployee('${emp['員工編號']}')" class="text-blue-600 font-bold underline">編輯</button></td></tr>`;
    });
}

async function editEmployee(empId) {
    const emp = appData.staff.find(e => e['員工編號'] == empId);
    const newGroup = prompt(`修改 ${emp['姓名']} 的組別：`, emp['所屬組別'] || '');
    if(newGroup !== null && newGroup !== emp['所屬組別']) {
        await postAction({ action: 'update_employee', empId, updateData: { '所屬組別': newGroup } });
        showEmployeeMaint();
    }
}
