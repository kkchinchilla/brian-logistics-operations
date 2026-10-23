const driverName =
    document.querySelector('#driver-name');

const driverDateInput =
    document.querySelector('#driver-date');

const driverRuns =
    document.querySelector('#driver-runs');

const logoutButton =
    document.querySelector('#logout-button');


let currentUser = null;



const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g,
        ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));


function getLocalDate() {

    const now = new Date();

    const year =
        now.getFullYear();

    const month =
        String(now.getMonth() + 1)
            .padStart(2, '0');

    const day =
        String(now.getDate())
            .padStart(2, '0');

    return `${year}-${month}-${day}`;
}



async function initializeDriverPage() {

    const {
        data: { user },
        error
    } = await db.auth.getUser();


    if (error || !user) {

        window.location.href =
            'index.html';

        return;
    }


    currentUser = user;


    const {
        data: profile,
        error: profileError
    } = await db
        .from('profiles')
        .select(
            'display_name, role, active'
        )
        .eq('id', user.id)
        .single();


    if (
        profileError ||
        !profile ||
        !profile.active ||
        profile.role !== 'driver'
    ) {

        await db.auth.signOut();

        window.location.href =
            'index.html';

        return;
    }


    driverName.textContent =
        profile.display_name;


    driverDateInput.value =
        getLocalDate();


    await refreshDriverBoard();

}



async function loadDriverRuns() {

    driverRuns.innerHTML =
        '<p>載入中...</p>';


    const selectedDate =
        driverDateInput.value;


    const { data, error } =
        await db
            .from('runs')
            .select(`
                id,
                service_date,
                scheduled_time,
                temperature_zone_snapshot,
                route_name_snapshot,
                is_rental,
                status,
                driver_notes,
                dispatcher_notes,

                routes (
                    route_name
                ),

                vehicles (
                    plate_number,
                    label
                )
            `)
            .eq(
                'service_date',
                selectedDate
            )
            .order(
                'scheduled_time',
                { ascending: true }
            );


    if (error) {

        console.error(error);

        driverRuns.innerHTML =
            '<p>無法載入配送趟次。</p>';

        return;
    }


    if (!data.length) {

        driverRuns.innerHTML =
            '<p>此日期沒有指派給你的配送趟次。</p>';

        return;
    }


    driverRuns.innerHTML = '';


    data.forEach(run => {

        const card =
            createRunCard(run);

        driverRuns.appendChild(card);

    });

}



function createRunCard(run) {

    const card =
        document.createElement('article');

    card.className =
        'run-card';


    const scheduledTime =
        run.scheduled_time
            ? run.scheduled_time.slice(0, 5)
            : '—';


    const routeName =
        run.routes?.route_name
        || run.route_name_snapshot
        || '—';


    const vehicle =
        run.vehicles?.label
            ? `${run.vehicles.plate_number} — ${run.vehicles.label}`
            : run.vehicles?.plate_number || '—';


    card.innerHTML = `

        <div class="run-card-header">

            <div>

                <span class="run-time">
                    ${scheduledTime}
                </span>

                <h3>
                    ${escapeHtml(routeName)}
                </h3>

            </div>

            <span class="status-badge">
                ${formatStatus(run.status)}
            </span>

        </div>


        <div class="run-details">

            <p>
                <strong>車輛:</strong>
                ${escapeHtml(vehicle)}
            </p>
            <p><strong>溫層：</strong>${escapeHtml(run.temperature_zone_snapshot || '待設定')}</p>
            <p><strong>是否租車：</strong>${run.is_rental === true ? '租車' : run.is_rental === false ? '非租車' : '未確認'}</p>


            ${run.dispatcher_notes
            ? `
                        <p>
                            <strong>
                                調度備註:
                            </strong>

                            ${escapeHtml(run.dispatcher_notes)}
                        </p>
                    `
            : ''
        }

        </div>


        <div
            class="run-actions"
            id="actions-${run.id}"
        >
        </div>

    `;


    const actionArea =
        card.querySelector(
            `#actions-${run.id}`
        );


    renderActions(
        run,
        actionArea
    );


    return card;

}



