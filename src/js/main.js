import { Calendar } from './components/calendar.js';
import { subscribeEvents, addEvent, updateEvent, deleteEvent, saveFcmToken, onForegroundMessage, db } from './services/firebase-config.js';
import { requestNotificationPermission, scheduleNotifications, startDailyScheduler } from './services/notification-service.js';

document.addEventListener('DOMContentLoaded', () => {

    // 전역 이벤트 데이터 (Firebase 실시간 동기화)
    let allEvents = {};
    let currentSelectedDateStr = new Date().toISOString().split('T')[0];
    let editingEventId = null; // 수정 중인 일정 ID (null이면 새 일정)

    // DOM 요소
    const eventsList = document.getElementById('eventsList');
    const selectedDateDisplay = document.getElementById('selectedDateDisplay');
    const fabAddEvent = document.getElementById('fabAddEvent');
    const eventModal = document.getElementById('eventModal');
    const btnCancelEvent = document.getElementById('btnCancelEvent');
    const eventForm = document.getElementById('eventForm');
    const modalTitle = document.getElementById('modalTitle');

    // 날짜 선택 시 하단 일정 목록 렌더링
    const handleDateSelect = (dateStr, dateObj) => {
        currentSelectedDateStr = dateStr;

        // 요일 구하기
        const weekDays = ['일', '월', '화', '수', '목', '금', '토'];
        const dayName = weekDays[dateObj.getDay()];

        // 포맷: 2월 25일 (수)
        selectedDateDisplay.textContent = `${dateObj.getMonth() + 1}월 ${dateObj.getDate()}일 (${dayName})`;

        renderEventsList(dateStr);
    };

    // 일정 목록 렌더링 (분리)
    const renderEventsList = (dateStr) => {
        eventsList.innerHTML = '';
        const dayEvents = allEvents[dateStr] || [];

        if (dayEvents.length === 0) {
            eventsList.innerHTML = '<li class="empty-state">선택한 날짜의 일정이 없습니다.</li>';
            return;
        }

        // 시간순 정렬
        dayEvents.sort((a, b) => a.time.localeCompare(b.time));

        dayEvents.forEach(evt => {
            const li = document.createElement('li');
            li.className = `event-item ${evt.assignee}`;

            const badgeText = evt.assignee === 'both' ? '가족' :
                evt.assignee === 'husband' ? '남편' : '아내';

            li.innerHTML = `
         <div class="event-indicator"></div>
         <div class="event-time">${evt.time}</div>
         <div class="event-details">
           <div class="event-title">${evt.title}</div>
           ${evt.memo ? `<div class="event-memo">${evt.memo}</div>` : ''}
         </div>
         <span class="event-badge">${badgeText}</span>
       `;

            // 일정 클릭 시 수정/삭제 옵션
            li.addEventListener('click', () => openEditModal(evt));

            eventsList.appendChild(li);
        });
    };

    // 초기에 달력 인스턴스 생성
    const calendar = new Calendar('calendarGrid', handleDateSelect);

    // === Firebase 실시간 구독 ===
    subscribeEvents((eventsMap) => {
        allEvents = eventsMap;
        calendar.setEvents(allEvents);
        // 현재 선택된 날짜의 목록도 새로고침
        renderEventsList(currentSelectedDateStr);
        // 알림 스케줄 갱신
        scheduleNotifications(eventsMap);
    });

    // 첫 화면은 오늘 날짜 선택한 상태
    handleDateSelect(currentSelectedDateStr, new Date());

    // === 알림 권한 요청 ===
    initNotifications();

    // === 설정 모달 ===
    const settingsModal = document.getElementById('settingsModal');
    const settingsBtn = document.getElementById('settingsBtn');

    // 저장된 설정 불러오기
    const savedSettings = JSON.parse(localStorage.getItem('calendarSettings') || '{}');

    settingsBtn.addEventListener('click', () => {
        // 현재 설정값 UI에 반영
        const role = savedSettings.role || 'husband';
        const mode = savedSettings.notifMode || 'sound';
        const notifSound = savedSettings.notifSound || 'default';
        document.querySelector(`input[name="userRole"][value="${role}"]`).checked = true;
        document.querySelector(`input[name="notifMode"][value="${mode}"]`).checked = true;
        document.getElementById('notifSound').value = notifSound;

        const soundWrapper = document.getElementById('soundSelectWrapper');
        if (soundWrapper) soundWrapper.style.display = mode === 'sound' ? 'block' : 'none';

        document.getElementById('filterMine').checked = savedSettings.filterMine !== false;
        document.getElementById('filterFamily').checked = savedSettings.filterFamily !== false;
        document.getElementById('filterPartner').checked = savedSettings.filterPartner || false;

        settingsModal.classList.add('show');
    });

    document.getElementById('btnCancelSettings').addEventListener('click', () => {
        settingsModal.classList.remove('show');
    });

    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) settingsModal.classList.remove('show');
    });

    document.getElementsByName('notifMode').forEach(radio => {
        radio.addEventListener('change', (e) => {
            const wrapper = document.getElementById('soundSelectWrapper');
            if (wrapper) {
                wrapper.style.display = e.target.value === 'sound' ? 'block' : 'none';
            }
        });
    });

    document.getElementById('btnSaveSettings').addEventListener('click', async () => {
        const role = document.querySelector('input[name="userRole"]:checked')?.value || 'husband';
        const notifMode = document.querySelector('input[name="notifMode"]:checked')?.value || 'sound';
        const notifSound = document.getElementById('notifSound')?.value || 'default';
        const filterMine = document.getElementById('filterMine').checked;
        const filterFamily = document.getElementById('filterFamily').checked;
        const filterPartner = document.getElementById('filterPartner').checked;

        const settings = { role, notifMode, notifSound, filterMine, filterFamily, filterPartner };
        localStorage.setItem('calendarSettings', JSON.stringify(settings));
        Object.assign(savedSettings, settings);

        // Firebase에도 설정 저장 (Cloud Functions가 참조)
        try {
            const { set: dbSet, ref: dbRef } = await import('firebase/database');
            const deviceId = localStorage.getItem('deviceId') || crypto.randomUUID();
            localStorage.setItem('deviceId', deviceId);
            await dbSet(dbRef(db, `deviceSettings/${deviceId}`), {
                ...settings,
                updatedAt: new Date().toISOString()
            });
        } catch (err) {
            console.error('설정 저장 실패:', err);
        }

        settingsModal.classList.remove('show');
        alert('✅ 설정이 저장되었습니다!');
    });

    // === 모달 제어 ===
    const openModal = () => {
        editingEventId = null;
        modalTitle.textContent = '일정 추가';
        eventForm.reset();

        // 삭제 버튼 숨기기
        const deleteBtn = document.getElementById('btnDeleteEvent');
        if (deleteBtn) deleteBtn.style.display = 'none';

        // 선택된 날짜를 기본값으로
        document.getElementById('eventDate').value = currentSelectedDateStr;
        eventModal.classList.add('show');
    };

    const openEditModal = (evt) => {
        editingEventId = evt.id;
        modalTitle.textContent = '일정 수정';

        // 폼에 기존 값 채우기
        document.getElementById('eventTitle').value = evt.title;
        document.getElementById('eventDate').value = evt.date;
        document.getElementById('eventTime').value = evt.time;
        document.getElementById('eventMemo').value = evt.memo || '';

        // 담당자 라디오 선택
        const assigneeRadios = document.querySelectorAll('input[name="assignee"]');
        assigneeRadios.forEach(radio => {
            radio.checked = radio.value === evt.assignee;
        });

        // 알림 체크박스 설정
        const alertCheckboxes = document.querySelectorAll('input[name="alerts"]');
        alertCheckboxes.forEach(cb => {
            cb.checked = evt.alerts && evt.alerts.includes(parseInt(cb.value));
        });

        // 삭제 버튼 표시
        let deleteBtn = document.getElementById('btnDeleteEvent');
        if (!deleteBtn) {
            deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.id = 'btnDeleteEvent';
            deleteBtn.className = 'btn btn-danger';
            deleteBtn.textContent = '삭제';
            document.querySelector('.modal-actions').appendChild(deleteBtn);
        }
        deleteBtn.style.display = 'block';
        deleteBtn.onclick = () => handleDelete();

        eventModal.classList.add('show');
    };

    const closeModal = () => {
        eventModal.classList.remove('show');
        eventForm.reset();
        editingEventId = null;
    };

    fabAddEvent.addEventListener('click', openModal);
    btnCancelEvent.addEventListener('click', closeModal);

    // 모달 바깥 배경 클릭 시 닫기
    eventModal.addEventListener('click', (e) => {
        if (e.target === eventModal) closeModal();
    });

    // === 일정 저장 (추가 / 수정) ===
    eventForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const title = document.getElementById('eventTitle').value.trim();
        const date = document.getElementById('eventDate').value;
        const time = document.getElementById('eventTime').value;
        const assignee = document.querySelector('input[name="assignee"]:checked').value;
        const memo = document.getElementById('eventMemo').value.trim();

        // 알림 값 수집
        const alertCheckboxes = document.querySelectorAll('input[name="alerts"]:checked');
        const alerts = Array.from(alertCheckboxes).map(cb => parseInt(cb.value));

        const eventData = { title, date, time, assignee, memo, alerts };

        try {
            if (editingEventId) {
                // 수정
                await updateEvent(editingEventId, eventData);
            } else {
                // 새로 추가
                await addEvent(eventData);
            }
            closeModal();
        } catch (err) {
            console.error('저장 실패:', err);
            alert('저장에 실패했습니다. 인터넷 연결을 확인해주세요.');
        }
    });

    // === 일정 삭제 ===
    const handleDelete = async () => {
        if (!editingEventId) return;
        if (!confirm('이 일정을 삭제하시겠습니까?')) return;

        try {
            await deleteEvent(editingEventId);
            closeModal();
        } catch (err) {
            console.error('삭제 실패:', err);
            alert('삭제에 실패했습니다.');
        }
    };

    // === 알림 초기화 ===
    async function initNotifications() {
        // Capacitor 네이티브 앱인지 확인
        const isNative = window.Capacitor && window.Capacitor.isNativePlatform();

        if (isNative) {
            // 네이티브 앱: Capacitor Push Notifications 사용
            try {
                const { PushNotifications } = await import('@capacitor/push-notifications');

                // 권한 요청
                const permResult = await PushNotifications.requestPermissions();
                if (permResult.receive !== 'granted') {
                    console.log('알림 권한 거부됨');
                    return;
                }

                // FCM 토큰 등록
                await PushNotifications.register();

                // 토큰 수신 → Firebase DB에 저장
                PushNotifications.addListener('registration', async (token) => {
                    console.log('✅ FCM 네이티브 토큰:', token.value);
                    const { set, ref } = await import('firebase/database');
                    const { db } = await import('./services/firebase-config.js');
                    const deviceId = localStorage.getItem('deviceId') || crypto.randomUUID();
                    localStorage.setItem('deviceId', deviceId);
                    await set(ref(db, `fcmTokens/${token.value.substring(0, 20)}`), {
                        token: token.value,
                        deviceId: deviceId,
                        updatedAt: new Date().toISOString(),
                        platform: 'android'
                    });
                });

                PushNotifications.addListener('registrationError', (err) => {
                    console.error('FCM 등록 실패:', err);
                });

                // 포그라운드에서 알림 수신
                PushNotifications.addListener('pushNotificationReceived', (notification) => {
                    console.log('📩 포그라운드 알림:', notification);
                    // 포그라운드에서도 알림 표시 (네이티브는 자동 표시 안함)
                    alert(`🔔 ${notification.title}\n${notification.body || ''}`);
                });

                // 알림 클릭 시
                PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
                    console.log('알림 클릭:', action);
                });

                // 포그라운드 일정 알림도 동작하도록 스케줄러 시작
                startDailyScheduler(allEvents);

            } catch (err) {
                console.error('Capacitor Push 초기화 실패:', err);
            }
        } else {
            // 웹 브라우저: 기존 웹 알림 방식
            if (!('Notification' in window)) return;

            if (Notification.permission === 'granted') {
                startDailyScheduler(allEvents);
                saveFcmToken();
                setupForegroundHandler();
                return;
            }

            if (Notification.permission === 'denied') return;

            const banner = document.createElement('div');
            banner.className = 'notification-banner';
            banner.innerHTML = `
                <div class="notification-banner-content">
                    <span>🔔 일정 알림을 받으시겠습니까?</span>
                    <div class="notification-banner-actions">
                        <button id="btnAllowNotif" class="btn btn-primary btn-sm">허용</button>
                        <button id="btnDenyNotif" class="btn btn-secondary btn-sm">나중에</button>
                    </div>
                </div>
            `;
            document.getElementById('app').appendChild(banner);
            setTimeout(() => banner.classList.add('show'), 500);

            document.getElementById('btnAllowNotif').addEventListener('click', async () => {
                const granted = await requestNotificationPermission();
                banner.classList.remove('show');
                setTimeout(() => banner.remove(), 300);
                if (granted) {
                    startDailyScheduler(allEvents);
                    saveFcmToken();
                    setupForegroundHandler();
                }
            });

            document.getElementById('btnDenyNotif').addEventListener('click', () => {
                banner.classList.remove('show');
                setTimeout(() => banner.remove(), 300);
            });
        }
    }

    // === 포그라운드 FCM 메시지 수신 (웹 전용) ===
    function setupForegroundHandler() {
        onForegroundMessage((payload) => {
            const title = payload.notification?.title || '우리가족 캘린더';
            const body = payload.notification?.body || '';
            new Notification(title, {
                body,
                icon: '/pwa-192x192.png'
            });
        });
    }
});
