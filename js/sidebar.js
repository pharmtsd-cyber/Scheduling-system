function renderSidebar() {
    const list = document.getElementById('deptList');
    list.innerHTML = '';
    appData.depts.forEach(d => {
        list.innerHTML += `
            <li class="cursor-pointer p-3 hover:bg-slate-700 transition" 
                onclick="selectDept('${d['部門名稱']}')">
                🏥 ${d['部門名稱']}
            </li>`;
    });
}

async function addDepartment() {
    const name = prompt("請輸入新部門名稱：");
    if(name) {
        const code = 'D' + new Date().getTime();
        await postAction({ action: 'add_department', deptCode: code, deptName: name });
        alert('新增成功，畫面將重新載入');
        location.reload();
    }
}
