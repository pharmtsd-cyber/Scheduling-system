function renderScheduleForm() {
    const empSel = document.getElementById('formEmp');
    const taskSel = document.getElementById('formTask');
    
    empSel.innerHTML = '<option value="">--選擇人員--</option>';
    appData.staff.forEach(s => {
        empSel.innerHTML += `<option value="${s['員工編號']}">${s['姓名']} (${s['員工編號']})</option>`;
    });
    
    taskSel.innerHTML = '<option value="">--選擇工作--</option>';
    // 只顯示該部門的工作，或通用工作
    appData.tasks.filter(t => t['部門名稱'] === currentDept || !t['部門名稱']).forEach(t => {
        taskSel.innerHTML += `<option value="${t['工作名稱']}">${t['工作名稱']}</option>`;
    });
}

async function saveShift() {
    const shiftId = 'S' + new Date().getTime(); // 產生排班唯一碼
    const data = [
        shiftId,
        document.getElementById('formDate').value,
        currentDept,
        document.getElementById('formEmp').value,
        document.getElementById('formTask').value,
        document.getElementById('formStart').value,
        document.getElementById('formEnd').value,
        document.getElementById('formCategory').value,
        document.getElementById('formRemark').value
    ];
    
    if(!data[1] || !data[3] || !data[4] || !data[5] || !data[6]) {
        return alert("請完整填寫日期、人員、工作與時間！");
    }

    await postAction({ action: 'save_shift', data: data });
    alert('排班寫入成功！');
    location.reload(); 
}