function renderActions(
    run,
    container
) {

    container.innerHTML = '';


    if (run.status === 'assigned') {

        const startButton =
            document.createElement('button');

        startButton.textContent =
            '開始配送';

        startButton.addEventListener(
            'click',
            () => startRun(run.id)
        );

        container.appendChild(
            startButton
        );

    }


    if (run.status === 'in_progress') {

        const label =
            document.createElement('label');

        label.textContent =
            '司機備註';


        const textarea =
            document.createElement(
                'textarea'
            );

        textarea.rows = 3;

        textarea.placeholder =
            '如有特殊狀況可填寫備註...';

        textarea.value =
            run.driver_notes || '';


        const completeButton =
            document.createElement(
                'button'
            );

        completeButton.textContent =
            '完成配送';


        completeButton.addEventListener(
            'click',
            () => completeRun(
                run.id,
                textarea.value
            )
        );


        container.appendChild(label);

        container.appendChild(
            textarea
        );

        container.appendChild(
            completeButton
        );

    }


    if (run.status === 'completed') {

        const message =
            document.createElement('p');

        message.className =
            'completed-message';

        message.textContent =
            '此趟配送已完成。';

        container.appendChild(
            message
        );


        if (run.driver_notes) {

            const notes =
                document.createElement('p');

            notes.innerHTML = `
                <strong>
                    司機備註:
                </strong>

                ${escapeHtml(run.driver_notes)}
            `;

            container.appendChild(
                notes
            );

        }

    }


    if (run.status === 'cancelled') {

        const message =
            document.createElement('p');

        message.textContent =
            '此趟配送已取消。';

        container.appendChild(
            message
        );

    }

}



async function startRun(runId) {

    const confirmed =
        confirm(
            '確定要開始這趟配送嗎？'
        );


    if (!confirmed) {
        return;
    }


    const { error } =
        await db
            .from('runs')
            .update({

                status:
                    'in_progress'


            })
            .eq('id', runId);


    if (error) {

        console.error(error);

        alert(
            `無法開始配送: ${error.message}`
        );

        return;
    }


    await refreshDriverBoard();

}



async function completeRun(
    runId,
    notes
) {

    const confirmed =
        confirm(
            '確定要將這趟配送標記為完成嗎？'
        );


    if (!confirmed) {
        return;
    }


    const { error } =
        await db
            .from('runs')
            .update({

                status:
                    'completed',


                driver_notes:
                    notes.trim() || null

            })
            .eq('id', runId);


    if (error) {

        console.error(error);

        alert(
            `無法完成配送: ${error.message}`
        );

        return;
    }


    await refreshDriverBoard();

}



function formatStatus(status) {

    switch (status) {

        case 'assigned':
            return '已指派';

        case 'in_progress':
            return '配送中';

        case 'completed':
            return '已完成';

        case 'cancelled':
            return '已取消';

        default:
            return status;

    }

}



function formatDateTime(value) {

    const date =
        new Date(value);


    return date.toLocaleString(
        undefined,
        {
            hour: '2-digit',
            minute: '2-digit'
        }
    );

}



// v0.5.5 Increment 1.1: driver-facing special work is fetched through
// an authenticated, narrowly-scoped RPC. No direct table select/update.
const specialWorkList = document.querySelector('#driver-special-work');
const specialFeedback = document.querySelector('#driver-special-feedback');

function specialKindLabel(kind) {
    return ({
        attached_support: '主線附屬支援',
        breakdown_replacement: '故障接替',
        follow_along: '跟車'
    })[kind] || '特殊勤務';
}

function specialReviewLabel(item) {
    if (item.review_status === 'confirmed') return '主管已確認';
    return item.submitted_at ? '已回報，待主管審核' : '已指派，待回報';
}

async function refreshDriverBoard() {
    await Promise.all([loadDriverRuns(), loadSpecialDriverWork()]);
}

