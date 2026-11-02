function renderGantt() {
    const container = document.getElementById('timeline_chart');
    const chart = new google.visualization.Timeline(container);
    const dataTable = new google.visualization.DataTable();

    dataTable.addColumn({ type: 'string', id: '人員' });
    dataTable.addColumn({ type: 'string', id: '工作名稱' });
    dataTable.addColumn({ type: 'string', role: 'tooltip', p: { html: true } });
    dataTable.addColumn({ type: 'date', id: '開始時間' });
    dataTable.addColumn({ type: 'date', id: '結束時間' });

    const targetDate = document.getElementById('ganttDate').value;
    const shifts = appData.shifts.filter(s => s['部門名稱'] === currentDept && s['日期'] === targetDate);
    
    if(shifts.length === 0) {
        container.innerHTML = '<div class="text-slate-500 flex justify-center items-center h-full">該日無排班，請從左側面板新增</div>';
        return;
    }

    const rows = shifts.map(s => {
        const emp = appData.staff.find(e => e['員工編號'] === s['員工編號']);
        const name = emp ? emp['姓名'] : s['員工編號'];
        
        const [sh, sm] = s['開始時間'].split(':');
        const [eh, em] = s['結束時間'].split(':');
        
        const tooltip = `
            <div style="padding:10px; min-width:150px;">
                <b style="font-size:14px">${name}</b><hr class="my-1">
                工作：${s['工作名稱']}<br>
                時間：${s['開始時間']} - ${s['結束時間']}<br>
                類別：${s['工作類別']}<br>
                備註：${s['備註'] || '無'}
            </div>`;
            
        return [name, s['工作名稱'], tooltip, new Date(2026, 0, 1, sh, sm), new Date(2026, 0, 1, eh, em)];
    });

    dataTable.addRows(rows);
    
    // 點擊圖表上的區塊，可以直接將資料帶回左邊面板進行修改或備註
    google.visualization.events.addListener(chart, 'select', function() {
        const selection = chart.getSelection()[0];
        if (selection) {
            const shiftData = shifts[selection.row];
            document.getElementById('formEmp').value = shiftData['員工編號'];
            document.getElementById('formTask').value = shiftData['工作名稱'];
            document.getElementById('formStart').value = shiftData['開始時間'];
            document.getElementById('formEnd').value = shiftData['結束時間'];
            document.getElementById('formRemark').value = shiftData['備註'] || '';
            // 提醒使用者在左側進行調整
            document.getElementById('shiftForm').classList.add('ring-2', 'ring-blue-500', 'p-2');
            setTimeout(() => document.getElementById('shiftForm').classList.remove('ring-2', 'ring-blue-500', 'p-2'), 1000);
        }
    });

    chart.draw(dataTable, { timeline: { colorByRowLabel: true }, tooltip: { isHtml: true } });
}
