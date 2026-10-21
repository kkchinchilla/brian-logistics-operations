/* 配送趟次管理系統 — Actual-execution review, v0.2
 * This is a bridge to the full 月出勤報表 module, NOT payroll calculation.
 * All UI labels are Traditional Chinese, while code and database keys remain English.
 */
(() => {
    'use strict';

    const monthInput = document.querySelector('#report-month');
    const totalEl = document.querySelector('#total-completed-runs');
    const pendingEl = document.querySelector('#pending-review-count');
    const rejectedEl = document.querySelector('#rejected-review-count');
    const driverBody = document.querySelector('#driver-report-body');
    const vehicleBody = document.querySelector('#vehicle-report-body');
    const driverEmpty = document.querySelector('#driver-report-empty');
    const vehicleEmpty = document.querySelector('#vehicle-report-empty');
    const reviewBody = document.querySelector('#execution-review-body');
    const reviewEmpty = document.querySelector('#execution-review-empty');
    const exportButton = document.querySelector('#export-csv-button');
    let currentRows = [];
    let breakdownByRun = new Map();

    function monthRange(value) {
        if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value || '')) {
            throw new Error('請選擇正確的年月。');
        }
        const [year, month] = value.split('-').map(Number);
        const next = new Date(Date.UTC(year, month, 1));
        return {
            first: `${year}-${String(month).padStart(2, '0')}-01`,
            next: `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-01`
        };
    }

    const columns = `
        id, run_id, service_date, driver_id, vehicle_id, route_id,
        route_temperature_zone, route_start_time, route_end_time,
        route_code_snapshot, is_rental, driver_notes,
        review_status, review_note,
        driver:profiles!trip_executions_driver_id_fkey(display_name),
        vehicle:vehicles!trip_executions_vehicle_id_fkey(plate_number),
        route:routes!trip_executions_route_id_fkey(route_code,route_name),
        assignment:runs!trip_executions_run_id_fkey(status,scheduled_time,dispatcher_notes)
    `;

    // Supabase/PostgREST defaults to 1,000 rows. Fetch all pages for large months.
    async function fetchMonth() {
        const { first, next } = monthRange(monthInput.value);
        const limit = 500;
        const all = [];
        for (let from = 0; ; from += limit) {
            const { data, error } = await db.from('trip_executions')
                .select(columns)
                .gte('service_date', first)
                .lt('service_date', next)
                .order('id', { ascending: true })
                .range(from, from + limit - 1);
            if (error) throw error;
            all.push(...(data || []));
            if (!data || data.length < limit) break;
        }
        return all;
    }

    async function fetchBreakdownReplacements() {
        const { first, next } = monthRange(monthInput.value);
        const rows = [];
        const limit = 500;
        for (let from=0; ; from+=limit) {
            const { data, error } = await db.from('v055_run_work')
                .select('id,run_id,driver_id,vehicle_id,replacement_payee,review_status')
                .eq('kind','breakdown_replacement')
                .neq('review_status','rejected')
                .gte('service_date',first).lt('service_date',next)
                .order('id',{ascending:true}).range(from,from+limit-1);
            if (error) throw error;
            rows.push(...(data||[]));
            if (!data || data.length<limit) break;
        }
        return new Map(rows.map(w=>[w.run_id,w]));
    }

    function makeCell(row, value) {
        const td = document.createElement('td');
        td.textContent = value === null || value === undefined || value === '' ? '—' : String(value);
        row.appendChild(td);
        return td;
    }

    function safeName(person, fallback) {
        return person?.display_name || fallback;
    }

    function dateTime(value) {
        if (!value) return '—';
        const date = new Date(value);
        if (Number.isNaN(date.valueOf())) return '—';
        return new Intl.DateTimeFormat('zh-TW', {
            timeZone: 'Asia/Taipei',
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', hour12: false
        }).format(date);
    }

    function renderTotals(body, empty, rows, key, label, fallback) {
        body.replaceChildren();
        const groups = new Map();
        for (const item of rows) {
            const id = item[`${key}_id`];
            if (!groups.has(id)) groups.set(id, { name: item[key]?.[label] || fallback, count: 0 });
            groups.get(id).count += 1;
        }
        const sorted = [...groups.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-TW'));
        empty.textContent = sorted.length ? '' : '本月尚無經確認的配送趟次。';
        for (const entry of sorted) {
            const tr = document.createElement('tr');
            makeCell(tr, entry.name);
            makeCell(tr, entry.count);
            body.appendChild(tr);
        }
    }

    function renderReview(rows) {
        reviewBody.replaceChildren();
        const needsReview = rows.filter(r => r.review_status === 'pending');
        reviewEmpty.textContent = needsReview.length ? '' : '本月目前沒有待審核的實際趟次。';

        for (const item of needsReview) {
            const tr = document.createElement('tr');
            makeCell(tr, item.service_date);
            makeCell(tr, item.route_code_snapshot || item.route?.route_code || '未知路線');
            makeCell(tr, item.route_temperature_zone || '待設定');
            makeCell(tr, safeName(item.driver, '未知司機'));
            makeCell(tr, item.vehicle?.plate_number || '未知車輛');
            makeCell(tr, item.is_rental === true ? '租車' : item.is_rental === false ? '非租車' : '未確認');
            const replacement=breakdownByRun.get(item.run_id);
            const mismatch=replacement && (
                item.driver_id!==replacement.driver_id ||
                Number(item.vehicle_id)!==Number(replacement.vehicle_id));
            makeCell(tr, replacement
                ? `故障接替（${replacement.replacement_payee==='both'?'C：雙方計酬待對帳':'B：僅接替司機計酬待對帳'}）${item.driver_notes?'；'+item.driver_notes:''}`
                : item.driver_notes || '—');
            const actions = document.createElement('td');
            actions.className = 'review-actions';
            const canConfirm = item.assignment?.status === 'completed' && !mismatch;
            if (!canConfirm) {
                const warning = document.createElement('span');
                warning.className = 'review-warning';
                warning.textContent = mismatch ? '接替歸屬尚未校正，請至特殊勤務管理' : '資料不完整／狀態異常';
                actions.appendChild(warning);
            }
            const yes = document.createElement('button');
            yes.type = 'button';
            yes.textContent = '確認';
            yes.className = 'review-confirm';
            yes.disabled = !canConfirm;
            yes.addEventListener('click', () => reviewExecution(item, 'confirmed'));
            const no = document.createElement('button');
            no.type = 'button';
            no.textContent = '退回';
            no.className = 'review-reject';
            no.addEventListener('click', () => reviewExecution(item, 'rejected'));
            actions.append(yes, no);
            tr.appendChild(actions);
            reviewBody.appendChild(tr);
        }
    }

    async function loadMonthlyReport() {
        driverEmpty.textContent = '載入中...';
        vehicleEmpty.textContent = '載入中...';
        reviewEmpty.textContent = '載入中...';
        try {
            const [data, replacements] = await Promise.all([fetchMonth(),fetchBreakdownReplacements()]);
            breakdownByRun = replacements;
            currentRows = data;
            const approved = data.filter(r => r.review_status === 'confirmed' && r.assignment?.status === 'completed');
            const pending = data.filter(r => r.review_status === 'pending');
            totalEl.textContent = approved.length;
            pendingEl.textContent = pending.length;
            rejectedEl.textContent = data.filter(r => r.review_status === 'rejected').length;
            renderTotals(driverBody, driverEmpty, approved, 'driver', 'display_name', '未知司機');
            renderTotals(vehicleBody, vehicleEmpty, approved, 'vehicle', 'plate_number', '未知車輛');
            renderReview(data);
        } catch (error) {
            console.error(error);
            driverEmpty.textContent = '無法載入已確認趟次。請先執行資料庫更新。';
            vehicleEmpty.textContent = '無法載入已確認趟次。';
            reviewEmpty.textContent = '無法載入待審核紀錄。';
            totalEl.textContent = '—';
            pendingEl.textContent = '—';
            rejectedEl.textContent = '—';
        }
    }

    async function reviewExecution(item, status) {
        let note = null;
        if (status === 'rejected') {
            const raw = window.prompt(`請輸入退回原因（趟次 #${item.run_id}，必填）：`);
            if (raw === null) return;
            note = raw.trim();
            if (!note) { window.alert('退回時必須填寫原因。'); return; }
        } else if (!window.confirm(`確認 ${safeName(item.driver, '此司機')} 在 ${item.service_date} 完成的趟次嗎？`)) {
            return;
        }
        try {
            // The database permits only dispatchers to perform review.
            const { data, error } = await db.from('trip_executions')
                .update({ review_status: status, review_note: note })
                .eq('id', item.id)
                .eq('review_status', 'pending')
                .select('id');
            if (error) throw error;
            if (!data || data.length !== 1) throw new Error('此筆資料已經被其他人修改，請重新整理。');
            await loadMonthlyReport();
        } catch (error) {
            console.error(error);
            window.alert(`審核失敗：${error.message}`);
        }
    }

    function csvCell(input) {
        let text = String(input ?? '');
        // Defuse spreadsheet formulas in user-provided free text/identifiers.
        if (/^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
        return `"${text.replace(/"/g, '""')}"`;
    }

    function downloadCsv(content, filename) {
        const blob = new Blob(['\uFEFF', content], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    async function exportMonthlyCsv() {
        exportButton.disabled = true;
        exportButton.textContent = '匯出中...';
        try {
            // Fetch again instead of relying on cached data that may be stale.
            const data = await fetchMonth();
            const approved = data.filter(r => r.review_status === 'confirmed' && r.assignment?.status === 'completed');
            if (!approved.length) {
                window.alert('本月沒有已確認的實際配送趟次。');
                return;
            }
            const headers = ['配送日期','預定出發時間','司機','車牌號碼','路線代碼','路線名稱',
                '溫層','路線固定開始時間','路線固定結束時間','是否租車',
                '審核狀態','司機備註','調度備註','來源趟次 ID'];
            const rows = approved.map(item => [
                item.service_date,
                item.assignment?.scheduled_time?.slice(0,5) || '',
                item.driver?.display_name || '',
                item.vehicle?.plate_number || '',
                item.route_code_snapshot || item.route?.route_code || '',
                item.route?.route_name || '',
                item.route_temperature_zone || '',
                item.route_start_time?.slice(0, 5) || '',
                item.route_end_time?.slice(0, 5) || '',
                item.is_rental === true ? '租車' : item.is_rental === false ? '非租車' : '未確認',
                '已確認',
                item.driver_notes || '',
                item.assignment?.dispatcher_notes || '',
                item.run_id
            ]);
            const csv = [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n');
            downloadCsv(csv, `實際趟次已確認清單-${monthInput.value}.csv`);
        } catch (error) {
            console.error(error);
            window.alert(`無法匯出已確認趟次：${error.message}`);
        } finally {
            exportButton.disabled = false;
            exportButton.textContent = '匯出已確認 CSV';
        }
    }

    window.attendanceModule = { loadMonthlyReport, exportMonthlyCsv, monthRange };
})();