async function loadSpecialDriverWork() {
    specialFeedback.textContent = '';
    specialWorkList.textContent = '載入中...';
    const {data, error} = await db.rpc('v055_my_special_assignments', {
        p_day: driverDateInput.value
    });
    if (error) {
        console.error(error);
        specialWorkList.textContent = '特殊勤務載入失敗，請確認 SQL 07 已安裝。';
        specialFeedback.textContent = `載入失敗：${error.message}`;
        return;
    }
    const tasks = Array.isArray(data) ? data : [];
    specialWorkList.replaceChildren();
    if (!tasks.length) {
        const none = document.createElement('p');
        none.textContent = '此日期沒有指派給你的特殊勤務。';
        specialWorkList.appendChild(none);
        return;
    }
    for (const work of tasks) specialWorkList.appendChild(createSpecialWorkCard(work));
}

function createSpecialWorkCard(work) {
    const card = document.createElement('article');
    card.className = 'run-card driver-special-card';
    const start = String(work.planned_start_time || '').slice(0, 5) || '—';
    const end = String(work.planned_end_time || '').slice(0, 5) || '—';
    const vehicle = work.plate_number
        ? `${work.plate_number}${work.vehicle_label ? ' — ' + work.vehicle_label : ''}`
        : '未指定';
    // Every database string is escaped before insertion as HTML.
    card.innerHTML = `
        <div class="run-card-header">
          <div><span class="run-time">${escapeHtml(start)}–${escapeHtml(end)}</span>
            <h3>${escapeHtml(specialKindLabel(work.kind))} · ${escapeHtml(work.route_name || '—')}</h3></div>
          <span class="status-badge">${escapeHtml(specialReviewLabel(work))}</span>
        </div>
        <div class="run-details">
          <p><strong>主線：</strong>${escapeHtml(work.route_name || '—')}</p>
          <p><strong>車輛：</strong>${escapeHtml(vehicle)}</p>
          <p><strong>溫層：</strong>${escapeHtml(work.temperature_zone || '未設定')}</p>
          ${work.support_reference ? `<p><strong>支援識別：</strong>${escapeHtml(work.support_reference)}</p>` : ''}
          <p><strong>主管說明：</strong>${escapeHtml(work.work_note || '—')}</p>
          ${work.submitted_at && work.submission_note ? `<p><strong>回報備註：</strong>${escapeHtml(work.submission_note)}</p>` : ''}
        </div>`;
    if (work.review_status === 'pending' && !work.submitted_at) {
        const actions = document.createElement('div');
        actions.className = 'run-actions';
        const label = document.createElement('label');
        label.textContent = '完成備註（選填）';
        const notes = document.createElement('textarea');
        notes.rows = 2;
        notes.maxLength = 2000;
        notes.placeholder = '例如：接替配送完成、跟車訓練結束、支援門市完成';
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = work.kind === 'breakdown_replacement' ? '回報接替配送完成' :
            work.kind === 'follow_along' ? '回報跟車完成' : '回報支援完成';
        button.addEventListener('click', async () => {
            if (!window.confirm(`確定回報「${specialKindLabel(work.kind)}」已完成嗎？`)) return;
            button.disabled = true;
            const {error} = await db.rpc('v055_submit_special_completion', {
                p_work_id: work.work_id, p_note: notes.value.trim()
            });
            if (error) {
                console.error(error);
                specialFeedback.textContent = `回報失敗：${error.message}`;
                button.disabled = false;
                return;
            }
            await refreshDriverBoard();
            specialFeedback.textContent = '已回報完成，等待主管核對。';
        });
        actions.append(label, notes, button);
        card.appendChild(actions);
    } else if (work.submitted_at) {
        const p = document.createElement('p');
        p.className = 'completed-message';
        p.textContent = work.review_status === 'confirmed'
            ? '已完成且經主管確認。'
            : '已回報完成，等待主管完成必要審核。';
        card.appendChild(p);
    }
    return card;
}

driverDateInput.addEventListener(
    'change',
    refreshDriverBoard
);

document.querySelector('#driver-special-refresh')
    .addEventListener('click', refreshDriverBoard);



logoutButton.addEventListener(
    'click',
    async () => {

        await db.auth.signOut();

        window.location.href =
            'index.html';

    }
);



initializeDriverPage();
